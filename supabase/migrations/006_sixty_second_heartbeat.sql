-- Allow 60 seconds without a heartbeat. Focus/tab events still lock immediately in the application.
-- Does not unlock teams or change their attempts. Existing cron schedule is retained.
begin;
create or replace function quiz_private.watchdog() returns void language plpgsql security definer set search_path='' as $$
declare ctl jsonb; rec record; event_id uuid; stamp bigint; threshold bigint; deadline bigint; score numeric;
begin
  select body into ctl from quiz_private.control where id=1 for update;
  stamp := floor(extract(epoch from clock_timestamp())*1000);
  -- Upgrade module-selection screens opened under the earlier start-on-entry rule.
  for rec in select a.id,a.team_id,a.body from quiz_private.attempts a
    join quiz_private.teams t on t.id=a.team_id and t.body->>'attemptId'=a.id::text
      and t.body->>'registrationClearedAt' is null
    where a.body->>'state' in ('active','paused') and (a.body->>'activeModule')::int=0
      and coalesce(jsonb_array_length(a.body->'sequence'),0)=0 and a.body->>'startedAt' is not null
  loop
    update quiz_private.attempts set body=body || jsonb_build_object('startedAt',null,'lastHeartbeat',null,'heartbeatSession',null,'revision',(body->>'revision')::int+1) where id=rec.id;
    event_id:=gen_random_uuid();
    insert into quiz_private.audit values(event_id,clock_timestamp(),jsonb_build_object('id',event_id,'actor','system','type','TIMER_AWAITING_MODULE','teamId',rec.team_id,'details','Timer awaits initial module selection','at',stamp));
  end loop;
  -- Every set has the same 40-minute wall-clock limit, including paused/locked teams.
  -- Finalize before checking monitoring so a disabled monitor cannot extend the exam.
  for rec in select a.id,a.team_id,a.body from quiz_private.attempts a
    join quiz_private.teams t on t.id=a.team_id and t.body->>'attemptId'=a.id::text and t.body->>'registrationClearedAt' is null
    where a.body->>'state' in ('active','paused')
      and stamp >= (a.body->>'startedAt')::bigint + 2400000
  loop
    deadline := (rec.body->>'startedAt')::bigint + 2400000;
    select coalesce(sum((p->>'marks')::numeric),0) into score from jsonb_array_elements(rec.body->'progress') p;
    update quiz_private.attempts set body=(body-'lockReason') || jsonb_build_object(
      'state','completed','completionReason','time_limit','completedAt',deadline,
      'total',score,'locked',false,'revision',(body->>'revision')::int+1) where id=rec.id;
    event_id:=gen_random_uuid();
    insert into quiz_private.audit values(event_id,to_timestamp(deadline/1000.0),jsonb_build_object(
      'id',event_id,'actor','watchdog','type','TIME_LIMIT_REACHED','teamId',rec.team_id,
      'details','40-minute limit reached; earned marks finalized','at',deadline));
  end loop;
  if not (ctl->>'monitoring')::boolean or not (ctl->>'released')::boolean or (ctl->>'closed')::boolean then return; end if;
  threshold := coalesce((ctl->>'heartbeatTimeout')::bigint,60000);
  for rec in select a.id,a.team_id,a.body from quiz_private.attempts a
    join quiz_private.teams t on t.id=a.team_id and t.body->>'attemptId'=a.id::text and t.body->>'registrationClearedAt' is null
    where a.body->>'state'='active' and a.body->>'startedAt' is not null and not (a.body->>'locked')::boolean
      and stamp-(a.body->>'lastHeartbeat')::bigint>threshold
  loop
    update quiz_private.attempts set body=body || jsonb_build_object('locked',true,
      'lockReason','Heartbeat connection lost. Ask the administrator to restore access.',
      'revision',(body->>'revision')::int+1) where id=rec.id;
    event_id:=gen_random_uuid();
    insert into quiz_private.audit values(event_id,clock_timestamp(),jsonb_build_object('id',event_id,'actor','watchdog','type','HEARTBEAT_MISSED','teamId',rec.team_id,'details','Heartbeat connection lost','at',stamp));
  end loop;
end $$;
revoke all on function quiz_private.watchdog() from public,anon,authenticated;

update quiz_private.control set body=jsonb_set(body,'{heartbeatTimeout}','60000'::jsonb) || jsonb_build_object('version',coalesce((body->>'version')::int,1)+1) where id=1;
commit;
