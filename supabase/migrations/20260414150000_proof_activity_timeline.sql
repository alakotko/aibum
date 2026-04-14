alter table public.proof_events
  drop constraint if exists proof_events_event_type_check;

alter table public.proof_events
  add constraint proof_events_event_type_check
  check (
    event_type in (
      'proof_sent',
      'proof_resent',
      'proof_opened',
      'comment_added',
      'changes_requested',
      'approved'
    )
  );

drop policy if exists "Public can log proof activity." on public.proof_events;
create policy "Public can log proof activity."
  on public.proof_events for insert
  with check (
    event_type in ('proof_opened', 'comment_added')
    and nullif(btrim(actor_name), '') is not null
    and exists (
      select 1
      from public.proof_links pl
      join public.album_versions av on av.id = pl.album_version_id
      where pl.id = proof_link_id
        and av.id = album_version_id
        and av.project_id = project_id
        and public.proof_link_is_publicly_accessible(pl.id)
    )
  );

grant insert on table public.proof_events to anon, authenticated;
