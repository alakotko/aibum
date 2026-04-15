'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import StatusBadge from '@/components/workflow/StatusBadge';
import type { OfferItemSummary, OrderSummary } from '@/types/workflow';
import { formatMoney } from '@/types/workflow';
import { formatOrderDestination } from '@/utils/commerce';
import { inferProjectStatusFromOrder } from '@/utils/workflowStatus';
import styles from '../../surface.module.css';

type OrderDetailRow = {
  id: string;
  project_id: string;
  status: OrderSummary['status'];
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  updated_at: string;
  operator_notes: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  client_note: string | null;
  shipping_name: string | null;
  shipping_address_line_1: string | null;
  shipping_address_line_2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  projects?: { title: string } | null;
};

type OrderDetailQueryRow = Omit<OrderDetailRow, 'projects'> & {
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

function nextOrderValues(nextStatus: OrderSummary['status']) {
  if (nextStatus === 'paid') {
    return { status: nextStatus, payment_status: 'paid', fulfillment_status: 'fulfillment_pending' };
  }

  if (nextStatus === 'fulfillment_pending') {
    return { status: nextStatus, payment_status: 'paid', fulfillment_status: 'fulfillment_pending' };
  }

  if (nextStatus === 'shipped') {
    return { status: nextStatus, payment_status: 'paid', fulfillment_status: 'shipped' };
  }

  return { status: nextStatus, payment_status: 'paid', fulfillment_status: 'delivered' };
}

export default function OrderDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const params = useParams<{ id: string }>();
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<(OrderDetailRow & { items: OfferItemSummary[] }) | null>(null);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    void (async () => {
      const resolvedId = params.id;
      if (!resolvedId) return;
      setOrderId(resolvedId);

      const { data: orderData } = await supabase
        .from('orders')
        .select('id,project_id,status,payment_status,fulfillment_status,total_cents,currency,updated_at,operator_notes,buyer_name,buyer_email,buyer_phone,client_note,shipping_name,shipping_address_line_1,shipping_address_line_2,shipping_city,shipping_state,shipping_postal_code,shipping_country,projects(title)')
        .eq('id', resolvedId)
        .maybeSingle();

      if (!orderData) return;

      const { data: itemData } = await supabase
        .from('order_items')
        .select('id,order_id,title,description,quantity,unit_price_cents,line_total_cents,item_kind')
        .eq('order_id', resolvedId);

      const hydratedOrder = orderData as OrderDetailQueryRow;

      setOrder({
        ...({
          ...hydratedOrder,
          projects: Array.isArray(hydratedOrder.projects)
            ? hydratedOrder.projects[0] ?? null
            : hydratedOrder.projects ?? null,
        } as OrderDetailRow),
        items: ((itemData ?? []) as OrderItemRow[]).map((item) => ({
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
        })),
      });
    })();
  }, [params.id, supabase]);

  async function advance(nextStatus: OrderSummary['status']) {
    if (!order) return;
    setAdvancing(true);
    const { error } = await supabase
      .from('orders')
      .update(nextOrderValues(nextStatus))
      .eq('id', order.id);
    setAdvancing(false);

    if (error) {
      alert(`Failed to update order: ${error.message}`);
      return;
    }

    await supabase
      .from('projects')
      .update({ status: inferProjectStatusFromOrder(nextStatus) })
      .eq('id', order.project_id)
      .is('status_override', null);

    setOrder((current) =>
      current
        ? {
            ...current,
            ...nextOrderValues(nextStatus),
            updated_at: new Date().toISOString(),
          }
        : current
    );
  }

  if (!order) {
    return (
      <div className={styles.page}>
        <section className={styles.panel}>
          <div className={styles.empty}>Order not found.</div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>{order.projects?.title ?? 'Order detail'}</h1>
        <p>Review the selected package, buyer info, and fulfillment progress from one operational view.</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Order status</h2>
            <p>Reference {orderId.slice(0, 8)} · Updated {new Date(order.updated_at).toLocaleString()}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className={styles.detailGrid}>
          <div className={styles.detailCard}>
            <span>Total</span>
            <strong>{formatMoney(order.total_cents, order.currency)}</strong>
          </div>
          <div className={styles.detailCard}>
            <span>Payment</span>
            <strong>{order.payment_status}</strong>
          </div>
          <div className={styles.detailCard}>
            <span>Fulfillment</span>
            <strong>{order.fulfillment_status}</strong>
          </div>
        </div>
        <div className={styles.actionRow}>
          <Link className={styles.link} href={`/projects/${order.project_id}`}>
            Open project workflow
          </Link>
          {order.status === 'payment_pending' ? (
            <button className={styles.buttonGhost} disabled={advancing} onClick={() => advance('paid')}>
              Mark Paid
            </button>
          ) : null}
          {order.status === 'paid' ? (
            <button
              className={styles.buttonGhost}
              disabled={advancing}
              onClick={() => advance('fulfillment_pending')}
            >
              Move to Fulfillment
            </button>
          ) : null}
          {order.status === 'fulfillment_pending' ? (
            <button className={styles.buttonGhost} disabled={advancing} onClick={() => advance('shipped')}>
              Mark Shipped
            </button>
          ) : null}
          {order.status === 'shipped' ? (
            <button className={styles.buttonGhost} disabled={advancing} onClick={() => advance('delivered')}>
              Mark Delivered
            </button>
          ) : null}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Selected package and add-ons</h2>
            <p>These line items were snapped from checkout or the manual offer conversion.</p>
          </div>
        </div>
        {order.items.length === 0 ? (
          <div className={styles.empty}>No order items were recorded for this order.</div>
        ) : (
          <div className={styles.list}>
            {order.items.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.titleRow}>
                  <h3>{item.title}</h3>
                  <span className={styles.pill}>{item.itemKind}</span>
                </div>
                {item.description ? <p className={styles.mutedText}>{item.description}</p> : null}
                <div className={styles.meta}>
                  <span>Qty {item.quantity}</span>
                  <span>{formatMoney(item.lineTotalCents, order.currency)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Buyer and shipping</h2>
            <p>Contact and delivery details from checkout are shown directly for ops.</p>
          </div>
        </div>
        <div className={styles.detailGrid}>
          <div className={styles.detailCard}>
            <span>Buyer</span>
            <strong>{order.buyer_name || 'Not set'}</strong>
          </div>
          <div className={styles.detailCard}>
            <span>Email</span>
            <strong>{order.buyer_email || 'Not set'}</strong>
          </div>
          <div className={styles.detailCard}>
            <span>Phone</span>
            <strong>{order.buyer_phone || 'Not set'}</strong>
          </div>
        </div>
        <div className={styles.stack}>
          <p className={styles.mutedText}>
            {[
              order.shipping_name,
              order.shipping_address_line_1,
              order.shipping_address_line_2,
              formatOrderDestination(order),
              order.shipping_postal_code,
            ]
              .filter(Boolean)
              .join(' · ') || 'Shipping information not set.'}
          </p>
          {order.client_note ? <p className={styles.mutedText}>Client note: {order.client_note}</p> : null}
          {order.operator_notes ? <p className={styles.mutedText}>Ops note: {order.operator_notes}</p> : null}
        </div>
      </section>
    </div>
  );
}
