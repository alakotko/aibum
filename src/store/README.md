# `src/store/` — Zustand State Management

Client-side state stores built with [Zustand](https://zustand-demo.pmnd.rs/). These stores hold the in-memory application state that drives the gallery UI, upload pipeline, and optimistic updates.

## Stores

### `useGalleryStore.ts` — Photo Collection & Selection

Manages the photo list and user interactions for the gallery grid.

| State / Action | Description |
|----------------|-------------|
| `photos` | Array of `Photo` objects (id, url, thumbnailUrl, status, aiScore, aiFlags) |
| `selectedPhotoIds` | Currently selected photo IDs |
| `toggleSelection()` | Click to toggle + Shift+Click range selection |
| `selectAll()` / `clearSelection()` | Bulk selection helpers |
| `deleteSelected()` | Optimistic UI removal + Supabase `photos` table delete |
| `fetchProjectPhotos(projectId)` | Loads photos from DB for a given project |
| `analyzePhotos()` | Calls `/api/analyze` to get AI quality flags from AWS Rekognition |
| `addOptimisticPhotos()` | Injects local preview thumbnails before upload completes |
| `swapOptimisticPhoto()` | Replaces a local blob photo with the real DB record post-upload |

### `useUploadStore.ts` — Upload Pipeline

Manages the file upload queue with optimistic preview injection.

| State / Action | Description |
|----------------|-------------|
| `queue` | Array of `UploadItem` objects with status, progress, and local preview |
| `addFiles(files)` | Validates file types, generates WebP thumbnails (concurrency-limited), pushes optimistic photos to `useGalleryStore` |
| `processQueue(projectId)` | Sequentially uploads each file to Supabase Storage, creates thumbnail copy, inserts DB record, swaps optimistic photo, and schedules AI analysis |
| `removeUpload(id)` | Removes an item from the queue |

**Batched AI analysis:** A module-level debounce (`scheduleAnalysis`) collects uploaded URLs and fires a single `/api/analyze` call 1.5 seconds after the last upload completes.

## Inter-Store Communication

`useUploadStore` directly calls `useGalleryStore.getState()` to:
1. Push optimistic photos instantly when files are added (`addOptimisticPhotos`).
2. Swap them with real DB records when upload completes (`swapOptimisticPhoto`).

```
useUploadStore  ──addOptimisticPhotos()──→  useGalleryStore
                ──swapOptimisticPhoto()──→  useGalleryStore
                ──scheduleAnalysis()────→   /api/analyze
```

## Connections

- **Consumed by:** Gallery page (`src/app/(dashboard)/projects/[id]/gallery/`), `UploadProgressTray` (`src/components/Upload/`).
- **Depends on:** `src/utils/supabase/client.ts` (for DB/Storage calls), `src/utils/uploadProcessor.ts` (for thumbnail generation).
