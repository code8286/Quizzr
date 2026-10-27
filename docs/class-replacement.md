# New class import — Team_Data_2.csv

The user approved replacing the active class and archiving the previous class. Applied to the live Supabase database on 26 October 2026.

- New roster: 53 students in Teams 1–11. Teams 1–10 have five members; Team 11 has three.
- Previous class: 11 registered teams and 26 attempts archived, together with the complete old roster, profiles, members, papers, control/settings and audit rows.
- Supabase archive: `quiz_private.class_archives`, ID `8d468faa-9205-434c-9b98-95e095643f0d`, label `Team_Data_2.csv`.
- Private recovery copy: `.data/archive/previous-class-8d468faa-9205-434c-9b98-95e095643f0d.json`.
- The fifteen existing questions and administrator accounts remain active. Previous student accounts/results are in the archive. New leaders create accounts using their new roster IDs and verify their teams normally.
- The new class starts open for registration with papers unreleased. Release papers in Admin when ready; this creates fresh balanced assignments for the new roster.

The live portal reads the new roster from Supabase immediately; this import does not require a Vercel rebuild or environment change. Refresh the admin/student portal.

## Inspect the archive

In the trusted Supabase SQL Editor:

```sql
select id, created_at, label,
       jsonb_array_length(body->'snapshot'->'teams') as registered_teams,
       jsonb_array_length(body->'snapshot'->'attempts') as saved_attempts
from quiz_private.class_archives
order by created_at desc;
```

Archive rows contain personal records and private paper data. They have RLS enabled and no browser-role access; keep recovery files private.

## Repeating this operation

For a completely new, non-overlapping cohort, use the explicit environment file so rehearsal settings cannot choose the target:

```powershell
node --import=tsx scripts/replace-class.ts --env-file .env.production.local --csv "C:\Current User Data\Downloads\Team_Data_2.csv" --apply
```

Repeating the same roster is a no-op and does not reset the new class. The script applies migration 008, locks the existing class, writes the local recovery copy and database archive before replacing active records, and rolls back the database transaction on failure. For edits within the same cohort, use `scripts/update-roster.ts` instead.
