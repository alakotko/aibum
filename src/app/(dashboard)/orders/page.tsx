'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import StatusBadge from '@/components/workflow/StatusBadge';
import { formatMoney, type WorkflowStatus } from '@/types/workflow';
import styles from '../surface.module.css';

type OrderRow = {
  id: string;
  project_id: string;
  status: WorkflowStatus;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  updated_at: string;
  projects?: { title: string } | null;
};

type OrderQueryRow = {
  id: string;
  project_id: string;
  status: WorkflowStatus;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  updated_at: string;
  projects?: Array<{ title: string }> | { title: string } | null;
};

export default function OrdersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    supabase
      .from('orders')
      .select('id,project_id,status,payment_status,fulfillment_status,total_cents,currency,updated_at,projects(title)')
      .order('updated_at', { ascending: false })
      .then(({ data }) =>
        setOrders(
          ((data ?? []) as OrderQueryRow[]).map((row) => ({
            ...row,
            projects: Array.isArray(row.projects) ? row.projects[0] ?? null : row.projects ?? null,
          }))
        )
      );
  }, [supabase]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Orders</h1>
        <p>Track every manual order across the studio, from payment pending through fulfillment and delivery.</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Studio order queue</h2>
            <p>Projects push approved packages here so the operator can manage payment and print handoff.</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className={styles.empty}>No orders yet. Create a manual order from a project offer.</div>
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
                </div>
                <Link className={styles.link} href={`/projects/${order.project_id}`}>
                  Open project workflow
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
