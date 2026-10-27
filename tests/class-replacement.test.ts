import { afterAll,afterEach,beforeAll,beforeEach,expect,it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { replaceClass,CLASS_SNAPSHOT_SQL,type ClassQuery } from "../scripts/class-replacement";
import { newAttempt } from "../src/server/engine";
import { practicePapers } from "../scripts/practice-papers";

let db:PGlite;const admin=randomUUID(),leader=randomUUID(),team=randomUUID();
const fresh=[{number:1,members:[{name:"New One",registration_number:"NEW001"}]},{number:2,members:[{name:"New Two",registration_number:"NEW002"}]}];
const query:ClassQuery=async(sql,params)=>(await db.query(sql,params)).rows as Record<string,unknown>[];
// The helper's cleanup batch uses the same multi-statement API as the real driver.
const run:ClassQuery=async(sql,params)=>{if(sql.startsWith("delete from quiz_private.attempts;")){await db.exec(sql);return [];}return query(sql,params);};
beforeAll(async()=>{
  db=new PGlite();await db.exec("create role anon;create role authenticated;");
  for(const name of (await readdir("supabase/migrations")).filter(n=>/^\d+.*\.sql$/.test(n)).sort())await db.exec(await readFile(`supabase/migrations/${name}`,"utf8"));
  await db.query("insert into quiz_private.profiles values($1,'ADMIN','ADMIN',$2)",[admin,JSON.stringify({id:admin,role:"ADMIN",sessionVersion:3,name:"Admin"})]);
  await db.query("insert into quiz_private.profiles values($1,'OLD001','LEADER',$2)",[leader,JSON.stringify({id:leader,role:"LEADER",sessionVersion:1,name:"Old Leader"})]);
  await db.query("insert into quiz_private.roster_teams values(1,$1)",[JSON.stringify({number:1,set:2,members:[{name:"Old Student",registration_number:"OLD001"}]})]);
  await db.exec("insert into quiz_private.roster_students values('OLD001',1)");
  const attempt=newAttempt(team);attempt.state="completed";attempt.total=2;attempt.progress[0].solved=true;attempt.progress[0].marks=2;
  await db.exec("begin");
  await db.query("insert into quiz_private.teams values($1,1,$2,$3)",[team,leader,JSON.stringify({id:team,number:1,leaderId:leader,attemptId:attempt.id,members:[{name:"Old Leader",registration_number:"OLD001",is_leader:true}]})]);
  await db.query("insert into quiz_private.members values($1,'OLD001',true,'Old Leader')",[team]);
  await db.query("insert into quiz_private.attempts values($1,$2,$3)",[attempt.id,team,JSON.stringify(attempt)]);await db.exec("commit");
  for(const p of practicePapers)await db.query("insert into quiz_private.papers values($1,$2,$3,$4,$5)",[p.id,p.set,p.module,p.version,JSON.stringify(p)]);
  await db.exec("update quiz_private.control set body=body || '{\"released\":true,\"closed\":true}'::jsonb");
},30000);
beforeEach(async()=>{await db.exec("begin");});afterEach(async()=>{await db.exec("rollback");});afterAll(async()=>{await db.close();});

it("archives all old records, keeps admin/papers, and opens a fresh unreleased class",async()=>{
  let backup:unknown;
  const before=(await query(CLASS_SNAPSHOT_SQL))[0].snapshot;
  const result=await replaceClass(run,fresh,"New class",async archive=>{backup=archive;});
  expect(result).toMatchObject({changed:true,archivedTeams:1,archivedAttempts:1,teams:2,students:2,papersReleased:false});
  const archived=(await db.query<{body:{snapshot:unknown}}>("select body from quiz_private.class_archives")).rows[0].body;
  expect(archived).toEqual(backup);expect(archived.snapshot).toEqual(before);
  const after=(await query(CLASS_SNAPSHOT_SQL))[0].snapshot as Record<string,Record<string,unknown>[]>;
  expect(after.teams).toEqual([]);expect(after.attempts).toEqual([]);expect(after.members).toEqual([]);
  expect(after.profiles).toHaveLength(1);expect(after.profiles[0].id).toBe(admin);
  expect(after.papers).toHaveLength(15);expect(after.roster_students).toHaveLength(2);
  expect(after.control[0].body).toMatchObject({released:false,closed:false,practice:false,heartbeatTimeout:60000});
  expect(after.roster_teams.every(t=>!(t.body as Record<string,unknown>).set)).toBe(true);
});
it("does nothing on a repeated import of the same class",async()=>{
  await replaceClass(run,fresh,"New class",async()=>{});
  const again=await replaceClass(run,fresh,"New class",async()=>{throw Error("Must not back up a no-op");});
  expect(again.changed).toBe(false);expect((await db.query("select id from quiz_private.class_archives")).rows).toHaveLength(1);
});
it("keeps the existing class if its private backup fails",async()=>{
  const before=(await query(CLASS_SNAPSHOT_SQL))[0];
  await expect(replaceClass(run,fresh,"New class",async()=>{throw Error("Backup failed");})).rejects.toThrow("Backup failed");
  expect((await query(CLASS_SNAPSHOT_SQL))[0]).toEqual(before);expect((await db.query("select id from quiz_private.class_archives")).rows).toHaveLength(0);
});
it("rolls archive and cleanup back together on an import failure",async()=>{
  const before=(await query(CLASS_SNAPSHOT_SQL))[0];await db.exec("savepoint replacement");
  const fail:ClassQuery=async(sql,params)=>{if(sql.startsWith("insert into quiz_private.roster_teams"))throw Error("Injected import failure");return run(sql,params);};
  await expect(replaceClass(fail,fresh,"New class",async()=>{})).rejects.toThrow("Injected");
  await db.exec("rollback to savepoint replacement");expect((await query(CLASS_SNAPSHOT_SQL))[0]).toEqual(before);expect((await db.query("select id from quiz_private.class_archives")).rows).toHaveLength(0);
});
it("blocks accidental overlap with the current cohort",async()=>{
  await expect(replaceClass(run,[{number:2,members:[{name:"Old Student",registration_number:"OLD001"}]}],"Wrong operation",async()=>{})).rejects.toThrow("overlaps");
});
it("does not expose archived personal records to browser roles",async()=>{
  for(const role of ["anon","authenticated"]){await db.exec("savepoint permissions");await db.exec(`set local role ${role}`);await expect(db.query("select body from quiz_private.class_archives")).rejects.toThrow(/permission denied/);await db.exec("rollback to savepoint permissions");}
});
