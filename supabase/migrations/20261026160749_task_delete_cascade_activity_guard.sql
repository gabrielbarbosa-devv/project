-- Child delete triggers may run during ON DELETE CASCADE after the parent task
-- has already been removed. Do not create activity that points back to a
-- missing task; manual checklist and label removals still retain their history.
create or replace function public.record_task_label_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := case when tg_op = 'INSERT' then new.workspace_id else old.workspace_id end;
  v_task_id uuid := case when tg_op = 'INSERT' then new.task_id else old.task_id end;
  v_label_id uuid := case when tg_op = 'INSERT' then new.label_id else old.label_id end;
  v_actor_id uuid := (select auth.uid());
  v_actor_name text;
  v_label_name text;
begin
  if v_actor_id is null or pg_catalog.pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' and not exists (
    select 1
      from public.tasks as task
     where task.id = v_task_id
       and task.workspace_id = v_workspace_id
  ) then
    return old;
  end if;

  select nullif(btrim(user_row.raw_user_meta_data ->> 'full_name'), '')
    into v_actor_name
    from auth.users as user_row
   where user_row.id = v_actor_id;
  select label.name into v_label_name from public.task_labels as label
   where label.id = v_label_id and label.workspace_id = v_workspace_id;

  insert into public.task_activity (task_id, workspace_id, actor_id, event_type, event_data)
  values (v_task_id, v_workspace_id, v_actor_id, 'task_labels_changed',
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'actor_name', v_actor_name,
      'action', case when tg_op = 'INSERT' then 'added' else 'removed' end,
      'label_name', v_label_name
    )));

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function public.record_task_checklist_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_name text;
  v_event_type text;
  v_task_id uuid := case when tg_op = 'DELETE' then old.task_id else new.task_id end;
  v_workspace_id uuid := case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;
  v_title text := case when tg_op = 'DELETE' then old.title else new.title end;
begin
  if v_actor_id is null or pg_catalog.pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' and not exists (
    select 1
      from public.tasks as task
     where task.id = v_task_id
       and task.workspace_id = v_workspace_id
  ) then
    return old;
  end if;

  select nullif(btrim(user_row.raw_user_meta_data ->> 'full_name'), '')
    into v_actor_name
    from auth.users as user_row
   where user_row.id = v_actor_id;

  if tg_op = 'INSERT' then
    v_event_type := 'checklist_item_added';
  elsif tg_op = 'DELETE' then
    v_event_type := 'checklist_item_deleted';
  elsif new.title is distinct from old.title then
    v_event_type := 'checklist_item_renamed';
  elsif new.is_completed is distinct from old.is_completed then
    v_event_type := case when new.is_completed then 'checklist_item_completed' else 'checklist_item_reopened' end;
  else
    return new;
  end if;

  insert into public.task_activity (task_id, workspace_id, actor_id, event_type, event_data)
  values (v_task_id, v_workspace_id, v_actor_id, v_event_type,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('actor_name', v_actor_name, 'title', v_title)));

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
