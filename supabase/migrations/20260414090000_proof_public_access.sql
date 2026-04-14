create or replace function public.project_has_active_public_proof(project_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.album_versions av
    join public.proof_links pl on pl.album_version_id = av.id
    where av.project_id = project_row_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  );
$$;

create or replace function public.album_input_has_active_public_proof(album_input_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.version_spread_images vsi
    join public.version_spreads vs on vs.id = vsi.version_spread_id
    join public.proof_links pl on pl.album_version_id = vs.album_version_id
    where vsi.album_input_id = album_input_row_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  );
$$;

create or replace function public.studio_branding_has_active_public_proof(studio_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.album_versions av on av.project_id = p.id
    join public.proof_links pl on pl.album_version_id = av.id
    where p.studio_id = studio_row_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  );
$$;

drop policy if exists "Public can read projects with active proof links." on public.projects;
create policy "Public can read projects with active proof links."
  on public.projects for select
  using (public.project_has_active_public_proof(public.projects.id));

drop policy if exists "Public can read album inputs with active proof links." on public.album_inputs;
create policy "Public can read album inputs with active proof links."
  on public.album_inputs for select
  using (public.album_input_has_active_public_proof(public.album_inputs.id));

drop policy if exists "Public can read studio branding with active proof links." on public.studio_branding;
create policy "Public can read studio branding with active proof links."
  on public.studio_branding for select
  using (public.studio_branding_has_active_public_proof(public.studio_branding.studio_id));

grant execute on function public.project_has_active_public_proof(uuid) to anon, authenticated;
grant execute on function public.album_input_has_active_public_proof(uuid) to anon, authenticated;
grant execute on function public.studio_branding_has_active_public_proof(uuid) to anon, authenticated;
