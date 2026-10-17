create table public.game_catalog (
  slug text primary key
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  genre text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.game_catalog enable row level security;

revoke all on table public.game_catalog from anon, authenticated;
grant select on table public.game_catalog to authenticated;

create policy "game_catalog_select_active"
  on public.game_catalog
  for select
  to authenticated
  using (is_active);

insert into public.game_catalog (slug, name, genre)
values
  ('apex-legends', 'Apex Legends', 'Battle royale'),
  ('counter-strike-2', 'Counter-Strike 2', 'FPS tático'),
  ('destiny-2', 'Destiny 2', 'Ação e RPG'),
  ('fortnite', 'Fortnite', 'Battle royale'),
  ('league-of-legends', 'League of Legends', 'MOBA'),
  ('minecraft', 'Minecraft', 'Sandbox'),
  ('overwatch-2', 'Overwatch 2', 'Hero shooter'),
  ('rocket-league', 'Rocket League', 'Esportes'),
  ('valorant', 'VALORANT', 'FPS tático'),
  ('warframe', 'Warframe', 'Ação e RPG');

create table public.gamer_profile_games (
  user_id uuid not null
    references public.gamer_profiles (user_id) on delete cascade,
  game_slug text not null
    references public.game_catalog (slug) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, game_slug)
);

alter table public.gamer_profile_games enable row level security;

revoke all on table public.gamer_profile_games from anon, authenticated;
grant select on table public.gamer_profile_games to authenticated;

create policy "gamer_profile_games_select_own"
  on public.gamer_profile_games
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "gamer_profile_games_insert_own"
  on public.gamer_profile_games
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "gamer_profile_games_delete_own"
  on public.gamer_profile_games
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.replace_current_user_games(p_game_slugs text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected_count integer := coalesce(cardinality(p_game_slugs), 0);
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if selected_count > 20 then
    raise exception 'Too many selected games'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(coalesce(p_game_slugs, array[]::text[])) as requested(slug)
    left join public.game_catalog as catalog
      on catalog.slug = requested.slug
      and catalog.is_active
    where catalog.slug is null
  ) then
    raise exception 'One or more games are unavailable'
      using errcode = '22023';
  end if;

  delete from public.gamer_profile_games
  where user_id = current_user_id;

  insert into public.gamer_profile_games (user_id, game_slug)
  select current_user_id, requested.slug
  from (
    select distinct slug
    from pg_catalog.unnest(coalesce(p_game_slugs, array[]::text[])) as requested(slug)
  ) as requested;
end;
$$;

revoke all on function public.replace_current_user_games(text[]) from PUBLIC, anon;
grant execute on function public.replace_current_user_games(text[]) to authenticated;
