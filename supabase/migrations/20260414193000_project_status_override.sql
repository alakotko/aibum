alter table public.projects
  add column if not exists status_override text
    check (
      status_override in (
        'draft',
        'client_review',
        'changes_requested',
        'approved',
        'payment_pending',
        'paid',
        'fulfillment_pending',
        'shipped',
        'delivered'
      )
    );

create or replace function public.set_project_auto_status(project_row_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if next_status not in (
    'draft',
    'client_review',
    'changes_requested',
    'approved',
    'payment_pending',
    'paid',
    'fulfillment_pending',
    'shipped',
    'delivered'
  ) then
    raise exception 'Unsupported project workflow status.';
  end if;

  update public.projects
  set status = next_status
  where id = project_row_id
    and status_override is null;
end;
$$;

grant execute on function public.set_project_auto_status(uuid, text) to authenticated;

create or replace function public.submit_public_proof_decision(
  proof_token text,
  actor_name text,
  decision text,
  note text default null
)
returns table (
  proof_link_id uuid,
  proof_status text,
  approved_at timestamp with time zone,
  event_id uuid,
  event_type text,
  event_actor_name text,
  event_note text,
  event_created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_link record;
  normalized_actor_name text := nullif(btrim(actor_name), '');
  normalized_note text := nullif(btrim(coalesce(note, '')), '');
  created_event public.proof_events%rowtype;
  next_approved_at timestamp with time zone;
begin
  if normalized_actor_name is null then
    raise exception 'Actor name is required.';
  end if;

  if decision not in ('changes_requested', 'approved') then
    raise exception 'Unsupported proof decision.';
  end if;

  select
    pl.id,
    pl.album_version_id,
    av.project_id,
    pl.status,
    pl.is_public,
    pl.expires_at
  into target_link
  from public.proof_links pl
  join public.album_versions av on av.id = pl.album_version_id
  where pl.slug = proof_token
  for update;

  if not found then
    raise exception 'Proof link not found.';
  end if;

  if not target_link.is_public
    or target_link.status = 'archived'
    or (target_link.expires_at is not null and target_link.expires_at <= now()) then
    raise exception 'Proof link is no longer available.';
  end if;

  if target_link.status = 'approved' then
    raise exception 'This proof has already been approved.';
  end if;

  if decision = 'changes_requested' then
    update public.proof_links
    set status = 'changes_requested',
        approved_at = null
    where id = target_link.id
    returning public.proof_links.approved_at into next_approved_at;

    update public.album_versions
    set status = 'changes_requested',
        updated_at = timezone('utc'::text, now())
    where id = target_link.album_version_id;

    perform public.set_project_auto_status(target_link.project_id, 'changes_requested');
  else
    update public.proof_links
    set status = 'approved',
        approved_at = timezone('utc'::text, now())
    where id = target_link.id
    returning public.proof_links.approved_at into next_approved_at;

    update public.album_versions
    set status = 'approved',
        updated_at = timezone('utc'::text, now())
    where id = target_link.album_version_id;

    perform public.set_project_auto_status(target_link.project_id, 'approved');

    update public.proof_links sibling
    set status = 'archived',
        is_public = false
    from public.album_versions sibling_version
    where sibling.album_version_id = sibling_version.id
      and sibling_version.project_id = target_link.project_id
      and sibling.id <> target_link.id
      and sibling.status <> 'archived';
  end if;

  insert into public.proof_events (
    proof_link_id,
    album_version_id,
    project_id,
    event_type,
    actor_name,
    note
  )
  values (
    target_link.id,
    target_link.album_version_id,
    target_link.project_id,
    decision,
    normalized_actor_name,
    normalized_note
  )
  returning * into created_event;

  proof_link_id := target_link.id;
  proof_status := decision;
  approved_at := next_approved_at;
  event_id := created_event.id;
  event_type := created_event.event_type;
  event_actor_name := created_event.actor_name;
  event_note := created_event.note;
  event_created_at := created_event.created_at;
  return next;
end;
$$;
