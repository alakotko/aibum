import type {
  ProjectProofCommentStats,
  ProjectProofData,
  ProjectProofLinkSummary,
  ProjectProofVersionSummary,
} from '@/types/project-proof';
import type { ProofCommentRecord, ProofEventRecord } from '@/types/proof';
import type { AlbumVersionSummary, ProofLinkSummary, WorkflowStatus } from '@/types/workflow';

export type ProjectProofCommentRow = {
  id: string;
  proof_link_id: string;
  comment_scope: ProofCommentRecord['commentScope'];
  version_spread_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type ProjectProofEventRow = {
  id: string;
  proof_link_id: string;
  album_version_id: string;
  project_id: string;
  event_type: ProofEventRecord['eventType'];
  actor_name: string;
  note: string | null;
  created_at: string;
};

function emptyCommentStats(): ProjectProofCommentStats {
  return {
    total: 0,
    resolved: 0,
    unresolved: 0,
    general: 0,
    spread: 0,
  };
}

export function getProofCommentStats(comments: ProjectProofLinkSummary['comments']) {
  return comments.reduce<ProjectProofCommentStats>((stats, comment) => {
    stats.total += 1;
    if (comment.resolvedAt) {
      stats.resolved += 1;
    } else {
      stats.unresolved += 1;
    }

    if (comment.commentScope === 'general') {
      stats.general += 1;
    } else {
      stats.spread += 1;
    }

    return stats;
  }, emptyCommentStats());
}

export function buildProjectProofData({
  projectId,
  projectTitle,
  projectStatus,
  versions,
  proofLinks,
  comments,
  events,
  spreadPageMap,
}: {
  projectId: string;
  projectTitle: string;
  projectStatus: WorkflowStatus | null;
  versions: AlbumVersionSummary[];
  proofLinks: ProofLinkSummary[];
  comments: ProjectProofCommentRow[];
  events: ProjectProofEventRow[];
  spreadPageMap: Record<string, number>;
}): ProjectProofData {
  const commentsByLink: Record<string, ProjectProofLinkSummary['comments']> = {};
  for (const comment of comments) {
    commentsByLink[comment.proof_link_id] ??= [];
    commentsByLink[comment.proof_link_id].push({
      id: comment.id,
      proofLinkId: comment.proof_link_id,
      commentScope: comment.comment_scope,
      versionSpreadId: comment.version_spread_id,
      authorName: comment.author_name,
      content: comment.content,
      createdAt: comment.created_at,
      resolvedAt: comment.resolved_at,
      resolvedBy: comment.resolved_by,
      spreadPageNumber: comment.version_spread_id ? spreadPageMap[comment.version_spread_id] ?? null : null,
    });
  }

  for (const linkComments of Object.values(commentsByLink)) {
    linkComments.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  const eventsByLink: Record<string, ProofEventRecord[]> = {};
  for (const event of events) {
    eventsByLink[event.proof_link_id] ??= [];
    eventsByLink[event.proof_link_id].push({
      id: event.id,
      proofLinkId: event.proof_link_id,
      albumVersionId: event.album_version_id,
      projectId: event.project_id,
      eventType: event.event_type,
      actorName: event.actor_name,
      note: event.note,
      createdAt: event.created_at,
    });
  }

  for (const linkEvents of Object.values(eventsByLink)) {
    linkEvents.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  const linksByVersion: Record<string, ProjectProofLinkSummary[]> = {};
  for (const link of proofLinks) {
    const linkComments = commentsByLink[link.id] ?? [];
    const hydratedLink: ProjectProofLinkSummary = {
      ...link,
      commentStats: getProofCommentStats(linkComments),
      comments: linkComments,
      events: eventsByLink[link.id] ?? [],
    };

    linksByVersion[link.albumVersionId] ??= [];
    linksByVersion[link.albumVersionId].push(hydratedLink);
  }

  for (const versionLinks of Object.values(linksByVersion)) {
    versionLinks.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  const hydratedVersions: ProjectProofVersionSummary[] = versions.map((version) => {
    const versionLinks = linksByVersion[version.id] ?? [];
    const versionComments = versionLinks.flatMap((link) => link.comments);

    return {
      ...version,
      proofLinks: versionLinks,
      commentStats: getProofCommentStats(versionComments),
    };
  });

  const allComments = hydratedVersions.flatMap((version) =>
    version.proofLinks.flatMap((link) => link.comments)
  );

  return {
    projectId,
    projectTitle,
    projectStatus,
    versions: hydratedVersions,
    latestProofLink: proofLinks[0]
      ? (linksByVersion[proofLinks[0].albumVersionId] ?? []).find((link) => link.id === proofLinks[0].id) ?? null
      : null,
    totalCommentStats: getProofCommentStats(allComments),
  };
}
