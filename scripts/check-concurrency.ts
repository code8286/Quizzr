// Optional real-PostgreSQL regression. All rows/functions live in a fresh private
// schema; the class schema and its attempts are never changed by this check.
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { newAttempt } from "../src/server/engine";
import { emptyState, type State } from "../src/server/model";
import { heartbeatReply } from "../src/server/heartbeat";
import { READ_STATE_SQL, HEARTBEAT_CONTEXT_SQL, HEARTBEAT_SAVE_SQL, heartbeatState, heartbeatPatch, type HeartbeatContext } from "../src/server/read-queries";

function signal() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--env-file") throw Error("Usage: npm run test:concurrency -- --env-file <private-postgres-env-file>");
  process.loadEnvFile(args[1]);
  if (!process.env.DATABASE_URL) throw Error("A private PostgreSQL DATABASE_URL is required.");
  const db = postgres(process.env.DATABASE_URL, { max: 6, prepare: false, ssl: "require", connect_timeout: 10, onnotice: () => {} });
  const schema = `quiz_perf_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^quiz_perf_test_[a-f0-9]{32}$/);
  const scoped = (query: string) => query.replaceAll("quiz_private", schema);
  const state = emptyState(); state.control.released = true;
  for (let i = 1; i <= 2; i++) {
    const user = { id: randomUUID(), registration: `TEST${i}`, name: `Synthetic ${i}`, role: "LEADER" as const, passwordHash: "", sessionVersion: 1, enrolled: true };
    const team = { id: randomUUID(), number: i, leaderId: user.id, members: [{ name: user.name, registration_number: user.registration, is_leader: true }], attemptId: "" };
    const attempt = newAttempt(team.id); attempt.state = "active"; attempt.activeModule = 1; attempt.sequence = [1, 2, 3, 4, 5];
    attempt.startedAt = Date.now(); attempt.lastHeartbeat = Date.now(); team.attemptId = attempt.id;
    state.users.push(user); state.teams.push(team); state.attempts.push(attempt);
    state.roster!.push({ number: i, members: [{ name: user.name, registration_number: user.registration }] });
  }
  const json = (value: unknown) => db.json(value as Parameters<typeof db.json>[0]);
  const actor = (i: number) => ({ id: state.users[i].id, version: 1, sid: `synthetic-session-${i}` });
  const payload = { focused: true, hidden: false, width: 1280, height: 720 };
  const readAttempt = async () => (await db.unsafe<{ body: State["attempts"][number] }[]>(scoped("select body from quiz_private.attempts where id=$1"), [state.attempts[0].id]))[0].body;
  try {
    for (const file of (await readdir("supabase/migrations")).filter(f => /^\d+.*\.sql$/.test(f)).sort()) {
      const migration = (await readFile(`supabase/migrations/${file}`, "utf8"))
        .replace(/^begin;[ \t]*\r?$/gim, "").replace(/^commit;[ \t]*\r?$/gim, "");
      await db.begin(tx => tx.unsafe(scoped(migration)));
    }
    await db.begin(async tx => {
      await tx.unsafe(scoped("update quiz_private.control set body=$1"), [json(state.control)]);
      for (const u of state.users) await tx.unsafe(scoped("insert into quiz_private.profiles values($1,$2,$3,$4)"), [u.id, u.registration, u.role, json(u)]);
      for (const r of state.roster!) {
        await tx.unsafe(scoped("insert into quiz_private.roster_teams values($1,$2)"), [r.number, json(r)]);
        for (const m of r.members) await tx.unsafe(scoped("insert into quiz_private.roster_students values($1,$2)"), [m.registration_number, r.number]);
      }
      for (const t of state.teams) {
        await tx.unsafe(scoped("insert into quiz_private.teams values($1,$2,$3,$4)"), [t.id, t.number, t.leaderId, json(t)]);
        for (const m of t.members) await tx.unsafe(scoped("insert into quiz_private.members values($1,$2,$3,$4)"), [t.id, m.registration_number, m.is_leader, m.name]);
      }
      for (const a of state.attempts) await tx.unsafe(scoped("insert into quiz_private.attempts values($1,$2,$3)"), [a.id, a.teamId, json(a)]);
    });

    const entered = signal(), release = signal();
    const writer = db.begin(async tx => {
      await tx.unsafe(scoped("select id from quiz_private.control where id=1 for update"));
      await tx.unsafe(scoped("select id from quiz_private.attempts where id=$1 for update"), [state.attempts[0].id]);
      const answer = structuredClone(state.attempts[0]); answer.progress[0].solved = true; answer.progress[0].marks = 2; answer.total = 2; answer.activeModule = 2;
      await tx.unsafe(scoped(HEARTBEAT_SAVE_SQL), [answer.id, json(answer), json([])]);
      entered.resolve(); await release.promise;
    });
    // Always release a held transaction, including failed assertions/timeouts.
    try {
      await Promise.race([entered.promise, writer]);
      await db.begin("read only", async tx => {
        await tx`set local statement_timeout='5s'`;
        const rows = await tx.unsafe<{ state: State }[]>(scoped(READ_STATE_SQL));
        assert.equal(rows[0].state.attempts.find(a => a.id === state.attempts[0].id)!.total, 0);
      });
      await db.begin(async tx => {
        await tx`set local lock_timeout='1500ms'`;
        const context = await tx.unsafe<HeartbeatContext[]>(scoped(HEARTBEAT_CONTEXT_SQL), [actor(1).id]);
        const own = heartbeatState(context[0]), before = structuredClone(own.attempts[0]); assert.equal(own.users.length, 1); assert.equal(own.teams[0].number, 2); assert.equal(own.papers.length, 0);
        assert.equal(heartbeatReply(own, actor(1), payload, Date.now()).error, undefined);
        const patch = heartbeatPatch(before,own.attempts[0]);
      await tx.unsafe(scoped(HEARTBEAT_SAVE_SQL), [own.attempts[0].id, json(patch.changes), json(patch.removed)]);
      });
      await assert.rejects(db.begin(async tx => {
        await tx`set local lock_timeout='500ms'`;
        await tx.unsafe(scoped(HEARTBEAT_CONTEXT_SQL), [actor(0).id]);
      }), (e: unknown) => (e as { code?: string }).code === "55P03");
    } finally { release.resolve(); await writer; }
    await db.begin(async tx => {
      const context = await tx.unsafe<HeartbeatContext[]>(scoped(HEARTBEAT_CONTEXT_SQL), [actor(0).id]);
      const own = heartbeatState(context[0]), before = structuredClone(own.attempts[0]); assert.equal(own.attempts[0].total, 2);
      assert.equal(heartbeatReply(own, actor(0), payload, Date.now()).error, undefined);
      const patch = heartbeatPatch(before,own.attempts[0]);
      await tx.unsafe(scoped(HEARTBEAT_SAVE_SQL), [own.attempts[0].id, json(patch.changes), json(patch.removed)]);
    });
    assert.equal((await readAttempt()).total, 2);
    console.log("PASS: read-only snapshots bypass the shared writer lock; other-team heartbeats proceed; same-team writes serialize and preserve answers.");

    // Simulate watchdog selecting a stale row while a heartbeat is uncommitted.
    await db.unsafe(scoped("update quiz_private.attempts set body=jsonb_set(body,'{lastHeartbeat}',to_jsonb($2::bigint)) where id=$1"), [state.attempts[0].id, Date.now() - 61000]);
    const refreshEntered = signal(), releaseRefresh = signal(), watchStarted = signal(); let watchPid = 0;
    const refresh = db.begin(async tx => {
      await tx.unsafe(scoped("update quiz_private.attempts set body=jsonb_set(body,'{lastHeartbeat}',to_jsonb($2::bigint)) where id=$1"), [state.attempts[0].id, Date.now()]);
      refreshEntered.resolve(); await releaseRefresh.promise;
    });
    let watcher: Promise<unknown> | undefined;
    try {
      await Promise.race([refreshEntered.promise, refresh]);
      watcher = db.begin(async tx => {
        watchPid = (await tx<{ pid: number }[]>`select pg_backend_pid() as pid`)[0].pid; watchStarted.resolve();
        await tx.unsafe(scoped("select quiz_private.watchdog()"));
      });
      await Promise.race([watchStarted.promise, watcher]);
      let waiting = false;
      for (let i = 0; i < 30; i++) {
        const rows = await db<{ waiting: boolean }[]>`select wait_event_type='Lock' as waiting from pg_stat_activity where pid=${watchPid}`;
        if (rows[0]?.waiting) { waiting = true; break; }
        await new Promise(r => setTimeout(r, 50));
      }
      assert.equal(waiting, true, "Watchdog must be waiting on the uncommitted heartbeat for this regression");
    } finally { releaseRefresh.resolve(); await refresh; if (watcher) await watcher; }
    assert.equal((await readAttempt()).locked, false);
    assert.equal((await db.unsafe<{ count: number }[]>(scoped("select count(*)::int as count from quiz_private.audit where body->>'type'='HEARTBEAT_MISSED'")))[0].count, 0);
    console.log("PASS: watchdog rechecks freshness after waiting and does not lock a recovered connection.");
  } finally {
    // Only the random test schema named above is ever eligible for cleanup.
    assert.match(schema, /^quiz_perf_test_[a-f0-9]{32}$/);
    await db`drop schema if exists ${db(schema)} cascade`;
    await db.end({ timeout: 5 });
  }
}
main().catch(error => { console.error("Concurrency check failed:", error instanceof assert.AssertionError ? error.message : (error as { code?: string })?.code || "configuration/connection error"); process.exitCode = 1; });
