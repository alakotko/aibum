# `src/app/(dashboard)/` — Authenticated Dashboard Shell

This is a Next.js **route group** (the parentheses mean `(dashboard)` does not appear in the URL). It wraps all pages that require the studio owner to be logged in.

## Layout

`layout.tsx` provides the persistent dashboard chrome:

- **Sidebar** — Brand name ("Album AI"), navigation links (Projects, Galleries, Settings), and a Log out button.
- **Main content area** — Renders the active child page.
- **`UploadProgressTray`** — A floating overlay (from `src/components/Upload/`) that shows real-time upload progress across all dashboard pages.

## Child Routes

| Directory | URL | Description |
|-----------|-----|-------------|
| `projects/` | `/projects` | Studio project listing, creation, and deletion |
| `projects/[id]/gallery/` | `/projects/:id/gallery` | Photo gallery grid + Album Builder (unified workspace) |
| `projects/[id]/album-builder/` | `/projects/:id/album-builder` | Redirect stub → forwards to gallery page |

## Connections

- Imports `UploadProgressTray` from `src/components/Upload/` (a shared component).
- Layout styles defined in `layout.module.css`.
- Does **not** directly import stores or utils — those are consumed by child pages.
