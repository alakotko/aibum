export const DRAFT_VARIANTS = ['classic', 'story', 'premium'] as const;

export type DraftVariant = (typeof DRAFT_VARIANTS)[number];
export type LayoutPhoto = {
  id: string;
  url: string;
  filename?: string;
  thumbnailUrl?: string;
  selectionStatus: string;
  aiScore?: number;
  aiFlags?: string[];
};

type LayoutType = 'single' | 'split' | 'grid3';

type VariantRules = {
  label: string;
  description: string;
  groupingPattern: readonly number[];
  background: (spreadIndex: number) => string;
};

const VARIANT_RULES: Record<DraftVariant, VariantRules> = {
  classic: {
    label: 'Classic',
    description: 'Balanced pacing with mostly clean white spreads and steady pairings.',
    groupingPattern: [2, 2, 1, 2, 3],
    background: () => '#ffffff',
  },
  story: {
    label: 'Story',
    description: 'More hero moments up front, then supporting frames around them.',
    groupingPattern: [1, 2, 1, 3, 2],
    background: (spreadIndex) => (spreadIndex % 3 === 2 ? '#f6f0ea' : '#ffffff'),
  },
  premium: {
    label: 'Premium',
    description: 'Denser sequencing with alternating light and dark presentation.',
    groupingPattern: [3, 2, 3, 1, 2],
    background: (spreadIndex) => (spreadIndex % 2 === 0 ? '#171515' : '#ffffff'),
  },
};

export interface LayoutSpread {
  id: string; // temp client identifier
  images: LayoutPhoto[];
  layoutType: LayoutType;
  backgroundColor: string; // #ffffff or #000000
}

export function getDraftVariantMeta(variant: DraftVariant) {
  return VARIANT_RULES[variant];
}

export function getAllowedLayoutTypes(imageCount: number): LayoutType[] {
  if (imageCount <= 1) return ['single'];
  if (imageCount === 2) return ['split', 'single'];
  return ['grid3', 'split'];
}

function stableSpreadId(variant: DraftVariant, spreadIndex: number, images: LayoutPhoto[]) {
  return `${variant}-${spreadIndex + 1}-${images.map((image) => image.id).join('-')}`;
}

function resolveGroupSize(remaining: number, desired: number) {
  if (remaining <= 3) return remaining;
  if (remaining === 4) return desired >= 3 ? 2 : desired;
  return Math.min(desired, 3, remaining);
}

function getLayoutType(images: LayoutPhoto[]): LayoutType {
  return getAllowedLayoutTypes(images.length)[0];
}

export function generateAutoLayout(shortlist: LayoutPhoto[], variant: DraftVariant = 'classic'): LayoutSpread[] {
  const spreads: LayoutSpread[] = [];
  let index = 0;
  let spreadIndex = 0;
  const rules = VARIANT_RULES[variant];

  while (index < shortlist.length) {
    const desiredGroupSize = rules.groupingPattern[spreadIndex % rules.groupingPattern.length];
    const remaining = shortlist.length - index;
    const groupSize = resolveGroupSize(remaining, desiredGroupSize);
    const chunk = shortlist.slice(index, index + groupSize);

    spreads.push({
      id: stableSpreadId(variant, spreadIndex, chunk),
      images: chunk,
      layoutType: getLayoutType(chunk),
      backgroundColor: rules.background(spreadIndex),
    });

    index += groupSize;
    spreadIndex += 1;
  }

  return spreads;
}
