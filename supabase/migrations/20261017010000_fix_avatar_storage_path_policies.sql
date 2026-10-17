drop policy "partyup_avatar_select_owner_or_visible_profile" on storage.objects;
drop policy "partyup_avatar_insert_owner" on storage.objects;
drop policy "partyup_avatar_update_owner" on storage.objects;
drop policy "partyup_avatar_delete_owner" on storage.objects;

create policy "partyup_avatar_select_owner_or_visible_profile"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'partyup-avatars'
    and name = ((storage.foldername(name))[1] || '/avatar')
    and public.can_read_discovery_avatar((storage.foldername(name))[1])
  );

create policy "partyup_avatar_insert_owner"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'partyup-avatars'
    and name = ((storage.foldername(name))[1] || '/avatar')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "partyup_avatar_update_owner"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'partyup-avatars'
    and name = ((storage.foldername(name))[1] || '/avatar')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'partyup-avatars'
    and name = ((storage.foldername(name))[1] || '/avatar')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "partyup_avatar_delete_owner"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'partyup-avatars'
    and name = ((storage.foldername(name))[1] || '/avatar')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
