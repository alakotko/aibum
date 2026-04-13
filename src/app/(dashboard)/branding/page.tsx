'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import styles from '../surface.module.css';

export default function BrandingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studioName: '',
    logoUrl: '',
    primaryColor: '#cc785c',
    accentColor: '#f3e6d4',
    supportEmail: '',
    proofHeadline: '',
    proofSubheadline: '',
  });

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getSession();
      const currentStudioId = authData.session?.user.id ?? null;
      setStudioId(currentStudioId);
      if (!currentStudioId) return;

      const { data } = await supabase
        .from('studio_branding')
        .select('*')
        .eq('studio_id', currentStudioId)
        .maybeSingle();

      if (data) {
        setForm({
          studioName: data.studio_name ?? '',
          logoUrl: data.logo_url ?? '',
          primaryColor: data.primary_color ?? '#cc785c',
          accentColor: data.accent_color ?? '#f3e6d4',
          supportEmail: data.support_email ?? '',
          proofHeadline: data.proof_headline ?? '',
          proofSubheadline: data.proof_subheadline ?? '',
        });
      }
    })();
  }, [supabase]);

  async function handleSave() {
    if (!studioId) return;
    setSaving(true);
    const { error } = await supabase.from('studio_branding').upsert({
      studio_id: studioId,
      studio_name: form.studioName,
      logo_url: form.logoUrl,
      primary_color: form.primaryColor,
      accent_color: form.accentColor,
      support_email: form.supportEmail,
      proof_headline: form.proofHeadline,
      proof_subheadline: form.proofSubheadline,
    });
    setSaving(false);
    if (error) {
      alert(`Failed to save branding: ${error.message}`);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Branding</h1>
        <p>Configure the white-label proof surface clients see when they open an Albumin proof link.</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Studio proof identity</h2>
            <p>These values power proof headers, contact copy, and color direction across the public experience.</p>
          </div>
          <button className={styles.button} disabled={saving || !studioId} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save branding'}
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="studio-name">Studio name</label>
              <input id="studio-name" value={form.studioName} onChange={(event) => setForm((current) => ({ ...current, studioName: event.target.value }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="support-email">Support email</label>
              <input id="support-email" value={form.supportEmail} onChange={(event) => setForm((current) => ({ ...current, supportEmail: event.target.value }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="primary-color">Primary color</label>
              <input id="primary-color" value={form.primaryColor} onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="accent-color">Accent color</label>
              <input id="accent-color" value={form.accentColor} onChange={(event) => setForm((current) => ({ ...current, accentColor: event.target.value }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="logo-url">Logo URL</label>
              <input id="logo-url" value={form.logoUrl} onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="proof-headline">Proof headline</label>
              <input id="proof-headline" value={form.proofHeadline} onChange={(event) => setForm((current) => ({ ...current, proofHeadline: event.target.value }))} />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="proof-subheadline">Proof subheadline</label>
            <textarea id="proof-subheadline" value={form.proofSubheadline} onChange={(event) => setForm((current) => ({ ...current, proofSubheadline: event.target.value }))} />
          </div>
        </div>
      </section>
    </div>
  );
}
