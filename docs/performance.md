# Request paths

Status, question, session, admin/export and SSE reads use `readSnapshot`. PostgreSQL returns one consistent JSON snapshot in one statement. Reads never take the shared control-row `FOR UPDATE` lock or persist state. Deadline/heartbeat state is projected immediately for display between watchdog ticks; these projections do not invent saved audit records. The database watchdog persists expiry/lock transitions independently.

Heartbeats use `recordHeartbeat`, not the aggregate writer. One query authenticates the profile and selects only that leader's current team, attempt, roster entry and control settings. It locks only that attempt row. A healthy heartbeat patches heartbeat timestamp/session/rate metadata; it does not rewrite answers, load papers, scan other attempts, or update the shared control/rate-limit row. Only a focus/expiry/connection event adds an audit record. Authentication, student-only access, release state, locks, deadlines, 60-second grace and a separate 60-per-minute heartbeat limit remain enforced.

Student mutations still serialize through the control row, but lock only that leader's attempt before reading it. Other teams' heartbeat updates can continue. Administrator/global mutations lock all attempt rows before changing them. This lock order prevents stale answer/admin snapshots from overwriting a concurrent heartbeat or focus lock. A guard refuses scoped student writes to other teams' attempts. Client heartbeat calls do not overlap when the preceding request is still pending.

Migration **007_concurrent_heartbeats.sql** installs the watchdog's freshness recheck after it obtains an attempt lock. A heartbeat may have committed while the watchdog waited; in that case it skips the obsolete lock/audit event. It also preserves an already-applied focus lock. Apply this migration before publishing the new request paths. It changes no student data or existing locks and keeps the current cron schedule.

## Verification

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run typecheck
npm.cmd run test:concurrency -- --env-file .env.production.local
```

The last check requires private PostgreSQL credentials and schema-creation permission. It creates a random, private `quiz_perf_test_…` schema containing synthetic users and attempts, then removes only that schema. It tests lock-free committed reads under a held writer, independent team heartbeats, same-team serialization/answer preservation, and a real watchdog/heartbeat lock race. It does not alter the actual class tables or schedule a test watchdog.

These changes reduce query count and lock contention; they do not establish a measured end-to-end latency improvement or a capacity guarantee. Function/database region placement and duplicate SSE/polling traffic are separate settings. Keep the database/HTTP checks passing before changing those paths further.
