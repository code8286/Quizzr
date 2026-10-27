# Trusted service boundary

`engine.ts` owns assessment rules; `store.ts` owns atomic local/PostgreSQL transactions; `gateway.ts` validates and routes requests; `session.ts` and `security.ts` own cookies and credential hashing.

The current rules are implemented in `engine-v2.ts` and re-exported by `engine.ts`. Read snapshots and scoped heartbeats avoid the aggregate writer path; see `docs/performance.md`. Exam closure and paper release are independent controls. Class replacement and progress reset are explicit operator scripts, outside normal request handling; see `docs/class-replacement.md` and `docs/implementation.md`.

The gateway and sessions are server-only. Domain/database files use Node APIs and are shared with trusted setup tooling and tests. Keep them out of client imports.
