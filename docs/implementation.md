# Setup, implementation and operation

## Class data and local rehearsal

The current documented cohort has 11 numbered teams and 53 students, following the class replacement recorded in [class replacement and recovery](class-replacement.md). The earlier roster update guide describes a previous 54-student cohort. Local rehearsal data is managed separately; changing documentation or publishing source does not replace that data. Empty team-number CSV cells inherit the preceding number. Registration IDs must be unique, and no fixed member-count or team-count cap applies.

The earlier synthetic practice state was backed up under `.data/archive/` before import. The current state is `.data/quiz.json`. The source CSV, PDFs, private question JSON and extracted review files have not been placed in public assets. They must not be served directly or committed as assessment secrets.

Run `npm run dev` and open http://127.0.0.1:3000. The existing local administrator remains ADMIN / PracticeAdmin!2026. Students choose Create a leader account and supply their university registration ID plus a name. They later sign in with the same ID and signup name. Name comparison for login ignores capitalization and repeated spaces. CSV names are not used to authenticate or verify membership.

Any roster member may claim the leader role for their numbered team. Only one active claim succeeds, including under concurrent registration. An administrator may delete the portal registration to allow a fresh claim without deleting stored records. Each team's form initially provides enough rows for the roster membership; the button is disabled while fields are incomplete or duplicated. Names are required for display but only the exact set of registration IDs determines team verification. No arbitrary upper member limit is applied.

## Student flow

1. Sign up or sign in with university ID and name. No student password or separate code is requested.
2. Under Active quizzes, click Start Quiz on Mathematics Quiz 3.
3. Complete all team fields and click Register Team. The server verifies the complete roster ID set and returns the existing team number.
4. The Mathematics Quiz 3 page displays the verified number and members. Start Quiz is disabled until the admin releases papers.
5. Clicking Start Quiz opens an untimed module-choice page. No question is disclosed and no exam or hint time is consumed at this stage.
6. Choose the starting module once. That selection atomically starts the 40-minute server clock and five-minute hint delay. The server stores a shuffled order for the remaining four modules. Only the current question is accessible; future/prior modules and later reselection are rejected.
7. A correct answer advances to the next question automatically. Wrong answers leave the team on the same question.
8. After five minutes from the overall start, optional hints become available. Each hint confirmation displays its total penalty and remaining possible question marks. Cancel closes the dialog without a request or deduction. Later tiers replace earlier deductions, never add to them.
9. All five correct keys finalize the submission. At forty minutes, unfinished work also finalizes with earned marks preserved. Scores, itemized performance and answer history are visible only to the admin. Students receive a submission receipt and return home within sixty seconds.

The countdown continues through refreshes, disconnections, recalls and lockouts. Only an audited admin reissue or confirmed replacement creates a fresh attempt. Restoring a lock resumes the same question, order, hints and timestamps.

## Paper import and fidelity

All papers have five questions, with question N mapped to Module-N and two marks per question. The supplied answer tables are used as the authoritative grading keys. The user explicitly requested that the source wording and formulas remain as written after the likely Q4 inconsistencies in Papers 1 and 3 were raised. No corrective mathematics was substituted.

There are questions with zero, one, two or three hints. A tier's `deduction` is the total deduction after that hint, between zero and two marks. Tiers must be nondecreasing; their sum is irrelevant. Only requested hint texts are returned. Full papers, unreleased hints and answer tables are never sent to a student.

The private JSON format is an array of fifteen records, with unique IDs and a shared version:

```json
[
  {
    "id": "exam-v1-a-1",
    "set": 1,
    "module": 1,
    "text": "Approved question with $LaTeX$ where needed.",
    "key": "42",
    "version": "exam-v1",
    "hints": [
      {"text": "First hint", "deduction": 0.5},
      {"text": "Second hint", "deduction": 1},
      {"text": "Final hint", "deduction": 2}
    ]
  }
]
```

The excerpt shows one record; imports require all fifteen. `npm run class:import -- <team.csv> <private-papers.json>` validates and imports both sources. A new class import is blocked if a real exam is already active. A previous local practice session may be archived automatically. `npm run papers:import` remains available for a fresh database with no attempts.

On first release, all roster teams receive balanced randomized assignments, including teams not yet verified. Eleven teams receive a randomized 4/4/3 allocation. Repeat release does not reroll sets. A deliberate admin override is logged and may change that balance.

## Production Supabase setup

1. Create a dedicated Supabase PostgreSQL project for the exam; use separate projects for previews and production.
2. Apply migrations 001 through 008 in order, applying only missing migrations to existing databases. Migration 005 installs selection-time clock start, 006 sets sixty-second heartbeat grace, 007 handles concurrent heartbeat/watchdog updates, and 008 adds private class archives. The existing cron schedule stays unchanged. Creating archive storage does not replace the active class.
3. Enable pg_cron and schedule `quiz_private.watchdog()` once using the command documented in migration 002. Migration 003 replaces that function with deadline finalization; it also preserves missed-heartbeat enforcement. The existing schedule remains valid.
4. Use the transaction-pooler URL as server-only DATABASE_URL. Set QUIZ_STORAGE=postgres, a random SESSION_SECRET of at least 32 characters, and the exact APP_ORIGIN. The Postgres driver disables prepared statements and requires TLS by default.
5. Run `npm run setup:admin` in a trusted environment pointing to that database. Administrator passwords are salted and hashed. Student login uses ID/name as requested, while cookies remain signed, HTTP-only and session-bound.
6. Import the roster and private paper JSON before teams begin. The CSV requires REGISTER NO, NAME and Team No. columns. Team numbers must be positive integers; duplicates of a registration ID are rejected.
7. Deploy the Next.js app to Vercel using Node 24, `npm ci` and `npm run build`. Configure environment variables separately for Preview and Production. Never enable ALLOW_LOCAL_PRODUCTION on the hosted assessment.
8. Rehearse team verification, balanced release, first-module choice, hint cancellation/tiers, lock restoration, timeout and administrator exports on staging.

All database tables remain in a private schema, with browser grants revoked and RLS enabled. Trusted server requests bind leaders to their own team and administrator permissions to the stored role. Student-safe DTOs omit marks, total scores, per-question progress records and future question order. The student result endpoint returns 403 even after completion. The admin dashboard and export retain the full results.

PostgreSQL status/question/SSE reads use a consistent snapshot without the shared writer lock. Heartbeats lock only their own attempt and update heartbeat metadata. Student mutations serialize through the control row and lock their team's attempt; global administrator mutations lock the affected attempt rows. See [request paths and concurrency](performance.md). The local adapter uses a cross-process file lock and atomic replacement. Roster tables persist team groups and unique student IDs; the deferred membership trigger verifies the full imported set without comparing names.

Live updates use authenticated SSE with reconnect and polling fallback. The scheduled watchdog handles absent browsers. Focus/visibility/cursor/keyboard/window signals remain imperfect browser telemetry; the administrator can review and restore a lock. Normal browser restrictions on OS shortcuts still apply. The completed student page navigates home instead of trying to close the tab.

Migration 006 sets the heartbeat grace to 60 seconds. The application uses `HEARTBEAT_TIMEOUT_MS=60000` and sends check-ins every three seconds. A missing connection is audited as `HEARTBEAT_MISSED`; a reported tab switch is `TAB_HIDDEN` and a focus loss is `FOCUS_LOST`. Tab/focus violations remain immediate and do not receive the connection grace. The migration preserves existing locks, attempts and timer start times.

## Verification

The tests cover signup-name login, roster-only IDs, arbitrary member/team counts, full-team matching independent of names, concurrent leader claims, balanced allocations including absent teams, selection-time clock start, one first-module choice, random unique sequence, future-question blocking, tiered hints, private student APIs, lock restoration, forty-minute expiry and independent exam/release controls. Migration, deployment and archive tests cover all eight migrations, private archive access, rollback and replacement no-ops. HTTP and browser checks use synthetic data in a separate store so real student accounts are not claimed.

The live portal uses Supabase PostgreSQL and Vercel. Local release checks validate source against synthetic data; they do not establish the current hosted database, scheduler or deployment state. Run the read-only check from [deployment](deployment.md) against the selected environment before launch. Private reports and raw exports stay under ignored `.data/results/` storage.

## Delete a portal registration

In the admin dashboard, select the team, enter a reason, choose **Delete registration** and confirm. The team disappears from active portal registrations, and its leader is directed back to team verification. Existing ID/name accounts continue to work; another listed member can also lead the fresh registration.

The action is a soft removal. It preserves the roster, assigned team number/paper allocation, account records, member rows, previous submitted answers/results and an audited registration snapshot. A fresh registration reuses the same stored team identity but creates a new empty attempt. Database rows are updated or inserted, never physically deleted by this action. A stale deletion request cannot clear a newer registration. A closed exam stays closed even if a team registers again.

The forty-minute timer and the five-minute hint delay both begin at the first module selection. Monitoring and missed-heartbeat locks do not apply to the untimed selection screen. Legacy pre-choice timestamps are cleared by the application/watchdog without changing attempts that have already selected a module.

## Exam closure and paper availability

Closing the exam preserves the paper release setting and existing results/progress. Paper release and recall remain available after closure, but neither reopens a closed attempt. A student start request while globally closed returns `EXAM_CLOSED`. Use administrator reissue for an authorized fresh attempt; use recall only to change paper availability.

## Explicit progress reset

For an authorized reset within the same cohort, the operator can run:

```text
node --import=tsx scripts/reset-progress.ts --env-file .env.production.local --apply
```

This writes a private backup before changing state, creates a fresh current attempt for each active registration, retains earlier attempts and registrations, preserves paper assignments and release availability, clears global closure and records audit events. It is a database-changing operation, not a release check. New-cohort replacement uses the separate archive-backed procedure in [class replacement](class-replacement.md).
