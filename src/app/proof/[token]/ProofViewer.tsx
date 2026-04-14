'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import GalleryImage from '@/app/(dashboard)/projects/[id]/gallery/GalleryImage';
import type { LoadedProof, ProofCommentRecord } from '@/types/proof';
import styles from './proof.module.css';

export default function ProofViewer({ initialProof }: { initialProof: LoadedProof }) {
  const [proof, setProof] = useState(initialProof);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeSpread = proof.spreads[currentSpread];
  const activeComments = proof.comments.filter((entry) => !entry.versionSpreadId || entry.versionSpreadId === activeSpread?.id);

  async function submitComment() {
    if (!comment.trim()) return;

    try {
      setIsSubmitting(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('proof_comments')
        .insert({
          proof_link_id: proof.proofLinkId,
          version_spread_id: activeSpread?.id ?? null,
          author_name: authorName.trim() || 'Client',
          content: comment.trim(),
        })
        .select('id, proof_link_id, version_spread_id, author_name, content, created_at')
        .single();

      if (error || !data) {
        alert(`Failed to submit comment: ${error?.message ?? 'Unknown error'}`);
        return;
      }

      const createdComment: ProofCommentRecord = {
        id: data.id,
        proofLinkId: data.proof_link_id,
        versionSpreadId: data.version_spread_id,
        authorName: data.author_name,
        content: data.content,
        createdAt: data.created_at,
      };

      setProof((current) => ({
        ...current,
        comments: [...current.comments, createdComment],
      }));
      setComment('');
    } catch (error: unknown) {
      alert(`Failed to submit comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }

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
              <div className={styles.viewerMeta}>
                {proof.spreads.length === 0 ? 'No spreads published' : `Spread ${currentSpread + 1} of ${proof.spreads.length}`}
              </div>
            </div>
            <div className={styles.navActions}>
              <button disabled={currentSpread === 0 || proof.spreads.length === 0} onClick={() => setCurrentSpread((value) => value - 1)}>
                Previous
              </button>
              <button
                disabled={currentSpread >= proof.spreads.length - 1 || proof.spreads.length === 0}
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
          ) : (
            <div className={styles.emptySpread}>No published spreads are available for this proof.</div>
          )}
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
              id="proof-comment-author"
              placeholder="Your name"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
            />
            <textarea
              id="proof-comment-content"
              placeholder="Ask for swaps, crop changes, or note what you love."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <button id="proof-comment-submit" disabled={isSubmitting || !comment.trim()} onClick={submitComment}>
              {isSubmitting ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
