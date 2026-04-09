import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';

export interface Photo {
  id: string;
  url: string;
  status: 'pending' | 'accepted' | 'rejected';
  aiScore?: number;
  aiFlags?: string[];
}

interface CullState {
  photos: Photo[];
  currentIndex: number;
  setPhotos: (photos: Photo[]) => void;
  setCurrentIndex: (index: number) => void;
  acceptCurrent: () => void;
  rejectCurrent: () => void;
  analyzePhotos: () => Promise<void>;
  fetchProjectPhotos: (projectId: string) => Promise<void>;
}

const mockPhotos: Photo[] = [
  { id: '1', url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80', status: 'pending' },
  { id: '2', url: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=800&q=80', status: 'pending' },
  { id: '3', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80', status: 'pending' },
  { id: '4', url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80', status: 'pending' },
];

export const useCullStore = create<CullState>((set, get) => ({
  photos: mockPhotos,
  currentIndex: 0,

  setPhotos: (photos) => set({ photos }),

  setCurrentIndex: (index) => set((state) => ({
    currentIndex: Math.max(0, Math.min(index, state.photos.length - 1))
  })),

  acceptCurrent: () => set((state) => {
    if (state.photos.length === 0) return state;
    const newPhotos = [...state.photos];
    newPhotos[state.currentIndex] = { ...newPhotos[state.currentIndex], status: 'accepted' };

    const nextIndex = Math.min(state.currentIndex + 1, state.photos.length - 1);
    return { photos: newPhotos, currentIndex: nextIndex };
  }),

  rejectCurrent: () => set((state) => {
    if (state.photos.length === 0) return state;
    const newPhotos = [...state.photos];
    newPhotos[state.currentIndex] = { ...newPhotos[state.currentIndex], status: 'rejected' };

    const nextIndex = Math.min(state.currentIndex + 1, state.photos.length - 1);
    return { photos: newPhotos, currentIndex: nextIndex };
  }),

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
      const data = await res.json();

      if (data.results) {
        set((state) => ({
          photos: state.photos.map(p => {
            const analysis = data.results.find((r: any) => r.url === p.url);
            if (analysis && analysis.flags) {
              return { ...p, aiFlags: analysis.flags.map((f: any) => f.type) };
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
      const { data, error } = await supabase.from('photos').select('*').eq('project_id', projectId);
      if (error) throw error;
      
      if (data && data.length > 0) {
        set({
          photos: data.map((p: any) => ({
            id: p.id,
            url: p.storage_path, // Resolves to the mocked Unsplash URL from our seeder!
            status: p.status === 'processed' ? 'accepted' : 'pending'
          })),
          currentIndex: 0
        });
      }
    } catch (e) {
      console.error("Failed to load photos from Database natively:", e);
    }
  }
}));
