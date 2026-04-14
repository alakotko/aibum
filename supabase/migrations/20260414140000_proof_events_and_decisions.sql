create table if not exists public.proof_events (
  id uuid default gen_random_uuid() primary key,
  proof_link_id uuid references public.proof_links(id) on delete cascade not null,
  album_version_id uuid references public.album_versions(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade not null,
  event_type text not null check (event_type in ('proof_sent', 'changes_requested', 'approved')),
  actor_name text not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists proof_events_proof_link_created_idx
  on public.proof_events (proof_link_id, created_at desc);

create index if not exists proof_events_project_created_idx
  on public.proof_events (project_id, created_at desc);

alter table public.proof_events enable row level security;

create or replace function public.proof_link_is_publicly_accessible(proof_link_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.proof_links pl
    where pl.id = proof_link_row_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  );
$$;

drop policy if exists "Studio owners can manage proof events." on public.proof_events;
create policy "Studio owners can manage proof events."
  on public.proof_events for all
  using (public.studio_owns_proof_link(public.proof_events.proof_link_id))
  with check (public.studio_owns_proof_link(public.proof_events.proof_link_id));

drop policy if exists "Public can read proof events." on public.proof_events;
create policy "Public can read proof events."
  on public.proof_events for select
  using (public.proof_link_is_publicly_accessible(public.proof_events.proof_link_id));

create or replace function public.create_proof_sent_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  version_project_id uuid;
  studio_actor_name text;
begin
  select av.project_id
  into version_project_id
  from public.album_versions av
  where av.id = new.album_version_id;

  select coalesce(nullif(p.studio_name, ''), 'Studio')
  into studio_actor_name
  from public.profiles p
  where p.id = auth.uid();

  insert into public.proof_events (
    proof_link_id,
    album_version_id,
    project_id,
    event_type,
    actor_name,
    note,
    created_at
  )
  values (
    new.id,
    new.album_version_id,
    version_project_id,
    'proof_sent',
    coalesce(studio_actor_name, 'Studio'),
    new.title,
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists proof_links_create_sent_event on public.proof_links;
create trigger proof_links_create_sent_event
  after insert on public.proof_links
  for each row execute procedure public.create_proof_sent_event();

insert into public.proof_events (
  proof_link_id,
  album_version_id,
  project_id,
  event_type,
  actor_name,
  note,
  created_at
)
select
  pl.id,
  pl.album_version_id,
  av.project_id,
  'proof_sent',
  coalesce(nullif(p.studio_name, ''), 'Studio'),
  pl.title,
  pl.created_at
from public.proof_links pl
join public.album_versions av on av.id = pl.album_version_id
join public.projects pr on pr.id = av.project_id
left join public.profiles p on p.id = pr.studio_id
left join public.proof_events pe
  on pe.proof_link_id = pl.id
 and pe.event_type = 'proof_sent'
where pe.id is null;

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

    update public.projects
    set status = 'changes_requested'
    where id = target_link.project_id;
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

    update public.projects
    set status = 'approved'
    where id = target_link.project_id;

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

grant execute on function public.proof_link_is_publicly_accessible(uuid) to anon, authenticated;
grant execute on function public.submit_public_proof_decision(text, text, text, text) to anon, authenticated;
