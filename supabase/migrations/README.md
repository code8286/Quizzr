# Database migrations

Apply migrations `001_portal.sql` through `005_module_start_and_portal_registration.sql` in numeric order to a dedicated Supabase project. Apply only missing migrations to existing databases. Migration 004 adds the roster and removes membership limits; 005 installs the module-selection timer and registration-aware watchdog. Enable pg_cron separately and schedule the watchdog once every second using the command in 002; later migrations preserve that schedule. See `docs/deployment.md` for the production launch check.

Review deny-by-default permissions before loading real question content. Test constraints and concurrent transactions against a local Supabase database.
