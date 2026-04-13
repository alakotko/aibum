alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  alter column status drop default;

update public.projects
set status = 'draft'
where status is distinct from 'draft';

alter table public.projects
  alter column status set default 'draft';

alter table public.projects
  add constraint projects_status_check
  check (
    status in (
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

create table if not exists public.clients (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  email text,
  partner_name text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.album_inputs (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  filename text not null,
  storage_path text not null,
  thumbnail_path text,
  selection_status text default 'unreviewed' not null check (
    selection_status in ('unreviewed', 'shortlisted', 'excluded')
  ),
  ai_score numeric,
  ai_flags jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.selection_sets (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.selection_set_items (
  selection_set_id uuid references public.selection_sets(id) on delete cascade not null,
  album_input_id uuid references public.album_inputs(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (selection_set_id, album_input_id)
);

create table if not exists public.album_versions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  selection_set_id uuid references public.selection_sets(id) on delete set null,
  version_number int not null,
  title text not null,
  status text default 'draft' not null check (
    status in (
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
  ),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (project_id, version_number)
);

create table if not exists public.version_spreads (
  id uuid default gen_random_uuid() primary key,
  album_version_id uuid references public.album_versions(id) on delete cascade not null,
  page_number int not null,
  layout_type text default 'auto' not null,
  background_color text default '#ffffff' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (album_version_id, page_number)
);

create table if not exists public.version_spread_images (
  id uuid default gen_random_uuid() primary key,
  version_spread_id uuid references public.version_spreads(id) on delete cascade not null,
  album_input_id uuid references public.album_inputs(id) on delete cascade not null,
  x_position decimal,
  y_position decimal,
  width decimal,
  height decimal,
  z_index int default 0 not null
);

create table if not exists public.proof_links (
  id uuid default gen_random_uuid() primary key,
  album_version_id uuid references public.album_versions(id) on delete cascade not null,
  slug text not null unique,
  title text,
  status text default 'active' not null check (
    status in ('draft', 'active', 'changes_requested', 'approved', 'archived')
  ),
  expires_at timestamp with time zone,
  approved_at timestamp with time zone,
  last_viewed_at timestamp with time zone,
  pin text,
  is_public boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.proof_comments (
  id uuid default gen_random_uuid() primary key,
  proof_link_id uuid references public.proof_links(id) on delete cascade not null,
  version_spread_id uuid references public.version_spreads(id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.offers (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  album_version_id uuid references public.album_versions(id) on delete set null,
  title text not null,
  status text default 'draft' not null check (
    status in ('draft', 'sent', 'accepted', 'declined', 'expired')
  ),
  currency text default 'USD' not null,
  total_cents int default 0 not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.offer_items (
  id uuid default gen_random_uuid() primary key,
  offer_id uuid references public.offers(id) on delete cascade not null,
  title text not null,
  description text,
  quantity int default 1 not null,
  unit_price_cents int default 0 not null,
  line_total_cents int default 0 not null
);

create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  status text default 'payment_pending' not null check (
    status in (
      'payment_pending',
      'paid',
      'fulfillment_pending',
      'shipped',
      'delivered',
      'cancelled'
    )
  ),
  payment_status text default 'payment_pending' not null check (
    payment_status in ('payment_pending', 'paid', 'refunded')
  ),
  fulfillment_status text default 'fulfillment_pending' not null check (
    fulfillment_status in ('fulfillment_pending', 'in_production', 'shipped', 'delivered')
  ),
  currency text default 'USD' not null,
  total_cents int default 0 not null,
  operator_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  title text not null,
  description text,
  quantity int default 1 not null,
  unit_price_cents int default 0 not null,
  line_total_cents int default 0 not null
);

create table if not exists public.studio_branding (
  studio_id uuid references public.profiles(id) on delete cascade primary key,
  studio_name text,
  logo_url text,
  primary_color text default '#cc785c' not null,
  accent_color text default '#f3e6d4' not null,
  support_email text,
  proof_headline text,
  proof_subheadline text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.clients enable row level security;
alter table public.album_inputs enable row level security;
alter table public.selection_sets enable row level security;
alter table public.selection_set_items enable row level security;
alter table public.album_versions enable row level security;
alter table public.version_spreads enable row level security;
alter table public.version_spread_images enable row level security;
alter table public.proof_links enable row level security;
alter table public.proof_comments enable row level security;
alter table public.offers enable row level security;
alter table public.offer_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.studio_branding enable row level security;

create policy "Studio owners can manage clients."
  on public.clients for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage album inputs."
  on public.album_inputs for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage selection sets."
  on public.selection_sets for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage selection set items."
  on public.selection_set_items for all
  using (exists (
    select 1
    from public.selection_sets ss
    join public.projects p on p.id = ss.project_id
    where ss.id = selection_set_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.selection_sets ss
    join public.projects p on p.id = ss.project_id
    where ss.id = selection_set_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage album versions."
  on public.album_versions for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage version spreads."
  on public.version_spreads for all
  using (exists (
    select 1
    from public.album_versions av
    join public.projects p on p.id = av.project_id
    where av.id = album_version_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.album_versions av
    join public.projects p on p.id = av.project_id
    where av.id = album_version_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage spread images."
  on public.version_spread_images for all
  using (exists (
    select 1
    from public.version_spreads vs
    join public.album_versions av on av.id = vs.album_version_id
    join public.projects p on p.id = av.project_id
    where vs.id = version_spread_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.version_spreads vs
    join public.album_versions av on av.id = vs.album_version_id
    join public.projects p on p.id = av.project_id
    where vs.id = version_spread_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage proof links."
  on public.proof_links for all
  using (exists (
    select 1
    from public.album_versions av
    join public.projects p on p.id = av.project_id
    where av.id = album_version_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.album_versions av
    join public.projects p on p.id = av.project_id
    where av.id = album_version_id and p.studio_id = auth.uid()
  ));

create policy "Public can read active proof links."
  on public.proof_links for select
  using (
    is_public = true
    and status in ('active', 'changes_requested', 'approved')
    and (expires_at is null or expires_at > now())
  );

create policy "Studio owners can manage proof comments."
  on public.proof_comments for all
  using (exists (
    select 1
    from public.proof_links pl
    join public.album_versions av on av.id = pl.album_version_id
    join public.projects p on p.id = av.project_id
    where pl.id = proof_link_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.proof_links pl
    join public.album_versions av on av.id = pl.album_version_id
    join public.projects p on p.id = av.project_id
    where pl.id = proof_link_id and p.studio_id = auth.uid()
  ));

create policy "Public can add proof comments."
  on public.proof_comments for insert
  with check (exists (
    select 1
    from public.proof_links pl
    where pl.id = proof_link_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  ));

create policy "Public can read proof comments."
  on public.proof_comments for select
  using (exists (
    select 1
    from public.proof_links pl
    where pl.id = proof_link_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  ));

create policy "Public can read version spreads with active proof links."
  on public.version_spreads for select
  using (exists (
    select 1
    from public.proof_links pl
    where pl.album_version_id = album_version_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  ));

create policy "Public can read spread images with active proof links."
  on public.version_spread_images for select
  using (exists (
    select 1
    from public.version_spreads vs
    join public.proof_links pl on pl.album_version_id = vs.album_version_id
    where vs.id = version_spread_id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  ));

create policy "Public can read album versions with active proof links."
  on public.album_versions for select
  using (exists (
    select 1
    from public.proof_links pl
    where pl.album_version_id = id
      and pl.is_public = true
      and pl.status in ('active', 'changes_requested', 'approved')
      and (pl.expires_at is null or pl.expires_at > now())
  ));

create policy "Studio owners can manage offers."
  on public.offers for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage offer items."
  on public.offer_items for all
  using (exists (
    select 1
    from public.offers o
    join public.projects p on p.id = o.project_id
    where o.id = offer_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.offers o
    join public.projects p on p.id = o.project_id
    where o.id = offer_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage orders."
  on public.orders for all
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage order items."
  on public.order_items for all
  using (exists (
    select 1
    from public.orders o
    join public.projects p on p.id = o.project_id
    where o.id = order_id and p.studio_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.orders o
    join public.projects p on p.id = o.project_id
    where o.id = order_id and p.studio_id = auth.uid()
  ));

create policy "Studio owners can manage studio branding."
  on public.studio_branding for all
  using (studio_id = auth.uid())
  with check (studio_id = auth.uid());
