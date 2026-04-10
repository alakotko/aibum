# Albumin — AI Assistant Instructions

> These instructions apply to any AI agent working in this repository.
> Also read: `AGENTS.md` (Next.js version-specific rules) and `MVP Features AI Photo Album Web App for Photographers.md` (product spec).

---

## 1. Project Identity

**Albumin** is an AI-powered photo album web app for professional photography studios.
Core workflow: **Upload → Gallery Cull → AI Quality Flag → Album Builder → Client Proofing.**

- **Framework:** Next.js 16.2 (App Router) — read `node_modules/next/dist/docs/` before using any Next.js API.
- **Language:** TypeScript (strict)
- **Styling:** Vanilla CSS Modules only. No Tailwind, no inline styles for layout.
- **State:** Zustand 5 (`src/store/`)
- **Backend:** Supabase (Auth + Postgres + Storage). No other databases.
- **AI:** AWS Rekognition via `@aws-sdk/client-rekognition` (currently mocked — see §5).

---

## 2. Repository Layout

```
src/
├── app/
│   ├── login/                        # /login  — email/password auth
│   ├── (dashboard)/                  # Protected studio shell (sidebar + upload tray)
│   │   ├── layout.tsx                # Sidebar nav + <UploadProgressTray />
│   │   └── projects/
│   │       ├── page.tsx              # /projects — studio dashboard
│   │       └── [id]/
│   │           ├── gallery/          # /projects/[id]/gallery — Media Finder
│   │           └── album-builder/    # /projects/[id]/album-builder
│   ├── proof/[id]/                   # /proof/[id] — public client proofing
│   └── api/
│       └── analyze/route.ts          # POST /api/analyze — Rekognition endpoint
├── components/
│   └── Upload/UploadProgressTray     # Floating upload progress indicator
├── store/
│   ├── useGalleryStore.ts            # Photo state, selection, delete, AI flags
│   └── useUploadStore.ts             # Upload queue, thumbnail gen, Storage pipeline
└── utils/
    ├── autoLayout.ts                 # Spread generator (single / split / grid3)
    ├── uploadProcessor.ts            # Canvas thumbnail + dataUrl→Blob helpers
    └── supabase/
        ├── client.ts                 # Browser Supabase client
        └── server.ts                 # Server Supabase client (SSR)
supabase/migrations/                  # SQL migrations — apply in filename order
```

---

## 3. Development Commands

```bash
npm run dev      # Start local dev server (port 3000)
npm run build    # Production build — run this to verify no TS/compile errors
npm run lint     # ESLint check
```

Always verify `npm run build` passes before finishing a task. The dev server is usually already running.

---

## 4. Environment Variables

Required in `.env.local` (never commit):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## 5. Key Architectural Decisions

### 5.1 Supabase Soft-Delete Pattern
**Do NOT use `.update()` for soft-deleting projects.** PostgREST wraps every UPDATE in a CTE with `RETURNING`, and PostgreSQL then enforces the SELECT RLS policy on the post-update row — which fails because the row now has `deleted_at` set and no longer passes `deleted_at IS NULL`.

**Correct pattern:** always call the `soft_delete_project` RPC:
```ts
await supabase.rpc('soft_delete_project', { project_id: id });
```
This runs as `SECURITY DEFINER` to bypass the conflict.

### 5.2 Optimistic Upload Flow
Photos appear in the gallery immediately (optimistic) → real DB record swaps in after S3 upload completes. Follow this pattern for any new upload-like feature:
1. `addOptimisticPhotos()` — push temp entry to gallery store
2. Upload to Storage → insert DB row
3. `swapOptimisticPhoto(localId, realPhoto)` — replace temp with real

### 5.3 Thumbnail Storage Strategy
Thumbnails are generated client-side via canvas (800px max, WebP 0.8 quality) and uploaded to `photos/thumbs/{path}.webp` in Supabase Storage. **Do not use Supabase's paid image transform CDN.** The `thumbnail_path` column in the `photos` table stores the public URL of the thumb.

### 5.4 Debounced Batch AI Analysis
After each upload, `scheduleAnalysis(url)` is called. It collects URLs for 1.5 s and fires a single `POST /api/analyze`. Never call `/api/analyze` once per photo — always batch.

### 5.5 AWS Rekognition Status
`hasAwsKeys = false` in `src/app/api/analyze/route.ts` — the endpoint returns deterministic mock data. To enable real Rekognition, set `hasAwsKeys = true` and ensure env vars are set. **Do not enable this without confirming with the developer** — it incurs per-image AWS charges.

### 5.6 Profiles Upsert Workaround
The `handle_new_user` Supabase trigger is unreliable. Project creation always defensively upserts the profile row before inserting the project:
```ts
await supabase.from('profiles').upsert({ id: session.user.id, studio_name: 'Demo Studio' });
```
Keep this pattern whenever a new authenticated action might run before the trigger fires.

---

## 6. State Store Contracts

### `useGalleryStore` (`src/store/useGalleryStore.ts`)
| Method | Contract |
|---|---|
| `fetchProjectPhotos(projectId)` | Replaces gallery with photos from DB for this project |
| `addOptimisticPhotos(photos)` | Appends temp photos; IDs must start with `optimistic-` |
| `swapOptimisticPhoto(localId, real)` | Mutates optimistic entry to real entry in-place |
| `toggleSelection(id, shift)` | Single click = toggle; shift+click = range select |
| `deleteSelected()` | Optimistic remove from UI → batch DB delete (skips `optimistic-` IDs) |
| `analyzePhotos()` | Calls `/api/analyze` with all photo URLs, merges `aiFlags` back onto photos |

### `useUploadStore` (`src/store/useUploadStore.ts`)
| Method | Contract |
|---|---|
| `addFiles(files)` | Validates type (JPEG/PNG/WebP), generates thumbnails with concurrency=3 |
| `processQueue(projectId)` | Sequential upload loop: Storage (original) → Storage (thumb) → DB insert → swap optimistic |
| `removeUpload(id)` | Removes from queue array only |

---

## 7. Database Schema Summary

Run migrations in filename order from `supabase/migrations/`.

| Table | Key Columns |
|---|---|
| `profiles` | `id` (FK → auth.users), `studio_name` |
| `projects` | `id`, `title`, `studio_id`, `status`, `event_date`, `deleted_at` |
| `photos` | `id`, `project_id`, `storage_path`, `thumbnail_path`, `filename`, `status` |
| `albums` | `id`, `project_id`, `title` |
| `spreads` | `id`, `album_id`, `page_number`, `layout_type`, `background_color` |
| `image_slots` | `id`, `spread_id`, `photo_id`, `z_index` |
| `comments` | `id`, `spread_id`, `body`, `author` |

All tables use RLS. `studio_id = auth.uid()` is the ownership check. `deleted_at IS NULL` filters soft-deleted projects.

---

## 8. Known Issues — Do Not Regress

| Issue | Detail |
|---|---|
| `proof/[id]/page.tsx` references `useCullStore` | This store does not exist. The page should use `useGalleryStore` and fetch from Supabase. **Do not add a `useCullStore` file** — fix the import. |
| `autoLayout.ts` imports `Photo` from `@/store/useCullStore` | Same issue — import `Photo` from `@/store/useGalleryStore` instead. |
| Sidebar "Galleries" and "Settings" links are dead | `/galleries` and `/settings` routes do not exist yet. Do not wire up navigation until the pages are built. |
| Comment submission in `proof/[id]` | Currently only `console.log`s. Must persist to `comments` table in Supabase. |
| `tus-js-client` is installed but unused | Standard upload is used. Only switch to TUS if files exceed Supabase's standard upload size limit. |

---

## 9. Coding Conventions

- **CSS:** Use CSS Modules (`*.module.css`) colocated with the component/page. No global classes except in `globals.css`.
- **Client vs Server components:** Default to Server Components. Add `'use client'` only when you need browser APIs, Zustand, or event handlers.
- **Supabase client selection:**
  - In `'use client'` components → `import { createClient } from '@/utils/supabase/client'`
  - In Server Components / Route Handlers → `import { createClient } from '@/utils/supabase/server'`
- **Params in App Router:** `params` is a `Promise<{...}>` in Next.js 16. Always `use(params)` to resolve it:
  ```tsx
  const resolvedParams = use(params);
  ```
- **Unique IDs on interactive elements:** All buttons and inputs must have unique `id` attributes for testability (e.g., `id="confirm-delete-project"`).
- **No `any` where avoidable:** Define proper interfaces. Existing `any` usages are technical debt — don't add new ones.
- **Error handling:** All async operations must have a `try/catch`. Surface errors to the user via `alert()` for now (until a toast system is built).

---

## 10. What NOT to Build Without Discussion

- **Free-form drag-and-drop layout editor** — out of MVP scope per the product spec.
- **Social media export, slideshow builder** — post-MVP features.
- **Print lab integrations** — v2.
- **Custom domains, white-label galleries** — v2.
- **Your own AI culling model** — use AWS Rekognition or a third-party API.
- **Real-time multiplayer editing** — v2.

---

## 11. MVP Completion Checklist

- [x] Auth (sign up / sign in)
- [x] Projects dashboard (create, list, soft-delete)
- [x] Photo upload pipeline (thumbnail gen, optimistic UI, Storage + DB write)
- [x] Gallery Media Finder (scale slider, multi-select, delete, drag-drop)
- [x] AI quality flagging endpoint (mocked)
- [x] Album Builder (auto-layout, background colors, export to DB)
- [ ] Fix `proof/[id]` to use `useGalleryStore` + Supabase (not `useCullStore`)
- [ ] Fix `autoLayout.ts` stale import
- [ ] Wire comment submission to `comments` DB table
- [ ] Implement "Approve Spread" and "Finalize Book" actions
- [ ] Generate shareable proof link from `/projects/[id]`
- [ ] Hosted online gallery (`/gallery/[id]` public route)
- [ ] Studio settings page (name, logo)
- [ ] Logout button wired up in sidebar
- [ ] Billing / Free+Pro tiers
