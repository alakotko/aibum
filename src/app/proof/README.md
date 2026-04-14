# `src/app/proof/` — Client Proofing

Public-facing album proofing page that clients (non-authenticated users) use to review and approve album spreads.

## Route

`/proof/[token]` — Dynamic route where `[token]` is the opaque proof-link credential stored in `proof_links.slug`.

## Files (`[token]/`)

| File | Purpose |
|------|---------|
| `page.tsx` | Server Component entry — validates the token and loads persisted proof data |
| `proof-data.ts` | Server-only proof loader for `proof_links`, versions, spreads, branding, and comments |
| `ProofViewer.tsx` | Client component — paginated spread viewer with comment sidebar |
| `proof.module.css` | Proofing page styles — viewport, navigation, comment panel |

## Features

- **Token-backed access** — Proof pages load from `proof_links` and reject expired, archived, or non-public links.
- **Spread Navigation** — Previous / Next buttons to paginate through album spreads.
- **Comment Sidebar** — Text input for clients to leave feedback on individual spreads via `proof_comments`.
- **White-label proof surface** — Proof styling and copy load from `studio_branding`.

## Connections

- Uses `src/utils/supabase/server.ts` for token validation and proof loading.
- Uses `src/utils/supabase/client.ts` for public comment insertion.
- Does **not** require authentication — designed to be shareable via URL.
