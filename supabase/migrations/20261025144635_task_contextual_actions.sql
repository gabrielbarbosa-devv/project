-- Duplicate a task and its current labels/checklist atomically. Activity history
-- is intentionally not copied; database triggers record only the new task's
-- creation and newly-created checklist/label assignments.
create or replace function public.duplicate_task(
  p_task_id uuid,
  p_request_id uuid
)
returns setof public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace_id uuid;
  v_original public.tasks%rowtype;
  v_existing public.tasks%rowtype;
  v_duplicate public.tasks%rowtype;
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

  if p_task_id is null or p_request_id is null then
    raise exception 'Invalid task input';
  end if;

  -- The client reuses this UUID if the network drops after commit. The primary
  -- key makes the retry return the original duplicate instead of inserting a
  -- second one. Scope is always derived from the current authenticated user.
  select *
    into v_existing
    from public.tasks as task
   where task.id = p_request_id
     and task.workspace_id = v_workspace_id
     and task.created_by = v_user_id;
  if found then
    return next v_existing;
    return;
  end if;

  select *
    into v_original
    from public.tasks as task
   where task.id = p_task_id
     and task.workspace_id = v_workspace_id
     and task.archived_at is null
   for update;
  if not found then
    raise exception 'Task is unavailable';
  end if;

  insert into public.tasks (
    id, workspace_id, created_by, project_id, title, description,
    planned_for, start_time, due_on, priority, status, completed_at, archived_at
  ) values (
    p_request_id, v_workspace_id, v_user_id, v_original.project_id,
    left(v_original.title, 152) || ' (cópia)', v_original.description,
    v_original.planned_for, v_original.start_time, v_original.due_on,
    v_original.priority, 'pending', null, null
  ) returning * into v_duplicate;

  insert into public.task_label_assignments (workspace_id, task_id, label_id)
  select v_workspace_id, v_duplicate.id, assignment.label_id
    from public.task_label_assignments as assignment
   where assignment.workspace_id = v_workspace_id
     and assignment.task_id = v_original.id
  on conflict (task_id, label_id) do nothing;

  insert into public.task_checklist_items (task_id, workspace_id, title, position)
  select v_duplicate.id, v_workspace_id, item.title, item.position
    from public.task_checklist_items as item
   where item.workspace_id = v_workspace_id
     and item.task_id = v_original.id
   order by item.position, item.created_at;

  return next v_duplicate;
end;
$$;

revoke all on function public.duplicate_task(uuid, uuid) from public, anon;
grant execute on function public.duplicate_task(uuid, uuid) to authenticated;
