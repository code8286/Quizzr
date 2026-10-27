import { paperSchema } from "../src/server/engine";
import { verifyPassword } from "../src/server/security";
import type { State, Paper, User } from "../src/server/model";

export type DeploymentQuery = <Row extends Record<string, unknown>>(sql: string) => Promise<Row[]>;

export async function checkDeploymentDatabase(query: DeploymentQuery) {
  const tables = await query<{ tablename: string; rowsecurity: boolean }>(`
    select tablename, rowsecurity from pg_tables where schemaname='quiz_private'`);
  const required = ["control", "profiles", "teams", "members", "attempts", "papers", "audit", "roster_teams", "roster_students", "class_archives"];
  if (required.some(name => !tables.some(t => t.tablename === name && t.rowsecurity)))
    throw new Error("Apply all eight database migrations; every private table must have RLS enabled.");
  const permissions = await query<{ exposed: boolean }>(`
    select exists (
      select 1 from pg_tables t cross join (values ('anon'), ('authenticated')) r(role)
      where t.schemaname='quiz_private' and (
        has_schema_privilege(r.role, 'quiz_private', 'USAGE') or
        has_table_privilege(r.role, format('%I.%I', t.schemaname, t.tablename), 'SELECT,INSERT,UPDATE,DELETE')
      )
    ) as exposed`);
  if (permissions[0].exposed) throw new Error("Revoke browser-role access to the private database schema and tables.");
  const control = await query<{ body: State["control"] }>(`select body from quiz_private.control where id=1`);
  if (!control.length || control[0].body.practice !== false)
    throw new Error("Import the actual class and papers; practice mode cannot ship.");
  const papers = await query<{ body: Paper }>(`select body from quiz_private.papers`);
  if (!paperSchema.safeParse(papers.map(p => p.body)).success)
    throw new Error("Import and validate all 15 production questions before deployment.");
  const roster = await query<{ teams: number; students: number }>(`
    select (select count(*)::int from quiz_private.roster_teams) as teams,
           (select count(*)::int from quiz_private.roster_students) as students`);
  if (!roster[0].teams || !roster[0].students) throw new Error("Import the numbered class roster before deployment.");
  const admins = await query<{ body: User }>(`select body from quiz_private.profiles where role='ADMIN'`);
  if (!admins.length) throw new Error("Create a production administrator with npm run setup:admin.");
  for (const { body } of admins) {
    if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(body.passwordHash) ||
        ["PracticeAdmin!2026", "TestAdmin!2026"].some(p => verifyPassword(p, body.passwordHash)))
      throw new Error("Replace every public practice/test administrator password before shipping.");
  }
  const watchdog = await query<{ definition: string }>(`
    select pg_get_functiondef(to_regprocedure('quiz_private.watchdog()')) as definition`);
  if (!["registrationClearedAt", "activeModule", "2400000", "60000", "if not found then continue"].every(token => watchdog[0]?.definition?.includes(token)))
    throw new Error("Apply migration 007 to install the watchdog compatible with concurrent heartbeats.");
  const cron = await query<{ installed: boolean }>(`select to_regclass('cron.job') is not null as installed`);
  if (!cron[0].installed) throw new Error("Enable pg_cron and schedule the watchdog every second (see docs/deployment.md).");
  const jobs = await query<{ schedule: string }>(`
    select schedule from cron.job
    where active and regexp_replace(lower(command), '[[:space:]]', '', 'g') in
      ('selectquiz_private.watchdog()', 'selectquiz_private.watchdog();')`);
  if (jobs.length !== 1 || jobs[0].schedule !== "1 second")
    throw new Error("Configure exactly one active watchdog job with the '1 second' schedule.");
}

