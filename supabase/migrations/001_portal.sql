begin;
create schema if not exists quiz_private;
revoke all on schema quiz_private from public, anon, authenticated;

create table quiz_private.control (
  id integer primary key check(id=1), body jsonb not null, limits jsonb not null default '{}'
);
insert into quiz_private.control(id,body) values(1,'{"released":false,"closed":false,"practice":false,"monitoring":true,"version":1}');
create table quiz_private.profiles (
  id uuid primary key, registration varchar(50) not null unique,
  role text not null check(role in ('LEADER','ADMIN')), body jsonb not null,
  check(registration=upper(trim(registration)))
);
create table quiz_private.teams (
  id uuid primary key, team_number integer not null unique check(team_number between 1 and 12),
  leader_id uuid not null unique references quiz_private.profiles(id), body jsonb not null
);
create table quiz_private.members (
  team_id uuid not null references quiz_private.teams(id), registration varchar(50) primary key,
  is_leader boolean not null, name varchar(100) not null,
  check(registration=upper(trim(registration)))
);
create unique index one_leader_per_team on quiz_private.members(team_id) where is_leader;
create function quiz_private.check_members() returns trigger language plpgsql set search_path='' as $$
declare tid uuid; n integer; leaders integer; matching integer;
begin
  tid := new.team_id;
  select count(*),count(*) filter(where m.is_leader),count(*) filter(where m.is_leader and m.registration=p.registration)
  into n,leaders,matching from quiz_private.members m join quiz_private.teams t on t.id=m.team_id join quiz_private.profiles p on p.id=t.leader_id where m.team_id=tid;
  if n not between 1 and 5 or leaders<>1 or matching<>1 then raise exception 'A team requires 1-5 members and its matching leader'; end if;
  return null;
end $$;
create constraint trigger valid_team_members after insert or update on quiz_private.members deferrable initially deferred for each row execute function quiz_private.check_members();
create table quiz_private.attempts (
  id uuid primary key, team_id uuid not null references quiz_private.teams(id), body jsonb not null,
  check(body->>'state' in ('waiting','active','paused','completed','closed')),
  check(jsonb_array_length(body->'progress')=5),
  check((body->>'total')::numeric between 0 and 10)
);
create index attempts_team on quiz_private.attempts(team_id);
create table quiz_private.papers (
  id text primary key, set_id integer not null check(set_id between 1 and 3),
  module integer not null check(module between 1 and 5),version text not null,body jsonb not null,
  unique(version,set_id,module)
);
create table quiz_private.audit(id uuid primary key,created_at timestamptz not null,body jsonb not null);
create index audit_time on quiz_private.audit(created_at desc);

-- Defense in depth: no tables are exposed to Supabase browser roles.
alter table quiz_private.control enable row level security;
alter table quiz_private.profiles enable row level security;
alter table quiz_private.teams enable row level security;
alter table quiz_private.members enable row level security;
alter table quiz_private.attempts enable row level security;
alter table quiz_private.papers enable row level security;
alter table quiz_private.audit enable row level security;
revoke all on all tables in schema quiz_private from public,anon,authenticated;
revoke all on all functions in schema quiz_private from public,anon,authenticated;
alter default privileges in schema quiz_private revoke all on tables from public,anon,authenticated;
commit;
