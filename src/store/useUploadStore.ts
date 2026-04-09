import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { useGalleryStore } from './useGalleryStore';
import { generateThumbnail, dataUrlToBlob } from '@/utils/uploadProcessor';

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

export interface UploadItem {
  id: string; // Temporary local ID
  file: File;
  status: UploadStatus;
  progress: number;
  localPreviewUrl: string; // The optimistic thumbnail
  errorDetails?: string;
}

interface UploadState {
  queue: UploadItem[];
  addFiles: (files: File[]) => Promise<void>;
  processQueue: (projectId: string) => Promise<void>;
  removeUpload: (id: string) => void;
  _isUploading: boolean;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  queue: [],
  _isUploading: false,

  addFiles: async (files) => {
    // 1. Filter files (JPEG/PNG only)
    const validFiles = files.filter(f =>
      f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'image/webp'
    );

    if (validFiles.length === 0) return;

    const newItems: UploadItem[] = [];

    // 2. Generate previews with a concurrency limit of 3.
    //    This prevents loading 15x 8MB images into the heap simultaneously,
    //    which would block the browser's main thread and make the UI unresponsive.
    const CONCURRENCY = 3;
    const pool: Promise<void>[] = [];

    const processFile = async (file: File) => {
      const localId = `optimistic-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const localPreviewUrl = await generateThumbnail(file);
      newItems.push({ id: localId, file, status: 'pending', progress: 0, localPreviewUrl });
    };

    for (const file of validFiles) {
      const p = processFile(file);
      pool.push(p);
      if (pool.length >= CONCURRENCY) {
        await Promise.race(pool);
        // Clean up resolved promises from the pool
        pool.splice(0, pool.length, ...pool.filter(p => {
          let resolved = false;
          p.then(() => { resolved = true; });
          return !resolved;
        }));
      }
    }
    // Drain any remaining promises
    await Promise.all(pool);

    // 3. Add to upload queue
    set(state => ({ queue: [...state.queue, ...newItems] }));

    // 4. Also push optimally to CullStore so user can work NOW
    const optimisticPhotos = newItems.map(item => ({
      id: item.id,
      url: item.localPreviewUrl,
      status: 'pending' as const
    }));
    useGalleryStore.getState().addOptimisticPhotos(optimisticPhotos);
  },

  removeUpload: (id) => {
    set(state => ({
      queue: state.queue.filter(item => item.id !== id)
    }));
  },

  processQueue: async (projectId: string) => {
    if (get()._isUploading) return;
    set({ _isUploading: true });

    const supabase = createClient();

    while (get().queue.some(item => item.status === 'pending')) {
      const state = get();
      const currentItem = state.queue.find(item => item.status === 'pending');
      if (!currentItem) break;

      // Mark as uploading
      set(state => ({
        queue: state.queue.map(item =>
          item.id === currentItem.id ? { ...item, status: 'uploading' } : item
        )
      }));

      try {
        // Upload to Supabase Storage
        const fileExt = currentItem.file.name.split('.').pop();
        const fileName = `${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // MVP: Standard upload. TUS can be added later if standard fails on large files.
        const { data: storageData, error: storageError } = await supabase.storage
          .from('photos')
          .upload(fileName, currentItem.file, {
            upsert: false,
            // We can't track precise % with standard upload easily in server components without TUS, 
            // but we can fake it or just set it to 100 on complete for MVP
          });

        if (storageError) throw storageError;

        // Also upload the canvas thumbnail blob to thumbs/ prefix
        // This lets us serve a tiny ~20KB WebP for the gallery grid without
        // needing paid CDN image transforms from Supabase or Cloudflare.
        let thumbnailPublicUrl: string | undefined;
        if (currentItem.localPreviewUrl.startsWith('data:')) {
          const thumbBlob = dataUrlToBlob(currentItem.localPreviewUrl);
          const thumbName = `thumbs/${fileName.replace(/\.[^.]+$/, '.webp')}`;
          const { data: thumbData, error: thumbError } = await supabase.storage
            .from('photos')
            .upload(thumbName, thumbBlob, { upsert: false, contentType: 'image/webp' });
          if (!thumbError && thumbData) {
            thumbnailPublicUrl = supabase.storage.from('photos').getPublicUrl(thumbData.path).data.publicUrl;
          }
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(storageData.path);
        const publicUrl = publicUrlData.publicUrl;

        // Insert into Database
        const { data: dbData, error: dbError } = await supabase
          .from('photos')
          .insert({
            project_id: projectId,
            storage_path: publicUrl,
            thumbnail_path: thumbnailPublicUrl ?? null,
            filename: currentItem.file.name,
            status: 'processed'
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Mark local upload queue as success
        set(state => ({
          queue: state.queue.map(item =>
            item.id === currentItem.id ? { ...item, status: 'success', progress: 100 } : item
          )
        }));

        // SWAP the Optimistic local photo with the REAL Database photo in GalleryStore!
        useGalleryStore.getState().swapOptimisticPhoto(currentItem.id, {
          id: dbData.id,
          url: publicUrl,
          thumbnailUrl: thumbnailPublicUrl,
          status: 'accepted'
        });

        // Queue URL for batched AI analysis (debounced to avoid 1 call per photo)
        scheduleAnalysis(publicUrl);

      } catch (err: any) {
        console.error("Upload failed for item", currentItem.id, err);
        set(state => ({
          queue: state.queue.map(item =>
            item.id === currentItem.id ? { ...item, status: 'error', errorDetails: err.message } : item
          )
        }));
      }
    }

    set({ _isUploading: false });
  }
}));

// Batch + debounced AI analysis to avoid 1-request-per-photo spam.
// Collects all uploaded URLs and fires a single /api/analyze call
// 1.5s after the LAST upload in the batch completes.
let analyzeTimer: ReturnType<typeof setTimeout> | null = null;
const analyzeUrlQueue: string[] = [];

function scheduleAnalysis(url: string) {
  analyzeUrlQueue.push(url);
  if (analyzeTimer) clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(() => {
    const urls = [...analyzeUrlQueue];
    analyzeUrlQueue.length = 0;
    analyzeTimer = null;
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrls: urls })
    }).catch(console.error);
  }, 1500);
}
