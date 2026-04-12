# `src/app/(dashboard)/projects/` — Studio Projects

This directory handles the project management surface of the app.

## Pages

### `page.tsx` — Projects Dashboard (`/projects`)

The main landing page for authenticated studio owners. Features:

- **Project listing** — Fetches all projects from Supabase `projects` table, ordered by creation date.
- **Create project** — Inserts a new row in `projects` (with a profile upsert safety net) and navigates to its gallery.
- **Delete project** — Soft-deletes via the `soft_delete_project` Supabase RPC function with a confirmation modal.
- **Auth guard** — Redirects to `/login` if no active session is detected.

### `[id]/` — Dynamic Project Routes

| Subdirectory | URL | Description |
|--------------|-----|-------------|
| `gallery/` | `/projects/:id/gallery` | The core workspace — photo grid + album builder tabs |
| `album-builder/` | `/projects/:id/album-builder` | Legacy redirect to the gallery page |

## Connections

- Uses `src/utils/supabase/client.ts` for all Supabase browser calls (auth, data, RPC).
- Links to gallery via Next.js `<Link>` and `router.push()`.
- Styled by `projects.module.css`.
