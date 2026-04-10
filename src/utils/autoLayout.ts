import { Photo } from '@/store/useGalleryStore';

export interface LayoutSpread {
  id: string; // temp client identifier
  images: Photo[];
  layoutType: 'single' | 'split' | 'grid3';
  backgroundColor: string; // #ffffff or #000000
}

export function generateAutoLayout(shortlist: Photo[]): LayoutSpread[] {
  const spreads: LayoutSpread[] = [];
  let index = 0;

  // Emulating an intelligent chronological or scene-based heuristic chunker
  while (index < shortlist.length) {
    // Pick 1 to 3 images to form a spread
    const groupSize = Math.floor(Math.random() * 3) + 1; 
    const chunk = shortlist.slice(index, Math.min(index + groupSize, shortlist.length));
    
    let layoutType: LayoutSpread['layoutType'] = 'single';
    if (chunk.length === 2) layoutType = 'split';
    if (chunk.length === 3) layoutType = 'grid3';
    
    // Mix up page colors slightly for dynamic impact (80% white, 20% black)
    const isDark = Math.random() > 0.8;

    spreads.push({
      id: `spread_${index}_${Date.now()}`,
      images: chunk,
      layoutType,
      backgroundColor: isDark ? '#000000' : '#ffffff'
    });
    
    index += groupSize;
  }
  
  return spreads;
}
