# Database migrations

Apply migrations `001_portal.sql` through `008_class_archives.sql` in numeric order to a dedicated Supabase project. Apply only missing migrations to existing databases. Enable pg_cron separately and schedule the watchdog once every second using the command in 002; later watchdog migrations preserve that schedule. See [deployment](../../docs/deployment.md) for the launch check.

| Migration | Purpose |
| --- | --- |
| 001 | Private assessment tables, constraints, RLS and browser-role revocations. |
| 002 | Scheduled missed-heartbeat watchdog. |
| 003 | Forty-minute deadline finalization. |
| 004 | Imported roster and unrestricted team membership counts. |
| 005 | Timer start at initial module selection and registration-aware watchdog. |
| 006 | Sixty-second missed-heartbeat grace. |
| 007 | Watchdog freshness recheck compatible with concurrent heartbeat updates. |
| 008 | Private, RLS-protected archives for explicit class replacement. |

Migration 008 creates archive storage only; it does not replace a roster, reset attempts or delete active assessment data. The [class replacement procedure](../../docs/class-replacement.md) handles those operations separately with recovery archives.

Review deny-by-default permissions before loading real question content. Test constraints and concurrent transactions against a local Supabase database.
