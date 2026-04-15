import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canApplyAutoProjectStatus,
  deriveProjectAutoStatus,
  getProjectStatusMode,
  inferProjectStatusFromOrder,
} from './workflowStatus.ts';

test('inferProjectStatusFromOrder maps order milestones into project workflow states', () => {
  assert.equal(inferProjectStatusFromOrder('payment_pending'), 'payment_pending');
  assert.equal(inferProjectStatusFromOrder('paid'), 'paid');
  assert.equal(inferProjectStatusFromOrder('fulfillment_pending'), 'fulfillment_pending');
  assert.equal(inferProjectStatusFromOrder('shipped'), 'shipped');
  assert.equal(inferProjectStatusFromOrder('delivered'), 'delivered');
});

test('deriveProjectAutoStatus prefers order progress over proof and version status', () => {
  assert.equal(
    deriveProjectAutoStatus({
      latestProofLink: {
        id: 'proof-1',
        token: 'proof-1',
        status: 'changes_requested',
        createdAt: '2026-04-14T16:00:00.000Z',
        isPublic: true,
        albumVersionId: 'version-1',
      },
      orders: [
        {
          id: 'order-1',
          status: 'shipped',
          paymentStatus: 'paid',
          fulfillmentStatus: 'shipped',
          totalCents: 100,
          currency: 'USD',
          updatedAt: '2026-04-14T17:00:00.000Z',
        },
      ],
      versions: [],
    }),
    'shipped'
  );
});

test('deriveProjectAutoStatus falls back from proof state to active version to draft', () => {
  assert.equal(
    deriveProjectAutoStatus({
      latestProofLink: {
        id: 'proof-1',
        token: 'proof-1',
        status: 'active',
        createdAt: '2026-04-14T16:00:00.000Z',
        isPublic: true,
        albumVersionId: 'version-1',
      },
    }),
    'client_review'
  );

  assert.equal(
    deriveProjectAutoStatus({
      versions: [
        {
          id: 'version-1',
          versionNumber: 2,
          title: 'Classic v2',
          status: 'changes_requested',
          variantKey: 'classic',
          isActive: true,
          createdAt: '2026-04-14T15:00:00.000Z',
          updatedAt: '2026-04-14T16:00:00.000Z',
          spreadCount: 12,
        },
      ],
    }),
    'changes_requested'
  );

  assert.equal(deriveProjectAutoStatus({}), 'draft');
});

test('status override helpers distinguish automatic and manual modes', () => {
  assert.equal(canApplyAutoProjectStatus(undefined), true);
  assert.equal(canApplyAutoProjectStatus(null), true);
  assert.equal(canApplyAutoProjectStatus('approved'), false);
  assert.equal(getProjectStatusMode(null), 'automatic');
  assert.equal(getProjectStatusMode('approved'), 'manual');
});
