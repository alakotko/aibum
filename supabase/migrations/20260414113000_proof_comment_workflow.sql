alter table public.proof_comments
  add column if not exists comment_scope text;

update public.proof_comments
set comment_scope = case
  when version_spread_id is null then 'general'
  else 'spread'
end
where comment_scope is null;

alter table public.proof_comments
  alter column comment_scope set default 'spread';

alter table public.proof_comments
  alter column comment_scope set not null;

alter table public.proof_comments
  drop constraint if exists proof_comments_comment_scope_check;

alter table public.proof_comments
  add constraint proof_comments_comment_scope_check
  check (comment_scope in ('spread', 'general'));

alter table public.proof_comments
  drop constraint if exists proof_comments_scope_matches_spread_check;

alter table public.proof_comments
  add constraint proof_comments_scope_matches_spread_check
  check (
    (comment_scope = 'general' and version_spread_id is null)
    or (comment_scope = 'spread' and version_spread_id is not null)
  );

alter table public.proof_comments
  add column if not exists resolved_at timestamp with time zone;

alter table public.proof_comments
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

create index if not exists proof_comments_proof_link_resolved_idx
  on public.proof_comments (proof_link_id, resolved_at, created_at desc);

drop policy if exists "Public can add proof comments." on public.proof_comments;
create policy "Public can add proof comments."
  on public.proof_comments for insert
  with check (
    resolved_at is null
    and resolved_by is null
    and (
      (comment_scope = 'general' and version_spread_id is null)
      or (comment_scope = 'spread' and version_spread_id is not null)
    )
    and exists (
      select 1
      from public.proof_links pl
      where pl.id = proof_link_id
        and pl.is_public = true
        and pl.status in ('active', 'changes_requested', 'approved')
        and (pl.expires_at is null or pl.expires_at > now())
    )
  );
