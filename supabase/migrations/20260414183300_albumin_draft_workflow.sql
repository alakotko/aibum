alter table public.selection_sets
  add column if not exists is_active boolean default false not null,
  add column if not exists cover_album_input_id uuid references public.album_inputs(id) on delete set null,
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

update public.selection_sets
set updated_at = created_at
where updated_at is null;

create unique index if not exists selection_sets_one_active_per_project
  on public.selection_sets(project_id)
  where is_active = true;

alter table public.album_versions
  add column if not exists variant_key text default 'classic' not null
    check (variant_key in ('classic', 'story', 'premium')),
  add column if not exists cover_title text,
  add column if not exists is_active boolean default false not null;

update public.album_versions
set variant_key = 'classic'
where variant_key is null;

with ranked_versions as (
  select
    id,
    row_number() over (partition by project_id order by version_number desc, created_at desc) as version_rank
  from public.album_versions
)
update public.album_versions av
set is_active = ranked_versions.version_rank = 1
from ranked_versions
where ranked_versions.id = av.id;

create unique index if not exists album_versions_one_active_per_project
  on public.album_versions(project_id)
  where is_active = true;
