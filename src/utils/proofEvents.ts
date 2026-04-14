import type { ProofEventRecord } from '@/types/proof';
import type { ProofLinkStatus } from '@/types/workflow';

export function getProofEventLabel(eventType: ProofEventRecord['eventType']) {
  if (eventType === 'proof_sent') return 'Proof sent';
  if (eventType === 'proof_resent') return 'Reminder sent';
  if (eventType === 'proof_opened') return 'Proof opened';
  if (eventType === 'comment_added') return 'Comment added';
  if (eventType === 'changes_requested') return 'Changes requested';
  return 'Approved';
}

export function isProofResendable(status: ProofLinkStatus) {
  return status === 'active' || status === 'changes_requested';
}
