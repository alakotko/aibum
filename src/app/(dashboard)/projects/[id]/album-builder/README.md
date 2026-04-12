# `src/app/(dashboard)/projects/[id]/album-builder/` — Album Builder Redirect

This route previously hosted a standalone Album Builder page. The functionality has been **merged into the Gallery page** (`../gallery/`) as a second tab.

## Files

| File | Purpose |
|------|---------|
| `page.tsx` | Server component that immediately `redirect()`s to `/projects/:id/gallery` |
| `album.module.css` | Legacy styles (no longer rendered; kept for reference) |

## Why It Exists

This stub ensures that any bookmarks, shared links, or in-app deep-links to the old `/album-builder` URL still work — they silently redirect to the unified gallery workspace.
