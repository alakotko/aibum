# `src/app/proof/` — Client Proofing

Public-facing album proofing page that clients (non-authenticated users) use to review and approve album spreads.

## Route

`/proof/[id]` — Dynamic route where `[id]` is intended to be a project or album identifier.

## Files (`[id]/`)

| File | Purpose |
|------|---------|
| `page.tsx` | Client component — paginated spread viewer with comment sidebar |
| `proof.module.css` | Proofing page styles — viewport, navigation, comment panel |

## Features

- **Spread Navigation** — Previous / Next buttons to paginate through album spreads.
- **Comment Sidebar** — Text input for clients to leave feedback on individual spreads.
- **Approve / Finalize buttons** — UI-ready buttons for spread approval and book finalization (currently stubbed).

## Current Limitations (MVP)

- Pulls photos from a Zustand store (`useCullStore`) rather than fetching from Supabase by project ID. This means the proofing page only works while the photographer's browser session is active.
- Comments are logged to console and shown via `alert()` — not yet persisted to the `comments` database table.

## Connections

- Uses `src/utils/autoLayout.ts` to generate spread layouts from accepted photos.
- References `useCullStore` from `src/store/` (⚠️ appears to reference an older store name — should be migrated to `useGalleryStore`).
- Does **not** require authentication — designed to be shareable via URL.
