import type { OfferItemSummary, OfferStatus, StudioBrandingConfig } from './workflow';

export interface PublicCheckoutOffer {
  id: string;
  title: string;
  status: OfferStatus;
  currency: string;
  totalCents: number;
  notes?: string | null;
  packageCatalogItemId?: string | null;
  items: OfferItemSummary[];
}

export interface PublicCheckoutExistingOrder {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  createdAt: string;
}

export interface PublicCheckoutContext {
  proofToken: string;
  projectTitle: string;
  versionTitle: string;
  proofStatus: string;
  branding: StudioBrandingConfig;
  offers: PublicCheckoutOffer[];
  existingOrder?: PublicCheckoutExistingOrder | null;
}

export interface PublicCheckoutSubmissionResult {
  orderId: string;
  orderStatus: string;
  totalCents: number;
  currency: string;
}
