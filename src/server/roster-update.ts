import { createHash } from "node:crypto";
import { assert, audit } from "./engine-v2";
import type { RosterTeam, State } from "./model";

const ids = (team: RosterTeam) => team.members.map(m => m.registration_number).sort();
const canonical = (roster: RosterTeam[]) => roster.map(t => ({
  number: t.number,
  members: [...t.members].sort((a, b) => a.registration_number.localeCompare(b.registration_number)),
})).sort((a, b) => a.number - b.number);

export function planRosterUpdate(state: State, incoming: RosterTeam[]) {
  const previous = state.roster || [];
  assert(previous.length, "Import the initial class and papers with class:import first.");
  const old = new Map(previous.map(t => [t.number, t]));
  const next = new Map(incoming.map(t => [t.number, t]));
  const changedTeams = [...new Set([...old.keys(), ...next.keys()])].filter(number =>
    JSON.stringify(old.has(number) ? ids(old.get(number)!) : null) !==
    JSON.stringify(next.has(number) ? ids(next.get(number)!) : null)).sort((a, b) => a - b);
  const oldStudents = new Map(previous.flatMap(t => t.members.map(m => [m.registration_number, t.number] as const)));
  const nextStudents = new Map(incoming.flatMap(t => t.members.map(m => [m.registration_number, t.number] as const)));
  const changed = JSON.stringify(canonical(previous)) !== JSON.stringify(canonical(incoming));
  return {
    changed,
    teams: incoming.length,
    students: nextStudents.size,
    changedTeams,
    addedStudents: [...nextStudents.keys()].filter(id => !oldStudents.has(id)).length,
    removedStudents: [...oldStudents.keys()].filter(id => !nextStudents.has(id)).length,
    movedStudents: [...nextStudents].filter(([id, number]) => oldStudents.has(id) && oldStudents.get(id) !== number).length,
    // Cleared registrations retain membership records and attempt history too.
    // A roster-only operation cannot safely reassign those historical records.
    blockedTeams: state.teams.filter(t => changedTeams.includes(t.number)).map(t => t.number).sort((a, b) => a - b),
  };
}

export function applyRosterUpdate(state: State, incoming: RosterTeam[], now: number) {
  const plan = planRosterUpdate(state, incoming);
  assert(!plan.blockedTeams.length,
    `Roster update blocked: teams ${plan.blockedTeams.join(", ")} have saved registrations. Their membership needs a separate migration preserving registration history; clearing the portal registration alone is insufficient.`);
  if (!plan.changed) return plan;
  const previous = new Map(state.roster!.map(t => [t.number, t]));
  assert(!state.control.released || incoming.every(t => previous.get(t.number)?.set),
    "Recall papers before adding unassigned team numbers, then release again to balance their paper assignments.");
  state.roster = incoming.map(t => ({ ...structuredClone(t), ...(previous.get(t.number)?.set ? { set: previous.get(t.number)!.set } : {}) }));
  state.control.version++;
  const fingerprint = createHash("sha256").update(JSON.stringify(canonical(incoming))).digest("hex");
  audit(state, "roster-import", "ROSTER_UPDATED", JSON.stringify({ ...plan, fingerprint }), now);
  return plan;
}

// These statements update only the authoritative roster and its lookup index.
// Accounts, registered teams, members, attempts and papers are never removed.
export function rosterStatements(previous: RosterTeam[], next: RosterTeam[]) {
  if (JSON.stringify(previous) === JSON.stringify(next)) return [];
  // Keep the payload structured so Postgres.js receives sql.json(payload), rather
  // than serializing an already-encoded JSON string into a JSON scalar.
  // Four bulk statements also avoid one network round trip per student.
  return [
    "insert into quiz_private.roster_teams(team_number,body) select (r->>'number')::integer,r from jsonb_array_elements($1::jsonb) r on conflict(team_number) do update set body=excluded.body",
    "insert into quiz_private.roster_students(registration,team_number) select m->>'registration_number',(r->>'number')::integer from jsonb_array_elements($1::jsonb) r cross join lateral jsonb_array_elements(r->'members') m on conflict(registration) do update set team_number=excluded.team_number",
    "delete from quiz_private.roster_students where registration not in (select m->>'registration_number' from jsonb_array_elements($1::jsonb) r cross join lateral jsonb_array_elements(r->'members') m)",
    "delete from quiz_private.roster_teams where team_number not in (select (r->>'number')::integer from jsonb_array_elements($1::jsonb) r)",
  ].map(text => ({ text, roster: next }));
}
