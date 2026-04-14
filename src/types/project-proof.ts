import type { ProofCommentRecord, ProofEventRecord } from './proof';
import type { AlbumVersionSummary, ProofLinkStatus, WorkflowStatus } from './workflow';

export interface ProjectProofCommentSummary extends ProofCommentRecord {
  spreadPageNumber?: number | null;
}

export interface ProjectProofCommentStats {
  total: number;
  resolved: number;
  unresolved: number;
  general: number;
  spread: number;
}

export interface ProjectProofLinkSummary {
  id: string;
  token: string;
  title?: string | null;
  status: ProofLinkStatus;
  createdAt: string;
  approvedAt?: string | null;
  expiresAt?: string | null;
  isPublic: boolean;
  albumVersionId: string;
  commentStats: ProjectProofCommentStats;
  comments: ProjectProofCommentSummary[];
  events: ProofEventRecord[];
}

export interface ProjectProofVersionSummary extends AlbumVersionSummary {
  proofLinks: ProjectProofLinkSummary[];
  commentStats: ProjectProofCommentStats;
}

export interface ProjectProofData {
  projectId: string;
  projectTitle: string;
  projectStatus: WorkflowStatus | null;
  versions: ProjectProofVersionSummary[];
  latestProofLink: ProjectProofLinkSummary | null;
  totalCommentStats: ProjectProofCommentStats;
}
