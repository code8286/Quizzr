-- Run after 001. pg_cron is available as an optional Supabase extension.
-- Enable pg_cron in the Supabase dashboard, then execute the final cron.schedule.
create or replace function quiz_private.watchdog() returns void language plpgsql security definer set search_path='' as $$
declare ctl jsonb; rec record; event_id uuid; stamp bigint; threshold bigint;
begin
  select body into ctl from quiz_private.control where id=1 for update;
  if not (ctl->>'monitoring')::boolean or not (ctl->>'released')::boolean or (ctl->>'closed')::boolean then return; end if;
  stamp := floor(extract(epoch from clock_timestamp())*1000);
  threshold := coalesce((ctl->>'heartbeatTimeout')::bigint,10000);
  for rec in select a.id,a.team_id,a.body from quiz_private.attempts a join quiz_private.teams t on t.id=a.team_id and t.body->>'attemptId'=a.id::text
    where a.body->>'state'='active' and not (a.body->>'locked')::boolean and stamp-(a.body->>'lastHeartbeat')::bigint>threshold
  loop
    update quiz_private.attempts set body=body || jsonb_build_object('locked',true,'lockReason','Heartbeat connection lost. Ask the administrator to restore access.','revision',(body->>'revision')::int+1) where id=rec.id;
    event_id:=gen_random_uuid();
    insert into quiz_private.audit values(event_id,clock_timestamp(),jsonb_build_object('id',event_id,'actor','watchdog','type','HEARTBEAT_MISSED','teamId',rec.team_id,'details','Heartbeat connection lost','at',stamp));
  end loop;
end $$;
revoke all on function quiz_private.watchdog() from public,anon,authenticated;
-- Enable after migration, once per database (do not schedule a duplicate job):
-- select cron.schedule('quiz-heartbeat-watchdog','1 second','select quiz_private.watchdog()');
