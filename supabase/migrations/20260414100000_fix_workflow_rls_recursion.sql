create or replace function public.studio_owns_album_version(album_version_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.album_versions av
    join public.projects p on p.id = av.project_id
    where av.id = album_version_row_id
      and p.studio_id = auth.uid()
  );
$$;

create or replace function public.studio_owns_version_spread(version_spread_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.version_spreads vs
    join public.album_versions av on av.id = vs.album_version_id
    join public.projects p on p.id = av.project_id
    where vs.id = version_spread_row_id
      and p.studio_id = auth.uid()
  );
$$;

create or replace function public.studio_owns_proof_link(proof_link_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.proof_links pl
    join public.album_versions av on av.id = pl.album_version_id
    join public.projects p on p.id = av.project_id
    where pl.id = proof_link_row_id
      and p.studio_id = auth.uid()
  );
$$;

create or replace function public.album_version_has_active_public_proof(album_version_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.proof_links pl
    where pl.album_version_id = album_version_row_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  );
$$;

create or replace function public.version_spread_has_active_public_proof(version_spread_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.version_spreads vs
    join public.proof_links pl on pl.album_version_id = vs.album_version_id
    where vs.id = version_spread_row_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  );
$$;

drop policy if exists "Studio owners can manage version spreads." on public.version_spreads;
create policy "Studio owners can manage version spreads."
  on public.version_spreads for all
  using (public.studio_owns_album_version(public.version_spreads.album_version_id))
  with check (public.studio_owns_album_version(public.version_spreads.album_version_id));

drop policy if exists "Studio owners can manage spread images." on public.version_spread_images;
create policy "Studio owners can manage spread images."
  on public.version_spread_images for all
  using (public.studio_owns_version_spread(public.version_spread_images.version_spread_id))
  with check (public.studio_owns_version_spread(public.version_spread_images.version_spread_id));

drop policy if exists "Studio owners can manage proof links." on public.proof_links;
create policy "Studio owners can manage proof links."
  on public.proof_links for all
  using (public.studio_owns_album_version(public.proof_links.album_version_id))
  with check (public.studio_owns_album_version(public.proof_links.album_version_id));

drop policy if exists "Studio owners can manage proof comments." on public.proof_comments;
create policy "Studio owners can manage proof comments."
  on public.proof_comments for all
  using (public.studio_owns_proof_link(public.proof_comments.proof_link_id))
  with check (public.studio_owns_proof_link(public.proof_comments.proof_link_id));

drop policy if exists "Public can read version spreads with active proof links." on public.version_spreads;
create policy "Public can read version spreads with active proof links."
  on public.version_spreads for select
  using (public.album_version_has_active_public_proof(public.version_spreads.album_version_id));

drop policy if exists "Public can read spread images with active proof links." on public.version_spread_images;
create policy "Public can read spread images with active proof links."
  on public.version_spread_images for select
  using (public.version_spread_has_active_public_proof(public.version_spread_images.version_spread_id));

drop policy if exists "Public can read album versions with active proof links." on public.album_versions;
create policy "Public can read album versions with active proof links."
  on public.album_versions for select
  using (public.album_version_has_active_public_proof(public.album_versions.id));

grant execute on function public.studio_owns_album_version(uuid) to anon, authenticated;
grant execute on function public.studio_owns_version_spread(uuid) to anon, authenticated;
grant execute on function public.studio_owns_proof_link(uuid) to anon, authenticated;
grant execute on function public.album_version_has_active_public_proof(uuid) to anon, authenticated;
grant execute on function public.version_spread_has_active_public_proof(uuid) to anon, authenticated;
