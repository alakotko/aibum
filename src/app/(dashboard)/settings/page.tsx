'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { CatalogItemKind, StudioCatalogItemSummary } from '@/types/workflow';
import { formatMoney } from '@/types/workflow';
import styles from '../surface.module.css';

type CatalogRow = {
  id: string;
  studio_id: string;
  kind: CatalogItemKind;
  title: string;
  description: string | null;
  currency: string;
  price_cents: number;
  internal_cost_cents: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type CatalogFormState = {
  kind: CatalogItemKind;
  title: string;
  description: string;
  price: string;
  internalCost: string;
  sortOrder: string;
  isActive: boolean;
};

const STARTER_CATALOG: Array<Omit<CatalogFormState, 'sortOrder' | 'isActive'>> = [
  {
    kind: 'package',
    title: 'Signature Album',
    description: '12x12 flush-mount album with linen wrap.',
    price: '129900',
    internalCost: '72000',
  },
  {
    kind: 'package',
    title: 'Story Album',
    description: '10x10 storytelling format with a lighter page count.',
    price: '99900',
    internalCost: '56000',
  },
  {
    kind: 'package',
    title: 'Luxe Album',
    description: 'Premium heirloom album with elevated finish options.',
    price: '169900',
    internalCost: '95000',
  },
  {
    kind: 'addon',
    title: 'Parent Album Pair',
    description: 'Two duplicate 8x8 copies.',
    price: '20000',
    internalCost: '12000',
  },
  {
    kind: 'addon',
    title: 'Cover Upgrade',
    description: 'Premium cover material upgrade.',
    price: '12000',
    internalCost: '6500',
  },
  {
    kind: 'addon',
    title: 'Gift Box',
    description: 'Protective presentation box for the final album.',
    price: '25000',
    internalCost: '14000',
  },
  {
    kind: 'addon',
    title: 'Extra Spreads',
    description: 'Two additional spreads beyond the base package.',
    price: '18000',
    internalCost: '9000',
  },
];

function emptyForm(kind: CatalogItemKind = 'package'): CatalogFormState {
  return {
    kind,
    title: '',
    description: '',
    price: '',
    internalCost: '',
    sortOrder: '0',
    isActive: true,
  };
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [items, setItems] = useState<StudioCatalogItemSummary[]>([]);
  const [form, setForm] = useState<CatalogFormState>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingStarter, setLoadingStarter] = useState(false);

  const packages = items.filter((item) => item.kind === 'package');
  const addons = items.filter((item) => item.kind === 'addon');

  const loadCatalog = useCallback(async (currentStudioId: string) => {
    const { data } = await supabase
      .from('studio_catalog_items')
      .select('*')
      .eq('studio_id', currentStudioId)
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false });

    setItems(
      ((data ?? []) as CatalogRow[]).map((row) => ({
        id: row.id,
        studioId: row.studio_id,
        kind: row.kind,
        title: row.title,
        description: row.description,
        currency: row.currency,
        priceCents: row.price_cents,
        internalCostCents: row.internal_cost_cents,
        isActive: row.is_active,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    );
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      const { data: authData } = await supabase.auth.getSession();
      const currentStudioId = authData.session?.user.id ?? null;
      setStudioId(currentStudioId);
      if (!currentStudioId) return;
      await loadCatalog(currentStudioId);
    })();
  }, [loadCatalog, supabase]);

  async function handleSave() {
    if (!studioId) return;

    setSaving(true);
    const { error } = await supabase.from('studio_catalog_items').upsert({
      id: editingId ?? undefined,
      studio_id: studioId,
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim() || null,
      currency: 'USD',
      price_cents: Number(form.price || 0),
      internal_cost_cents: Number(form.internalCost || 0),
      is_active: form.isActive,
      sort_order: Number(form.sortOrder || 0),
    });
    setSaving(false);

    if (error) {
      alert(`Failed to save catalog item: ${error.message}`);
      return;
    }

    setEditingId(null);
    setForm(emptyForm(form.kind));
    await loadCatalog(studioId);
  }

  async function handleArchive(item: StudioCatalogItemSummary) {
    if (!studioId) return;

    const { error } = await supabase
      .from('studio_catalog_items')
      .update({ is_active: false })
      .eq('id', item.id);

    if (error) {
      alert(`Failed to archive item: ${error.message}`);
      return;
    }

    await loadCatalog(studioId);
  }

  async function loadStarterCatalog() {
    if (!studioId) return;

    setLoadingStarter(true);
    const payload = STARTER_CATALOG.map((item, index) => ({
      studio_id: studioId,
      kind: item.kind,
      title: item.title,
      description: item.description,
      currency: 'USD',
      price_cents: Number(item.price),
      internal_cost_cents: Number(item.internalCost),
      is_active: true,
      sort_order: index,
    }));

    const { error } = await supabase.from('studio_catalog_items').insert(payload);
    setLoadingStarter(false);

    if (error) {
      alert(`Failed to load starter catalog: ${error.message}`);
      return;
    }

    await loadCatalog(studioId);
  }

  function startEditing(item: StudioCatalogItemSummary) {
    setEditingId(item.id);
    setForm({
      kind: item.kind,
      title: item.title,
      description: item.description ?? '',
      price: String(item.priceCents),
      internalCost: String(item.internalCostCents),
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Settings</h1>
        <p>
          Define the prepared package catalog that photographers can attach to approved proofs.
          Packages and add-ons here power the guarded client checkout flow.
        </p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Package catalog</h2>
            <p>Build a reusable catalog of base packages and optional add-ons with customer price and internal cost metadata.</p>
          </div>
          <div className={styles.toolbar}>
            <button
              className={styles.buttonGhost}
              disabled={loadingStarter || !studioId}
              onClick={loadStarterCatalog}
            >
              {loadingStarter ? 'Loading…' : 'Load Starter Catalog'}
            </button>
          </div>
        </div>

        <div className={styles.form}>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>Catalog kind</span>
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    kind: event.target.value as CatalogItemKind,
                  }))
                }
              >
                <option value="package">Package</option>
                <option value="addon">Add-on</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Customer price (cents)</span>
              <input
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Internal cost (cents)</span>
              <input
                value={form.internalCost}
                onChange={(event) =>
                  setForm((current) => ({ ...current, internalCost: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>Sort order</span>
              <input
                value={form.sortOrder}
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.value === 'active',
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>

          <div className={styles.actionRow}>
            <button className={styles.button} disabled={saving || !studioId} onClick={handleSave}>
              {saving ? 'Saving…' : editingId ? 'Update Item' : 'Create Item'}
            </button>
            {editingId ? (
              <button className={styles.buttonGhost} onClick={() => {
                setEditingId(null);
                setForm(emptyForm(form.kind));
              }}>
                Cancel Edit
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Prepared packages</h2>
            <p>These are the base package cards clients will choose from after proof approval.</p>
          </div>
        </div>
        {packages.length === 0 ? (
          <div className={styles.empty}>No packages yet. Add Signature, Story, Luxe, or load the starter catalog.</div>
        ) : (
          <div className={styles.list}>
            {packages.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.titleRow}>
                  <h3>{item.title}</h3>
                  <span className={styles.pill}>{item.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                {item.description ? <p className={styles.mutedText}>{item.description}</p> : null}
                <div className={styles.meta}>
                  <span>{formatMoney(item.priceCents, item.currency)}</span>
                  <span>Cost {formatMoney(item.internalCostCents, item.currency)}</span>
                  <span>Sort {item.sortOrder}</span>
                </div>
                <div className={styles.actionRow}>
                  <button className={styles.buttonGhost} onClick={() => startEditing(item)}>
                    Edit
                  </button>
                  {item.isActive ? (
                    <button className={styles.buttonDanger} onClick={() => handleArchive(item)}>
                      Archive
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Add-on catalog</h2>
            <p>These extras appear as optional upsells during client package selection and checkout.</p>
          </div>
        </div>
        {addons.length === 0 ? (
          <div className={styles.empty}>No add-ons yet. Add gift boxes, parent albums, cover upgrades, or extra spreads.</div>
        ) : (
          <div className={styles.list}>
            {addons.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.titleRow}>
                  <h3>{item.title}</h3>
                  <span className={styles.pill}>{item.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                {item.description ? <p className={styles.mutedText}>{item.description}</p> : null}
                <div className={styles.meta}>
                  <span>{formatMoney(item.priceCents, item.currency)}</span>
                  <span>Cost {formatMoney(item.internalCostCents, item.currency)}</span>
                  <span>Sort {item.sortOrder}</span>
                </div>
                <div className={styles.actionRow}>
                  <button className={styles.buttonGhost} onClick={() => startEditing(item)}>
                    Edit
                  </button>
                  {item.isActive ? (
                    <button className={styles.buttonDanger} onClick={() => handleArchive(item)}>
                      Archive
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
