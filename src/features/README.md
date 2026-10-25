# Browser feature boundary

`portal.tsx` contains the student and admin views. `api.ts`, `math-text.tsx` and `use-monitoring.ts` own network calls, safe mathematical rendering and event/heartbeat reporting.

Own browser views, form state and API adapters. Quiz state is hydrated from the server. Client countdowns are displays of server timestamps and cannot authorize hints or prolong attempts.
