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
| `generateAutoLayout(shortlist, variant)` | Takes an ordered array of `Photo` objects and deterministically builds a dark cover followed by explicit interior layouts for the `classic`, `story`, or `premium` draft variant. |
| `getDraftVariantMeta(variant)` | Returns the user-facing label and sequencing rules for a draft variant. |
| `getAllowedLayoutTypes(imageCount)` | Returns the layouts that are valid for the current spread image count. |
| `createSpreadKey({ spreadRole, templateId, imageIds })` | Builds a deterministic spread identity key from semantic role, template, and ordered image membership. |
| `buildLayoutSpread(...)` | Rehydrates or creates a spread with template metadata, role, and stable spread key. |

**Used by:** Project workspace drafts in `src/app/(dashboard)/projects/[id]/ProjectWorkspace.tsx` and the public proof page in `src/app/proof/[token]/`.

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
autoLayout.ts       ←── Project workspace, Proof page (src/app/)
supabase/client.ts  ←── Stores, Pages, Components (browser-side)
supabase/server.ts  ←── API routes, proxy.ts (server-side)
```
