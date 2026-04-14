export interface ProofCommentRecord {
  id: string;
  proofLinkId: string;
  versionSpreadId?: string | null;
  authorName: string;
  content: string;
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
  spreads: ProofSpreadRecord[];
  comments: ProofCommentRecord[];
}
