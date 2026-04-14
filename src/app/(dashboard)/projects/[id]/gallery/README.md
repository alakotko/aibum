# `src/app/(dashboard)/projects/[id]/gallery/` — Media Studio

This route remains the media-focused gallery surface for a project. Album draft generation, shortlist sets, proof publishing, and version compare now live in the workflow workspace component on `../page.tsx`.

## Files

| File | Purpose |
|------|---------|
| `page.tsx` | Gallery-focused media page for the project |
| `GalleryImage.tsx` | Smart image component with crossfade transition from optimistic blob URLs to real Supabase URLs |
| `GalleryImage.module.css` | Styles for the crossfade image component |
| `gallery.module.css` | All page-level styles — grid layout, toolbar, tabs, album canvas, spread rendering |

## Key Features

- **Drag & Drop / Manual Upload** — Files are added to `useUploadStore` for async processing while optimistic thumbnails appear instantly.
- **Photo Selection** — Click to toggle, Shift+Click for range selection. Keyboard shortcuts: `Delete`/`Backspace` to delete, `Escape` to deselect.
- **Thumbnail Scale Slider** — Adjustable grid thumbnail size (80px → 400px), persisted to `localStorage`.
- **Photo Selection** — Supports shortlist/exclude tagging that feeds named shortlist sets and draft generation in the project workspace.

## Connections

- **`useGalleryStore`** (`src/store/`) — Photo list, selection state, fetch, delete, AI analysis.
- **`useUploadStore`** (`src/store/`) — Upload queue, file processing, optimistic photo injection.
- **`generateAutoLayout`** (`src/utils/autoLayout.ts`) — Deterministic spread generation algorithm used by the project workspace.
- **`GalleryImage`** (local) — Renders each thumbnail with smooth URL swap transitions.
- **Supabase client** (`src/utils/supabase/client.ts`) — Album/spread/slot export to database.
