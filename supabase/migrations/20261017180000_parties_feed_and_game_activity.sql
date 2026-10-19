create table public.parties (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organizer_id uuid not null
    references public.gamer_profiles (user_id) on delete cascade,
  game_slug text not null
    references public.game_catalog (slug) on delete restrict,
  title text not null
    check (char_length(btrim(title)) between 3 and 80),
  description text
    check (char_length(description) <= 500),
  game_mode text not null
    check (game_mode in ('casual', 'competitive', 'cooperative', 'ranked')),
  starts_at timestamptz not null,
  language text not null
    check (language in ('pt-BR', 'en', 'es')),
  max_players smallint not null
    check (max_players between 2 and 8),
  status text not null default 'open'
    check (status in ('open', 'cancelled', 'completed')),
  created_at timestamptz not null default pg_catalog.now()
);

create table public.party_participants (
  party_id uuid not null
    references public.parties (id) on delete cascade,
  user_id uuid not null
    references public.gamer_profiles (user_id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'left')),
  joined_at timestamptz not null default pg_catalog.now(),
  primary key (party_id, user_id)
);

create index parties_open_feed_idx
  on public.parties (starts_at, game_slug, game_mode, language)
  where status = 'open';
create index party_participants_active_party_idx
  on public.party_participants (party_id)
  where status = 'active';
create index party_participants_user_idx
  on public.party_participants (user_id, party_id);

alter table public.parties enable row level security;
alter table public.party_participants enable row level security;

revoke all on table public.parties from PUBLIC, anon, authenticated;
revoke all on table public.party_participants from PUBLIC, anon, authenticated;

create function public.create_party(
  p_game_slug text,
  p_title text,
  p_description text,
  p_game_mode text,
  p_starts_at timestamp without time zone,
  p_language text,
  p_max_players integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_timezone text;
  start_instant timestamptz;
  new_party_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select profile.timezone
  into profile_timezone
  from public.gamer_profiles as profile
  where profile.user_id = current_user_id;

  if profile_timezone is null then
    raise exception 'Complete your gamer profile first' using errcode = '22023';
  end if;

  if p_title is null
    or char_length(btrim(p_title)) not between 3 and 80
    or char_length(coalesce(p_description, '')) > 500
    or p_game_slug is null
    or p_game_mode is null
    or p_game_mode not in ('casual', 'competitive', 'cooperative', 'ranked')
    or p_language is null
    or p_language not in ('pt-BR', 'en', 'es')
    or p_max_players is null
    or p_max_players not between 2 and 8
    or p_starts_at is null
  then
    raise exception 'Invalid party details' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.game_catalog as game
    where game.slug = p_game_slug
      and game.is_active
  ) then
    raise exception 'Game is unavailable' using errcode = '22023';
  end if;

  start_instant := p_starts_at at time zone profile_timezone;
  if start_instant <= pg_catalog.now()
    or start_instant > pg_catalog.now() + interval '60 days'
  then
    raise exception 'Party start time must be within the next 60 days'
      using errcode = '22023';
  end if;

  insert into public.parties (
    organizer_id,
    game_slug,
    title,
    description,
    game_mode,
    starts_at,
    language,
    max_players
  )
  values (
    current_user_id,
    p_game_slug,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_game_mode,
    start_instant,
    p_language,
    p_max_players
  )
  returning id into new_party_id;

  insert into public.party_participants (party_id, user_id)
  values (new_party_id, current_user_id);

  return new_party_id;
end;
$$;

create function public.list_open_parties(
  p_game_slug text default null,
  p_game_mode text default null,
  p_time_band text default null,
  p_language text default null,
  p_limit integer default 30
)
returns table (
  party_id uuid,
  title text,
  description text,
  game_slug text,
  game_name text,
  game_genre text,
  game_mode text,
  starts_at timestamptz,
  language text,
  max_players integer,
  active_players integer,
  available_spots integer,
  organizer_id uuid,
  organizer_name text,
  organizer_avatar_path text,
  organizer_is_discoverable boolean,
  viewer_is_member boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  viewer_timezone text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select profile.timezone
  into viewer_timezone
  from public.gamer_profiles as profile
  where profile.user_id = current_user_id;
  viewer_timezone := coalesce(viewer_timezone, 'UTC');

  if (p_game_mode is not null and p_game_mode not in (
      'casual', 'competitive', 'cooperative', 'ranked'
    ))
    or (p_time_band is not null and p_time_band not in (
      'morning', 'afternoon', 'evening', 'night'
    ))
    or (p_language is not null and p_language not in ('pt-BR', 'en', 'es'))
    or p_limit not between 1 and 50
  then
    raise exception 'Invalid party filters' using errcode = '22023';
  end if;

  return query
  select
    party.id,
    party.title,
    party.description,
    game.slug,
    game.name,
    game.genre,
    party.game_mode,
    party.starts_at,
    party.language,
    party.max_players::integer,
    counts.active_players,
    party.max_players::integer - counts.active_players,
    organizer.user_id,
    organizer.display_name,
    organizer.avatar_path,
    organizer.show_in_discovery,
    exists (
      select 1
      from public.party_participants as viewer
      where viewer.party_id = party.id
        and viewer.user_id = current_user_id
        and viewer.status = 'active'
    )
  from public.parties as party
  join public.game_catalog as game
    on game.slug = party.game_slug
  join public.gamer_profiles as organizer
    on organizer.user_id = party.organizer_id
  cross join lateral (
    select pg_catalog.count(*)::integer as active_players
    from public.party_participants as participant
    where participant.party_id = party.id
      and participant.status = 'active'
  ) as counts
  where party.status = 'open'
    and party.starts_at > pg_catalog.now()
    and counts.active_players < party.max_players
    and (p_game_slug is null or party.game_slug = p_game_slug)
    and (p_game_mode is null or party.game_mode = p_game_mode)
    and (p_language is null or party.language = p_language)
    and (
      p_time_band is null
      or (
        p_time_band = 'morning'
        and extract(hour from party.starts_at at time zone viewer_timezone) >= 6
        and extract(hour from party.starts_at at time zone viewer_timezone) < 12
      )
      or (
        p_time_band = 'afternoon'
        and extract(hour from party.starts_at at time zone viewer_timezone) >= 12
        and extract(hour from party.starts_at at time zone viewer_timezone) < 18
      )
      or (
        p_time_band = 'evening'
        and extract(hour from party.starts_at at time zone viewer_timezone) >= 18
      )
      or (
        p_time_band = 'night'
        and extract(hour from party.starts_at at time zone viewer_timezone) < 6
      )
    )
  order by party.starts_at
  limit p_limit;
end;
$$;

create function public.join_party(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected_party public.parties%rowtype;
  active_player_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.gamer_profiles as profile
    where profile.user_id = current_user_id
  ) then
    raise exception 'Complete your gamer profile first' using errcode = '22023';
  end if;

  select party.*
  into selected_party
  from public.parties as party
  where party.id = p_party_id
  for update;

  if not found
    or selected_party.status <> 'open'
    or selected_party.starts_at <= pg_catalog.now()
  then
    raise exception 'Party is no longer available' using errcode = '22023';
  end if;

  select pg_catalog.count(*)::integer
  into active_player_count
  from public.party_participants as participant
  where participant.party_id = p_party_id
    and participant.status = 'active';

  if active_player_count >= selected_party.max_players then
    raise exception 'Party is full' using errcode = '22023';
  end if;

  insert into public.party_participants (party_id, user_id, status, joined_at)
  values (p_party_id, current_user_id, 'active', pg_catalog.now())
  on conflict (party_id, user_id)
  do update set
    status = 'active',
    joined_at = excluded.joined_at
  where public.party_participants.status = 'left';

  if not found then
    raise exception 'You already joined this party' using errcode = '23505';
  end if;
end;
$$;

create function public.leave_party(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected_party public.parties%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select party.*
  into selected_party
  from public.parties as party
  where party.id = p_party_id
  for update;

  if not found or selected_party.organizer_id = current_user_id then
    raise exception 'Organizer cannot leave their party' using errcode = '22023';
  end if;

  update public.party_participants
  set status = 'left'
  where party_id = p_party_id
    and user_id = current_user_id
    and status = 'active';

  if not found then
    raise exception 'You are not an active party member' using errcode = '22023';
  end if;
end;
$$;

create function public.cancel_party(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.parties
  set status = 'cancelled'
  where id = p_party_id
    and organizer_id = current_user_id
    and status = 'open';

  if not found then
    raise exception 'Party could not be cancelled' using errcode = '22023';
  end if;
end;
$$;

create function public.get_party_game_activity(p_user_id uuid default null)
returns table (
  game_slug text,
  game_name text,
  party_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  requested_user_id uuid := coalesce(p_user_id, (select auth.uid()));
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if requested_user_id is null
    or (
      requested_user_id <> current_user_id
      and not exists (
        select 1
        from public.gamer_profiles as profile
        where profile.user_id = requested_user_id
          and profile.show_in_discovery
      )
    )
  then
    raise exception 'Player activity is private' using errcode = '42501';
  end if;

  return query
  select
    game.slug,
    game.name,
    pg_catalog.count(distinct party.id)
  from public.party_participants as participant
  join public.parties as party
    on party.id = participant.party_id
  join public.game_catalog as game
    on game.slug = party.game_slug
  where participant.user_id = requested_user_id
    and party.status <> 'cancelled'
  group by game.slug, game.name
  order by pg_catalog.count(distinct party.id) desc, game.name;
end;
$$;

create function public.get_discoverable_gamer_profile(p_player_id uuid)
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
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    profile.user_id,
    profile.display_name,
    case
      when coalesce(profile.privacy_settings ->> 'show_bio', 'false') = 'true'
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
    select pg_catalog.array_agg(selected.platform_slug order by selected.platform_slug) as slugs
    from public.gamer_profile_platforms as selected
    where selected.user_id = profile.user_id
  ) as platforms on true
  left join lateral (
    select pg_catalog.array_agg(game.name order by game.name) as names
    from public.gamer_profile_games as selected
    join public.game_catalog as game on game.slug = selected.game_slug
    where selected.user_id = profile.user_id
  ) as games on true
  where profile.user_id = p_player_id
    and profile.show_in_discovery;
end;
$$;

revoke all on function public.create_party(
  text, text, text, text, timestamp without time zone, text, integer
) from PUBLIC, anon;
grant execute on function public.create_party(
  text, text, text, text, timestamp without time zone, text, integer
) to authenticated;

revoke all on function public.list_open_parties(
  text, text, text, text, integer
) from PUBLIC, anon;
grant execute on function public.list_open_parties(
  text, text, text, text, integer
) to authenticated;

revoke all on function public.join_party(uuid) from PUBLIC, anon;
grant execute on function public.join_party(uuid) to authenticated;
revoke all on function public.leave_party(uuid) from PUBLIC, anon;
grant execute on function public.leave_party(uuid) to authenticated;
revoke all on function public.cancel_party(uuid) from PUBLIC, anon;
grant execute on function public.cancel_party(uuid) to authenticated;

revoke all on function public.get_party_game_activity(uuid) from PUBLIC, anon;
grant execute on function public.get_party_game_activity(uuid) to authenticated;
revoke all on function public.get_discoverable_gamer_profile(uuid) from PUBLIC, anon;
grant execute on function public.get_discoverable_gamer_profile(uuid) to authenticated;
