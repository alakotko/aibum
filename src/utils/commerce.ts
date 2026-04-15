import type { PublicCheckoutContext, PublicCheckoutExistingOrder, PublicCheckoutOffer, PublicCheckoutSubmissionResult } from '@/types/checkout';
import type { OfferItemSummary, StudioBrandingConfig } from '@/types/workflow';

export type ResolvedStudioBranding = {
  studioName: string;
  senderName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  proofHeadline: string;
  proofSubheadline: string;
};

export const DEFAULT_STUDIO_BRANDING: ResolvedStudioBranding = {
  studioName: 'Albumin Studio',
  senderName: 'Albumin Studio',
  logoUrl: '',
  primaryColor: '#cc785c',
  accentColor: '#f3e6d4',
  supportEmail: '',
  proofHeadline: 'Review your album proof',
  proofSubheadline: 'Choose the album package that matches your final proof.',
};

export function resolveStudioBranding(
  branding: Partial<StudioBrandingConfig> | null | undefined
): ResolvedStudioBranding {
  return {
    studioName: branding?.studioName?.trim() || DEFAULT_STUDIO_BRANDING.studioName,
    senderName:
      branding?.senderName?.trim() ||
      branding?.studioName?.trim() ||
      DEFAULT_STUDIO_BRANDING.senderName,
    logoUrl: branding?.logoUrl?.trim() || DEFAULT_STUDIO_BRANDING.logoUrl,
    primaryColor: branding?.primaryColor || DEFAULT_STUDIO_BRANDING.primaryColor,
    accentColor: branding?.accentColor || DEFAULT_STUDIO_BRANDING.accentColor,
    supportEmail: branding?.supportEmail?.trim() || DEFAULT_STUDIO_BRANDING.supportEmail,
    proofHeadline: branding?.proofHeadline?.trim() || DEFAULT_STUDIO_BRANDING.proofHeadline,
    proofSubheadline:
      branding?.proofSubheadline?.trim() || DEFAULT_STUDIO_BRANDING.proofSubheadline,
  };
}

export function calculateOfferSelectionTotal(
  items: OfferItemSummary[],
  selectedAddonIds: string[] = []
) {
  const selectedIds = new Set(selectedAddonIds);

  return items.reduce((total, item) => {
    if (!item.isOptional) return total + item.lineTotalCents;
    if (selectedIds.has(item.id)) return total + item.lineTotalCents;
    return total;
  }, 0);
}

export function getSelectedOfferItems(
  items: OfferItemSummary[],
  selectedAddonIds: string[] = []
) {
  const selectedIds = new Set(selectedAddonIds);
  return items.filter((item) => !item.isOptional || selectedIds.has(item.id));
}

export function canOpenProofCheckout(proofStatus: string, offerCount: number) {
  return proofStatus === 'approved' && offerCount > 0;
}

export function formatOrderDestination(order: {
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingCountry?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_country?: string | null;
}) {
  return [
    order.shippingCity ?? order.shipping_city,
    order.shippingState ?? order.shipping_state,
    order.shippingCountry ?? order.shipping_country,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(', ');
}

function normalizeOffer(input: Record<string, unknown>): PublicCheckoutOffer {
  return {
    id: String(input.id),
    title: String(input.title),
    status: String(input.status) as PublicCheckoutOffer['status'],
    currency: String(input.currency ?? 'USD'),
    totalCents: Number(input.totalCents ?? 0),
    notes: typeof input.notes === 'string' ? input.notes : null,
    packageCatalogItemId:
      typeof input.packageCatalogItemId === 'string' ? input.packageCatalogItemId : null,
    items: Array.isArray(input.items)
      ? input.items.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            id: String(row.id),
            title: String(row.title),
            description: typeof row.description === 'string' ? row.description : null,
            quantity: Number(row.quantity ?? 1),
            unitPriceCents: Number(row.unitPriceCents ?? 0),
            lineTotalCents: Number(row.lineTotalCents ?? 0),
            itemKind: (row.itemKind === 'addon' ? 'addon' : 'included') as OfferItemSummary['itemKind'],
            isOptional: Boolean(row.isOptional),
            isSelectedByDefault: Boolean(row.isSelectedByDefault),
            internalCostCents: Number(row.internalCostCents ?? 0),
            studioCatalogItemId:
              typeof row.studioCatalogItemId === 'string' ? row.studioCatalogItemId : null,
          };
        })
      : [],
  };
}

function normalizeExistingOrder(input: Record<string, unknown> | null | undefined): PublicCheckoutExistingOrder | null {
  if (!input) return null;

  return {
    id: String(input.id),
    status: String(input.status),
    totalCents: Number(input.totalCents ?? 0),
    currency: String(input.currency ?? 'USD'),
    buyerName: typeof input.buyerName === 'string' ? input.buyerName : null,
    buyerEmail: typeof input.buyerEmail === 'string' ? input.buyerEmail : null,
    createdAt: String(input.createdAt),
  };
}

export function normalizePublicCheckoutContext(input: unknown): PublicCheckoutContext | null {
  if (!input || typeof input !== 'object') return null;

  const payload = input as Record<string, unknown>;

  return {
    proofToken: String(payload.proofToken),
    projectTitle: String(payload.projectTitle),
    versionTitle: String(payload.versionTitle),
    proofStatus: String(payload.proofStatus),
    branding: resolveStudioBranding(
      (payload.branding as Partial<StudioBrandingConfig> | undefined) ?? null
    ),
    offers: Array.isArray(payload.offers)
      ? payload.offers.map((offer) => normalizeOffer(offer as Record<string, unknown>))
      : [],
    existingOrder: normalizeExistingOrder(
      (payload.existingOrder as Record<string, unknown> | undefined) ?? null
    ),
  };
}

export function normalizePublicCheckoutSubmission(
  input: unknown
): PublicCheckoutSubmissionResult | null {
  const row =
    Array.isArray(input) && input.length > 0
      ? (input[0] as Record<string, unknown>)
      : input && typeof input === 'object'
        ? (input as Record<string, unknown>)
        : null;

  if (!row) return null;

  return {
    orderId: String(row.order_id ?? row.orderId),
    orderStatus: String(row.order_status ?? row.orderStatus),
    totalCents: Number(row.total_cents ?? row.totalCents ?? 0),
    currency: String(row.currency ?? 'USD'),
  };
}
