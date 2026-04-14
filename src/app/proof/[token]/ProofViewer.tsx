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
  const [spreadComment, setSpreadComment] = useState('');
  const [generalComment, setGeneralComment] = useState('');
  const [isSubmittingSpread, setIsSubmittingSpread] = useState(false);
  const [isSubmittingGeneral, setIsSubmittingGeneral] = useState(false);

  const activeSpread = proof.spreads[currentSpread];
  const activeSpreadComments = proof.comments.filter(
    (entry) => entry.commentScope === 'spread' && entry.versionSpreadId === activeSpread?.id
  );
  const generalComments = proof.comments.filter((entry) => entry.commentScope === 'general');

  async function submitComment(scope: ProofCommentRecord['commentScope']) {
    const content = scope === 'spread' ? spreadComment.trim() : generalComment.trim();
    if (!content) return;
    if (scope === 'spread' && !activeSpread) return;

    try {
      if (scope === 'spread') {
        setIsSubmittingSpread(true);
      } else {
        setIsSubmittingGeneral(true);
      }
      const supabase = createClient();

      const { data, error } = await supabase
        .from('proof_comments')
        .insert({
          proof_link_id: proof.proofLinkId,
          comment_scope: scope,
          version_spread_id: scope === 'spread' ? activeSpread?.id ?? null : null,
          author_name: authorName.trim() || 'Client',
          content,
        })
        .select('id, proof_link_id, comment_scope, version_spread_id, author_name, content, created_at, resolved_at, resolved_by')
        .single();

      if (error || !data) {
        alert(`Failed to submit comment: ${error?.message ?? 'Unknown error'}`);
        return;
      }

      const createdComment: ProofCommentRecord = {
        id: data.id,
        proofLinkId: data.proof_link_id,
        commentScope: data.comment_scope,
        versionSpreadId: data.version_spread_id,
        authorName: data.author_name,
        content: data.content,
        createdAt: data.created_at,
        resolvedAt: data.resolved_at,
        resolvedBy: data.resolved_by,
      };

      setProof((current) => ({
        ...current,
        comments: [...current.comments, createdComment],
      }));
      if (scope === 'spread') {
        setSpreadComment('');
      } else {
        setGeneralComment('');
      }
    } catch (error: unknown) {
      alert(`Failed to submit comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (scope === 'spread') {
        setIsSubmittingSpread(false);
      } else {
        setIsSubmittingGeneral(false);
      }
    }
  }

  function renderComment(entry: ProofCommentRecord) {
    const isResolved = Boolean(entry.resolvedAt);
    return (
      <article key={entry.id} className={`${styles.commentCard} ${isResolved ? styles.commentResolved : ''}`}>
        <div className={styles.commentHeader}>
          <div className={styles.commentAuthor}>{entry.authorName}</div>
          <span className={styles.commentStatus}>{isResolved ? 'Resolved' : 'Open'}</span>
        </div>
        <p>{entry.content}</p>
        <time>
          {new Date(entry.createdAt).toLocaleString()}
          {entry.resolvedAt ? ` · Resolved ${new Date(entry.resolvedAt).toLocaleString()}` : ''}
        </time>
      </article>
    );
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
            <div className={styles.panelHeader}>
              <h2>Spread feedback</h2>
              <span className={styles.commentCount}>{activeSpreadComments.length}</span>
            </div>
            {activeSpreadComments.length === 0 ? (
              <p className={styles.empty}>No comments yet for this spread.</p>
            ) : (
              <div className={styles.commentList}>
                {activeSpreadComments.map(renderComment)}
              </div>
            )}
          </div>

          <div className={styles.commentForm}>
            <h2>Comment on this spread</h2>
            <input
              id="proof-comment-author"
              placeholder="Your name"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
            />
            <textarea
              id="proof-spread-comment-content"
              placeholder="Ask for swaps, crop changes, or note what you love."
              value={spreadComment}
              onChange={(event) => setSpreadComment(event.target.value)}
              disabled={!activeSpread}
            />
            <button
              id="proof-comment-submit"
              disabled={!activeSpread || isSubmittingSpread || !spreadComment.trim()}
              onClick={() => submitComment('spread')}
            >
              {isSubmittingSpread ? 'Sending…' : 'Send spread feedback'}
            </button>
          </div>

          <div className={styles.commentPanel}>
            <div className={styles.panelHeader}>
              <h2>General notes</h2>
              <span className={styles.commentCount}>{generalComments.length}</span>
            </div>
            {generalComments.length === 0 ? (
              <p className={styles.empty}>No general notes yet for this proof.</p>
            ) : (
              <div className={styles.commentList}>
                {generalComments.map(renderComment)}
              </div>
            )}
          </div>

          <div className={styles.commentForm}>
            <h2>Share overall feedback</h2>
            <textarea
              id="proof-general-comment-content"
              placeholder="Tell the studio about overall pacing, cover direction, favorite moments, or changes across the full album."
              value={generalComment}
              onChange={(event) => setGeneralComment(event.target.value)}
            />
            <button
              id="proof-general-comment-submit"
              disabled={isSubmittingGeneral || !generalComment.trim()}
              onClick={() => submitComment('general')}
            >
              {isSubmittingGeneral ? 'Sending…' : 'Send general feedback'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
