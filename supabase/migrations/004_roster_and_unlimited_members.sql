begin;
create table quiz_private.roster_teams(team_number integer primary key check(team_number>0),body jsonb not null);
create table quiz_private.roster_students(registration varchar(50) primary key,team_number integer not null references quiz_private.roster_teams(team_number));
alter table quiz_private.roster_teams enable row level security;
alter table quiz_private.roster_students enable row level security;
revoke all on quiz_private.roster_teams,quiz_private.roster_students from public,anon,authenticated;
-- Replace the original upper bound on team numbers without changing uniqueness.
alter table quiz_private.teams drop constraint teams_team_number_check;
alter table quiz_private.teams add constraint teams_team_number_check check(team_number>0);
-- Keep exactly one matching leader; member counts have no fixed upper bound.
create or replace function quiz_private.check_members() returns trigger language plpgsql set search_path='' as $$
declare tid uuid; n integer; leaders integer; matching integer;
begin
  tid:=new.team_id;
  select count(*),count(*) filter(where m.is_leader),count(*) filter(where m.is_leader and m.registration=p.registration)
  into n,leaders,matching from quiz_private.members m join quiz_private.teams t on t.id=m.team_id join quiz_private.profiles p on p.id=t.leader_id where m.team_id=tid;
  if n<1 or leaders<>1 or matching<>1 then raise exception 'A team requires its matching leader and roster members'; end if;
  if exists(select 1 from quiz_private.roster_teams) then
    if exists(select 1 from quiz_private.members m join quiz_private.teams t on t.id=m.team_id left join quiz_private.roster_students r on r.registration=m.registration and r.team_number=t.team_number where m.team_id=tid and r.registration is null)
      or n<>(select count(*) from quiz_private.roster_students r join quiz_private.teams t on t.team_number=r.team_number where t.id=tid)
    then raise exception 'Registration IDs must match the full imported roster team'; end if;
  end if;
  return null;
end $$;
revoke all on function quiz_private.check_members() from public,anon,authenticated;
commit;
