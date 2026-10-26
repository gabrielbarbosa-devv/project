-- Persist checklist items and server-authenticated task activity.
create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  is_completed boolean not null default false,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_checklist_items_task_workspace_fkey
    foreign key (workspace_id, task_id)
    references public.tasks (workspace_id, id) on delete cascade,
  constraint task_checklist_items_position_key unique (workspace_id, task_id, position)
);

create index task_checklist_items_workspace_task_position_idx
  on public.task_checklist_items (workspace_id, task_id, position, created_at);

alter table public.task_checklist_items enable row level security;

create policy "Workspace members can read task checklist items"
  on public.task_checklist_items for select to authenticated
  using (exists (
    select 1 from public.workspace_members as membership
    where membership.workspace_id = task_checklist_items.workspace_id
      and membership.user_id = (select auth.uid())
  ));

create policy "Workspace editors can add task checklist items"
  on public.task_checklist_items for insert to authenticated
  with check (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = task_checklist_items.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin', 'member')
    )
    and exists (
      select 1 from public.tasks as task
      where task.id = task_checklist_items.task_id
        and task.workspace_id = task_checklist_items.workspace_id
    )
  );

create policy "Workspace editors can update task checklist items"
  on public.task_checklist_items for update to authenticated
  using (exists (
    select 1 from public.workspace_members as membership
    where membership.workspace_id = task_checklist_items.workspace_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin', 'member')
  ))
  with check (exists (
    select 1 from public.workspace_members as membership
    where membership.workspace_id = task_checklist_items.workspace_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin', 'member')
  ));

create policy "Workspace editors can delete task checklist items"
  on public.task_checklist_items for delete to authenticated
  using (exists (
    select 1 from public.workspace_members as membership
    where membership.workspace_id = task_checklist_items.workspace_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin', 'member')
  ));

revoke all on public.task_checklist_items from anon, authenticated;
grant select, delete on public.task_checklist_items to authenticated;
grant insert (task_id, workspace_id, title, position) on public.task_checklist_items to authenticated;
grant update (title, is_completed) on public.task_checklist_items to authenticated;

create trigger task_checklist_items_touch_updated_at
  before update on public.task_checklist_items
  for each row execute function public.touch_amora_updated_at();

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid null references auth.users (id) on delete set null,
  event_type text not null check (event_type in (
    'task_created', 'task_title_changed', 'task_priority_changed',
    'task_project_changed', 'task_schedule_changed', 'task_status_changed',
    'task_description_changed', 'task_labels_changed',
    'checklist_item_added', 'checklist_item_renamed',
    'checklist_item_completed', 'checklist_item_reopened', 'checklist_item_deleted'
  )),
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data) = 'object'),
  created_at timestamptz not null default now(),
  constraint task_activity_task_workspace_fkey
    foreign key (workspace_id, task_id)
    references public.tasks (workspace_id, id) on delete cascade
);

create index task_activity_workspace_task_created_idx
  on public.task_activity (workspace_id, task_id, created_at desc);
create index task_activity_actor_id_idx on public.task_activity (actor_id);

alter table public.task_activity enable row level security;

create policy "Workspace members can read task activity"
  on public.task_activity for select to authenticated
  using (exists (
    select 1 from public.workspace_members as membership
    where membership.workspace_id = task_activity.workspace_id
      and membership.user_id = (select auth.uid())
  ));

revoke all on public.task_activity from anon, authenticated;
grant select on public.task_activity to authenticated;

-- These trigger functions run inside the same transaction as their source changes.
-- They accept no actor identity from the client; auth.uid() is the source of truth.
create or replace function public.record_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_name text;
begin
  if v_actor_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select nullif(btrim(user_row.raw_user_meta_data ->> 'full_name'), '')
    into v_actor_name
    from auth.users as user_row
   where user_row.id = v_actor_id;

  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, workspace_id, actor_id, event_type, event_data)
    values (
      new.id, new.workspace_id, v_actor_id, 'task_created',
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('actor_name', v_actor_name))
    );
    return new;
  end if;

  if new.title is distinct from old.title then
    insert into public.task_activity (task_id, workspace_id, actor_id, event_type, event_data)
    values (new.id, new.workspace_id, v_actor_id, 'task_title_changed',
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('actor_name', v_actor_name, 'from', old.title, 'to', new.title)));
  end if;

  if new.priority is distinct from old.priority then
    insert into public.task_activity (task_id, workspace_id, actor_id, event_type, event_data)
    values (new.id, new.workspace_id, v_actor_id, 'task_priority_changed',
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('actor_name', v_actor_name, 'from', old.priority, 'to', new.priority)));
  end if;

  if new.project_id is distinct from old.project_id then
    insert into public.task_activity (task_id, workspace_id, actor_id, event_type, event_data)
    values (new.id, new.workspace_id, v_actor_id, 'task_project_changed',
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('actor_name', v_actor_name, 'from', old.project_id, 'to', new.project_id)));
  end if;

  if new.planned_for is distinct from old.planned_for
     or new.start_time is distinct from old.start_time
     or new.due_on is distinct from old.due_on then
    insert into public.task_activity (task_id, workspace_id, actor_id, event_type, event_data)
    values (new.id, new.workspace_id, v_actor_id, 'task_schedule_changed',
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'actor_name', v_actor_name,
        'planned_for', new.planned_for,
        'start_time', new.start_time,
        'due_on', new.due_on
      )));
  end if;

  if new.status is distinct from old.status then
    insert into public.task_activity (task_id, workspace_id, actor_id, event_type, event_data)
    values (new.id, new.workspace_id, v_actor_id, 'task_status_changed',
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('actor_name', v_actor_name, 'from', old.status, 'to', new.status)));
  end if;

  if new.description is distinct from old.description then
    insert into public.task_activity (task_id, workspace_id, actor_id, event_type, event_data)
    values (new.id, new.workspace_id, v_actor_id, 'task_description_changed',
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('actor_name', v_actor_name)));
  end if;

  return new;
end;
$$;

revoke all on function public.record_task_activity() from public, anon, authenticated;

create trigger tasks_record_activity_after_insert
  after insert on public.tasks
  for each row execute function public.record_task_activity();
create trigger tasks_record_activity_after_update
  after update on public.tasks
  for each row execute function public.record_task_activity();

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

revoke all on function public.record_task_label_activity() from public, anon, authenticated;

create trigger task_label_assignments_record_activity
  after insert or delete on public.task_label_assignments
  for each row execute function public.record_task_label_activity();

-- The RPC locks the parent task to assign collision-free positions and relies on RLS
-- for workspace membership. It is atomic with the checklist activity trigger.
create or replace function public.create_task_checklist_item(p_task_id uuid, p_title text)
returns setof public.task_checklist_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace_id uuid;
  v_position integer;
  v_item public.task_checklist_items%rowtype;
begin
  if v_user_id is null or p_title is null or char_length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Invalid checklist item';
  end if;

  select task.workspace_id into v_workspace_id
    from public.tasks as task
    join public.workspace_members as membership
      on membership.workspace_id = task.workspace_id
     and membership.user_id = v_user_id
     and membership.role in ('owner', 'admin', 'member')
   where task.id = p_task_id
   for update of task;

  if v_workspace_id is null then
    raise exception 'Task access required';
  end if;

  select coalesce(pg_catalog.max(item.position), -1) + 1 into v_position
    from public.task_checklist_items as item
   where item.workspace_id = v_workspace_id and item.task_id = p_task_id;

  insert into public.task_checklist_items (task_id, workspace_id, title, position)
  values (p_task_id, v_workspace_id, btrim(p_title), v_position)
  returning * into v_item;

  return next v_item;
end;
$$;

revoke all on function public.create_task_checklist_item(uuid, text) from public, anon;
grant execute on function public.create_task_checklist_item(uuid, text) to authenticated;

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

revoke all on function public.record_task_checklist_activity() from public, anon, authenticated;

create trigger task_checklist_items_record_activity
  after insert or update or delete on public.task_checklist_items
  for each row execute function public.record_task_checklist_activity();

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
     or p_status not in ('pending', 'completed')
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

create policy "Workspace editors can remove task label assignments"
  on public.task_label_assignments for delete to authenticated
  using (exists (
    select 1 from public.workspace_members as membership
    where membership.workspace_id = task_label_assignments.workspace_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin', 'member')
  ));

grant delete on public.task_label_assignments to authenticated;
