alter table public.gamer_profiles
  add column avatar_path text,
  add column show_in_discovery boolean not null default false;

create table public.platform_catalog (
  slug text primary key
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  badge text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.platform_catalog enable row level security;

revoke all on table public.platform_catalog from anon, authenticated;
grant select on table public.platform_catalog to authenticated;

create policy "platform_catalog_select_active"
  on public.platform_catalog
  for select
  to authenticated
  using (is_active);

insert into public.platform_catalog (slug, name, badge)
values
  ('pc', 'PC', 'PC'),
  ('playstation', 'PlayStation', 'PS'),
  ('xbox', 'Xbox', 'X'),
  ('nintendo-switch', 'Nintendo Switch', 'NS'),
  ('mobile', 'Mobile', 'M');

create table public.gamer_profile_platforms (
  user_id uuid not null
    references public.gamer_profiles (user_id) on delete cascade,
  platform_slug text not null
    references public.platform_catalog (slug) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, platform_slug)
);

alter table public.gamer_profile_platforms enable row level security;

revoke all on table public.gamer_profile_platforms from anon, authenticated;
grant select on table public.gamer_profile_platforms to authenticated;

create policy "gamer_profile_platforms_select_own"
  on public.gamer_profile_platforms
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'partyup-avatars',
  'partyup-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

create or replace function public.can_read_discovery_avatar(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())::text
    or exists (
      select 1
      from public.gamer_profiles as profile
      where profile.user_id::text = p_user_id
        and profile.show_in_discovery
    );
$$;

revoke all on function public.can_read_discovery_avatar(text) from PUBLIC, anon;
grant execute on function public.can_read_discovery_avatar(text) to authenticated;

create policy "partyup_avatar_select_owner_or_visible_profile"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'partyup-avatars'
    and (storage.foldername(name))[2] = 'avatar'
    and public.can_read_discovery_avatar((storage.foldername(name))[1])
  );

create policy "partyup_avatar_insert_owner"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'partyup-avatars'
    and (storage.foldername(name))[2] = 'avatar'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "partyup_avatar_update_owner"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'partyup-avatars'
    and (storage.foldername(name))[2] = 'avatar'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'partyup-avatars'
    and (storage.foldername(name))[2] = 'avatar'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "partyup_avatar_delete_owner"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'partyup-avatars'
    and (storage.foldername(name))[2] = 'avatar'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.save_current_user_profile(
  p_display_name text,
  p_bio text,
  p_timezone text,
  p_preferred_language text,
  p_play_style text,
  p_communication_preference text,
  p_avatar_path text,
  p_show_in_discovery boolean,
  p_platform_slugs text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected_platform_count integer := coalesce(cardinality(p_platform_slugs), 0);
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_display_name is null
    or char_length(btrim(p_display_name)) not between 2 and 40
    or char_length(coalesce(p_bio, '')) > 280
    or p_timezone is null
    or p_timezone not in (
      'America/Sao_Paulo',
      'America/Manaus',
      'America/Fortaleza',
      'UTC'
    )
    or p_preferred_language is null
    or p_preferred_language not in ('pt-BR', 'en', 'es')
    or p_show_in_discovery is null
    or (p_play_style is not null and p_play_style not in (
      'casual',
      'competitive',
      'cooperative',
      'social'
    ))
    or (p_communication_preference is not null
      and p_communication_preference not in ('voice', 'text', 'any'))
  then
    raise exception 'Invalid profile details'
      using errcode = '22023';
  end if;

  if selected_platform_count > 5 then
    raise exception 'Too many selected platforms'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(
      coalesce(p_platform_slugs, array[]::text[])
    ) as requested(slug)
    left join public.platform_catalog as catalog
      on catalog.slug = requested.slug
      and catalog.is_active
    where catalog.slug is null
  ) then
    raise exception 'One or more platforms are unavailable'
      using errcode = '22023';
  end if;

  if p_avatar_path is not null
    and (
      p_avatar_path <> (current_user_id::text || '/avatar')
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = 'partyup-avatars'
          and object.name = p_avatar_path
      )
    )
  then
    raise exception 'Avatar is unavailable'
      using errcode = '22023';
  end if;

  insert into public.gamer_profiles (
    user_id,
    display_name,
    bio,
    timezone,
    preferred_language,
    play_style,
    communication_preference,
    avatar_path,
    show_in_discovery
  )
  values (
    current_user_id,
    btrim(p_display_name),
    nullif(btrim(coalesce(p_bio, '')), ''),
    p_timezone,
    p_preferred_language,
    nullif(p_play_style, ''),
    nullif(p_communication_preference, ''),
    p_avatar_path,
    p_show_in_discovery
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    bio = excluded.bio,
    timezone = excluded.timezone,
    preferred_language = excluded.preferred_language,
    play_style = excluded.play_style,
    communication_preference = excluded.communication_preference,
    avatar_path = excluded.avatar_path,
    show_in_discovery = excluded.show_in_discovery;

  delete from public.gamer_profile_platforms
  where user_id = current_user_id;

  insert into public.gamer_profile_platforms (user_id, platform_slug)
  select current_user_id, requested.slug
  from (
    select distinct slug
    from pg_catalog.unnest(
      coalesce(p_platform_slugs, array[]::text[])
    ) as requested(slug)
  ) as requested;
end;
$$;

revoke all on function public.save_current_user_profile(
  text, text, text, text, text, text, text, boolean, text[]
) from PUBLIC, anon;
grant execute on function public.save_current_user_profile(
  text, text, text, text, text, text, text, boolean, text[]
) to authenticated;

create or replace function public.discover_gamers(
  p_game_slug text default null,
  p_platform_slug text default null,
  p_preferred_language text default null,
  p_play_style text default null,
  p_limit integer default 20
)
returns table (
  player_id uuid,
  display_name text,
  bio text,
  timezone text,
  preferred_language text,
  play_style text,
  communication_preference text,
  avatar_path text,
  platform_slugs text[],
  game_names text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_game_slug is null and p_platform_slug is null then
    raise exception 'Select a game or platform to search'
      using errcode = '22023';
  end if;

  if p_game_slug is not null and not exists (
    select 1
    from public.game_catalog
    where slug = p_game_slug and is_active
  ) then
    raise exception 'Selected game is unavailable'
      using errcode = '22023';
  end if;

  if p_platform_slug is not null and not exists (
    select 1
    from public.platform_catalog
    where slug = p_platform_slug and is_active
  ) then
    raise exception 'Selected platform is unavailable'
      using errcode = '22023';
  end if;

  if p_preferred_language is not null
    and p_preferred_language not in ('pt-BR', 'en', 'es')
  then
    raise exception 'Selected language is unavailable'
      using errcode = '22023';
  end if;

  if p_play_style is not null
    and p_play_style not in ('casual', 'competitive', 'cooperative', 'social')
  then
    raise exception 'Selected play style is unavailable'
      using errcode = '22023';
  end if;

  return query
  select
    profile.user_id,
    profile.display_name,
    case
      when coalesce(profile.privacy_settings ->> 'show_bio', 'true') = 'true'
        then profile.bio
      else null
    end,
    profile.timezone,
    profile.preferred_language,
    profile.play_style,
    profile.communication_preference,
    profile.avatar_path,
    coalesce(platforms.slugs, array[]::text[]),
    coalesce(games.names, array[]::text[])
  from public.gamer_profiles as profile
  left join lateral (
    select pg_catalog.array_agg(catalog.slug order by catalog.name) as slugs
    from public.gamer_profile_platforms as selected
    join public.platform_catalog as catalog
      on catalog.slug = selected.platform_slug
    where selected.user_id = profile.user_id
      and catalog.is_active
  ) as platforms on true
  left join lateral (
    select pg_catalog.array_agg(catalog.name order by catalog.name) as names
    from public.gamer_profile_games as selected
    join public.game_catalog as catalog
      on catalog.slug = selected.game_slug
    where selected.user_id = profile.user_id
      and catalog.is_active
  ) as games on true
  where profile.show_in_discovery
    and profile.user_id <> current_user_id
    and (p_preferred_language is null
      or profile.preferred_language = p_preferred_language)
    and (p_play_style is null or profile.play_style = p_play_style)
    and (
      p_game_slug is null
      or exists (
        select 1
        from public.gamer_profile_games as selected
        where selected.user_id = profile.user_id
          and selected.game_slug = p_game_slug
      )
    )
    and (
      p_platform_slug is null
      or exists (
        select 1
        from public.gamer_profile_platforms as selected
        where selected.user_id = profile.user_id
          and selected.platform_slug = p_platform_slug
      )
    )
  order by profile.display_name, profile.user_id
  limit least(greatest(coalesce(p_limit, 20), 1), 30);
end;
$$;

revoke all on function public.discover_gamers(
  text, text, text, text, integer
) from PUBLIC, anon;
grant execute on function public.discover_gamers(
  text, text, text, text, integer
) to authenticated;
