import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { newAttempt } from "../src/server/engine";
import { QUIZ_DURATION_MS } from "../src/contracts/timing";
let db:PGlite;const leader=randomUUID(),team=randomUUID();
beforeAll(async()=>{db=new PGlite();await db.exec("create role anon; create role authenticated;");await db.exec(await readFile("supabase/migrations/001_portal.sql","utf8"));await db.exec(await readFile("supabase/migrations/002_watchdog.sql","utf8"));await db.exec(await readFile("supabase/migrations/003_forty_minute_limit.sql","utf8"));await db.exec(await readFile("supabase/migrations/004_roster_and_unlimited_members.sql","utf8"));await db.exec(await readFile("supabase/migrations/005_module_start_and_portal_registration.sql","utf8"));},30000);
afterAll(async()=>{await db?.close();});
describe("PostgreSQL migration and access boundaries",()=>{
  it("refuses anonymous and authenticated access to the private schema",async()=>{
    for(const role of ["anon","authenticated"]){await db.exec(`set role ${role}`);await expect(db.query("select body from quiz_private.papers")).rejects.toThrow(/permission denied/);await db.exec("reset role");}
  });
  it("enforces unique registration numbers and positive team numbers",async()=>{
    await db.query("insert into quiz_private.profiles values($1,'MA001','LEADER','{}')",[leader]);
    await expect(db.query("insert into quiz_private.profiles values($1,'MA001','LEADER','{}')",[randomUUID()])).rejects.toThrow(/duplicate/);
    await expect(db.query("insert into quiz_private.teams values($1,0,$2,'{}')",[randomUUID(),leader])).rejects.toThrow(/check constraint/);
  });
  it("defers membership validation until the complete team transaction",async()=>{
    await db.exec("begin");await db.query("insert into quiz_private.teams values($1,1,$2,$3)",[team,leader,JSON.stringify({attemptId:"placeholder"})]);await db.query("insert into quiz_private.members values($1,'MA001',true,'Test Leader')",[team]);await db.exec("commit");
    await expect(db.query("insert into quiz_private.members values($1,'MA002',true,'Second Leader')",[team])).rejects.toThrow(/duplicate/);
  });
  it("allows more than five members while preventing duplicate student membership",async()=>{
    for(let i=2;i<=5;i++)await db.query("insert into quiz_private.members values($1,$2,false,'Test Member')",[team,`MA00${i}`]);
    await db.query("insert into quiz_private.members values($1,'MA006',false,'Sixth Member')",[team]);
    await expect(db.query("insert into quiz_private.members values($1,'MA001',false,'Duplicate Member')",[team])).rejects.toThrow(/duplicate/);
  });
  it("locks stale active attempts even when no browser sends a request",async()=>{
    const a=newAttempt(team);a.state="active";a.activeModule=1;a.sequence=[1,2,3,4,5];a.startedAt=Date.now()-20000;a.lastHeartbeat=Date.now()-20000;
    await db.query("update quiz_private.control set body=body || '{\"released\":true}'::jsonb where id=1");
    await db.query("update quiz_private.teams set body=$1 where id=$2",[JSON.stringify({attemptId:a.id}),team]);
    await db.query("insert into quiz_private.attempts values($1,$2,$3)",[a.id,team,JSON.stringify(a)]);
    await db.exec("select quiz_private.watchdog()");
    const r=await db.query<{body:{locked:boolean}}>("select body from quiz_private.attempts where id=$1",[a.id]);expect(r.rows[0].body.locked).toBe(true);
    const log=await db.query("select * from quiz_private.audit");expect(log.rows).toHaveLength(1);
    await db.exec("select quiz_private.watchdog()");expect((await db.query("select * from quiz_private.audit")).rows).toHaveLength(1);
  });
  it("finalizes an overdue paused/locked paper without browser requests or monitoring",async()=>{
    const a=newAttempt(team);a.set=3;a.state="paused";a.locked=true;a.lockReason="Focus review";a.startedAt=Date.now()-QUIZ_DURATION_MS;a.activeModule=1;a.sequence=[1,2,3,4,5];
    a.progress[0].solved=true;a.progress[0].marks=1.5;a.progress[0].deducted=.5;
    await db.query("update quiz_private.control set body=body || '{\"monitoring\":false,\"released\":false}'::jsonb where id=1");
    await db.query("update quiz_private.teams set body=$1 where id=$2",[JSON.stringify({attemptId:a.id}),team]);
    await db.query("insert into quiz_private.attempts values($1,$2,$3)",[a.id,team,JSON.stringify(a)]);
    await db.exec("select quiz_private.watchdog()");
    const saved=(await db.query<{body:typeof a}>("select body from quiz_private.attempts where id=$1",[a.id])).rows[0].body;
    expect(saved.state).toBe("completed");expect(saved.completionReason).toBe("time_limit");expect(saved.total).toBe(1.5);
    expect(saved.completedAt).toBe(a.startedAt+QUIZ_DURATION_MS);expect(saved.locked).toBe(false);expect(saved.lockReason).toBeUndefined();
    await db.exec("select quiz_private.watchdog()");
    expect((await db.query("select * from quiz_private.audit where body->>'type'='TIME_LIMIT_REACHED'")).rows).toHaveLength(1);
  });
  it("requires every imported ID but does not compare member names",async()=>{
    const uid=randomUUID(),tid=randomUUID();await db.query("insert into quiz_private.profiles values($1,'CSV001','LEADER','{}')",[uid]);
    await db.query("insert into quiz_private.roster_teams values(27,'{}')");
    await db.query("insert into quiz_private.roster_students values('CSV001',27),('CSV002',27)");
    await db.exec("begin");await db.query("insert into quiz_private.teams values($1,27,$2,'{}')",[tid,uid]);await db.query("insert into quiz_private.members values($1,'CSV001',true,'Not The CSV Name')",[tid]);await db.query("insert into quiz_private.members values($1,'CSV002',false,'Another Display Name')",[tid]);await db.exec("commit");
    await expect(db.query("insert into quiz_private.members values($1,'FOREIGNID',false,'Foreign Person')",[tid])).rejects.toThrow(/full imported roster/);
  });
  it("does not lock or expire an unselected module screen and repairs legacy timestamps",async()=>{
    const a=newAttempt(team);a.state="active";a.lastHeartbeat=Date.now()-100000;
    await db.query("update quiz_private.control set body=body || '{\"monitoring\":true,\"released\":true}'::jsonb where id=1");
    await db.query("update quiz_private.teams set body=$1 where id=$2",[JSON.stringify({attemptId:a.id}),team]);
    await db.query("insert into quiz_private.attempts values($1,$2,$3)",[a.id,team,JSON.stringify(a)]);
    await db.exec("select quiz_private.watchdog()");
    let saved=(await db.query<{body:typeof a}>("select body from quiz_private.attempts where id=$1",[a.id])).rows[0].body;
    expect(saved.locked).toBe(false);expect(saved.startedAt).toBeNull();expect(saved.state).toBe("active");
    a.startedAt=Date.now()-QUIZ_DURATION_MS*2;await db.query("update quiz_private.attempts set body=$1 where id=$2",[JSON.stringify(a),a.id]);await db.exec("select quiz_private.watchdog()");
    saved=(await db.query<{body:typeof a}>("select body from quiz_private.attempts where id=$1",[a.id])).rows[0].body;
    expect(saved.startedAt).toBeNull();expect(saved.state).toBe("active");expect(saved.locked).toBe(false);
  });
  it("reuses membership rows when a cleared registration returns with a new leader",async()=>{
    const row=(await db.query<{id:string}>("select id from quiz_private.teams where team_number=27")).rows[0],replacement=randomUUID();
    await db.query("insert into quiz_private.profiles values($1,'CSV002','LEADER','{}')",[replacement]);
    const archived=newAttempt(row.id);archived.state="closed";archived.total=2;
    await db.query("insert into quiz_private.attempts values($1,$2,$3)",[archived.id,row.id,JSON.stringify(archived)]);
    await db.query("update quiz_private.teams set body=$1 where id=$2",[JSON.stringify({registrationClearedAt:Date.now(),attemptId:archived.id}),row.id]);
    const before=(await db.query<{count:number}>("select count(*)::int as count from quiz_private.members where team_id=$1",[row.id])).rows[0].count;
    const fresh=newAttempt(row.id);
    await db.exec("begin");await db.query("update quiz_private.teams set leader_id=$1,body=$2 where id=$3",[replacement,JSON.stringify({attemptId:fresh.id,registrations:[{attemptId:archived.id}]}),row.id]);
    await db.query("update quiz_private.members set is_leader=false where team_id=$1",[row.id]);
    for(const [id,lead]of [["CSV001",false],["CSV002",true]])await db.query("insert into quiz_private.members(team_id,registration,is_leader,name) values($1,$2,$3,'Fresh Display Name') on conflict(registration) do update set is_leader=excluded.is_leader,name=excluded.name where quiz_private.members.team_id=excluded.team_id",[row.id,id,lead]);
    await db.query("insert into quiz_private.attempts values($1,$2,$3)",[fresh.id,row.id,JSON.stringify(fresh)]);await db.exec("commit");
    expect((await db.query<{count:number}>("select count(*)::int as count from quiz_private.members where team_id=$1",[row.id])).rows[0].count).toBe(before);
    expect((await db.query<{registration:string}>("select registration from quiz_private.members where team_id=$1 and is_leader",[row.id])).rows[0].registration).toBe("CSV002");
    expect((await db.query<{body:typeof archived}>("select body from quiz_private.attempts where id=$1",[archived.id])).rows[0].body.total).toBe(2);
  });
});
