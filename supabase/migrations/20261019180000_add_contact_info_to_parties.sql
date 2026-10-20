
-- Add contact_info to parties table
ALTER TABLE public.parties ADD COLUMN contact_info TEXT;

drop function public.create_party(
  text, text, text, text, timestamp without time zone, text, integer
);
drop function public.list_open_parties(text, text, text, text, integer);

-- Update create_party function to accept contact_info
create or replace function public.create_party(
  p_game_slug text,
  p_title text,
  p_description text,
  p_contact_info text,
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
    or char_length(coalesce(p_contact_info, '')) > 200
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
    contact_info,
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
    nullif(btrim(coalesce(p_contact_info, '')), ''),
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

revoke all on function public.create_party(
  text, text, text, text, text, timestamp without time zone, text, integer
) from PUBLIC, anon;
grant execute on function public.create_party(
  text, text, text, text, text, timestamp without time zone, text, integer
) to authenticated;

-- Update list_open_parties function to return contact_info to members
create or replace function public.list_open_parties(
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
  contact_info text,
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
    case
      when exists (
        select 1
        from public.party_participants as participant
        where participant.party_id = party.id
          and participant.user_id = current_user_id
          and participant.status = 'active'
      ) then party.contact_info
      else null
    end,
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

revoke all on function public.list_open_parties(
  text, text, text, text, integer
) from PUBLIC, anon;
grant execute on function public.list_open_parties(
  text, text, text, text, integer
) to authenticated;
