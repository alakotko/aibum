import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import type { SelectionStatus } from '@/types/workflow';

export interface Photo {
  id: string;
  url: string;
  filename?: string;
  thumbnailUrl?: string; // Stored WebP thumbnail for fast grid display
  selectionStatus: SelectionStatus;
  aiScore?: number;
  aiFlags?: string[];
}

type AnalyzeResult = {
  url: string;
  flags?: Array<{ type: string; confidence: number }>;
  score?: number;
};

type AlbumInputRow = {
  id: string;
  filename: string;
  storage_path: string;
  thumbnail_path: string | null;
  selection_status: SelectionStatus;
  ai_score: number | null;
  ai_flags: unknown;
};

interface GalleryState {
  photos: Photo[];
  selectedPhotoIds: string[];
  lastClickedId: string | null;
  
  setPhotos: (photos: Photo[]) => void;
  updateSelectionStatus: (ids: string[], selectionStatus: SelectionStatus) => Promise<void>;
  
  toggleSelection: (id: string, shift: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;
  
  deleteSelected: () => Promise<void>;
  
  analyzePhotos: () => Promise<void>;
  fetchProjectPhotos: (projectId: string) => Promise<void>;
  addOptimisticPhotos: (newPhotos: Photo[]) => void;
  swapOptimisticPhoto: (localId: string, updatedPhoto: Photo) => void;
}

export const useGalleryStore = create<GalleryState>((set, get) => ({
  photos: [],
  selectedPhotoIds: [],
  lastClickedId: null,

  setPhotos: (photos) => set({ photos }),

  updateSelectionStatus: async (ids, selectionStatus) => {
    if (ids.length === 0) return;

    set((state) => ({
      photos: state.photos.map((photo) =>
        ids.includes(photo.id) ? { ...photo, selectionStatus } : photo
      ),
    }));

    const dbIds = ids.filter((id) => !id.startsWith('optimistic-'));
    if (dbIds.length === 0) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('album_inputs')
      .update({ selection_status: selectionStatus })
      .in('id', dbIds);

    if (error) {
      console.error('Failed to update selection status', error);
    }
  },

  toggleSelection: (id: string, shift: boolean) => set((state) => {
    let newSelection = [...state.selectedPhotoIds];
    
    if (shift && state.lastClickedId) {
      // Find indexes
      const lastIndex = state.photos.findIndex(p => p.id === state.lastClickedId);
      const currentIndex = state.photos.findIndex(p => p.id === id);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        
        // Add all photos in range to selection
        const rangeIds = state.photos.slice(start, end + 1).map(p => p.id);
        rangeIds.forEach(rangeId => {
          if (!newSelection.includes(rangeId)) {
            newSelection.push(rangeId);
          }
        });
      }
    } else {
      // Normal click toggle
      if (newSelection.includes(id)) {
        newSelection = newSelection.filter(selectedId => selectedId !== id);
      } else {
        newSelection.push(id);
      }
    }

    return { selectedPhotoIds: newSelection, lastClickedId: id };
  }),

  clearSelection: () => set({ selectedPhotoIds: [], lastClickedId: null }),
  
  selectAll: () => set((state) => ({
    selectedPhotoIds: state.photos.map(p => p.id),
    lastClickedId: null
  })),

  deleteSelected: async () => {
    const state = get();
    if (state.selectedPhotoIds.length === 0) return;
    
    const idsToDelete = [...state.selectedPhotoIds];
    
    // 1. Remove from UI instantly (Optimistic)
    set((state) => ({
      photos: state.photos.filter(p => !idsToDelete.includes(p.id)),
      selectedPhotoIds: [],
      lastClickedId: null
    }));

    // 2. Remove from the current workflow table; storage cleanup can be handled separately.
    const dbIds = idsToDelete.filter(id => !id.startsWith('optimistic-'));
    if (dbIds.length > 0) {
      const supabase = createClient();
      try {
        await supabase.from('album_inputs').delete().in('id', dbIds);
      } catch (err) {
        console.error("Failed to batch delete photos from DB:", err);
      }
    }
  },

  // Phase 2: Call the AWS route to evaluate existing photos
  analyzePhotos: async () => {
    const { photos } = get();
    if (photos.length === 0) return;
    const urls = photos.map(p => p.url).filter(Boolean);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: urls })
      });
      const data = (await res.json()) as { results?: AnalyzeResult[] };

      if (data.results) {
        const results = data.results;
        set((state) => ({
          photos: state.photos.map(p => {
            const analysis = results.find((result) => result.url === p.url);
            if (analysis && analysis.flags) {
              return {
                ...p,
                aiFlags: analysis.flags.map((flag) => flag.type),
                aiScore: typeof analysis.score === 'number' ? analysis.score : p.aiScore,
              };
            }
            return p;
          })
        }));
      }
    } catch (err) {
      console.error("AI Analysis Failed", err);
    }
  },

  // Phase 3: Fetch photos directly from the Real Supabase Database!
  fetchProjectPhotos: async (projectId: string) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('album_inputs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      set({
        photos: ((data ?? []) as AlbumInputRow[]).map((p) => ({
          id: p.id,
          filename: p.filename,
          url: p.storage_path,
          thumbnailUrl: p.thumbnail_path ?? undefined,
          selectionStatus: p.selection_status,
          aiScore: p.ai_score ?? undefined,
          aiFlags: Array.isArray(p.ai_flags) ? p.ai_flags : [],
        })),
        selectedPhotoIds: [],
        lastClickedId: null
      });
    } catch (e) {
      console.error("Failed to load photos from Database natively:", e);
    }
  },

  addOptimisticPhotos: (newPhotos) => set((state) => ({
    photos: [...state.photos, ...newPhotos]
  })),

  swapOptimisticPhoto: (localId, updatedPhoto) => set((state) => ({
    photos: state.photos.some((photo) => photo.id === localId)
      ? state.photos.map((photo) => {
          if (photo.id === localId) return updatedPhoto;
          return photo;
        })
      : state.photos.some((photo) => photo.id === updatedPhoto.id)
        ? state.photos
        : [...state.photos, updatedPhoto],
    // Update selected ID if the optimistic ID was selected
    selectedPhotoIds: state.selectedPhotoIds.map(id => id === localId ? updatedPhoto.id : id),
    lastClickedId: state.lastClickedId === localId ? updatedPhoto.id : state.lastClickedId
  }))
}));
