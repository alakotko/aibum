'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/workflow/StatusBadge';
import type { ProjectProofCommentSummary, ProjectProofData, ProjectProofLinkSummary } from '@/types/project-proof';
import { createClient } from '@/utils/supabase/client';
import { isProofResendable, getProofEventLabel } from '@/utils/proofEvents';
import styles from './revisions.module.css';

function getProofAccessState(link: ProjectProofLinkSummary) {
  if (link.status === 'archived' || !link.isPublic) return 'Archived';
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) return 'Expired';
  return 'Active';
}

export default function RevisionHub({ initialData }: { initialData: ProjectProofData }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function copyProofLink(link: ProjectProofLinkSummary) {
    try {
      await navigator.clipboard.writeText(window.location.origin + `/proof/${link.token}`);
      setFeedback('Proof URL copied.');
    } catch (error: unknown) {
      alert(`Failed to copy proof URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  function refreshWithFeedback(message: string) {
    setFeedback(message);
    startTransition(() => {
      router.refresh();
    });
  }

  async function resendProofLink(link: ProjectProofLinkSummary) {
    if (!isProofResendable(link.status)) return;

    try {
      await navigator.clipboard.writeText(window.location.origin + `/proof/${link.token}`);
      const { error } = await supabase.from('proof_events').insert({
        proof_link_id: link.id,
        album_version_id: link.albumVersionId,
        project_id: initialData.projectId,
        event_type: 'proof_resent',
        actor_name: 'Studio',
        note: link.title || 'Proof reminder sent',
      });

      if (error) {
        alert(`Failed to log proof reminder: ${error.message}`);
        return;
      }

      refreshWithFeedback('Proof URL copied and reminder logged.');
    } catch (error: unknown) {
      alert(`Failed to send reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function toggleCommentResolved(comment: ProjectProofCommentSummary, resolved: boolean) {
    try {
      const { data: authData } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('proof_comments')
        .update({
          resolved_at: resolved ? new Date().toISOString() : null,
          resolved_by: resolved ? authData.session?.user.id ?? null : null,
        })
        .eq('id', comment.id);

      if (error) {
        alert(`Failed to update comment status: ${error.message}`);
        return;
      }

      refreshWithFeedback(resolved ? 'Comment resolved.' : 'Comment reopened.');
    } catch (error: unknown) {
      alert(`Failed to update comment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Photographer revision hub</div>
          <div className={styles.titleRow}>
            <h1>{initialData.projectTitle}</h1>
            {initialData.projectStatus ? <StatusBadge status={initialData.projectStatus} /> : null}
          </div>
          <p>
            Review every saved version, track open client feedback, and send a reminder for the latest proof without
            generating a new album draft.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.buttonGhost} href={`/projects/${initialData.projectId}`}>
              Back To Workspace
            </Link>
            {initialData.latestProofLink ? (
              <Link className={styles.buttonGhost} href={`/proof/${initialData.latestProofLink.token}`} target="_blank">
                Open Latest Proof
              </Link>
            ) : null}
          </div>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.statCard}>
            <span>Versions</span>
            <strong>{initialData.versions.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Proof links</span>
            <strong>{initialData.versions.reduce((sum, version) => sum + version.proofLinks.length, 0)}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Unresolved</span>
            <strong>{initialData.totalCommentStats.unresolved}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Resolved</span>
            <strong>{initialData.totalCommentStats.resolved}</strong>
          </div>
        </div>
      </header>

      {feedback ? <div className={styles.feedback}>{feedback}</div> : null}
      {isPending ? <div className={styles.feedback}>Refreshing proof history…</div> : null}

      {initialData.versions.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>No proof history yet</h2>
          <p>Save a draft from the project workspace to create the first proof version.</p>
          <Link className={styles.button} href={`/projects/${initialData.projectId}`}>
            Go To Workspace
          </Link>
        </section>
      ) : (
        <div className={styles.layout}>
          <aside className={styles.versionRail}>
            <h2>Version list</h2>
            {initialData.versions.map((version) => (
              <article key={version.id} className={styles.versionRailCard}>
                <div className={styles.versionRailHeader}>
                  <strong>{version.title}</strong>
                  <StatusBadge status={version.status} />
                </div>
                <div className={styles.metaRow}>
                  <span>Version {version.versionNumber}</span>
                  <span>{version.spreadCount} spreads</span>
                </div>
                <div className={styles.metaRow}>
                  <span>{version.proofLinks.length} proofs</span>
                  <span>{version.commentStats.unresolved} unresolved</span>
                </div>
              </article>
            ))}
          </aside>

          <main className={styles.versionStack}>
            {initialData.versions.map((version) => (
              <section key={version.id} className={styles.versionSection}>
                <div className={styles.versionHeader}>
                  <div>
                    <div className={styles.versionEyebrow}>Version {version.versionNumber}</div>
                    <h2>{version.title}</h2>
                  </div>
                  <div className={styles.versionMeta}>
                    <StatusBadge status={version.status} />
                    <span>{version.spreadCount} spreads</span>
                    <span>{version.commentStats.unresolved} unresolved</span>
                    <span>{version.commentStats.resolved} resolved</span>
                  </div>
                </div>

                {version.proofLinks.length === 0 ? (
                  <div className={styles.emptyCard}>
                    <h3>No proof link for this version</h3>
                    <p>This album version exists in history, but no public proof link was published for it.</p>
                  </div>
                ) : (
                  <div className={styles.linkStack}>
                    {version.proofLinks.map((link) => (
                      <article key={link.id} className={styles.linkCard}>
                        <div className={styles.linkHeader}>
                          <div>
                            <h3>{link.title || 'Client proof link'}</h3>
                            <div className={styles.proofUrl}>{`/proof/${link.token}`}</div>
                          </div>
                          <div className={styles.badgeRow}>
                            <span className={styles.pill}>{getProofAccessState(link)}</span>
                            <span className={styles.pill}>{link.status}</span>
                          </div>
                        </div>

                        <div className={styles.metaRow}>
                          <span>{link.commentStats.unresolved} unresolved</span>
                          <span>{link.commentStats.resolved} resolved</span>
                          <span>{link.commentStats.general} general notes</span>
                          <span>Sent {new Date(link.createdAt).toLocaleString()}</span>
                          {link.approvedAt ? <span>Approved {new Date(link.approvedAt).toLocaleString()}</span> : null}
                        </div>

                        <div className={styles.actions}>
                          <Link className={styles.linkText} href={`/proof/${link.token}`} target="_blank">
                            Open proof
                          </Link>
                          <button className={styles.buttonGhost} onClick={() => copyProofLink(link)}>
                            Copy URL
                          </button>
                          {isProofResendable(link.status) ? (
                            <button className={styles.buttonGhost} onClick={() => resendProofLink(link)}>
                              Send Reminder
                            </button>
                          ) : null}
                        </div>

                        <div className={styles.detailsGrid}>
                          <section className={styles.detailCard}>
                            <div className={styles.cardTitleRow}>
                              <h4>Audit trail</h4>
                              <span className={styles.commentBadge}>{link.events.length}</span>
                            </div>
                            {link.events.length === 0 ? (
                              <p className={styles.metaText}>No proof events yet.</p>
                            ) : (
                              <div className={styles.timelineList}>
                                {link.events.map((event) => (
                                  <article key={event.id} className={styles.timelineItem}>
                                    <div className={styles.timelineHeader}>
                                      <span className={styles.pill}>{getProofEventLabel(event.eventType)}</span>
                                      <span>{new Date(event.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className={styles.timelineActor}>{event.actorName}</div>
                                    {event.note ? <p className={styles.timelineNote}>{event.note}</p> : null}
                                  </article>
                                ))}
                              </div>
                            )}
                          </section>

                          <section className={styles.detailCard}>
                            <div className={styles.cardTitleRow}>
                              <h4>Feedback</h4>
                              <span className={styles.commentBadge}>{link.comments.length}</span>
                            </div>
                            {link.comments.length === 0 ? (
                              <p className={styles.metaText}>No client feedback on this proof yet.</p>
                            ) : (
                              <div className={styles.commentStream}>
                                {link.comments.map((comment) => (
                                  <article
                                    key={comment.id}
                                    className={`${styles.commentItem} ${comment.resolvedAt ? styles.commentItemResolved : ''}`}
                                  >
                                    <div className={styles.commentItemHeader}>
                                      <div>
                                        <div className={styles.commentItemAuthor}>{comment.authorName}</div>
                                        <div className={styles.commentItemMeta}>
                                          <span>
                                            {comment.commentScope === 'general'
                                              ? 'General note'
                                              : `Spread ${comment.spreadPageNumber ?? 'Unknown'}`}
                                          </span>
                                          <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                        </div>
                                      </div>
                                      <span className={styles.pill}>{comment.resolvedAt ? 'Resolved' : 'Open'}</span>
                                    </div>
                                    <p className={styles.commentItemBody}>{comment.content}</p>
                                    <div className={styles.actions}>
                                      <button
                                        className={styles.buttonGhost}
                                        onClick={() => toggleCommentResolved(comment, !comment.resolvedAt)}
                                      >
                                        {comment.resolvedAt ? 'Reopen Comment' : 'Resolve Comment'}
                                      </button>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </section>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </main>
        </div>
      )}
    </div>
  );
}
