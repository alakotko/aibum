# `src/utils/` — Utility Functions & Service Layer

Pure helper modules and service abstractions used across the application.

## Files

### `uploadProcessor.ts` — Client-Side Image Processing

| Function | Purpose |
|----------|---------|
| `generateThumbnail(file, maxWidth?, maxHeight?)` | Resizes an image on an offscreen `<canvas>` and returns a lightweight WebP data URL. Prevents high memory usage when bulk-dropping 1000+ files. |
| `dataUrlToBlob(dataUrl)` | Converts a canvas data URL to a `Blob` for uploading to Supabase Storage as a thumbnail file. |

**Used by:** `useUploadStore` (`src/store/`) during the file-add and upload phases.

### `autoLayout.ts` — Album Spread Layout Generator

| Function | Purpose |
|----------|---------|
| `generateAutoLayout(shortlist)` | Takes an array of `Photo` objects and chunks them into `LayoutSpread` groups (1–3 images per spread) with randomized layout types (`single`, `split`, `grid3`) and background colors. |

**Used by:** Gallery page (`src/app/(dashboard)/projects/[id]/gallery/`) for the Album Builder tab, and the Proof page (`src/app/proof/[id]/`).

## Subdirectory

### `supabase/` — Supabase Client Factories

Creates configured Supabase clients for different execution contexts.

| File | Context | Purpose |
|------|---------|---------|
| `client.ts` | Browser (Client Components) | `createBrowserClient()` — used by pages, stores, and components for data/auth/storage operations. |
| `server.ts` | Server (Server Components, API Routes) | `createServerClient()` — reads/writes cookies for session management on the server side. |

**Used by:** Virtually everything — stores, pages, API routes, and the `proxy.ts` middleware.

## Connections

```
uploadProcessor.ts  ←── useUploadStore (src/store/)
autoLayout.ts       ←── Gallery page, Proof page (src/app/)
supabase/client.ts  ←── Stores, Pages, Components (browser-side)
supabase/server.ts  ←── API routes, proxy.ts (server-side)
```
