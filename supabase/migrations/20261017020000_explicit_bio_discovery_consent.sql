update public.gamer_profiles
set privacy_settings = pg_catalog.jsonb_set(
  privacy_settings,
  '{show_bio}',
  'false'::jsonb,
  true
)
where privacy_settings ->> 'show_bio' is distinct from 'false';

alter table public.gamer_profiles
  alter column privacy_settings set default
    '{"show_bio": false, "show_availability": true}'::jsonb;

revoke insert, update, delete
  on table public.gamer_profiles
  from anon, authenticated;
grant select on table public.gamer_profiles to authenticated;

revoke all on function public.save_current_user_profile(
  text, text, text, text, text, text, text, boolean, text[]
) from PUBLIC, anon, authenticated;

drop function public.save_current_user_profile(
  text, text, text, text, text, text, text, boolean, text[]
);

create function public.save_current_user_profile(
  p_display_name text,
  p_bio text,
  p_timezone text,
  p_preferred_language text,
  p_play_style text,
  p_communication_preference text,
  p_avatar_path text,
  p_show_in_discovery boolean,
  p_platform_slugs text[],
  p_show_bio boolean
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
    or p_show_bio is null
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
    show_in_discovery,
    privacy_settings
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
    p_show_in_discovery,
    pg_catalog.jsonb_build_object(
      'show_availability', true,
      'show_bio', p_show_bio
    )
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    bio = excluded.bio,
    timezone = excluded.timezone,
    preferred_language = excluded.preferred_language,
    play_style = excluded.play_style,
    communication_preference = excluded.communication_preference,
    avatar_path = excluded.avatar_path,
    show_in_discovery = excluded.show_in_discovery,
    privacy_settings = pg_catalog.jsonb_set(
      public.gamer_profiles.privacy_settings,
      '{show_bio}',
      pg_catalog.to_jsonb(p_show_bio),
      true
    );

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
  text, text, text, text, text, text, text, boolean, text[], boolean
) from PUBLIC, anon;
grant execute on function public.save_current_user_profile(
  text, text, text, text, text, text, text, boolean, text[], boolean
) to authenticated;
