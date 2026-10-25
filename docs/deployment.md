# Deployment runbook

The app requires a Node server and private PostgreSQL. Use this folder as the Vercel root directory. Node 24, `npm ci`, and `npm run build` are declared in the project. Static export cannot run the assessment APIs.

## Verify the release

```text
npm ci
npm run verify
npm audit --audit-level=low
```

`verify` runs the unit/database suite, HTTP assessment flow, production smoke test, final build and type check. The production smoke test builds into `.next-verify` and uses synthetic data in `.data/e2e`; it checks built assets, headers, origin protection and secure session cookies. Local imported class data is preserved. Browser tests are separate: `npm run test:ui`, after installing Playwright Chromium.

## Prepare production

1. Create a dedicated Supabase database. Use a different database and secrets for previews.
2. Apply all five files in `supabase/migrations/` in numeric order in the trusted SQL editor, ending with `005_module_start_and_portal_registration.sql`. Apply only missing migrations to existing databases; the migrations cannot be replayed.
3. Enable pg_cron. Inspect `cron.job` for an existing watchdog first, then schedule it once using the application's database role:

   ```sql
   select cron.schedule('quiz-heartbeat-watchdog', '1 second', 'select quiz_private.watchdog()');
   ```

   Check `cron.job_run_details` for successful execution. A minute-level HTTP cron cannot meet the ten-second heartbeat rule.

4. Create an ignored `.env.production.local` on the trusted import machine. All `.env*` files, including templates, are excluded from Git and deployment uploads. Set `QUIZ_STORAGE=postgres`, the transaction-pooler `DATABASE_URL`, a unique random `SESSION_SECRET` of at least 32 characters, the exact public HTTPS `APP_ORIGIN` without a trailing slash, and `HEARTBEAT_TIMEOUT_MS=10000`. The local `.env.production.example` can be used as a starting point if available. Generate the session secret with:

   ```text
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

5. Create a private administrator and import the approved sources:

   ```text
   node --env-file=.env.production.local --import tsx scripts/setup.ts admin
   node --env-file=.env.production.local --import tsx scripts/import-class.ts <absolute-team-csv> <absolute-private-paper-json>
   ```

   These commands use the explicit production settings instead of the local rehearsal. Never use the documented practice or test administrator passwords in production. The importer refuses to replace an active exam.

6. Run the read-only launch check:

   ```text
   npm run deploy:check -- --env-file .env.production.local
   ```

   It checks settings, connectivity, private table access/RLS, all 15 questions, the roster, administrator passwords, the latest watchdog and exactly one active per-second schedule. It exits unsuccessfully on a blocker and changes no records. It never implicitly reads `.env.local`. Existing shell variables take precedence over the explicit file. Connection secrets and paper content are not printed.

## Deploy

Set the same variables in the host's server-side Production environment. Never prefix secrets with `NEXT_PUBLIC_`. Leave `PGSSL=disable` and `ALLOW_LOCAL_PRODUCTION` unset. `CRON_SECRET` is optional for pg_cron; use a separate random secret of at least 32 characters if enabling an external watchdog caller.

On Vercel, import this directory, choose the production domain, configure the variables, and deploy. Configure a preview-specific `APP_ORIGIN` and database before testing Preview deployments. `.vercelignore` excludes local state, secrets, private papers, planning files, tests and generated artifacts from CLI uploads. Next's tracing exclusions also keep private source data out of server functions. Never publish the entire workspace as a static folder or public archive.

This workspace is currently inside a parent Git repository that ignores this folder. For Git-based hosting, publish this directory as its own repository first. A Vercel CLI deployment can use the directory directly with the supplied upload exclusions.

For another Node host, run `npm ci`, `npm run build`, then `npm start` with the production environment. The server binds to `0.0.0.0` and uses the host's `PORT` (default 3000). Terminate HTTPS at the hosting proxy and disable proxy buffering for `/api/events`.

## Before admitting students

- Open the final HTTPS domain and sign in as administrator. Rehearse the full student flow on the separate staging database. Leave production papers unreleased until the exam starts.
- Confirm successful watchdog execution logs. Unauthenticated `/api/admin/export` and `/api/cron/watchdog` must return 401.
- `/api/health` checks process liveness only. Its 200 response does not verify the database; require the launch check to pass against the deployed environment.
- Retain a private database backup and record the deployed revision. Roll back application code by redeploying a compatible earlier version; do not reset the database or rerun imports during an exam.

The code can be verified without production credentials. A hosted release still requires the database, scheduler, secrets and domain to be provisioned and checked.
