export const WORKFLOW_STATUSES = [
  'draft',
  'client_review',
  'changes_requested',
  'approved',
  'payment_pending',
  'paid',
  'fulfillment_pending',
  'shipped',
  'delivered',
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const PROJECT_WORKSPACE_TABS = [
  'photos',
  'drafts',
  'proof',
  'offers',
  'orders',
] as const;

export type ProjectWorkspaceTab = (typeof PROJECT_WORKSPACE_TABS)[number];

export type SelectionStatus = 'unreviewed' | 'shortlisted' | 'excluded';
export type ProofLinkStatus = 'draft' | 'active' | 'changes_requested' | 'approved' | 'archived';
export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type OrderStatus =
  | 'payment_pending'
  | 'paid'
  | 'fulfillment_pending'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface AlbumInputRecord {
  id: string;
  filename: string;
  storagePath: string;
  thumbnailPath?: string | null;
  selectionStatus: SelectionStatus;
  aiFlags: string[];
  aiScore?: number | null;
  createdAt?: string;
}

export interface SpreadImageRecord {
  id: string;
  albumInputId: string;
  zIndex: number;
  image: AlbumInputRecord;
}

export interface AlbumVersionSpreadRecord {
  id: string;
  pageNumber: number;
  templateId: string;
  spreadRole: 'cover' | 'interior';
  spreadKey: string;
  layoutType: 'single' | 'split' | 'grid3' | 'auto';
  backgroundColor: string;
  images: SpreadImageRecord[];
}

export interface SelectionSetSummary {
  id: string;
  name: string;
  description?: string | null;
  itemCount: number;
  isActive: boolean;
  coverAlbumInputId?: string | null;
  coverFilename?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface AlbumVersionSummary {
  id: string;
  versionNumber: number;
  title: string;
  status: WorkflowStatus;
  variantKey: 'classic' | 'story' | 'premium';
  isActive: boolean;
  selectionSetId?: string | null;
  coverTitle?: string | null;
  createdAt: string;
  updatedAt: string;
  spreadCount: number;
}

export interface ProofLinkSummary {
  id: string;
  token: string;
  title?: string | null;
  status: ProofLinkStatus;
  createdAt: string;
  approvedAt?: string | null;
  expiresAt?: string | null;
  isPublic: boolean;
  albumVersionId: string;
}

export interface OfferSummary {
  id: string;
  title: string;
  status: OfferStatus;
  totalCents: number;
  currency: string;
  updatedAt: string;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  currency: string;
  updatedAt: string;
  operatorNotes?: string | null;
}

export interface StudioBrandingConfig {
  studioName?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  supportEmail?: string | null;
  proofHeadline?: string | null;
  proofSubheadline?: string | null;
}

export const WORKFLOW_STATUS_META: Record<
  WorkflowStatus,
  { label: string; tone: 'neutral' | 'review' | 'alert' | 'success' | 'delivery' }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  client_review: { label: 'Client Review', tone: 'review' },
  changes_requested: { label: 'Changes Requested', tone: 'alert' },
  approved: { label: 'Approved', tone: 'success' },
  payment_pending: { label: 'Payment Pending', tone: 'alert' },
  paid: { label: 'Paid', tone: 'success' },
  fulfillment_pending: { label: 'Fulfillment Pending', tone: 'review' },
  shipped: { label: 'Shipped', tone: 'delivery' },
  delivered: { label: 'Delivered', tone: 'success' },
};

export function getWorkflowStatusMeta(status: string | null | undefined) {
  if (status && status in WORKFLOW_STATUS_META) {
    return WORKFLOW_STATUS_META[status as WorkflowStatus];
  }

  return {
    label: status ? status.replaceAll('_', ' ') : 'Unknown',
    tone: 'neutral' as const,
  };
}

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
