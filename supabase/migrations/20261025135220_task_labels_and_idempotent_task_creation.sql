-- Add workspace-scoped labels and an atomic, idempotent task creation RPC.
alter table public.tasks
  add constraint tasks_workspace_id_id_key unique (workspace_id, id);

create table public.task_labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  name_key text generated always as (lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))) stored,
  color text not null default 'violet' check (color in ('violet', 'blue', 'amber', 'green', 'rose', 'slate')),
  created_at timestamptz not null default now(),
  constraint task_labels_workspace_id_id_key unique (workspace_id, id),
  constraint task_labels_workspace_name_key unique (workspace_id, name_key)
);

create table public.task_label_assignments (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, label_id),
  constraint task_label_assignments_task_workspace_fkey
    foreign key (workspace_id, task_id)
    references public.tasks (workspace_id, id) on delete cascade,
  constraint task_label_assignments_label_workspace_fkey
    foreign key (workspace_id, label_id)
    references public.task_labels (workspace_id, id) on delete cascade
);

create index task_labels_workspace_id_idx on public.task_labels (workspace_id);
create index task_label_assignments_workspace_task_idx on public.task_label_assignments (workspace_id, task_id);
create index task_label_assignments_workspace_label_idx on public.task_label_assignments (workspace_id, label_id);

alter table public.task_labels enable row level security;
alter table public.task_label_assignments enable row level security;

create policy "Workspace members can read task labels"
  on public.task_labels for select to authenticated
  using (exists (
    select 1 from public.workspace_members as membership
    where membership.workspace_id = task_labels.workspace_id
      and membership.user_id = (select auth.uid())
  ));

create policy "Workspace members can create task labels"
  on public.task_labels for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = task_labels.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin', 'member')
    )
  );

create policy "Workspace members can read task label assignments"
  on public.task_label_assignments for select to authenticated
  using (exists (
    select 1 from public.workspace_members as membership
    where membership.workspace_id = task_label_assignments.workspace_id
      and membership.user_id = (select auth.uid())
  ));

create policy "Workspace members can assign task labels"
  on public.task_label_assignments for insert to authenticated
  with check (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = task_label_assignments.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin', 'member')
    )
    and exists (
      select 1 from public.tasks as task
      where task.id = task_label_assignments.task_id
        and task.workspace_id = task_label_assignments.workspace_id
    )
    and exists (
      select 1 from public.task_labels as label
      where label.id = task_label_assignments.label_id
        and label.workspace_id = task_label_assignments.workspace_id
    )
  );

revoke all on public.task_labels, public.task_label_assignments from anon, authenticated;
grant select on public.task_labels, public.task_label_assignments to authenticated;
grant insert (workspace_id, created_by, name, color) on public.task_labels to authenticated;
grant insert (workspace_id, task_id, label_id) on public.task_label_assignments to authenticated;

-- The UUID is generated once on the client for this submission and reused on retry.
-- This makes a repeated action idempotent without trusting it for identity or scope.
grant insert (id) on public.tasks to authenticated;

create or replace function public.create_task_with_labels(
  p_request_id uuid,
  p_title text,
  p_description text,
  p_project_id uuid,
  p_planned_for date,
  p_start_time time without time zone,
  p_due_on date,
  p_priority text,
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
  v_existing public.tasks%rowtype;
  v_task public.tasks%rowtype;
  v_name text;
  v_name_key text;
  v_label_id uuid;
  v_requested_label_count integer;
  v_found_label_count integer;
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

  if p_request_id is null
     or p_title is null
     or char_length(btrim(p_title)) not between 1 and 160
     or char_length(coalesce(p_description, '')) > 4000
     or p_priority not in ('low', 'medium', 'high')
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

  -- If this UUID already belongs to the same user in this workspace, this is a retry.
  select * into v_existing
    from public.tasks as task
   where task.id = p_request_id
     and task.workspace_id = v_workspace_id
     and task.created_by = v_user_id;
  if found then
    return next v_existing;
    return;
  end if;

  select count(distinct selected.label_id)::integer
    into v_requested_label_count
    from unnest(coalesce(p_label_ids, array[]::uuid[])) as selected(label_id);
  select count(*)::integer
    into v_found_label_count
    from public.task_labels as label
   where label.workspace_id = v_workspace_id
     and label.id = any(coalesce(p_label_ids, array[]::uuid[]));
  if v_found_label_count <> v_requested_label_count then
    raise exception 'A selected label is outside the active workspace';
  end if;

  insert into public.tasks (
    id, workspace_id, created_by, project_id, title, description,
    planned_for, start_time, due_on, priority
  ) values (
    p_request_id, v_workspace_id, v_user_id, p_project_id, btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''), p_planned_for,
    p_start_time, p_due_on, p_priority
  ) returning * into v_task;

  insert into public.task_label_assignments (workspace_id, task_id, label_id)
  select v_workspace_id, v_task.id, label_id
    from unnest(coalesce(p_label_ids, array[]::uuid[])) as selected(label_id)
  on conflict (task_id, label_id) do nothing;

  for v_name in
    select distinct regexp_replace(btrim(raw_name), '[[:space:]]+', ' ', 'g')
      from unnest(coalesce(p_new_label_names, array[]::text[])) as names(raw_name)
     where btrim(raw_name) <> ''
  loop
    if char_length(v_name) not between 2 and 40 then
      raise exception 'Invalid label name';
    end if;
    v_name_key := lower(v_name);
    insert into public.task_labels (workspace_id, created_by, name, color)
    values (v_workspace_id, v_user_id, v_name, 'violet')
    on conflict (workspace_id, name_key) do nothing;
    select label.id into v_label_id
      from public.task_labels as label
     where label.workspace_id = v_workspace_id
       and label.name_key = v_name_key;
    insert into public.task_label_assignments (workspace_id, task_id, label_id)
    values (v_workspace_id, v_task.id, v_label_id)
    on conflict (task_id, label_id) do nothing;
  end loop;

  return next v_task;
end;
$$;

revoke all on function public.create_task_with_labels(uuid, text, text, uuid, date, time without time zone, date, text, uuid[], text[]) from public, anon;
grant execute on function public.create_task_with_labels(uuid, text, text, uuid, date, time without time zone, date, text, uuid[], text[]) to authenticated;
