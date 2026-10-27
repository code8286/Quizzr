import { randomUUID } from "node:crypto";
import { assert } from "../src/server/engine";
import type { RosterTeam } from "../src/server/model";
import { rosterStatements } from "../src/server/roster-update";

type Row = Record<string, unknown>;
export type ClassSnapshot = Record<string, Row[]>;
export type ClassQuery = (sql: string, params?: unknown[]) => Promise<Row[]>;
const tables = ["control", "profiles", "teams", "members", "attempts", "papers", "roster_teams", "roster_students", "audit"];
export const CLASS_SNAPSHOT_SQL = `select jsonb_build_object(${tables.map(name => `'${name}',coalesce((select jsonb_agg(to_jsonb(r)) from quiz_private.${name} r),'[]'::jsonb)`).join(",")}) as snapshot`;
const canonical = (roster: RosterTeam[]) => JSON.stringify(roster.map(t => ({number:t.number,members:[...t.members].sort((a,b)=>a.registration_number.localeCompare(b.registration_number))})).sort((a,b)=>a.number-b.number));

// The caller must wrap this in one PostgreSQL transaction. No active data is
// removed until both the private file backup and database archive are saved.
export async function replaceClass(query: ClassQuery, incoming: RosterTeam[], label: string, backup: (archive: unknown, id: string) => Promise<void>) {
  await query("select id from quiz_private.control where id=1 for update");
  await query("select id from quiz_private.attempts order by id for update");
  const rows = await query(CLASS_SNAPSHOT_SQL), snapshot = rows[0]?.snapshot as ClassSnapshot;
  assert(snapshot?.control.length === 1, "The existing class database is not initialized.");
  const previous = snapshot.roster_teams.map(r => r.body as RosterTeam);
  if (canonical(previous) === canonical(incoming)) return {changed:false,teams:incoming.length,students:incoming.reduce((n,t)=>n+t.members.length,0)};
  const oldIds = new Set(previous.flatMap(t=>t.members.map(m=>m.registration_number)));
  assert(incoming.every(t=>t.members.every(m=>!oldIds.has(m.registration_number))), "This roster overlaps the existing class. Use the roster updater rather than replacing its registrations.");
  const adminIds = new Set(snapshot.profiles.filter(p=>p.role==="ADMIN").map(p=>p.registration));
  assert(incoming.every(t=>t.members.every(m=>!adminIds.has(m.registration_number))), "A student ID conflicts with an administrator account.");
  assert(incoming.length>0&&snapshot.papers.length===15, "Require a nonempty roster and the existing fifteen questions.");
  const id=randomUUID(),createdAt=new Date().toISOString();
  const archive={formatVersion:1,createdAt,label,snapshot};
  await backup(archive,id);
  // Cast through text to avoid double JSON encoding by PostgreSQL drivers.
  await query("insert into quiz_private.class_archives(id,created_at,label,body) values($1,$2,$3,$4::text::jsonb)",[id,createdAt,label,JSON.stringify(archive)]);
  await query("delete from quiz_private.attempts; delete from quiz_private.members; delete from quiz_private.teams; delete from quiz_private.profiles where role='LEADER'; delete from quiz_private.roster_students; delete from quiz_private.roster_teams; delete from quiz_private.audit;");
  for(const statement of rosterStatements([],incoming))
    await query(statement.text.replaceAll("$1::jsonb","$1::text::jsonb"),[JSON.stringify(statement.roster)]);
  await query("update quiz_private.control set body=body || jsonb_build_object('released',false,'closed',false,'practice',false,'version',(body->>'version')::integer+1),limits='{}'::jsonb where id=1");
  const details=JSON.stringify({archiveId:id,previousTeams:previous.length,newTeams:incoming.length,newStudents:incoming.reduce((n,t)=>n+t.members.length,0)});
  const event={id:randomUUID(),actor:"class-import",type:"CLASS_REPLACED",details,at:Date.now()};
  await query("insert into quiz_private.audit(id,created_at,body) values($1,$2,$3::text::jsonb)",[event.id,createdAt,JSON.stringify(event)]);
  return {changed:true,archiveId:id,archivedTeams:snapshot.teams.length,archivedAttempts:snapshot.attempts.length,teams:incoming.length,students:incoming.reduce((n,t)=>n+t.members.length,0),papersReleased:false};
}
