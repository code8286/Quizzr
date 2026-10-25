import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { emptyState, type Actor, type State } from "./model";
import { assertProductionConfig } from "./production";
import { rosterStatements } from "./roster-update";
import { HEARTBEAT_CONTEXT_SQL, HEARTBEAT_SAVE_SQL, READ_STATE_SQL, heartbeatState, heartbeatPatch, type HeartbeatContext } from "./read-queries";
import { heartbeatReply } from "./heartbeat";

export type Transaction = <T>(fn: (state: State) => T | Promise<T>,scope?:{leaderId:string}) => Promise<T>;
const dataDir = () => path.resolve(/* turbopackIgnore: true */ process.env.QUIZ_DATA_DIR || ".data");
let pool: ReturnType<typeof postgres> | undefined;
function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for PostgreSQL storage.");
  return pool ??= postgres(process.env.DATABASE_URL, { max: 3, prepare: false, idle_timeout: 20, connect_timeout: 10, ssl: process.env.PGSSL === "disable" ? false : "require" });
}
async function localTransaction<T>(fn: (state: State) => T | Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_PRODUCTION !== "true") throw new Error("Local storage is disabled in production. Configure PostgreSQL.");
  const dir=dataDir(), file=path.join(dir,"quiz.json"), lock=path.join(dir,"write.lock");
  await mkdir(dir,{recursive:true});
  let acquired=false;
  for(let i=0;i<200;i++) {
    try { await mkdir(lock);await writeFile(path.join(lock,"pid"),String(process.pid));acquired=true;break; }
    catch(e) {
      if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;
      try { const pid=Number(await readFile(path.join(lock,"pid"),"utf8")); try {process.kill(pid,0);} catch(err) {if((err as NodeJS.ErrnoException).code==="ESRCH") await rm(lock,{recursive:true,force:true});} } catch { /* Another process is acquiring the lock. */ }
      await new Promise(r=>setTimeout(r,25));
    }
  }
  if(!acquired)throw new Error("The local store is busy. Retry the request.");
  try {
    let state:State;
    try {state=JSON.parse(await readFile(file,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state=emptyState();}
    const before=JSON.stringify(state);const result=await fn(state);const after=JSON.stringify(state);
    if(before!==after){const tmp=path.join(dir,`quiz.${process.pid}.tmp`);await writeFile(tmp,after,{mode:0o600});await rename(tmp,file);}
    return result;
  } finally {await rm(lock,{recursive:true,force:true});}
}
async function postgresTransaction<T>(fn:(state:State)=>T|Promise<T>,scope?:{leaderId:string}):Promise<T> {
  const result=await database().begin(async sql=>{
    // One serialized classroom exam aggregate. All instances share this lock.
    const rows=await sql`select body, limits from quiz_private.control where id=1 for update`;
    if(!rows.length)throw new Error("Apply the database migration before starting the portal.");
    const users=await sql`select body from quiz_private.profiles`;
    const teams=await sql`select body from quiz_private.teams order by team_number`;
    // Writers take the same attempt-row locks as the lightweight heartbeat path.
    // Otherwise a full-state answer/admin write could overwrite a newer heartbeat
    // or focus lock. Read-only requests never enter this transaction.
    if(scope)await sql`select a.id from quiz_private.attempts a join quiz_private.teams t on t.body->>'attemptId'=a.id::text where t.leader_id=${scope.leaderId} order by a.id for update of a`;
    const attempts=scope?await sql`select body from quiz_private.attempts`:await sql`select body from quiz_private.attempts order by id for update`;
    const papers=await sql`select body from quiz_private.papers`;
    const roster=await sql`select body from quiz_private.roster_teams order by team_number`;
    const events=await sql`select body from (select body, created_at from quiz_private.audit order by created_at desc limit 200) e order by created_at`;
    const state:State={control:rows[0].body,limits:rows[0].limits,users:users.map(x=>x.body),teams:teams.map(x=>x.body),attempts:attempts.map(x=>x.body),papers:papers.map(x=>x.body),audit:events.map(x=>x.body),roster:roster.map(x=>x.body)};
    const previous=structuredClone(state);const output=await fn(state);
    if(scope){
      const ownTeams=new Set(state.teams.filter(t=>t.leaderId===scope.leaderId).map(t=>t.id));
      for(const attempt of state.attempts)
        if(JSON.stringify(previous.attempts.find(a=>a.id===attempt.id))!==JSON.stringify(attempt)&&!ownTeams.has(attempt.teamId))
          throw new Error("A scoped student transaction cannot change another team's attempt.");
    }
    const json=(v:unknown)=>sql.json(v as Parameters<typeof sql.json>[0]);
    if(JSON.stringify(previous.control)!==JSON.stringify(state.control)||JSON.stringify(previous.limits)!==JSON.stringify(state.limits))
      await sql`update quiz_private.control set body=${json(state.control)}, limits=${json(state.limits)} where id=1`;
    for(const statement of rosterStatements(previous.roster||[],state.roster||[]))
      await sql.unsafe(statement.text,[json(statement.roster)]);
    for(const u of state.users)if(JSON.stringify(previous.users.find(x=>x.id===u.id))!==JSON.stringify(u))
      await sql`insert into quiz_private.profiles (id,registration,role,body) values (${u.id},${u.registration},${u.role},${json(u)}) on conflict(id) do update set body=excluded.body,registration=excluded.registration,role=excluded.role`;
    for(const t of state.teams)if(JSON.stringify(previous.teams.find(x=>x.id===t.id))!==JSON.stringify(t)){
      await sql`insert into quiz_private.teams (id,team_number,leader_id,body) values (${t.id},${t.number},${t.leaderId},${json(t)}) on conflict(id) do update set body=excluded.body,leader_id=excluded.leader_id`;
      const previousTeam=previous.teams.find(x=>x.id===t.id);
      if(!previousTeam||JSON.stringify(previousTeam.members)!==JSON.stringify(t.members)){
        // Reuse the roster's existing membership rows. Clear flags first so swapping
        // leaders cannot violate the immediate one-leader unique index mid-update.
        await sql`update quiz_private.members set is_leader=false where team_id=${t.id}`;
        for(const m of t.members){
          const saved=await sql`insert into quiz_private.members(team_id,registration,is_leader,name) values (${t.id},${m.registration_number},${m.is_leader},${m.name}) on conflict(registration) do update set is_leader=excluded.is_leader,name=excluded.name where quiz_private.members.team_id=excluded.team_id returning registration`;
          if(saved.length!==1)throw new Error("A roster member is linked to another team.");
        }
      }
    }
    for(const a of state.attempts)if(JSON.stringify(previous.attempts.find(x=>x.id===a.id))!==JSON.stringify(a))
      await sql`insert into quiz_private.attempts(id,team_id,body) values (${a.id},${a.teamId},${json(a)}) on conflict(id) do update set body=excluded.body`;
    for(const p of state.papers)if(JSON.stringify(previous.papers.find(x=>x.id===p.id))!==JSON.stringify(p))
      await sql`insert into quiz_private.papers(id,set_id,module,version,body) values (${p.id},${p.set},${p.module},${p.version},${json(p)}) on conflict(id) do update set body=excluded.body,set_id=excluded.set_id,module=excluded.module,version=excluded.version`;
    for(const p of previous.papers)if(!state.papers.some(x=>x.id===p.id))await sql`delete from quiz_private.papers where id=${p.id}`;
    for(const e of state.audit)if(!previous.audit.some(x=>x.id===e.id))
      await sql`insert into quiz_private.audit(id,created_at,body) values (${e.id},${new Date(e.at)},${json(e)})`;
    return output;
  });
  return result as T;
}
export const transaction:Transaction=async (fn,scope)=>{
  assertProductionConfig();
  if(process.env.QUIZ_STORAGE==="postgres")return postgresTransaction(fn,scope);
  if(process.env.QUIZ_STORAGE==="local")return localTransaction(fn);
  throw new Error("Portal is not configured. Run npm run demo locally, or configure PostgreSQL.");
};

export const readSnapshot:Transaction=async fn=>{
  assertProductionConfig();
  if(process.env.QUIZ_STORAGE==="postgres"){
    const rows=await database().unsafe<{state:State}[]>(READ_STATE_SQL);
    if(!rows.length)throw new Error("Apply the database migration before starting the portal.");
    return fn(rows[0].state);
  }
  if(process.env.QUIZ_STORAGE==="local"){
    if(process.env.NODE_ENV==="production"&&process.env.ALLOW_LOCAL_PRODUCTION!=="true")throw new Error("Local storage is disabled in production. Configure PostgreSQL.");
    // The writer uses atomic rename, so readers see either complete version and
    // can safely avoid the local write lock too.
    let state:State;
    try{state=JSON.parse(await readFile(path.join(dataDir(),"quiz.json"),"utf8"));}
    catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state=emptyState();}
    return fn(state);
  }
  throw new Error("Portal is not configured. Run npm run demo locally, or configure PostgreSQL.");
};

export async function recordHeartbeat(actor:Actor,data:unknown){
  assertProductionConfig();
  if(process.env.QUIZ_STORAGE!=="postgres")return transaction(state=>heartbeatReply(state,actor,data,Date.now()));
  return database().begin(async sql=>{
    const rows=await sql.unsafe<HeartbeatContext[]>(HEARTBEAT_CONTEXT_SQL,[actor.id]);
    const state=heartbeatState(rows[0]),before=structuredClone(state.attempts[0]);
    const reply=heartbeatReply(state,actor,data,Date.now());
    const attempt=state.attempts[0],json=(v:unknown)=>sql.json(v as Parameters<typeof sql.json>[0]);
    if(attempt&&before&&JSON.stringify(attempt)!==JSON.stringify(before)){
      const patch=heartbeatPatch(before,attempt);
      await sql.unsafe(HEARTBEAT_SAVE_SQL,[attempt.id,json(patch.changes),json(patch.removed)]);
    }
    for(const event of state.audit)
      await sql`insert into quiz_private.audit(id,created_at,body) values(${event.id},${new Date(event.at)},${json(event)})`;
    return reply;
  });
}
export async function closeStore(){if(pool){await pool.end();pool=undefined;}}
