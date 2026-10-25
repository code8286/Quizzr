# API and event integration contracts

> Original design contracts. The implemented API and decisions are described in [implementation.md](implementation.md) and `src/server/gateway.ts`; this document is retained as planning history.

These are planned contracts, not implemented endpoints. Protected responses use `Cache-Control: no-store`. Mutations use an idempotency key where retries could duplicate an effect and an expected attempt revision where stale state matters.

Standard error shape: `{ code, message, requestId }`. Use 401 for missing identity, 403 for denied actions or early hints, 409 for state/version conflicts, 422 for invalid input, and 429 for throttling. Responses expose only caller-authorized fields.

| Endpoint | Input / caller | Server integration and output |
| --- | --- | --- |
| `POST /api/auth/login` | Registration number + selected identity proof | Verify identity through Auth before binding profile; return profile and team association. First-time name entry is onboarding, not identity proof. |
| `POST /api/auth/logout` | Session | Revoke/end session and clear cookies. |
| `POST /api/team/register` | Leader; member names and registration numbers | Normalize IDs, enforce leader membership, allocate slot and create members atomically; return team number. |
| `GET /api/quiz/status` | Leader | Return safe team/attempt summary, release state, revision and server time. |
| `GET /api/quiz/question?module=N` | Leader | Verify active attempt and selected module; return only question ID, module and question text. |
| `POST /api/quiz/select-module` | Leader; module 1–5, revision | Persist active module; return updated revision for restoration and admin monitoring. |
| `POST /api/quiz/submit-key` | Leader; question ID, string key, revision | Validate against assigned paper, compare privately and update counters/progress atomically; return success, attempts and new revision. Fifth correct answer also finalizes once. |
| `POST /api/quiz/request-hint` | Leader; question ID, requested hint index | Check server clock and next allowed hint; atomically issue receipt and deduct once; return only earned hint text and permitted score summary. |
| `POST /api/quiz/heartbeat` | Leader; session ID, sequence, focus metrics | Record server receipt time, apply configured lock rules; return authoritative status and revision. |
| `POST /api/quiz/proctor-event` | Leader; bounded event type/details | Append event and apply specified immediate lock in one transaction; return lock state. |
| `GET /api/quiz/result` | Leader | Only after completion; return team details, total, question breakdown, deductions and completion time. |
| `POST /api/admin/login` | Admin username + strong credential | Supabase Auth verification and role check; recommended MFA. Never grant role from supplied username alone. |
| `GET /api/admin/live-dashboard` | Admin | Safe summary of up to 12 teams, member details, active module, elapsed time, scores, hints and alerts. |
| `POST /api/admin/toggle-paper-release` | Admin; release status, revision | Serialize global change; allocate sets on first release; preserve assignments on repeat release; publish committed revision. |
| `POST /api/admin/override-set` | Admin; team, set, expected revision, reason | Before start: replace allocation. During attempt: proposed explicit audited reset into a new attempt, preserving old history; policy decision required. |
| `POST /api/admin/lockout-team` | Admin; team, lock status, reason | Lock overlay or restore saved prior state; audit and notify. |
| `POST /api/admin/close` | Admin; individual/global scope, reason | Atomically close targeted attempts; deny further quiz mutations. |
| `POST /api/admin/reissue` | Admin; team, reason | Create new attempt under explicit exception; previous results remain immutable. |

## Critical transaction flows

1. **Register:** verify session → lock free numbered slot → validate canonical registry and all members → insert team/members → commit → waiting state. Unique constraints remain the final defense against concurrent duplicate registrations.
2. **Release:** lock global control row → assign one of A/B/C to each unassigned team using server randomness → create/start eligible attempts → increment revision → commit → broadcast. Distribution is random, not necessarily balanced; repeat release must not reroll sets.
3. **Answer:** lock attempt/progress → validate ownership and active state → strictly parse whole-number input → compare key → record attempt → mark solved once → sum score and finalize if all five solved → commit → notify. Reject empty strings, mixed text, fractions and exponents; proposed canonicalization accepts leading zeros and optional plus sign. Negative-number policy remains open.
4. **Hint:** lock attempt/progress → check start + 300 seconds and active state → return prior receipt or issue next hint → apply its penalty once → commit → return that hint. Concurrent hint/answer requests serialize against the same progress record.
5. **Restore:** reload server state → if locked, show lock view → otherwise hydrate selected module, solved modules, disclosed hints and timestamps. A refresh cannot clear a lock or reset a timer.

## Realtime and stale heartbeats

Private topics: `team:<team-id>` and `admin:quiz`. Events carry only `{ eventId, kind, revision }`, with kinds such as `release.changed`, `attempt.changed`, `team.locked`, `team.unlocked`, `quiz.closed`, `quiz.completed`. Clients refetch authorized API state; duplicate or out-of-order events are harmless. Poll status as a fallback when realtime disconnects.

Send heartbeats every 3 seconds while Active. A missed ping is detected by a server-side watchdog, not by a Vercel request waiting forever. Proposed watchdog: Supabase Cron checks stored receipt times every second, with threshold and startup/reconnect rules to be approved. Actual lock latency includes the timeout, scheduler and delivery delay; it cannot be instantaneous at the moment a packet is lost. Every mutation also checks heartbeat freshness so a disconnected client cannot bypass an already stale session before the watchdog runs.

## Frontend integration boundaries

Planned routes: `/login`, `/home`, `/quiz/register`, `/quiz/waiting`, `/quiz/play`, `/quiz/completed`, `/admin/login`, `/admin`. Locks render from authoritative status on every relevant screen.

Feature components consume safe contracts, never database rows directly. Authentication and all graded actions pass through the API. A single selected question is displayed at a time; module switching is allowed, while only correct answers mark modules complete. A completed team's home card is disabled, and the server independently blocks attempts.

At completion, show the countdown and attempt `window.close()` where allowed; if the browser refuses, replace the quiz with a closed/completed screen. A release notification navigates the existing tab because unsolicited popup launch can be blocked.
