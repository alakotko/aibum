'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import GalleryImage from '@/app/(dashboard)/projects/[id]/gallery/GalleryImage';
import type { LoadedProof, ProofCommentRecord, ProofEventRecord } from '@/types/proof';
import { getProofEventLabel } from '@/utils/proofEvents';
import styles from './proof.module.css';

function formatProofStatus(status: string) {
  return status.replaceAll('_', ' ');
}

function getProofOpenSessionKey(token: string) {
  return `proof-opened:${token}`;
}

export default function ProofViewer({ initialProof }: { initialProof: LoadedProof }) {
  const [proof, setProof] = useState(initialProof);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [spreadComment, setSpreadComment] = useState('');
  const [generalComment, setGeneralComment] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [isSubmittingSpread, setIsSubmittingSpread] = useState(false);
  const [isSubmittingGeneral, setIsSubmittingGeneral] = useState(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [isConfirmingApproval, setIsConfirmingApproval] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);
  const hasLoggedOpenRef = useRef(false);

  const activeSpread = proof.spreads[currentSpread];
  const activeSpreadComments = proof.comments.filter(
    (entry) => entry.commentScope === 'spread' && entry.versionSpreadId === activeSpread?.id
  );
  const generalComments = proof.comments.filter((entry) => entry.commentScope === 'general');
  const canSubmitDecision = proof.proofStatus !== 'approved';
  const canUseName = authorName.trim().length > 0;

  useEffect(() => {
    const sessionKey = getProofOpenSessionKey(initialProof.proofToken);

    if (hasLoggedOpenRef.current) return;
    if (window.sessionStorage.getItem(sessionKey)) {
      hasLoggedOpenRef.current = true;
      return;
    }

    hasLoggedOpenRef.current = true;

    const supabase = createClient();

    void (async () => {
      const { data, error } = await supabase
        .from('proof_events')
        .insert({
          proof_link_id: initialProof.proofLinkId,
          album_version_id: initialProof.albumVersionId,
          project_id: initialProof.projectId,
          event_type: 'proof_opened',
          actor_name: 'Client',
          note: null,
        })
        .select('id, proof_link_id, album_version_id, project_id, event_type, actor_name, note, created_at')
        .single();

      if (error || !data) {
        hasLoggedOpenRef.current = false;
        return;
      }

      window.sessionStorage.setItem(sessionKey, '1');

      const openedEvent: ProofEventRecord = {
        id: data.id,
        proofLinkId: data.proof_link_id,
        albumVersionId: data.album_version_id,
        projectId: data.project_id,
        eventType: data.event_type,
        actorName: data.actor_name,
        note: data.note,
        createdAt: data.created_at,
      };

      setProof((current) => {
        if (current.events.some((event) => event.id === openedEvent.id)) {
          return current;
        }

        return {
          ...current,
          events: [openedEvent, ...current.events],
        };
      });
    })();
  }, [initialProof.albumVersionId, initialProof.projectId, initialProof.proofLinkId, initialProof.proofToken]);

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

      const eventNote =
        scope === 'general' ? 'General feedback' : `Commented on spread ${activeSpread.pageNumber}`;
      const { data: eventData, error: eventError } = await supabase
        .from('proof_events')
        .insert({
          proof_link_id: proof.proofLinkId,
          album_version_id: proof.albumVersionId,
          project_id: proof.projectId,
          event_type: 'comment_added',
          actor_name: authorName.trim() || 'Client',
          note: eventNote,
        })
        .select('id, proof_link_id, album_version_id, project_id, event_type, actor_name, note, created_at')
        .single();

      const createdEvent: ProofEventRecord | null =
        eventError || !eventData
          ? null
          : {
              id: eventData.id,
              proofLinkId: eventData.proof_link_id,
              albumVersionId: eventData.album_version_id,
              projectId: eventData.project_id,
              eventType: eventData.event_type,
              actorName: eventData.actor_name,
              note: eventData.note,
              createdAt: eventData.created_at,
            };

      setProof((current) => ({
        ...current,
        comments: [...current.comments, createdComment],
        events: createdEvent ? [createdEvent, ...current.events] : current.events,
      }));

      if (eventError) {
        alert(`Comment saved, but failed to update proof activity: ${eventError.message}`);
      }

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

  async function submitDecision(decision: 'changes_requested' | 'approved') {
    if (!canUseName) {
      alert('Please add your name before submitting a proof decision.');
      return;
    }

    try {
      setIsSubmittingDecision(true);
      const supabase = createClient();

      const { data, error } = await supabase.rpc('submit_public_proof_decision', {
        proof_token: proof.proofToken,
        actor_name: authorName.trim(),
        decision,
        note: decisionNote.trim() || null,
      });

      const result = Array.isArray(data) ? data[0] : null;

      if (error || !result) {
        alert(`Failed to submit proof decision: ${error?.message ?? 'Unknown error'}`);
        return;
      }

      const createdEvent: ProofEventRecord = {
        id: result.event_id,
        proofLinkId: result.proof_link_id,
        albumVersionId: proof.albumVersionId,
        projectId: proof.projectId,
        eventType: result.event_type,
        actorName: result.event_actor_name,
        note: result.event_note,
        createdAt: result.event_created_at,
      };

      setProof((current) => ({
        ...current,
        proofStatus: result.proof_status,
        approvedAt: result.approved_at,
        events: [createdEvent, ...current.events],
      }));
      setDecisionNote('');
      setIsConfirmingApproval(false);
      setDecisionFeedback(
        decision === 'approved'
          ? 'Final approval received. This version is now locked for the studio.'
          : 'Change request sent to the studio.'
      );
    } catch (error: unknown) {
      alert(`Failed to submit proof decision: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmittingDecision(false);
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

  function renderEvent(entry: ProofEventRecord) {
    return (
      <article key={entry.id} className={styles.eventCard}>
        <div className={styles.eventHeader}>
          <span className={styles.commentStatus}>{getProofEventLabel(entry.eventType)}</span>
          <time>{new Date(entry.createdAt).toLocaleString()}</time>
        </div>
        <div className={styles.eventMeta}>{entry.actorName}</div>
        {entry.note ? <p>{entry.note}</p> : null}
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
          <span className={styles.status}>{formatProofStatus(proof.proofStatus)}</span>
          <strong>{proof.projectTitle}</strong>
          <span>{proof.versionTitle}</span>
          {proof.approvedAt ? <span>Approved {new Date(proof.approvedAt).toLocaleString()}</span> : null}
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
          <div className={styles.identityCard}>
            <h2>Your name</h2>
            <input
              id="proof-comment-author"
              placeholder="Your name"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
            />
            <p className={styles.identityHint}>We’ll attach this name to comments and any final proof decision.</p>
          </div>

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

          <div className={styles.decisionPanel}>
            <div className={styles.panelHeader}>
              <h2>Final proof decision</h2>
              <span className={styles.commentStatus}>{formatProofStatus(proof.proofStatus)}</span>
            </div>
            <p className={styles.decisionText}>
              Request one more revision round or approve this version as the final album proof.
            </p>
            {!canUseName ? (
              <p className={styles.empty}>Add your name above before you submit a final decision.</p>
            ) : null}
            {decisionFeedback ? <div className={styles.decisionFeedback}>{decisionFeedback}</div> : null}
            <textarea
              id="proof-decision-note"
              placeholder="Optional note for the studio about the final decision."
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              disabled={!canSubmitDecision || isSubmittingDecision}
            />
            {proof.proofStatus === 'approved' ? (
              <div className={styles.approvedState}>
                This proof is approved and locked.
                {proof.approvedAt ? ` Finalized ${new Date(proof.approvedAt).toLocaleString()}.` : ''}
              </div>
            ) : (
              <div className={styles.decisionActions}>
                <button
                  disabled={!canUseName || isSubmittingDecision}
                  onClick={() => submitDecision('changes_requested')}
                >
                  {isSubmittingDecision ? 'Sending…' : 'Request Changes'}
                </button>
                {isConfirmingApproval ? (
                  <>
                    <button
                      disabled={!canUseName || isSubmittingDecision}
                      onClick={() => submitDecision('approved')}
                    >
                      {isSubmittingDecision ? 'Sending…' : 'Confirm Final Approval'}
                    </button>
                    <button
                      className={styles.secondaryAction}
                      disabled={isSubmittingDecision}
                      onClick={() => setIsConfirmingApproval(false)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    disabled={!canUseName || isSubmittingDecision}
                    onClick={() => setIsConfirmingApproval(true)}
                  >
                    Approve Final
                  </button>
                )}
              </div>
            )}
          </div>

          {proof.proofStatus === 'approved' ? (
            <div className={styles.checkoutCard}>
              <div className={styles.panelHeader}>
                <h2>Package selection</h2>
                <span className={styles.commentStatus}>
                  {proof.checkoutEnabled ? 'Open' : 'Pending'}
                </span>
              </div>
              <p className={styles.decisionText}>
                Once your proof is approved, you can move into the branded package and checkout flow.
              </p>
              {proof.checkoutEnabled && proof.checkoutUrl ? (
                <Link className={styles.checkoutLink} href={proof.checkoutUrl}>
                  Continue to package selection
                </Link>
              ) : (
                <p className={styles.empty}>
                  The studio has not published a package offer for this proof yet.
                </p>
              )}
            </div>
          ) : null}

          <div className={styles.commentPanel}>
            <div className={styles.panelHeader}>
              <h2>Proof activity</h2>
              <span className={styles.commentCount}>{proof.events.length}</span>
            </div>
            {proof.events.length === 0 ? (
              <p className={styles.empty}>No proof activity yet.</p>
            ) : (
              <div className={styles.eventList}>
                {proof.events.map(renderEvent)}
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
