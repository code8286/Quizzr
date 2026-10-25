# Safe contract boundary

`types.ts` defines safe student/admin views, question and result DTOs. Input validators live with the server engine.

Do not export database row types containing answer keys or undisclosed hints. Contracts described in `docs/integrations.md` are proposals until policy decisions are resolved.
