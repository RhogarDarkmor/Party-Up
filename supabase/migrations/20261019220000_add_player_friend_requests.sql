create table public.friend_requests (
  user_low uuid not null
    references public.gamer_profiles (user_id) on delete cascade,
  user_high uuid not null
    references public.gamer_profiles (user_id) on delete cascade,
  requester_id uuid not null
    references public.gamer_profiles (user_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  responded_by uuid
    references public.gamer_profiles (user_id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requester_id in (user_low, user_high)),
  check (responded_by is null or responded_by in (user_low, user_high))
);

alter table public.friend_requests enable row level security;
revoke all on table public.friend_requests from PUBLIC, anon, authenticated;

create index friend_requests_user_low_status_idx
  on public.friend_requests (user_low, status);
create index friend_requests_user_high_status_idx
  on public.friend_requests (user_high, status);

create function public.send_friend_request(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  low_user_id uuid;
  high_user_id uuid;
  existing_request public.friend_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_player_id is null
    or p_player_id = current_user_id
    or not exists (
      select 1
      from public.gamer_profiles as profile
      where profile.user_id = p_player_id
        and profile.show_in_discovery
    )
  then
    raise exception 'Player is unavailable' using errcode = '22023';
  end if;

  low_user_id := least(current_user_id, p_player_id);
  high_user_id := greatest(current_user_id, p_player_id);

  insert into public.friend_requests (
    user_low,
    user_high,
    requester_id,
    status,
    responded_by,
    created_at,
    updated_at
  )
  values (
    low_user_id,
    high_user_id,
    current_user_id,
    'pending',
    null,
    pg_catalog.now(),
    pg_catalog.now()
  )
  on conflict (user_low, user_high)
  do update set
    requester_id = excluded.requester_id,
    status = 'pending',
    responded_by = null,
    created_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  where public.friend_requests.status = 'declined'
    and public.friend_requests.responded_by = current_user_id;

  if found then
    return;
  end if;

  select request.*
  into existing_request
  from public.friend_requests as request
  where request.user_low = low_user_id
    and request.user_high = high_user_id;

  if not found then
    raise exception 'Friend request could not be saved';
  elsif existing_request.status = 'accepted' then
    raise exception 'Players are already friends' using errcode = '23505';
  elsif existing_request.status = 'pending'
    and existing_request.requester_id = current_user_id
  then
    raise exception 'Friend request is already pending' using errcode = '23505';
  elsif existing_request.status = 'pending' then
    raise exception 'This player already sent you a friend request'
      using errcode = '23505';
  else
    raise exception 'This friend request was declined' using errcode = '23505';
  end if;
end;
$$;

create function public.respond_to_friend_request(
  p_player_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  low_user_id uuid;
  high_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_player_id is null
    or p_player_id = current_user_id
    or p_accept is null
  then
    raise exception 'Invalid friend request response' using errcode = '22023';
  end if;

  low_user_id := least(current_user_id, p_player_id);
  high_user_id := greatest(current_user_id, p_player_id);

  update public.friend_requests
  set
    status = case when p_accept then 'accepted' else 'declined' end,
    responded_by = case when p_accept then null else current_user_id end,
    updated_at = pg_catalog.now()
  where user_low = low_user_id
    and user_high = high_user_id
    and requester_id = p_player_id
    and status = 'pending';

  if not found then
    raise exception 'Friend request is no longer available' using errcode = '22023';
  end if;
end;
$$;

create function public.get_friend_request_status(p_player_id uuid)
returns table (
  request_status text,
  requester_id uuid,
  responded_by uuid
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
    coalesce(request.status, 'none'),
    request.requester_id,
    request.responded_by
  from public.gamer_profiles as profile
  left join public.friend_requests as request
    on request.user_low = least(current_user_id, profile.user_id)
    and request.user_high = greatest(current_user_id, profile.user_id)
  where profile.user_id = p_player_id
    and profile.show_in_discovery
    and profile.user_id <> current_user_id;
end;
$$;

create function public.list_friend_requests()
returns table (
  player_id uuid,
  display_name text,
  request_status text,
  requester_id uuid,
  updated_at timestamptz,
  is_discoverable boolean
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
    case
      when request.user_low = current_user_id then request.user_high
      else request.user_low
    end,
    profile.display_name,
    request.status,
    request.requester_id,
    request.updated_at,
    profile.show_in_discovery
  from public.friend_requests as request
  join public.gamer_profiles as profile
    on profile.user_id = case
      when request.user_low = current_user_id then request.user_high
      else request.user_low
    end
  where (request.user_low = current_user_id or request.user_high = current_user_id)
    and request.status in ('pending', 'accepted')
  order by
    case when request.status = 'pending' then 0 else 1 end,
    request.updated_at desc,
    profile.display_name;
end;
$$;

revoke all on function public.send_friend_request(uuid) from PUBLIC, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

revoke all on function public.respond_to_friend_request(uuid, boolean) from PUBLIC, anon;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;

revoke all on function public.get_friend_request_status(uuid) from PUBLIC, anon;
grant execute on function public.get_friend_request_status(uuid) to authenticated;

revoke all on function public.list_friend_requests() from PUBLIC, anon;
grant execute on function public.list_friend_requests() to authenticated;
