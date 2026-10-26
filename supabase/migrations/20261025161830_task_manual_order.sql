alter table public.tasks
  add column if not exists sort_order integer;

grant update (sort_order) on public.tasks to authenticated;

create or replace function public.reorder_task_group(
  p_group_key text,
  p_task_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace_id uuid;
  v_today date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
  v_expected_ids uuid[];
  v_received_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_group_key not in ('today', 'overdue', 'completed', 'upcoming', 'unscheduled', 'other') then
    raise exception 'Invalid task group';
  end if;

  if p_task_ids is null or pg_catalog.cardinality(p_task_ids) < 1 or pg_catalog.cardinality(p_task_ids) > 500 then
    raise exception 'Invalid task list';
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

  select pg_catalog.array_agg(task.id order by task.id)
    into v_expected_ids
    from public.tasks as task
   where task.workspace_id = v_workspace_id
     and task.archived_at is null
     and case
       when task.status = 'completed' then 'completed'
       when task.due_on is not null and task.due_on < v_today then 'overdue'
       when task.planned_for = v_today or task.due_on = v_today then 'today'
       when (task.planned_for is not null and task.planned_for > v_today)
         or (task.due_on is not null and task.due_on > v_today) then 'upcoming'
       when task.planned_for is null and task.due_on is null then 'unscheduled'
       else 'other'
     end = p_group_key;

  select pg_catalog.array_agg(task_id order by task_id)
    into v_received_ids
    from (
      select distinct requested.task_id
        from pg_catalog.unnest(p_task_ids) as requested(task_id)
    ) as unique_ids;

  if pg_catalog.cardinality(p_task_ids) <> pg_catalog.cardinality(v_received_ids)
     or coalesce(v_expected_ids, array[]::uuid[]) is distinct from coalesce(v_received_ids, array[]::uuid[]) then
    raise exception 'Task order must contain every task in this workspace group';
  end if;

  update public.tasks as task
     set sort_order = requested.position::integer
    from pg_catalog.unnest(p_task_ids) with ordinality as requested(task_id, position)
   where task.id = requested.task_id
     and task.workspace_id = v_workspace_id
     and task.id = any(v_expected_ids)
     and task.archived_at is null;
end;
$$;

revoke all on function public.reorder_task_group(text, uuid[]) from public, anon;
grant execute on function public.reorder_task_group(text, uuid[]) to authenticated;
