alter table public.version_spreads
  add column if not exists template_id text;

alter table public.version_spreads
  add column if not exists spread_role text;

alter table public.version_spreads
  add column if not exists spread_key text;

with spread_images as (
  select
    vsi.version_spread_id,
    string_agg(vsi.album_input_id::text, '|' order by vsi.z_index, vsi.album_input_id::text) as image_ids
  from public.version_spread_images vsi
  group by vsi.version_spread_id
)
update public.version_spreads vs
set
  template_id = case
    when vs.page_number = 1 then 'cover-' || coalesce(nullif(vs.layout_type, 'auto'), 'single')
    else 'interior-' || coalesce(nullif(vs.layout_type, 'auto'), 'single')
  end,
  spread_role = case
    when vs.page_number = 1 then 'cover'
    else 'interior'
  end,
  spread_key = concat(
    case
      when vs.page_number = 1 then 'cover'
      else 'interior'
    end,
    ':',
    case
      when vs.page_number = 1 then 'cover-' || coalesce(nullif(vs.layout_type, 'auto'), 'single')
      else 'interior-' || coalesce(nullif(vs.layout_type, 'auto'), 'single')
    end,
    ':',
    coalesce(si.image_ids, '')
  )
from spread_images si
where vs.id = si.version_spread_id;

update public.version_spreads
set
  template_id = case
    when page_number = 1 then 'cover-' || coalesce(nullif(layout_type, 'auto'), 'single')
    else 'interior-' || coalesce(nullif(layout_type, 'auto'), 'single')
  end,
  spread_role = case
    when page_number = 1 then 'cover'
    else 'interior'
  end,
  spread_key = concat(
    case
      when page_number = 1 then 'cover'
      else 'interior'
    end,
    ':',
    case
      when page_number = 1 then 'cover-' || coalesce(nullif(layout_type, 'auto'), 'single')
      else 'interior-' || coalesce(nullif(layout_type, 'auto'), 'single')
    end,
    ':'
  )
where spread_key is null;

alter table public.version_spreads
  alter column template_id set not null;

alter table public.version_spreads
  alter column spread_role set not null;

alter table public.version_spreads
  alter column spread_key set not null;

alter table public.version_spreads
  drop constraint if exists version_spreads_spread_role_check;

alter table public.version_spreads
  add constraint version_spreads_spread_role_check
  check (spread_role in ('cover', 'interior'));

alter table public.version_spreads
  drop constraint if exists version_spreads_album_version_id_spread_key_key;

alter table public.version_spreads
  add constraint version_spreads_album_version_id_spread_key_key
  unique (album_version_id, spread_key);
