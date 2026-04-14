export interface ProofCommentRecord {
  id: string;
  proofLinkId: string;
  commentScope: 'spread' | 'general';
  versionSpreadId?: string | null;
  authorName: string;
  content: string;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface ProofEventRecord {
  id: string;
  proofLinkId: string;
  albumVersionId: string;
  projectId: string;
  eventType:
    | 'proof_sent'
    | 'proof_resent'
    | 'proof_opened'
    | 'comment_added'
    | 'changes_requested'
    | 'approved';
  actorName: string;
  note?: string | null;
  createdAt: string;
}

export interface ProofSpreadImageRecord {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  filename?: string | null;
}

export interface ProofSpreadRecord {
  id: string;
  pageNumber: number;
  layoutType: 'single' | 'split' | 'grid3' | 'auto';
  backgroundColor: string;
  images: ProofSpreadImageRecord[];
}

export interface LoadedProof {
  proofLinkId: string;
  proofToken: string;
  albumVersionId: string;
  projectId: string;
  projectTitle: string;
  versionTitle: string;
  proofTitle: string;
  proofStatus: string;
  approvedAt?: string | null;
  studioName: string;
  supportEmail: string;
  proofHeadline: string;
  proofSubheadline: string;
  primaryColor: string;
  accentColor: string;
  spreads: ProofSpreadRecord[];
  comments: ProofCommentRecord[];
  events: ProofEventRecord[];
}
