'use client';

import type { CSSProperties } from 'react';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import GalleryImage from '@/app/(dashboard)/projects/[id]/gallery/GalleryImage';
import styles from './proof.module.css';

type LoadedProof = {
  proofLinkId: string;
  projectTitle: string;
  versionTitle: string;
  proofTitle: string;
  proofStatus: string;
  studioName: string;
  supportEmail: string;
  proofHeadline: string;
  proofSubheadline: string;
  primaryColor: string;
  accentColor: string;
  spreads: Array<{
    id: string;
    pageNumber: number;
    layoutType: 'single' | 'split' | 'grid3' | 'auto';
    backgroundColor: string;
    images: Array<{ id: string; url: string; thumbnailUrl?: string | null; filename?: string | null }>;
  }>;
  comments: Array<{
    id: string;
    proofLinkId: string;
    versionSpreadId?: string | null;
    authorName: string;
    content: string;
    createdAt: string;
  }>;
};

export default function ClientProofingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.id;
  const supabase = useMemo(() => createClient(), []);

  const [proof, setProof] = useState<LoadedProof | null>(null);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProof = useCallback(async (): Promise<{ proof: LoadedProof | null; error: string | null }> => {
    const { data: proofLink, error: proofError } = await supabase
      .from('proof_links')
      .select('*')
      .eq('slug', slug)
      .single();

    if (proofError || !proofLink) {
      return { proof: null, error: 'Proof link not found or no longer active.' };
    }

    const { data: version, error: versionError } = await supabase
      .from('album_versions')
      .select('id,project_id,title,status')
      .eq('id', proofLink.album_version_id)
      .single();

    if (versionError || !version) {
      return { proof: null, error: 'The proof version could not be loaded.' };
    }

    const [{ data: project }, { data: branding }, { data: spreads }, { data: comments }] = await Promise.all([
      supabase.from('projects').select('title,studio_id').eq('id', version.project_id).single(),
      supabase
        .from('projects')
        .select('studio_id')
        .eq('id', version.project_id)
        .single()
        .then(async ({ data }) => {
          if (!data?.studio_id) return { data: null };
          return supabase.from('studio_branding').select('*').eq('studio_id', data.studio_id).maybeSingle();
        }),
      supabase
        .from('version_spreads')
        .select('*')
        .eq('album_version_id', version.id)
        .order('page_number', { ascending: true }),
      supabase
        .from('proof_comments')
        .select('*')
        .eq('proof_link_id', proofLink.id)
        .order('created_at', { ascending: true }),
    ]);

    const spreadRows = spreads ?? [];
    const spreadIds = spreadRows.map((spread) => spread.id);

    const { data: spreadImages } = spreadIds.length
      ? await supabase
          .from('version_spread_images')
          .select('*')
          .in('version_spread_id', spreadIds)
          .order('z_index', { ascending: true })
      : { data: [] };

    const albumInputIds = (spreadImages ?? []).map((image) => image.album_input_id);
    const { data: albumInputs } = albumInputIds.length
      ? await supabase.from('album_inputs').select('*').in('id', albumInputIds)
      : { data: [] };

    const inputMap = new Map((albumInputs ?? []).map((input) => [input.id, input]));

    return {
      error: null,
      proof: {
      proofLinkId: proofLink.id,
      projectTitle: project?.title ?? 'Album proof',
      versionTitle: version.title,
      proofTitle: proofLink.title ?? 'Album proof',
      proofStatus: proofLink.status,
      studioName: branding?.studio_name ?? 'Albumin Studio',
      supportEmail: branding?.support_email ?? '',
      proofHeadline: branding?.proof_headline ?? 'Review your album proof',
      proofSubheadline:
        branding?.proof_subheadline ?? 'Leave comments directly on the spreads that need changes.',
      primaryColor: branding?.primary_color ?? '#cc785c',
      accentColor: branding?.accent_color ?? '#f3e6d4',
      spreads: spreadRows.map((spread) => ({
        id: spread.id,
        pageNumber: spread.page_number,
        layoutType: spread.layout_type,
        backgroundColor: spread.background_color,
        images: (spreadImages ?? [])
          .filter((image) => image.version_spread_id === spread.id)
          .map((image) => {
            const input = inputMap.get(image.album_input_id);
            return {
              id: image.id,
              url: input?.storage_path ?? '',
              thumbnailUrl: input?.thumbnail_path ?? null,
              filename: input?.filename ?? null,
            };
          }),
      })),
      comments: (comments ?? []).map((entry) => ({
        id: entry.id,
        proofLinkId: entry.proof_link_id,
        versionSpreadId: entry.version_spread_id,
        authorName: entry.author_name,
        content: entry.content,
        createdAt: entry.created_at,
      })),
      },
    };
  }, [slug, supabase]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setError(null);
      const result = await fetchProof();
      if (cancelled) return;
      setProof(result.proof);
      setError(result.error);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchProof]);

  async function submitComment() {
    if (!proof || !comment.trim()) return;

    setIsSubmitting(true);
    const current = proof.spreads[currentSpread];
    const { error: insertError } = await supabase.from('proof_comments').insert({
      proof_link_id: proof.proofLinkId,
      version_spread_id: current?.id ?? null,
      author_name: authorName.trim() || 'Client',
      content: comment.trim(),
    });
    setIsSubmitting(false);

    if (insertError) {
      alert(`Failed to submit comment: ${insertError.message}`);
      return;
    }

    setComment('');
    const result = await fetchProof();
    setProof(result.proof);
    setError(result.error);
  }

  if (error) {
    return <div className={styles.centerState}>{error}</div>;
  }

  if (!proof) {
    return <div className={styles.centerState}>Loading proof…</div>;
  }

  const activeSpread = proof.spreads[currentSpread];
  const activeComments = proof.comments.filter((entry) => !entry.versionSpreadId || entry.versionSpreadId === activeSpread?.id);

  return (
    <div
      className={styles.page}
      style={
        {
          ['--proof-primary' as string]: proof.primaryColor,
          ['--proof-accent' as string]: proof.accentColor,
        } as CSSProperties
      }
    >
      <header className={styles.header}>
        <div>
          <div className={styles.studio}>{proof.studioName}</div>
          <h1>{proof.proofHeadline}</h1>
          <p>{proof.proofSubheadline}</p>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.status}>{proof.proofStatus}</span>
          <strong>{proof.projectTitle}</strong>
          <span>{proof.versionTitle}</span>
          {proof.supportEmail ? <span>{proof.supportEmail}</span> : null}
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.viewer}>
          <div className={styles.viewerToolbar}>
            <div>
              <div className={styles.viewerTitle}>{proof.proofTitle}</div>
              <div className={styles.viewerMeta}>Spread {currentSpread + 1} of {proof.spreads.length}</div>
            </div>
            <div className={styles.navActions}>
              <button disabled={currentSpread === 0} onClick={() => setCurrentSpread((value) => value - 1)}>
                Previous
              </button>
              <button
                disabled={currentSpread >= proof.spreads.length - 1}
                onClick={() => setCurrentSpread((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>

          {activeSpread ? (
            <div
              className={`${styles.spread} ${styles[`layout_${activeSpread.layoutType}`] ?? styles.layout_auto}`}
              style={{ backgroundColor: activeSpread.backgroundColor }}
            >
              {activeSpread.images.map((image) => (
                <div key={image.id} className={styles.spreadSlot}>
                  <GalleryImage src={image.thumbnailUrl ?? image.url} alt={image.filename ?? 'Proof image'} />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <aside className={styles.sidebar}>
          <div className={styles.commentPanel}>
            <h2>Comments</h2>
            {activeComments.length === 0 ? (
              <p className={styles.empty}>No comments yet for this spread.</p>
            ) : (
              <div className={styles.commentList}>
                {activeComments.map((entry) => (
                  <article key={entry.id} className={styles.commentCard}>
                    <div className={styles.commentAuthor}>{entry.authorName}</div>
                    <p>{entry.content}</p>
                    <time>{new Date(entry.createdAt).toLocaleString()}</time>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className={styles.commentForm}>
            <h2>Leave feedback</h2>
            <input
              placeholder="Your name"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
            />
            <textarea
              placeholder="Ask for swaps, crop changes, or note what you love."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <button disabled={isSubmitting || !comment.trim()} onClick={submitComment}>
              {isSubmitting ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
