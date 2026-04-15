alter table public.studio_branding
  add column if not exists sender_name text;

create table if not exists public.studio_catalog_items (
  id uuid default gen_random_uuid() primary key,
  studio_id uuid references public.profiles(id) on delete cascade not null,
  kind text not null check (kind in ('package', 'addon')),
  title text not null,
  description text,
  currency text default 'USD' not null,
  price_cents int default 0 not null,
  internal_cost_cents int default 0 not null,
  is_active boolean default true not null,
  sort_order int default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists studio_catalog_items_studio_kind_idx
  on public.studio_catalog_items (studio_id, kind, updated_at desc);

alter table public.studio_catalog_items enable row level security;

drop policy if exists "Studio owners can manage catalog items." on public.studio_catalog_items;
create policy "Studio owners can manage catalog items."
  on public.studio_catalog_items for all
  using (studio_id = auth.uid())
  with check (studio_id = auth.uid());

alter table public.offers
  add column if not exists package_catalog_item_id uuid references public.studio_catalog_items(id) on delete set null;

alter table public.offer_items
  add column if not exists item_kind text default 'included' not null
    check (item_kind in ('included', 'addon')),
  add column if not exists is_optional boolean default false not null,
  add column if not exists is_selected_by_default boolean default false not null,
  add column if not exists internal_cost_cents int default 0 not null,
  add column if not exists studio_catalog_item_id uuid references public.studio_catalog_items(id) on delete set null;

alter table public.orders
  add column if not exists buyer_name text,
  add column if not exists buyer_email text,
  add column if not exists buyer_phone text,
  add column if not exists client_note text,
  add column if not exists shipping_name text,
  add column if not exists shipping_address_line_1 text,
  add column if not exists shipping_address_line_2 text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_country text;

alter table public.order_items
  add column if not exists item_kind text default 'included' not null
    check (item_kind in ('included', 'addon')),
  add column if not exists internal_cost_cents int default 0 not null,
  add column if not exists studio_catalog_item_id uuid references public.studio_catalog_items(id) on delete set null;

create or replace function public.get_public_checkout_context(proof_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_link record;
  existing_order jsonb;
begin
  select
    pl.id as proof_link_id,
    pl.slug as proof_token,
    pl.album_version_id,
    pl.status as proof_status,
    pl.is_public,
    pl.expires_at,
    av.title as version_title,
    av.project_id,
    pr.title as project_title,
    pr.studio_id
  into target_link
  from public.proof_links pl
  join public.album_versions av on av.id = pl.album_version_id
  join public.projects pr on pr.id = av.project_id
  where pl.slug = proof_token;

  if not found then
    return null;
  end if;

  if not target_link.is_public
    or target_link.proof_status <> 'approved'
    or (target_link.expires_at is not null and target_link.expires_at <= now()) then
    return null;
  end if;

  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'totalCents', o.total_cents,
    'currency', o.currency,
    'buyerName', o.buyer_name,
    'buyerEmail', o.buyer_email,
    'createdAt', o.created_at
  )
  into existing_order
  from public.orders o
  join public.offers offer_row on offer_row.id = o.offer_id
  where offer_row.album_version_id = target_link.album_version_id
    and o.status <> 'cancelled'
  order by o.created_at desc
  limit 1;

  return jsonb_build_object(
    'proofToken', target_link.proof_token,
    'projectTitle', target_link.project_title,
    'versionTitle', target_link.version_title,
    'proofStatus', target_link.proof_status,
    'branding', (
      select jsonb_build_object(
        'studioName', coalesce(nullif(sb.studio_name, ''), 'Albumin Studio'),
        'senderName', coalesce(nullif(sb.sender_name, ''), nullif(sb.studio_name, ''), 'Albumin Studio'),
        'logoUrl', sb.logo_url,
        'supportEmail', coalesce(sb.support_email, ''),
        'proofHeadline', coalesce(nullif(sb.proof_headline, ''), 'Review your album proof'),
        'proofSubheadline', coalesce(nullif(sb.proof_subheadline, ''), 'Choose the album package that matches your final proof.'),
        'primaryColor', coalesce(sb.primary_color, '#cc785c'),
        'accentColor', coalesce(sb.accent_color, '#f3e6d4')
      )
      from public.studio_branding sb
      where sb.studio_id = target_link.studio_id
    ),
    'offers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'title', o.title,
          'status', o.status,
          'currency', o.currency,
          'totalCents', o.total_cents,
          'notes', o.notes,
          'packageCatalogItemId', o.package_catalog_item_id,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', oi.id,
                'title', oi.title,
                'description', oi.description,
                'quantity', oi.quantity,
                'unitPriceCents', oi.unit_price_cents,
                'lineTotalCents', oi.line_total_cents,
                'itemKind', oi.item_kind,
                'isOptional', oi.is_optional,
                'isSelectedByDefault', oi.is_selected_by_default,
                'internalCostCents', oi.internal_cost_cents,
                'studioCatalogItemId', oi.studio_catalog_item_id
              )
              order by oi.is_optional, oi.title
            )
            from public.offer_items oi
            where oi.offer_id = o.id
          ), '[]'::jsonb)
        )
        order by o.updated_at desc
      )
      from public.offers o
      where o.album_version_id = target_link.album_version_id
        and o.status in ('sent', 'accepted')
    ), '[]'::jsonb),
    'existingOrder', existing_order
  );
end;
$$;

create or replace function public.submit_public_checkout(
  proof_token text,
  offer_row_id uuid,
  selected_addon_item_ids uuid[] default '{}',
  buyer_name text default null,
  buyer_email text default null,
  buyer_phone text default null,
  client_note text default null,
  shipping_name text default null,
  shipping_address_line_1 text default null,
  shipping_address_line_2 text default null,
  shipping_city text default null,
  shipping_state text default null,
  shipping_postal_code text default null,
  shipping_country text default null
)
returns table (
  order_id uuid,
  order_status text,
  total_cents int,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_link record;
  target_offer public.offers%rowtype;
  target_client_id uuid;
  next_total_cents int;
  next_order public.orders%rowtype;
  normalized_buyer_name text := nullif(btrim(coalesce(buyer_name, '')), '');
  normalized_buyer_email text := nullif(btrim(coalesce(buyer_email, '')), '');
  normalized_buyer_phone text := nullif(btrim(coalesce(buyer_phone, '')), '');
  normalized_client_note text := nullif(btrim(coalesce(client_note, '')), '');
  normalized_shipping_name text := nullif(btrim(coalesce(shipping_name, '')), '');
  normalized_address_line_1 text := nullif(btrim(coalesce(shipping_address_line_1, '')), '');
  normalized_address_line_2 text := nullif(btrim(coalesce(shipping_address_line_2, '')), '');
  normalized_shipping_city text := nullif(btrim(coalesce(shipping_city, '')), '');
  normalized_shipping_state text := nullif(btrim(coalesce(shipping_state, '')), '');
  normalized_shipping_postal_code text := nullif(btrim(coalesce(shipping_postal_code, '')), '');
  normalized_shipping_country text := nullif(btrim(coalesce(shipping_country, '')), '');
begin
  if normalized_buyer_name is null
    or normalized_buyer_email is null
    or normalized_address_line_1 is null
    or normalized_shipping_city is null
    or normalized_shipping_state is null
    or normalized_shipping_postal_code is null
    or normalized_shipping_country is null then
    raise exception 'Buyer name, buyer email, and full shipping address are required.';
  end if;

  select
    pl.id as proof_link_id,
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
    or target_link.status <> 'approved'
    or (target_link.expires_at is not null and target_link.expires_at <= now()) then
    raise exception 'Checkout is not available for this proof.';
  end if;

  select *
  into target_offer
  from public.offers
  where id = offer_row_id
    and album_version_id = target_link.album_version_id
  for update;

  if not found then
    raise exception 'Offer not found for this proof.';
  end if;

  if target_offer.status not in ('sent', 'accepted') then
    raise exception 'Offer is not available for checkout.';
  end if;

  if exists (
    select 1
    from public.orders existing_order
    join public.offers existing_offer on existing_offer.id = existing_order.offer_id
    where existing_offer.album_version_id = target_link.album_version_id
      and existing_order.status <> 'cancelled'
  ) then
    raise exception 'An order has already been placed for this proof.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(selected_addon_item_ids, '{}'::uuid[])) selected_item(item_id)
    left join public.offer_items oi on oi.id = selected_item.item_id
    where oi.id is null
      or oi.offer_id <> target_offer.id
      or oi.is_optional = false
  ) then
    raise exception 'Selected add-ons are invalid for this offer.';
  end if;

  select coalesce(sum(oi.line_total_cents), target_offer.total_cents)
  into next_total_cents
  from public.offer_items oi
  where oi.offer_id = target_offer.id
    and (
      oi.is_optional = false
      or oi.id = any(coalesce(selected_addon_item_ids, '{}'::uuid[]))
    );

  target_client_id := target_offer.client_id;

  if target_client_id is null then
    insert into public.clients (
      project_id,
      name,
      email,
      notes,
      updated_at
    )
    values (
      target_link.project_id,
      normalized_buyer_name,
      normalized_buyer_email,
      normalized_client_note,
      timezone('utc'::text, now())
    )
    returning id into target_client_id;
  else
    update public.clients
    set name = normalized_buyer_name,
        email = normalized_buyer_email,
        notes = coalesce(normalized_client_note, notes),
        updated_at = timezone('utc'::text, now())
    where id = target_client_id;
  end if;

  insert into public.orders (
    project_id,
    client_id,
    offer_id,
    status,
    payment_status,
    fulfillment_status,
    currency,
    total_cents,
    operator_notes,
    buyer_name,
    buyer_email,
    buyer_phone,
    client_note,
    shipping_name,
    shipping_address_line_1,
    shipping_address_line_2,
    shipping_city,
    shipping_state,
    shipping_postal_code,
    shipping_country
  )
  values (
    target_link.project_id,
    target_client_id,
    target_offer.id,
    'payment_pending',
    'payment_pending',
    'fulfillment_pending',
    target_offer.currency,
    next_total_cents,
    'Client submitted checkout. Awaiting manual payment confirmation.',
    normalized_buyer_name,
    normalized_buyer_email,
    normalized_buyer_phone,
    normalized_client_note,
    coalesce(normalized_shipping_name, normalized_buyer_name),
    normalized_address_line_1,
    normalized_address_line_2,
    normalized_shipping_city,
    normalized_shipping_state,
    normalized_shipping_postal_code,
    normalized_shipping_country
  )
  returning * into next_order;

  insert into public.order_items (
    order_id,
    title,
    description,
    quantity,
    unit_price_cents,
    line_total_cents,
    item_kind,
    internal_cost_cents,
    studio_catalog_item_id
  )
  select
    next_order.id,
    oi.title,
    oi.description,
    oi.quantity,
    oi.unit_price_cents,
    oi.line_total_cents,
    oi.item_kind,
    oi.internal_cost_cents,
    oi.studio_catalog_item_id
  from public.offer_items oi
  where oi.offer_id = target_offer.id
    and (
      oi.is_optional = false
      or oi.id = any(coalesce(selected_addon_item_ids, '{}'::uuid[]))
    );

  update public.offers
  set status = 'accepted',
      updated_at = timezone('utc'::text, now())
  where id = target_offer.id;

  perform public.set_project_auto_status(target_link.project_id, 'payment_pending');

  order_id := next_order.id;
  order_status := next_order.status;
  total_cents := next_order.total_cents;
  currency := next_order.currency;
  return next;
end;
$$;

grant execute on function public.get_public_checkout_context(text) to anon, authenticated;
grant execute on function public.submit_public_checkout(
  text,
  uuid,
  uuid[],
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;
