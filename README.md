# Quizzr · Mathematics Quiz 3

A team mathematics assessment portal built with Next.js, React, TypeScript and Supabase PostgreSQL. The current documented cohort has 11 numbered teams and 53 students; local rehearsal data is managed separately. Real paper content, answer keys, rosters and exported results stay in ignored private storage, outside browser bundles and public assets.

See [the changelog](CHANGELOG.md) for release changes and [the class replacement guide](docs/class-replacement.md) for cohort archiving and recovery.

## Current assessment rules

- Leaders sign up with their university registration ID and name. The same ID and signup name are used on future visits, with no password or access key. Administrator sign-in remains password protected.
- Any listed team member may act as leader. One leader can verify and claim each team. Registration IDs must exactly match the whole imported team; entered names are not compared with CSV names.
- Team numbers come from the CSV. No fixed team-member or team-count cap is imposed; the imported roster determines each team's required membership.
- The home page lists Mathematics Quiz 3 under Active quizzes. Leaders complete the team form, verify it, then see their number and details. Start Quiz stays disabled until papers are released.
- Initial paper assignment is randomized and balanced across all roster teams, including teams that register later. Administrator set overrides remain available.
- Close exam for everyone closes attempts without changing paper release. Release/recall remains available after closure and does not reopen closed attempts; reissue is the separate action for a fresh attempt.
- Admin → select a team → enter a reason → Delete registration clears the portal claim and enables fresh team verification. The roster, accounts, membership records, registration snapshots and past attempts remain stored; the team keeps its assigned number.
- Clicking Start Quiz opens an untimed module-selection screen. Selecting the first module starts the 40-minute clock and five-minute hint delay. Students choose their first module once, without seeing questions beforehand. Correct answers reveal subsequent modules in a server-generated random order covering all five questions.
- Hints unlock after five minutes. Their penalties are cumulative tiers, not additions: using a one-mark tier means a total one-mark deduction. Each disclosure requires a confirmation showing its total cost; Cancel makes no request and applies no deduction.
- Student screens and API responses contain no scores or performance breakdowns. Completed submissions return home within 60 seconds. Only the administrator sees results and exports.
- A top-of-page theme toggle switches light/dark mode and remembers the preference.
- Heartbeats are sent every three seconds with 60 seconds allowed for a connection gap. Tab switching and focus violations are recorded separately and lock immediately when monitoring is enabled.

The supplied papers and answer keys are transcribed as written, including the source formula/hint inconsistencies the user chose to preserve.

## Open locally

```text
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The imported class data is already configured in this workspace. Do not run demo setup over the imported class.

Existing local administrator: `ADMIN` / `PracticeAdmin!2026`. Replace that public practice admin credential when setting up a hosted exam. Students use Create a leader account with an ID present in the supplied roster and their name.

Use separate browser profiles/private windows to use student and administrator sessions simultaneously. One cookie jar holds one identity.

## New installation and deployment

Follow [the deployment runbook](docs/deployment.md) for release checks, production settings, all eight migrations, private data import and the per-second watchdog. Node 24 and Vercel build settings are declared in this directory. Run `npm run verify`, then `npm run deploy:check -- --env-file .env.production.local` against the target database. The live portal uses Supabase PostgreSQL and Vercel. This directory is the standalone Git repository at `code8286/Quizzr`.

For a fresh local rehearsal only, `npm run demo` creates a synthetic roster and practice papers. For the actual class, use:

```text
npm run class:import -- <absolute-team-csv> <absolute-private-paper-json>
```

The importer checks the CSV and all 15 questions. It will archive an earlier local practice session before replacing it, and refuses to overwrite an active class exam. The current source material is prepared privately under `.data/import/`.

For edits within an existing class, use `npm run roster:update -- "<team.csv>"` to preview and append `--apply` to save. It preserves existing attempts and paper allocations; the [roster update guide](docs/roster-updates.md) records the earlier 54-student cohort. A completely new, non-overlapping cohort uses [archive-backed class replacement](docs/class-replacement.md). Never use a class replacement or progress reset as a deployment check.

## Results and private files

Administrator exports include team membership, attempt history, submitted answers, hints, deductions and marks. Detailed local reports belong under `.data/results/<batch>/README.md`, alongside the original JSON when available. These reports contain student identities and recorded answers and are excluded from Git and deployment uploads.

All `.env*` files, including templates, and local `devdata.txt` notes are private. Configure hosting secrets through the host's environment settings. See the [deployment runbook](docs/deployment.md) for required variable names and credential-history cleanup guidance.

## Checks

Status/SSE reads now avoid the shared writer lock, and heartbeats update only their own attempt's metadata. See [request performance and concurrency checks](docs/performance.md). Existing databases need migration 007 before deploying these paths.

```text
npm run verify
npm audit --audit-level=low
```

Unit/database tests check roster matching, unrestricted member counts, balanced assignment, one-time module selection, sequential gating, tiered hints, score privacy, lock restoration, expiry and production settings. The HTTP suite uses isolated synthetic data and real route handlers. The production smoke test checks the built app, assets, headers and sessions. Optional browser automation is available with `npm run test:ui` after installing Playwright Chromium.

## Source map

- `src/features/student-views.tsx`: student views and passwordless login
- `src/features/portal.tsx`: workspace shell, live updates and admin dashboard
- `src/features/theme-toggle.tsx`: persisted theme preference
- `src/server/engine-v2.ts`: current assessment rules (`engine.ts` re-exports them)
- `src/server/store.ts`: atomic local/PostgreSQL persistence
- `src/server/gateway.ts`: session-bound API access and safe responses
- `src/server/roster.ts`: CSV parsing and numbered roster validation
- `supabase/migrations/`: private schema, watchdog and roster constraints
- `scripts/import-class.ts`: private roster/paper import
- `scripts/update-roster.ts`: protected updates within an existing cohort
- `scripts/replace-class.ts`: explicit new-cohort replacement with private recovery archives
- `scripts/reset-progress.ts`: explicit backed-up reset of active team progress
- `CHANGELOG.md`: release changes and validation record

Original planning documents are retained as history. The current operations guide and latest user rules supersede their earlier limits and login flow.
