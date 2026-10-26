alter table public.profiles
  drop constraint if exists profiles_full_name_check;

alter table public.profiles
  add constraint profiles_full_name_check
  check (char_length(trim(full_name)) between 2 and 80);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_email_name text := trim(split_part(coalesce(new.email, ''), '@', 1));
begin
  if char_length(v_full_name) not between 2 and 80 then
    if char_length(v_email_name) between 2 and 120 then
      v_full_name := left(v_email_name, 80);
    else
      v_full_name := 'Novo usuário';
    end if;
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, v_full_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
