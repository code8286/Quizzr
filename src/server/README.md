# Trusted service boundary

`engine.ts` owns assessment rules; `store.ts` owns atomic local/PostgreSQL transactions; `gateway.ts` validates and routes requests; `session.ts` and `security.ts` own cookies and credential hashing.

The gateway and sessions are server-only. Domain/database files use Node APIs and are shared with trusted setup tooling and tests. Keep them out of client imports.
