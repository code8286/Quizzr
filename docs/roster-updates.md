# Updating the class roster

This page records the earlier 25 October cohort and remains the guide for edits within an existing cohort. That cohort was subsequently archived for the 53-student class described in [class replacement and recovery](class-replacement.md). Do not apply the historical counts below as a current database expectation.

The 25 October roster contains **11 teams and 54 students**. Team 8 and Team 10 now have six members each; Team 11 contains the two demo accounts. Teams 1–7 and Team 9 each have five members. Two existing students moved out of Team 11; two new IDs were added. The source is `C:\Current User Data\Downloads\Team_Data.csv`.

This roster was applied to both the local rehearsal and the configured live Supabase database on 25 October 2026. A read-only comparison verified the lookup index matches all 54 roster entries, and accounts, registered teams, attempts, papers and existing set assignments match the pre-update snapshot. The accompanying source changes were subsequently published to Vercel with the sixty-second heartbeat update. Refresh the live portal to use them.

The importer accepts the supplied blank first heading, as well as `REGISTER NO,NAME,Team No.`. Blank team numbers inherit the preceding number. IDs must be unique; all member IDs must match the resulting team at registration.

## What this update preserves

`roster:update` previews by default; `--apply` saves in one transaction. It preserves paper assignments for existing team numbers, release settings, accounts, registered teams, answers, scores and attempts. It records `ROSTER_UPDATED` in the admin audit and saves a private recovery snapshot under `.data/archive/` before writing. This is an application-state snapshot, not a full Supabase backup.

Membership changes to **any team with a saved registration**, including a cleared registration, are blocked. Clearing a registration does not remove its historical membership records. Those cases require a separate migration that preserves their history. The current update does not affect the saved Team 1 registration. Name-only roster changes do not change anyone's signup/login name or existing team display names.

New team numbers added after release require papers to be recalled first. Release again afterward to assign new groups balanced paper sets. The current update retains the same eleven team numbers and needs no recall.

## Local rehearsal

Open PowerShell in this project folder, then run:

```powershell
npm.cmd run roster:update -- "C:\Current User Data\Downloads\Team_Data.csv"
npm.cmd run roster:update -- "C:\Current User Data\Downloads\Team_Data.csv" --apply
```

The first command reports the changes and any blocked team numbers. The second applies an allowed update. Repeating it reports `Already up to date` and changes nothing. Keep the CSV and recovery files private; `.data/` is excluded from Git and Vercel uploads.

## Supabase: update the live database

Use the existing ignored `.env.production.local` on this trusted computer. Its `QUIZ_STORAGE=postgres` and `DATABASE_URL` must point to the **same Supabase project as Vercel Production**. Do not put the connection string into chat, the CSV or a public file.

In PowerShell, from this project folder:

```powershell
node --env-file=.env.production.local --import=tsx scripts/update-roster.ts "C:\Current User Data\Downloads\Team_Data.csv"
```

Confirm `Target: PostgreSQL (DATABASE_URL)` and review the preview. For the supplied file, the initial preview is 11 teams, 54 students, changed teams 8/10/11, two additions, two moves, zero removals and no blocked teams. If it already reports `Already up to date`, the update has already been applied.

Apply with:

```powershell
node --env-file=.env.production.local --import=tsx scripts/update-roster.ts "C:\Current User Data\Downloads\Team_Data.csv" --apply
```

Run the preview again to confirm it is up to date. This command connects directly to Supabase; there is no CSV upload in the Supabase Table Editor, and no new schema migration is needed. Do not rerun `class:import`, recreate tables, or reset the exam.

Optional confirmation: in Supabase → SQL Editor → New query, run this read-only query:

```sql
select t.team_number,
       jsonb_array_length(t.body->'members') as roster_members,
       count(s.registration)::integer as lookup_members
from quiz_private.roster_teams t
left join quiz_private.roster_students s using (team_number)
group by t.team_number, t.body
order by t.team_number;
```

Both counts should agree: Teams 8 and 10 = 6, Team 11 = 2, all others = 5; total = 54.

## Vercel: how the live site receives it

The deployed site reads this roster from Supabase on server requests. Once the live database is updated, refresh the portal and the new roster is available. **A roster-only update needs no Vercel environment-variable change or redeployment.** On Admin, the roster totals should show 11 teams and 54 members. Students register using the new team membership.

To deploy the accompanying importer/persistence code for future updates, publish this changed source using the same method as the existing project:

- Git deployment: commit and push the changed source to the repository/production branch connected to the `quizzr` Vercel project. Vercel builds that commit automatically. A dashboard redeploy of an old commit will not include changed local source.
- Vercel CLI deployment: from this project folder, run `npx vercel --prod` and select the existing `quizzr` project if prompted. Do not create a second project. The supplied `.vercelignore` excludes private data and environment files. See the [official Vercel deploy command reference](https://vercel.com/docs/cli/deploy).

Check the new deployment is Ready and open https://quizzr-phi.vercel.app. Keep the existing Production database variables. The roster data belongs in Supabase, not the Vercel build or public assets.
