alter table public.workspaces
  add column persona public.user_persona not null default 'creator';

revoke insert on public.workspace_members from authenticated;
drop policy "Owners can create their own membership" on public.workspace_members;

revoke insert on public.workspaces from authenticated;
grant insert (name, slug, created_by, persona) on public.workspaces to authenticated;

create or replace function public.initialize_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is distinct from auth.uid() then
    raise exception 'Workspace owner must be the authenticated user';
  end if;

  perform 1 from public.profiles
  where id = new.created_by and onboarding_state = 'workspace'
  for update;
  if not found then
    raise exception 'Workspace setup has already started';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  update public.profiles
  set persona = new.persona,
      primary_workspace_id = new.id,
      onboarding_state = 'channels',
      updated_at = now()
  where id = new.created_by;

  return new;
end;
$$;

revoke all on function public.initialize_workspace_owner() from public, anon, authenticated;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.initialize_workspace_owner();

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

  insert into public.workspaces (name, slug, created_by, persona)
  values (trim(p_name), v_slug, v_user_id, p_persona)
  returning id into v_workspace_id;

  return v_workspace_id;
end;
$$;

revoke all on function public.create_workspace_for_current_user(text, public.user_persona) from public, anon, authenticated;
grant execute on function public.create_workspace_for_current_user(text, public.user_persona) to authenticated;
