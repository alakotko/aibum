create table public.comments (
  id uuid default gen_random_uuid() primary key,
  spread_id uuid references public.spreads(id) on delete cascade not null,
  client_name text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.comments enable row level security;

-- In a real app we'd secure this with a unique token or RLS linked to project access. 
-- For our MVP read-only proofing link, we permit anonymous inserts globally if they possess the unguessable URL.
create policy "Anyone can insert comments on a spread." 
  on public.comments for insert 
  with check (true);

create policy "Studio owners can view comments."
  on public.comments for select
  using (exists (
    select 1 from public.spreads s 
    join public.albums a on s.album_id = a.id 
    join public.projects p on a.project_id = p.id 
    where s.id = spread_id and p.studio_id = auth.uid()
  ));

create policy "Public can view comments."
  on public.comments for select
  using (true);

-- Also add an approval state to the albums table
alter table public.albums add column status text default 'draft' check (status in ('draft', 'review', 'approved'));
