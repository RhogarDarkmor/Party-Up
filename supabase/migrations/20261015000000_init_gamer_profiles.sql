create table public.gamer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 2 and 40),
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  timezone text not null default 'America/Sao_Paulo',
  preferred_language text not null default 'pt-BR',
  play_style text
    check (play_style in ('casual', 'competitive', 'cooperative', 'social')),
  communication_preference text
    check (communication_preference in ('voice', 'text', 'any')),
  privacy_settings jsonb not null default
    '{"show_bio": true, "show_availability": true}'::jsonb
    check (jsonb_typeof(privacy_settings) = 'object'),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.gamer_profiles enable row level security;

revoke all on table public.gamer_profiles from anon, authenticated;
grant select, insert, update, delete on table public.gamer_profiles to authenticated;

create policy "gamer_profiles_select_own"
  on public.gamer_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "gamer_profiles_insert_own"
  on public.gamer_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "gamer_profiles_update_own"
  on public.gamer_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "gamer_profiles_delete_own"
  on public.gamer_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_gamer_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger gamer_profiles_set_updated_at
  before update on public.gamer_profiles
  for each row
  execute function public.set_gamer_profile_updated_at();
