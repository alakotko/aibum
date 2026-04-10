-- 1. Add soft-delete column (safe to re-run)
alter table public.projects
  add column if not exists deleted_at timestamp with time zone default null;

-- 2. SELECT policy — hide soft-deleted rows from normal queries
drop policy if exists "Users can view own projects." on public.projects;
create policy "Users can view own projects." on public.projects
  for select using (auth.uid() = studio_id and deleted_at is null);

-- 3. Restore the UPDATE policy to its original form (we won't use it for soft-delete)
drop policy if exists "Users can update own projects." on public.projects;
create policy "Users can update own projects." on public.projects
  for update using (auth.uid() = studio_id);

-- 4. SECURITY DEFINER function for soft-delete.
--    Runs as the postgres role (bypasses RLS) but verifies ownership first via auth.uid().
--    This avoids the PostgREST RETURNING+SELECT-policy conflict:
--    PostgREST wraps every UPDATE in `WITH ... AS (UPDATE ... RETURNING 1) SELECT ...`
--    which causes PostgreSQL to enforce SELECT policies on the post-update row —
--    a row that now has deleted_at set and therefore fails the `deleted_at is null` check.
create or replace function public.soft_delete_project(project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ownership check before touching anything
  if not exists (
    select 1 from projects
    where id = project_id and studio_id = auth.uid()
  ) then
    raise exception 'Not found or not authorized';
  end if;

  update projects
    set deleted_at = now()
  where id = project_id;
end;
$$;
