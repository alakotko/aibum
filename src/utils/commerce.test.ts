import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_STUDIO_BRANDING,
  calculateOfferSelectionTotal,
  canOpenProofCheckout,
  formatOrderDestination,
  normalizePublicCheckoutContext,
  resolveStudioBranding,
} from './commerce.ts';

test('resolveStudioBranding falls back to shared defaults', () => {
  assert.deepEqual(resolveStudioBranding(null), DEFAULT_STUDIO_BRANDING);
  assert.equal(
    resolveStudioBranding({
      studioName: 'North Studio',
      senderName: '',
      primaryColor: '#111111',
      accentColor: '#eeeeee',
    }).senderName,
    'North Studio'
  );
});

test('calculateOfferSelectionTotal includes required items and selected add-ons only', () => {
  const items = [
    {
      id: 'package',
      title: 'Signature Album',
      quantity: 1,
      unitPriceCents: 129900,
      lineTotalCents: 129900,
      itemKind: 'included' as const,
      isOptional: false,
      isSelectedByDefault: false,
      internalCostCents: 70000,
    },
    {
      id: 'addon-1',
      title: 'Gift Box',
      quantity: 1,
      unitPriceCents: 25000,
      lineTotalCents: 25000,
      itemKind: 'addon' as const,
      isOptional: true,
      isSelectedByDefault: false,
      internalCostCents: 14000,
    },
  ];

  assert.equal(calculateOfferSelectionTotal(items), 129900);
  assert.equal(calculateOfferSelectionTotal(items, ['addon-1']), 154900);
});

test('checkout is only available for approved proofs with offers', () => {
  assert.equal(canOpenProofCheckout('approved', 1), true);
  assert.equal(canOpenProofCheckout('approved', 0), false);
  assert.equal(canOpenProofCheckout('active', 2), false);
});

test('formatOrderDestination joins non-empty destination parts', () => {
  assert.equal(
    formatOrderDestination({
      shippingCity: 'Brooklyn',
      shippingState: 'NY',
      shippingCountry: 'USA',
    }),
    'Brooklyn, NY, USA'
  );
});

test('normalizePublicCheckoutContext resolves branding defaults and offer items', () => {
  const context = normalizePublicCheckoutContext({
    proofToken: 'proof-1',
    projectTitle: 'River Wedding',
    versionTitle: 'Classic v2',
    proofStatus: 'approved',
    branding: {
      studioName: 'North Studio',
      primaryColor: '#111111',
      accentColor: '#eeeeee',
    },
    offers: [
      {
        id: 'offer-1',
        title: 'Signature',
        status: 'sent',
        currency: 'USD',
        totalCents: 129900,
        items: [
          {
            id: 'item-1',
            title: 'Signature Album',
            quantity: 1,
            unitPriceCents: 129900,
            lineTotalCents: 129900,
            itemKind: 'included',
            isOptional: false,
            isSelectedByDefault: false,
            internalCostCents: 0,
          },
        ],
      },
    ],
  });

  assert.ok(context);
  assert.equal(context?.branding.senderName, 'North Studio');
  assert.equal(context?.offers[0].items.length, 1);
});
