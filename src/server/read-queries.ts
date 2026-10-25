import { emptyState, type Attempt, type RosterTeam, type State, type Team, type User } from "./model";

// One PostgreSQL statement has one MVCC snapshot. No FOR UPDATE, no writes and
// no seven sequential network trips for every status/SSE refresh.
export const READ_STATE_SQL = `select jsonb_build_object(
  'control', c.body, 'limits', '{}'::jsonb,
  'users', coalesce((select jsonb_agg(body) from quiz_private.profiles), '[]'::jsonb),
  'teams', coalesce((select jsonb_agg(body order by team_number) from quiz_private.teams), '[]'::jsonb),
  'attempts', coalesce((select jsonb_agg(body) from quiz_private.attempts), '[]'::jsonb),
  'papers', coalesce((select jsonb_agg(body) from quiz_private.papers), '[]'::jsonb),
  'roster', coalesce((select jsonb_agg(body order by team_number) from quiz_private.roster_teams), '[]'::jsonb),
  'audit', coalesce((select jsonb_agg(body order by created_at) from
    (select body,created_at from quiz_private.audit order by created_at desc limit 200) e), '[]'::jsonb)
) as state from quiz_private.control c where c.id=1`;

// Only the caller's current attempt is locked. The lateral subquery allows a
// valid account without a team to be distinguished from an invalid session.
export const HEARTBEAT_CONTEXT_SQL = `select c.body as control,p.body as profile,
  q.team,q.attempt,r.body as roster
from quiz_private.control c cross join quiz_private.profiles p
left join lateral (
  select t.body as team,a.body as attempt,t.team_number
  from quiz_private.teams t join quiz_private.attempts a on a.id=(t.body->>'attemptId')::uuid
  where t.leader_id=p.id and t.body->>'registrationClearedAt' is null
  for update of a
) q on true
left join quiz_private.roster_teams r on r.team_number=q.team_number
where c.id=1 and p.id=$1::uuid`;
export const HEARTBEAT_SAVE_SQL = `update quiz_private.attempts
set body=(body-array(select jsonb_array_elements_text($3::jsonb))) || $2::jsonb where id=$1::uuid`;

export function heartbeatPatch(before: Attempt, after: Attempt) {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof Attempt)[])
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes[key] = after[key];
  return { changes, removed: Object.keys(before).filter(key => !(key in after)) };
}

export interface HeartbeatContext {
  control: State["control"]; profile: User; team: Team | null;
  attempt: Attempt | null; roster: RosterTeam | null;
}
export function heartbeatState(row: HeartbeatContext | undefined): State {
  const state = emptyState();
  if (!row) return state;
  state.control = row.control; state.users = [row.profile];
  if (row.team) state.teams = [row.team];
  if (row.attempt) state.attempts = [row.attempt];
  if (row.roster) state.roster = [row.roster];
  return state;
}
