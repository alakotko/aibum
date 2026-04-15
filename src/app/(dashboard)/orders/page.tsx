'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import StatusBadge from '@/components/workflow/StatusBadge';
import type { OfferItemSummary, OrderSummary } from '@/types/workflow';
import { formatMoney } from '@/types/workflow';
import { formatOrderDestination } from '@/utils/commerce';
import styles from '../surface.module.css';

type OrderRow = {
  id: string;
  project_id: string;
  status: OrderSummary['status'];
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  updated_at: string;
  buyer_name: string | null;
  buyer_email: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_country: string | null;
  projects?: { title: string } | null;
};

type OrderQueryRow = {
  id: string;
  project_id: string;
  status: OrderSummary['status'];
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  updated_at: string;
  buyer_name: string | null;
  buyer_email: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_country: string | null;
  projects?: Array<{ title: string }> | { title: string } | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  title: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  item_kind: OfferItemSummary['itemKind'];
};

type BrandingRow = {
  studio_name: string | null;
  sender_name: string | null;
};

export default function OrdersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<Array<OrderRow & { items: OfferItemSummary[] }>>([]);
  const [branding, setBranding] = useState<BrandingRow | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: authData } = await supabase.auth.getSession();
      const currentStudioId = authData.session?.user.id ?? null;

      const [{ data: orderData }, brandingRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id,project_id,status,payment_status,fulfillment_status,total_cents,currency,updated_at,buyer_name,buyer_email,shipping_city,shipping_state,shipping_country,projects(title)')
          .order('updated_at', { ascending: false }),
        currentStudioId
          ? supabase
              .from('studio_branding')
              .select('studio_name,sender_name')
              .eq('studio_id', currentStudioId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const nextOrders = ((orderData ?? []) as OrderQueryRow[]).map((row) => ({
        ...row,
        projects: Array.isArray(row.projects) ? row.projects[0] ?? null : row.projects ?? null,
      }));

      const orderIds = nextOrders.map((order) => order.id);
      const { data: itemData } = orderIds.length
        ? await supabase
            .from('order_items')
            .select('id,order_id,title,description,quantity,unit_price_cents,line_total_cents,item_kind')
            .in('order_id', orderIds)
        : { data: [] };

      const itemsByOrder = new Map<string, OfferItemSummary[]>();
      for (const item of (itemData ?? []) as OrderItemRow[]) {
        const currentItems = itemsByOrder.get(item.order_id) ?? [];
        currentItems.push({
          id: item.id,
          title: item.title,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
          lineTotalCents: item.line_total_cents,
          itemKind: item.item_kind,
          isOptional: false,
          isSelectedByDefault: false,
          internalCostCents: 0,
        });
        itemsByOrder.set(item.order_id, currentItems);
      }

      setOrders(
        nextOrders.map((order) => ({
          ...order,
          items: itemsByOrder.get(order.id) ?? [],
        }))
      );
      setBranding((brandingRes.data as BrandingRow | null) ?? null);
    })();
  }, [supabase]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Orders</h1>
        <p>
          {(branding?.sender_name || branding?.studio_name || 'Studio ops') +
            ' can manage payment, fulfillment, buyer contact, and shipping details from one order queue.'}
        </p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Studio order queue</h2>
            <p>Each order shows the chosen package, add-ons, buyer context, and current operational state.</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className={styles.empty}>No orders yet. Orders appear here after manual creation or public checkout.</div>
        ) : (
          <div className={styles.list}>
            {orders.map((order) => (
              <article key={order.id} className={styles.card}>
                <div className={styles.titleRow}>
                  <h3>{order.projects?.title ?? 'Project order'}</h3>
                  <StatusBadge status={order.status} />
                </div>
                <div className={styles.meta}>
                  <span>{formatMoney(order.total_cents, order.currency)}</span>
                  <span>Payment: {order.payment_status}</span>
                  <span>Fulfillment: {order.fulfillment_status}</span>
                  {order.buyer_name ? <span>Buyer: {order.buyer_name}</span> : null}
                  {order.buyer_email ? <span>{order.buyer_email}</span> : null}
                  {formatOrderDestination(order) ? (
                    <span>Ship to {formatOrderDestination(order)}</span>
                  ) : null}
                </div>
                {order.items.length > 0 ? (
                  <div className={styles.stack}>
                    {order.items.map((item) => (
                      <div key={item.id} className={styles.meta}>
                        <span>{item.title}</span>
                        <span>{formatMoney(item.lineTotalCents, order.currency)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className={styles.actionRow}>
                  <Link className={styles.link} href={`/orders/${order.id}`}>
                    Open order detail
                  </Link>
                  <Link className={styles.link} href={`/projects/${order.project_id}`}>
                    Open project workflow
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
