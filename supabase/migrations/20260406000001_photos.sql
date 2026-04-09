-- Create a new bucket for project photos
insert into storage.buckets (id, name, public) 
values ('photos', 'photos', true)
on conflict do nothing;

create policy "Studio owners can upload photos." 
  on storage.objects for insert 
  with check (bucket_id = 'photos' and auth.role() = 'authenticated');

create policy "Studio owners can delete photos." 
  on storage.objects for delete
  using (bucket_id = 'photos' and auth.role() = 'authenticated');

-- Everyone can view photos via public URL
create policy "Public can view photos." 
  on storage.objects for select 
  using (bucket_id = 'photos');

-- Create a table linking photos to projects
create table public.photos (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  storage_path text not null,
  filename text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text default 'uploaded' check (status in ('uploaded', 'failed', 'processed')),
  exif_data jsonb
);

alter table public.photos enable row level security;

create policy "Studio owners can view photos of their projects." 
  on public.photos for select 
  using (
    exists (
      select 1 from public.projects p 
      where p.id = photos.project_id and p.studio_id = auth.uid()
    )
  );

create policy "Studio owners can insert photos into their projects." 
  on public.photos for insert 
  with check (
    exists (
      select 1 from public.projects p 
      where p.id = project_id and p.studio_id = auth.uid()
    )
  );
