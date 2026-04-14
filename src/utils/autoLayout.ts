import type { Photo } from '@/store/useGalleryStore';

export const DRAFT_VARIANTS = ['classic', 'story', 'premium'] as const;

export type DraftVariant = (typeof DRAFT_VARIANTS)[number];
export type LayoutPhoto = Photo;
export type SpreadRole = 'cover' | 'interior';
export type LayoutTemplateId =
  | 'cover-single'
  | 'interior-single'
  | 'interior-split'
  | 'interior-grid3';

type LayoutType = 'single' | 'split' | 'grid3';

type VariantRules = {
  label: string;
  description: string;
  groupingPattern: readonly number[];
  background: (spreadIndex: number) => string;
};

type LayoutTemplateDefinition = {
  id: LayoutTemplateId;
  spreadRole: SpreadRole;
  imageCount: 1 | 2 | 3;
  layoutType: LayoutType;
  backgroundColor: '#000000' | '#ffffff';
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

export const LAYOUT_TEMPLATES: Record<LayoutTemplateId, LayoutTemplateDefinition> = {
  'cover-single': {
    id: 'cover-single',
    spreadRole: 'cover',
    imageCount: 1,
    layoutType: 'single',
    backgroundColor: '#000000',
  },
  'interior-single': {
    id: 'interior-single',
    spreadRole: 'interior',
    imageCount: 1,
    layoutType: 'single',
    backgroundColor: '#ffffff',
  },
  'interior-split': {
    id: 'interior-split',
    spreadRole: 'interior',
    imageCount: 2,
    layoutType: 'split',
    backgroundColor: '#ffffff',
  },
  'interior-grid3': {
    id: 'interior-grid3',
    spreadRole: 'interior',
    imageCount: 3,
    layoutType: 'grid3',
    backgroundColor: '#ffffff',
  },
};

export interface LayoutSpread {
  id: string;
  templateId: LayoutTemplateId;
  spreadRole: SpreadRole;
  spreadKey: string;
  images: LayoutPhoto[];
  layoutType: LayoutType;
  backgroundColor: string;
}

export function getDraftVariantMeta(variant: DraftVariant) {
  return VARIANT_RULES[variant];
}

export function getAllowedLayoutTypes(imageCount: number): LayoutType[] {
  if (imageCount <= 1) return ['single'];
  if (imageCount === 2) return ['split', 'single'];
  return ['grid3', 'split'];
}

export function createSpreadKey({
  spreadRole,
  templateId,
  imageIds,
}: {
  spreadRole: SpreadRole;
  templateId: LayoutTemplateId;
  imageIds: string[];
}) {
  return `${spreadRole}:${templateId}:${imageIds.join('|')}`;
}

export function createVersionSpreadKeys(spreads: Pick<LayoutSpread, 'spreadKey'>[]) {
  const counts = new Map<string, number>();

  return spreads.map((spread) => {
    const occurrence = (counts.get(spread.spreadKey) ?? 0) + 1;
    counts.set(spread.spreadKey, occurrence);

    return occurrence === 1 ? spread.spreadKey : `${spread.spreadKey}#${occurrence}`;
  });
}

export function getTemplateId(spreadRole: SpreadRole, layoutType: LayoutType): LayoutTemplateId {
  if (spreadRole === 'cover') return 'cover-single';
  if (layoutType === 'split') return 'interior-split';
  if (layoutType === 'grid3') return 'interior-grid3';
  return 'interior-single';
}

export function buildLayoutSpread({
  spreadRole,
  layoutType,
  images,
  backgroundColor,
  id,
}: {
  spreadRole: SpreadRole;
  layoutType: LayoutType;
  images: LayoutPhoto[];
  backgroundColor?: string;
  id?: string;
}): LayoutSpread {
  const templateId = getTemplateId(spreadRole, layoutType);
  const spreadKey = createSpreadKey({
    spreadRole,
    templateId,
    imageIds: images.map((image) => image.id),
  });

  return {
    id: id ?? spreadKey,
    templateId,
    spreadRole,
    spreadKey,
    images,
    layoutType,
    backgroundColor:
      backgroundColor ?? (spreadRole === 'cover' ? LAYOUT_TEMPLATES['cover-single'].backgroundColor : LAYOUT_TEMPLATES[templateId].backgroundColor),
  };
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
  if (shortlist.length === 0) return [];

  const rules = VARIANT_RULES[variant];
  const spreads: LayoutSpread[] = [
    buildLayoutSpread({
      spreadRole: 'cover',
      layoutType: 'single',
      images: shortlist.slice(0, 1),
      backgroundColor: LAYOUT_TEMPLATES['cover-single'].backgroundColor,
    }),
  ];

  let index = 1;
  let interiorSpreadIndex = 0;

  while (index < shortlist.length) {
    const desiredGroupSize = rules.groupingPattern[interiorSpreadIndex % rules.groupingPattern.length];
    const remaining = shortlist.length - index;
    const groupSize = resolveGroupSize(remaining, desiredGroupSize);
    const chunk = shortlist.slice(index, index + groupSize);
    const layoutType = getLayoutType(chunk);

    spreads.push(
      buildLayoutSpread({
        spreadRole: 'interior',
        layoutType,
        images: chunk,
        backgroundColor: rules.background(interiorSpreadIndex),
      })
    );

    index += groupSize;
    interiorSpreadIndex += 1;
  }

  return spreads;
}
