create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_workspace_id_id_key unique (workspace_id, id)
);

create unique index projects_workspace_name_unique_idx
  on public.projects (workspace_id, lower(name));

create index projects_workspace_id_idx on public.projects (workspace_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  project_id uuid null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text null check (description is null or char_length(description) <= 4000),
  planned_for date null,
  start_time time without time zone null,
  due_on date null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_workspace_project_fkey
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id)
    on delete set null (project_id),
  constraint tasks_status_completed_at_consistent check (
    (status = 'completed' and completed_at is not null)
    or (status = 'pending' and completed_at is null)
  )
);

create index tasks_workspace_archived_idx on public.tasks (workspace_id, archived_at);
create index tasks_workspace_status_idx on public.tasks (workspace_id, status);
create index tasks_workspace_planned_for_idx on public.tasks (workspace_id, planned_for);
create index tasks_workspace_due_on_idx on public.tasks (workspace_id, due_on);
create index tasks_workspace_project_idx on public.tasks (workspace_id, project_id);

alter table public.projects enable row level security;
alter table public.tasks enable row level security;

create policy "Workspace members can read projects"
  on public.projects for select to authenticated
  using (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = projects.workspace_id
        and membership.user_id = (select auth.uid())
    )
  );

create policy "Workspace managers can create projects"
  on public.projects for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = projects.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin')
    )
  );

create policy "Workspace managers can rename projects"
  on public.projects for update to authenticated
  using (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = projects.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = projects.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin')
    )
  );

create policy "Workspace members can read tasks"
  on public.tasks for select to authenticated
  using (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = tasks.workspace_id
        and membership.user_id = (select auth.uid())
    )
  );

create policy "Workspace members can create tasks"
  on public.tasks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = tasks.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin', 'member')
    )
  );

create policy "Workspace members can update tasks"
  on public.tasks for update to authenticated
  using (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = tasks.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin', 'member')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = tasks.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin', 'member')
    )
  );

create policy "Workspace members can delete tasks"
  on public.tasks for delete to authenticated
  using (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = tasks.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin', 'member')
    )
  );

revoke all on public.projects, public.tasks from anon, authenticated;
grant select on public.projects to authenticated;
grant insert (workspace_id, created_by, name) on public.projects to authenticated;
grant update (name) on public.projects to authenticated;
grant select, delete on public.tasks to authenticated;
grant insert (
  workspace_id, created_by, project_id, title, description,
  planned_for, start_time, due_on, priority, status,
  completed_at, archived_at
) on public.tasks to authenticated;
grant update (
  project_id, title, description, planned_for, start_time, due_on,
  priority, status, completed_at, archived_at
) on public.tasks to authenticated;

create or replace function public.touch_amora_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.touch_amora_updated_at() from public, anon, authenticated;

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_amora_updated_at();

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_amora_updated_at();
