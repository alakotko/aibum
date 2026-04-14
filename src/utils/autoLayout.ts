import type { Photo } from '../store/useGalleryStore';

export type SpreadRole = 'cover' | 'interior';
export type LayoutTemplateId =
  | 'cover-single'
  | 'interior-single'
  | 'interior-split'
  | 'interior-grid3';

type LayoutTemplateDefinition = {
  id: LayoutTemplateId;
  spreadRole: SpreadRole;
  imageCount: 1 | 2 | 3;
  layoutType: 'single' | 'split' | 'grid3';
  backgroundColor: '#000000' | '#ffffff';
};

export interface LayoutSpread {
  id: string;
  templateId: LayoutTemplateId;
  spreadRole: SpreadRole;
  spreadKey: string;
  images: Photo[];
  layoutType: 'single' | 'split' | 'grid3';
  backgroundColor: string;
}

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

function buildSpread(templateId: LayoutTemplateId, images: Photo[]): LayoutSpread {
  const template = LAYOUT_TEMPLATES[templateId];
  const spreadKey = createSpreadKey({
    spreadRole: template.spreadRole,
    templateId: template.id,
    imageIds: images.map((image) => image.id),
  });

  return {
    id: spreadKey,
    templateId: template.id,
    spreadRole: template.spreadRole,
    spreadKey,
    images,
    layoutType: template.layoutType,
    backgroundColor: template.backgroundColor,
  };
}

export function generateAutoLayout(shortlist: Photo[]): LayoutSpread[] {
  if (shortlist.length === 0) {
    return [];
  }

  const spreads: LayoutSpread[] = [buildSpread('cover-single', shortlist.slice(0, 1))];
  let index = 1;

  while (index < shortlist.length) {
    const remaining = shortlist.length - index;
    const templateId: LayoutTemplateId =
      remaining >= 3 ? 'interior-grid3' : remaining === 2 ? 'interior-split' : 'interior-single';
    const template = LAYOUT_TEMPLATES[templateId];
    const chunk = shortlist.slice(index, index + template.imageCount);

    spreads.push(buildSpread(templateId, chunk));
    index += template.imageCount;
  }

  return spreads;
}
