create table public.albums (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.spreads (
  id uuid default gen_random_uuid() primary key,
  album_id uuid references public.albums(id) on delete cascade not null,
  page_number int not null,
  layout_type text default 'auto',
  background_color text default '#ffffff',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.image_slots (
  id uuid default gen_random_uuid() primary key,
  spread_id uuid references public.spreads(id) on delete cascade not null,
  photo_id uuid references public.photos(id) on delete cascade not null,
  x_position decimal,
  y_position decimal,
  width decimal,
  height decimal,
  z_index int default 0
);

alter table public.albums enable row level security;
alter table public.spreads enable row level security;
alter table public.image_slots enable row level security;

create policy "Studio owners can manage albums." 
  on public.albums for all 
  using (exists (select 1 from public.projects p where p.id = project_id and p.studio_id = auth.uid()));

create policy "Studio owners can manage spreads." 
  on public.spreads for all 
  using (exists (select 1 from public.albums a join public.projects p on a.project_id = p.id where a.id = album_id and p.studio_id = auth.uid()));

create policy "Studio owners can manage slots." 
  on public.image_slots for all 
  using (exists (select 1 from public.spreads s join public.albums a on s.album_id = a.id join public.projects p on a.project_id = p.id where s.id = spread_id and p.studio_id = auth.uid()));
