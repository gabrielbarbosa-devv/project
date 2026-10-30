alter table public.tasks
  drop constraint tasks_status_check,
  drop constraint tasks_status_completed_at_consistent;

alter table public.tasks
  add constraint tasks_status_check
    check (status in ('pending', 'in_progress', 'completed', 'paused')),
  add constraint tasks_status_completed_at_consistent
    check (
      (status = 'completed' and completed_at is not null)
      or (status <> 'completed' and completed_at is null)
    );

create or replace function public.update_task_with_labels(
  p_task_id uuid,
  p_title text,
  p_description text,
  p_project_id uuid,
  p_planned_for date,
  p_start_time time without time zone,
  p_due_on date,
  p_priority text,
  p_status text,
  p_label_ids uuid[],
  p_new_label_names text[]
)
returns setof public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace_id uuid;
  v_task public.tasks%rowtype;
  v_name text;
  v_name_key text;
  v_label_id uuid;
  v_requested_count integer;
  v_found_count integer;
  v_all_label_ids uuid[] := coalesce(p_label_ids, array[]::uuid[]);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select membership.workspace_id
    into v_workspace_id
    from public.profiles as profile
    join public.workspace_members as membership
      on membership.workspace_id = profile.primary_workspace_id
     and membership.user_id = profile.id
   where profile.id = v_user_id
     and profile.onboarding_state = 'complete'
     and membership.role in ('owner', 'admin', 'member');

  if v_workspace_id is null then
    raise exception 'Workspace access required';
  end if;

  if p_task_id is null
     or p_title is null
     or char_length(btrim(p_title)) not between 1 and 160
     or char_length(coalesce(p_description, '')) > 4000
     or p_priority not in ('low', 'medium', 'high')
     or p_status not in ('pending', 'in_progress', 'completed', 'paused')
     or (p_start_time is not null and p_planned_for is null)
     or coalesce(cardinality(p_label_ids), 0) > 20
     or coalesce(cardinality(p_new_label_names), 0) > 20 then
    raise exception 'Invalid task input';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects as project
     where project.id = p_project_id and project.workspace_id = v_workspace_id
  ) then
    raise exception 'Project is outside the active workspace';
  end if;

  select count(distinct selected.label_id)::integer into v_requested_count
    from unnest(v_all_label_ids) as selected(label_id);
  select count(*)::integer into v_found_count
    from public.task_labels as label
   where label.workspace_id = v_workspace_id and label.id = any(v_all_label_ids);
  if v_requested_count <> v_found_count then
    raise exception 'A selected label is outside the active workspace';
  end if;

  select * into v_task
    from public.tasks as task
   where task.id = p_task_id and task.workspace_id = v_workspace_id
   for update;
  if not found then
    raise exception 'Task access required';
  end if;

  update public.tasks as task
     set title = btrim(p_title),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         project_id = p_project_id,
         planned_for = p_planned_for,
         start_time = p_start_time,
         due_on = p_due_on,
         priority = p_priority,
         status = p_status,
         completed_at = case
           when p_status = 'completed' then coalesce(task.completed_at, pg_catalog.now())
           else null
         end
   where task.id = p_task_id and task.workspace_id = v_workspace_id
   returning * into v_task;

  for v_name in
    select distinct pg_catalog.regexp_replace(pg_catalog.btrim(raw_name), '[[:space:]]+', ' ', 'g')
      from unnest(coalesce(p_new_label_names, array[]::text[])) as names(raw_name)
     where pg_catalog.btrim(raw_name) <> ''
  loop
    if char_length(v_name) not between 2 and 40 then
      raise exception 'Invalid label name';
    end if;
    v_name_key := pg_catalog.lower(v_name);
    insert into public.task_labels (workspace_id, created_by, name, color)
    values (v_workspace_id, v_user_id, v_name, 'violet')
    on conflict (workspace_id, name_key) do nothing;
    select label.id into v_label_id
      from public.task_labels as label
     where label.workspace_id = v_workspace_id and label.name_key = v_name_key;
    v_all_label_ids := pg_catalog.array_append(v_all_label_ids, v_label_id);
  end loop;

  select count(distinct selected.label_id)::integer into v_requested_count
    from unnest(v_all_label_ids) as selected(label_id);
  select count(*)::integer into v_found_count
    from public.task_labels as label
   where label.workspace_id = v_workspace_id and label.id = any(v_all_label_ids);
  if v_requested_count <> v_found_count then
    raise exception 'A selected label is outside the active workspace';
  end if;

  delete from public.task_label_assignments as assignment
   where assignment.workspace_id = v_workspace_id
     and assignment.task_id = p_task_id
     and not (assignment.label_id = any(v_all_label_ids));

  insert into public.task_label_assignments (workspace_id, task_id, label_id)
  select v_workspace_id, p_task_id, selected.label_id
    from unnest(v_all_label_ids) as selected(label_id)
  on conflict (task_id, label_id) do nothing;

  return next v_task;
end;
$$;

revoke all on function public.update_task_with_labels(uuid, text, text, uuid, date, time without time zone, date, text, text, uuid[], text[]) from public, anon;
grant execute on function public.update_task_with_labels(uuid, text, text, uuid, date, time without time zone, date, text, text, uuid[], text[]) to authenticated;
