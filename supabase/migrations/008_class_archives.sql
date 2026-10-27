begin;
create table if not exists quiz_private.class_archives (
  id uuid primary key,
  created_at timestamptz not null,
  label text not null,
  body jsonb not null
);
alter table quiz_private.class_archives enable row level security;
revoke all on quiz_private.class_archives from public,anon,authenticated;
commit;
