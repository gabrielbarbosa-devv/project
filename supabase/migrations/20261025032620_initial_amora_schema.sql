create type public.user_persona as enum ('creator', 'agency', 'brand');
create type public.workspace_role as enum ('owner', 'admin', 'member');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  persona public.user_persona,
  onboarding_state text not null default 'workspace'
    check (onboarding_state in ('workspace', 'channels', 'complete')),
  primary_workspace_id uuid references public.workspaces (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  platform text not null check (platform in ('youtube', 'instagram', 'tiktok', 'linkedin', 'facebook', 'podcast', 'other')),
  name text not null check (char_length(trim(name)) between 2 and 80),
  handle text,
  url text check (url is null or url ~ '^https?://'),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index channels_workspace_id_idx on public.channels (workspace_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.channels enable row level security;

create policy "Users can read their profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their name"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Workspace members can read their workspaces"
  on public.workspaces for select to authenticated
  using (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = id
        and membership.user_id = (select auth.uid())
    )
  );

create policy "Users can read their own memberships"
  on public.workspace_members for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Workspace managers can read channels"
  on public.channels for select to authenticated
  using (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = channels.workspace_id
        and membership.user_id = (select auth.uid())
    )
  );

create policy "Workspace owners and admins can add channels"
  on public.channels for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = channels.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin')
    )
  );

create policy "Workspace owners and admins can edit channels"
  on public.channels for update to authenticated
  using (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = channels.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = channels.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin')
    )
  );

create policy "Workspace owners and admins can remove channels"
  on public.channels for delete to authenticated
  using (
    exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = channels.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role in ('owner', 'admin')
    )
  );

revoke all on public.profiles, public.workspaces, public.workspace_members, public.channels from anon, authenticated;
grant select on public.profiles, public.workspaces, public.workspace_members to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, delete on public.channels to authenticated;
grant insert (workspace_id, platform, name, handle, url, created_by) on public.channels to authenticated;
grant update (platform, name, handle, url) on public.channels to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    case
      when char_length(trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''))) between 2 and 120
        then trim(new.raw_user_meta_data ->> 'full_name')
      when char_length(trim(coalesce(split_part(coalesce(new.email, ''), '@', 1), ''))) between 2 and 120
        then trim(split_part(coalesce(new.email, ''), '@', 1))
      else 'Novo usuário'
    end
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_workspace_for_current_user(
  p_name text,
  p_persona public.user_persona
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(p_name)) not between 2 and 80 then
    raise exception 'Workspace name must be between 2 and 80 characters';
  end if;

  if p_persona is null then
    raise exception 'Choose a workspace persona';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile not found';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id and onboarding_state = 'workspace'
  ) then
    raise exception 'Workspace setup has already started';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'workspace';
  end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.workspaces (name, slug, created_by)
  values (trim(p_name), v_slug, v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');

  update public.profiles
  set persona = p_persona,
      primary_workspace_id = v_workspace_id,
      onboarding_state = 'channels',
      updated_at = now()
  where id = v_user_id;

  return v_workspace_id;
end;
$$;

revoke all on function public.create_workspace_for_current_user(text, public.user_persona) from public, anon, authenticated;
grant execute on function public.create_workspace_for_current_user(text, public.user_persona) to authenticated;

create or replace function public.complete_my_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles as profile
  set onboarding_state = 'complete', updated_at = now()
  where profile.id = v_user_id
    and profile.primary_workspace_id is not null
    and profile.onboarding_state = 'channels'
    and exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = profile.primary_workspace_id
        and membership.user_id = v_user_id
    );

  if not found then
    raise exception 'Workspace setup is incomplete';
  end if;
end;
$$;

revoke all on function public.complete_my_onboarding() from public, anon, authenticated;
grant execute on function public.complete_my_onboarding() to authenticated;
