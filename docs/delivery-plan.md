# Implementation sequence, decisions and verification

> Original delivery plan. Implementation is complete locally with practice papers; current verification and deployment steps are in [implementation.md](implementation.md).

## Decisions to settle before portal implementation

| Specification issue | Proposed treatment | Status |
| --- | --- | --- |
| Registration number and name used as login | Bind registration to institutional SSO or an administrator-issued one-time enrollment credential, then a verified Auth identity. | Identity method needs selection. |
| "Never send full hint texts" versus displaying requested hints | Never preload unreleased hints; return the individual earned hint on demand. | Proposed clarification. |
| Free module choice versus sequential unlocking | Any module may be selected; only a correct answer completes it; all five must be solved. | Proposed interpretation. |
| Change sets at any time | Permit command at any time, but an active-set change requires explicit reset/new attempt and audit. Do not apply old answers to new questions. | Needs policy approval. |
| No reattempts versus admin reissue | Block student reattempts; only explicit audited admin reissue creates another attempt. | Proposed interpretation. |
| Callback and closure | Callback pauses access; closure terminates current attempts. Release resumes paused attempts without rerolling sets or resetting hint clocks. | Needs timing policy confirmation. |
| Whole-number definition and penalties | Define allowed signs, normalization, hint deductions and zero-score floor before paper import. | Marking scheme required. |
| Strict lock on one missed ping versus network recovery | Keep strict rule visible as specified; configure a measurable timeout and explain that packet loss can trigger locks. A grace period would be a policy change. | Timeout needs approval. |
| Browser anti-malpractice guarantees | Treat focus/mouse/window signals as imperfect telemetry. OS shortcuts and external screens cannot be reliably controlled by a normal website. | Browser limitation. |
| Automatic tab close / launch | Use same-tab start and completed-screen fallback when browser popup/close restrictions apply. | Browser limitation. |

No questions, answers or hint content have been supplied. Do not invent live assessment material or seed real credentials.

## Build order and completion evidence

| Phase | Deliverable | Verification before proceeding |
| --- | --- | --- |
| 1. Policy and contracts | Resolve decisions above; freeze API/state contracts and paper format | Review student/admin flows and error states |
| 2. Database foundation | Migrations, private schemas, RLS, transactional commands, import validation | Concurrent registrations cannot exceed 12 or duplicate a student; deny browser access to keys/hints |
| 3. Identity and teams | Verified onboarding, secure sessions, registration and home | Forged registration identity and admin-role escalation fail; 1–5 membership enforced |
| 4. Release and monitoring | Admin controls, waiting room, private events, polling fallback | Unauthorized subscriptions fail; release is idempotent; reconnect restores authoritative state |
| 5. Quiz and hints | Module selection, server evaluation, exact scoring | 299 seconds denies hints; 300 permits them; repeated/concurrent requests charge once; forged question IDs fail |
| 6. Proctoring and recovery | Event reporting, heartbeat watchdog, lock/restore | Lock blocks answers even with stale UI; scheduler catches absence without requests; refresh restores state |
| 7. Lifecycle | Finalization, closure, reissue and completion screen | Fifth solve finalizes once; retry cannot duplicate score; completed attempts stay blocked; fallback after 60 seconds works |
| 8. Release readiness | Preview deployment and supervised 12-team rehearsal | Test all three sets, callback, set override, connection loss and admin recovery; inspect bundles/network for secret leakage |

## Deployment scaffold

- Separate local/test, Vercel preview and production Supabase projects. Never let previews connect to live quiz data.
- Apply reviewed migrations before deploying compatible application changes. Import papers using privileged server tooling and validate three sets × five questions × two marks.
- Expected server configuration: Supabase URL, server credential, auth callback/origin allowlist and watchdog timeout. Realtime browser configuration uses only public project configuration and a scoped session token. No secret values are included here.
- Keep paper imports and server credentials outside public assets and tracked seed data. Set retention/access rules for student records and proctoring logs before the event.
- Confirm scheduler availability, backups, recovery procedure, service limits and monitoring during provisioning. No third-party persistent socket server is needed for the chosen Supabase Realtime design.

## Requirement coverage

| Prompt.md area | Planned location |
| --- | --- |
| Roles, first login, persistent session | Authentication boundary and identity decision |
| Team leader, 1–5 members, unique IDs, team numbers 1–12 | Registry and team registration transaction |
| Home card, registration, waiting room | Planned student routes and feature adapters |
| Three sets, five modules, two marks each | Paper-version validation and quiz engine |
| Random release and manual assignment | Release service and override contract |
| Numeric keys and correctness gating | Submit-key transaction and module interpretation |
| Five-minute hints, caps and deductions | Private hints, unique receipts and server-time check |
| Score, keys, team details and breakdown persistence | Progress, answer events, attempts and result API |
| Monitoring and anti-malpractice | Heartbeats, events, watchdog and admin dashboard |
| Locks and exact restoration | Lock overlay, prior state and hydration |
| Callback, global/team closure and admin reissue | Admin command contracts and audit |
| 60-second close and no student reattempt | Completion timestamp, browser fallback and server guards |
