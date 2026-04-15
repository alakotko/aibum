import type {
  AlbumVersionSummary,
  OrderSummary,
  ProofLinkSummary,
  WorkflowStatus,
} from '@/types/workflow';

export function inferProjectStatusFromOrder(status: OrderSummary['status']): WorkflowStatus {
  if (status === 'paid') return 'paid';
  if (status === 'fulfillment_pending') return 'fulfillment_pending';
  if (status === 'shipped') return 'shipped';
  if (status === 'delivered') return 'delivered';
  return 'payment_pending';
}

export function canApplyAutoProjectStatus(statusOverride: WorkflowStatus | null | undefined) {
  return !statusOverride;
}

export function getProjectStatusMode(statusOverride: WorkflowStatus | null | undefined) {
  return canApplyAutoProjectStatus(statusOverride) ? 'automatic' : 'manual';
}

type ProjectAutoStatusInput = {
  latestProofLink?: ProofLinkSummary | null;
  orders?: OrderSummary[];
  versions?: AlbumVersionSummary[];
};

export function deriveProjectAutoStatus({
  latestProofLink,
  orders = [],
  versions = [],
}: ProjectAutoStatusInput): WorkflowStatus {
  const latestOrder = orders[0];
  if (latestOrder) {
    return inferProjectStatusFromOrder(latestOrder.status);
  }

  if (latestProofLink) {
    if (latestProofLink.status === 'approved') return 'approved';
    if (latestProofLink.status === 'changes_requested') return 'changes_requested';
    if (latestProofLink.status === 'active' || latestProofLink.status === 'draft') {
      return 'client_review';
    }
  }

  const activeVersion = versions.find((version) => version.isActive) ?? versions[0];
  if (activeVersion) {
    return activeVersion.status;
  }

  return 'draft';
}
