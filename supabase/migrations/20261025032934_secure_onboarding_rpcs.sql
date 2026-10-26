create index profiles_primary_workspace_id_idx on public.profiles (primary_workspace_id);
create index workspaces_created_by_idx on public.workspaces (created_by);
create index channels_created_by_idx on public.channels (created_by);

drop policy "Workspace members can read their workspaces" on public.workspaces;
create policy "Users can read workspaces they created or joined"
  on public.workspaces for select to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.workspace_members as membership
      where membership.workspace_id = id
        and membership.user_id = (select auth.uid())
    )
  );

create policy "Users can create their own workspaces"
  on public.workspaces for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "Owners can create their own membership"
  on public.workspace_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1 from public.workspaces as workspace
      where workspace.id = workspace_id
        and workspace.created_by = (select auth.uid())
    )
  );

drop policy "Users can update their name" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and (
      (onboarding_state = 'workspace' and persona is null and primary_workspace_id is null)
      or (
        onboarding_state in ('channels', 'complete')
        and persona is not null
        and primary_workspace_id is not null
        and exists (
          select 1 from public.workspace_members as membership
          where membership.workspace_id = primary_workspace_id
            and membership.user_id = (select auth.uid())
            and membership.role = 'owner'
        )
      )
    )
  );

revoke insert on public.workspaces from authenticated;
grant insert (name, slug, created_by) on public.workspaces to authenticated;
grant insert (workspace_id, user_id, role) on public.workspace_members to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, persona, onboarding_state, primary_workspace_id, updated_at)
  on public.profiles to authenticated;

create or replace function public.create_workspace_for_current_user(
  p_name text,
  p_persona public.user_persona
)
returns uuid
language plpgsql
security invoker
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

create or replace function public.complete_my_onboarding()
returns void
language plpgsql
security invoker
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
        and membership.role = 'owner'
    );

  if not found then
    raise exception 'Workspace setup is incomplete';
  end if;
end;
$$;

revoke all on function public.create_workspace_for_current_user(text, public.user_persona) from public, anon, authenticated;
grant execute on function public.create_workspace_for_current_user(text, public.user_persona) to authenticated;
revoke all on function public.complete_my_onboarding() from public, anon, authenticated;
grant execute on function public.complete_my_onboarding() to authenticated;
