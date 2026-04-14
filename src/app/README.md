# `src/app/` — Next.js App Router

This directory defines all pages, layouts, and server-side API routes using the Next.js App Router convention. Each subdirectory maps to a URL path segment.

## Route Map

| Path | Route | Description |
|------|-------|-------------|
| `/` | `page.tsx` | Root landing page (minimal redirect/placeholder) |
| `/login` | `login/page.tsx` | Authentication page — email/password sign-in and sign-up via Supabase Auth |
| `/projects` | `(dashboard)/projects/page.tsx` | Studio dashboard — lists all projects, create & soft-delete projects |
| `/projects/[id]/gallery` | `(dashboard)/projects/[id]/gallery/page.tsx` | **Core workspace** — photo gallery grid + integrated Album Builder tab |
| `/projects/[id]/album-builder` | `(dashboard)/projects/[id]/album-builder/page.tsx` | Legacy redirect → sends users to the unified gallery page |
| `/proof/[token]` | `proof/[token]/page.tsx` | Public token-backed proof page — loads persisted spreads, branding, and comments |
| `/api/analyze` | `api/analyze/route.ts` | Server-side API — runs AWS Rekognition (or mock) for blur/closed-eye detection |
| `/api/projects/[id]` | `api/projects/[id]/` | Reserved project-level API (currently empty) |

## Layouts

- **`layout.tsx`** (root) — Sets HTML shell, Google Fonts (Geist), and global CSS.
- **`(dashboard)/layout.tsx`** — Wraps all authenticated pages with sidebar navigation and the `UploadProgressTray` overlay component.

## Standalone Files

| File | Purpose |
|------|---------|
| `globals.css` | Global CSS reset and custom properties |
| `page.module.css` | Root page styles |
| `favicon.ico` | App favicon |

## Connections

- **`(dashboard)/`** route group uses the shared `UploadProgressTray` component from `src/components/Upload/`.
- Gallery and projects pages consume `useGalleryStore` and `useUploadStore` from `src/store/`.
- All authenticated pages rely on `src/utils/supabase/client.ts` for browser-side Supabase calls.
- API routes use `src/utils/supabase/server.ts` and AWS SDK for server-side operations.
