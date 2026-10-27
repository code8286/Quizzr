# Changelog

Changes are grouped by the date they are prepared for publication. Private student results and credentials remain outside the repository.

## 2026-10-27

### Changed

- Exam closure and paper availability are independent administrator controls. Closing the exam preserves paper availability and saved work. Release/recall remains usable after closure and does not reopen closed attempts; a fresh attempt requires reissue.
- Starting while the exam is globally closed returns `EXAM_CLOSED`, with a message directing the team to the administrator.
- Administrator labels and confirmations explain the distinction between paper availability, exam closure and reissue.
- Root, deployment and implementation guides describe the standalone GitHub repository, current documented 53-student cohort, all eight migrations, and the distinction between roster edits, class replacement and progress reset.

### Added

- New-cohort replacement tooling validates a non-overlapping roster, preserves administrators and all fifteen questions, and saves the full previous class in a private database archive and local recovery file before replacing active records.
- Migration `008_class_archives.sql` adds the private, RLS-protected class archive table with browser-role access revoked.
- Explicit progress-reset tooling writes a private backup and creates fresh current attempts while retaining earlier attempts, registrations, paper assignments and paper availability.
- Class replacement tests cover archive fidelity, repeated-import no-ops, backup failure, transaction rollback, overlapping rosters and archive access restrictions.
- Deployment preflight requires the class archive table and its row-level security alongside the existing private schema and watchdog checks.
- Results-storage documentation describes private per-batch README reports and source exports without publishing student records.

### Security

- Removed `devdata.txt` from Git tracking while retaining the local file. Added explicit Git, Vercel-upload and production-tracing exclusions for private development notes.
- Retained exclusions for every `.env*` file, private data, assessment papers, exported results and generated artifacts.
- A database credential was already present in earlier Git history. Removing the current file does not revoke it or erase history; the credential owner must rotate the password and update private runtime settings. This release does not rewrite published history or rotate live credentials.

### Validation

Run `npm run verify` for unit/database tests, the real HTTP assessment flow, the production smoke test, optimized build and type checking. Browser rehearsal is available with `npm run test:ui`. These checks use synthetic local data; class replacement and progress reset are not run against the live database during verification.

Local verification on 27 October 2026 passed: 97 unit/database tests, the HTTP assessment test, production smoke test, optimized build and type check. Browser rehearsal passed on rerun after a transient Windows file-lock error in its synthetic local store. The dependency audit reported zero vulnerabilities. The staged-file scan found no credentials or exported student registration IDs, and all nine production file traces excluded private files. This records local checks, not a hosted deployment or GitHub CI result.

## Earlier work

The application includes balanced paper assignment, roster-bound leader accounts, one initial module selection, a forty-minute deadline, cumulative hint tiers, administrator-only results, Node 24/Vercel configuration and private environment-file exclusions. Heartbeat grace is sixty seconds; focus/tab violations remain immediate. Migration 007 and the scoped heartbeat/read paths address concurrent requests. See [request paths](docs/performance.md), [roster update history](docs/roster-updates.md) and [deployment](docs/deployment.md) for details.
