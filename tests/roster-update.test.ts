import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { applyRosterUpdate, planRosterUpdate, rosterStatements } from "../src/server/roster-update";
import { parseRosterCsv } from "../src/server/roster";
import { emptyState, type RosterTeam } from "../src/server/model";
import { newAttempt, registerTeam, signup } from "../src/server/engine";

const initial: RosterTeam[] = [
  { number: 1, set: 1, members: [{ registration_number: "AA01", name: "First Student" }] },
  { number: 8, set: 2, members: [{ registration_number: "AA08", name: "Eighth Student" }] },
  { number: 11, set: 3, members: [{ registration_number: "AA11", name: "Moving Student" }] },
];
const updated = parseRosterCsv(",NAME,Team No.\nAA01,First Student,1\nAA08,Eighth Student,8\nAA11,Moving Student,\nDEMO01,Demo One,11\nDEMO02,Demo Two,");
function fixture() { const state = emptyState(); state.roster = structuredClone(initial); state.control.released = true; return state; }

it("accepts the updated CSV's blank first heading while rejecting ambiguous layouts and bad IDs", () => {
  expect(updated.map(t => [t.number, t.members.length])).toEqual([[1, 1], [8, 2], [11, 2]]);
  for (const text of ["OTHER,NAME,Team No.\nAA01,Name,1", ",NAME,Team No.\ninvalid id,Name,1", ",NAME,Team No.\nAA01,Name,1,extra"])
    expect(() => parseRosterCsv(text)).toThrow();
});

it("previews moves/additions and preserves all assignments and an unrelated registered attempt", () => {
  const state = fixture(), identity = signup(state, { registration_id: "AA01", name: "Signup Name" }, 100);
  registerTeam(state, state.users.find(u => u.id === identity.id)!, { members: initial[0].members }, 101);
  const records = structuredClone({ users: state.users, teams: state.teams, attempts: state.attempts, papers: state.papers });
  expect(planRosterUpdate(state, updated)).toMatchObject({ changed: true, addedStudents: 2, movedStudents: 1, removedStudents: 0, changedTeams: [8, 11], blockedTeams: [] });
  const beforeVersion = state.control.version;
  applyRosterUpdate(state, updated, 102);
  expect(state.roster!.map(t => t.set)).toEqual([1, 2, 3]);
  expect({ users: state.users, teams: state.teams, attempts: state.attempts, papers: state.papers }).toEqual(records);
  expect(state.control.released).toBe(true); expect(state.control.version).toBe(beforeVersion + 1);
  expect(state.audit.at(-1)?.type).toBe("ROSTER_UPDATED");
  const saved = structuredClone(state); applyRosterUpdate(state, updated, 103); expect(state).toEqual(saved);
});

it.each([false, true])("blocks membership changes for saved teams, including cleared=%s, without mutating records", cleared => {
  const state = fixture();
  state.teams.push({ id: randomUUID(), number: 11, leaderId: randomUUID(), attemptId: "saved", members: [], ...(cleared ? { registrationClearedAt: 100 } : {}) });
  const before = structuredClone(state);
  expect(planRosterUpdate(state, updated).blockedTeams).toEqual([11]);
  expect(() => applyRosterUpdate(state, updated, 102)).toThrow("separate migration");
  expect(state).toEqual(before);
});

it("allows name edits and CSV row reordering without resetting registrations", () => {
  const state = fixture(); state.teams.push({ id: randomUUID(), number: 11, leaderId: randomUUID(), attemptId: "saved", members: [] });
  const names = structuredClone(initial).reverse(); names[0].members[0].name = "Updated CSV Name";
  expect(planRosterUpdate(state, names).blockedTeams).toEqual([]);
  applyRosterUpdate(state, names, 102); expect(state.roster!.find(t => t.number === 11)!.members[0].name).toBe("Updated CSV Name");
});

it("requires recall before introducing unassigned team numbers after paper release", () => {
  const state = fixture(), extra = [...updated, { number: 12, members: [{ registration_number: "AA12", name: "New Student" }] }];
  expect(() => applyRosterUpdate(state, extra, 102)).toThrow("Recall papers");
  state.control.released = false; applyRosterUpdate(state, extra, 102);
  expect(state.roster!.find(t => t.number === 12)!.set).toBeUndefined();
});

let db: PGlite;
beforeAll(async () => {
  db = new PGlite(); await db.exec("create role anon; create role authenticated;");
  for (const name of ["001_portal.sql", "002_watchdog.sql", "003_forty_minute_limit.sql", "004_roster_and_unlimited_members.sql", "005_module_start_and_portal_registration.sql", "006_sixty_second_heartbeat.sql", "007_concurrent_heartbeats.sql"])
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

it("persists moved IDs, removes stale lookup entries/team numbers and retains historical attempts", async () => {
  const leader = randomUUID(), team = randomUUID(), attempt = newAttempt(team); attempt.state = "closed";
  await db.query("insert into quiz_private.profiles values($1,'AA01','LEADER','{}')", [leader]);
  await db.exec("begin");
  await db.query("insert into quiz_private.teams values($1,1,$2,$3)", [team, leader, JSON.stringify({ attemptId: attempt.id })]);
  await db.query("insert into quiz_private.members values($1,'AA01',true,'First Student')", [team]);
  await db.query("insert into quiz_private.attempts values($1,$2,$3)", [attempt.id, team, JSON.stringify(attempt)]);
  await db.exec("commit");
  for (const statement of rosterStatements([], initial)) await db.query(statement.text, [JSON.stringify(statement.roster)]);
  await db.query("insert into quiz_private.roster_students values('STALE_ID',11)");
  await db.exec("begin");
  for (const statement of rosterStatements(initial, updated)) await db.query(statement.text, [JSON.stringify(statement.roster)]);
  await db.exec("commit");
  expect((await db.query<{ registration: string }>("select registration from quiz_private.roster_students where team_number=8 order by registration")).rows.map(r => r.registration)).toEqual(["AA08", "AA11"]);
  expect((await db.query("select * from quiz_private.roster_students where registration='STALE_ID'")).rows).toHaveLength(0);
  expect((await db.query<{ body: unknown }>("select body from quiz_private.attempts where id=$1", [attempt.id])).rows[0].body).toEqual(attempt);
  const smaller = updated.filter(t => t.number !== 11);
  for (const statement of rosterStatements(updated, smaller)) await db.query(statement.text, [JSON.stringify(statement.roster)]);
  expect((await db.query("select * from quiz_private.roster_teams where team_number=11")).rows).toHaveLength(0);
  expect((await db.query("select * from quiz_private.roster_students where team_number=11")).rows).toHaveLength(0);
  expect(rosterStatements(smaller, smaller)).toEqual([]);
});
