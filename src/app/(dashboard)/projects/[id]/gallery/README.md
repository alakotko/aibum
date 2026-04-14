# `src/app/(dashboard)/projects/[id]/gallery/` — Media Studio (Gallery + Album Builder)

This is the **core workspace** of the application — a unified page that combines the photo gallery grid and the album builder into a single tabbed interface.

## Files

| File | Purpose |
|------|---------|
| `page.tsx` | Main page component — Gallery grid tab + Album Builder tab, upload handling, selection, deletion, album export |
| `GalleryImage.tsx` | Smart image component with crossfade transition from optimistic blob URLs to real Supabase URLs |
| `GalleryImage.module.css` | Styles for the crossfade image component |
| `gallery.module.css` | All page-level styles — grid layout, toolbar, tabs, album canvas, spread rendering |

## Key Features

- **Drag & Drop / Manual Upload** — Files are added to `useUploadStore` for async processing while optimistic thumbnails appear instantly.
- **Photo Selection** — Click to toggle, Shift+Click for range selection. Keyboard shortcuts: `Delete`/`Backspace` to delete, `Escape` to deselect.
- **Thumbnail Scale Slider** — Adjustable grid thumbnail size (80px → 400px), persisted to `localStorage`.
- **Album Builder Tab** — Auto-generates deterministic cover/interior layouts from selected (or all) photos using `generateAutoLayout()` and exports template metadata plus stable spread keys to Supabase.

## Connections

- **`useGalleryStore`** (`src/store/`) — Photo list, selection state, fetch, delete, AI analysis.
- **`useUploadStore`** (`src/store/`) — Upload queue, file processing, optimistic photo injection.
- **`generateAutoLayout`** (`src/utils/autoLayout.ts`) — Spread layout generation algorithm.
- **`GalleryImage`** (local) — Renders each thumbnail with smooth URL swap transitions.
- **Supabase client** (`src/utils/supabase/client.ts`) — Album/spread/slot export to database.
