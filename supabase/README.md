# `supabase/`

Supabase migrations define the workflow foundation for Albumin.

## Current Model

The active ownership chain is:

`profiles -> projects -> album_inputs / album_versions / offers / orders`

Public proofing hangs off:

`album_versions -> proof_links -> proof_comments`

## Migration Highlights

| File | Purpose |
|------|---------|
| `20260406000000_init.sql` | Creates `profiles`, `projects`, and ownership-based RLS. |
| `20260406000001_photos.sql` | Creates the `photos` storage-oriented table and bucket. |
| `20260406000002_albums.sql` | Original album prototype tables. Still present in migration history, but no longer the design center. |
| `20260406000003_comments.sql` | Original proofing prototype tables. Superseded by `proof_links` and `proof_comments`. |
| `20260410000000_projects_soft_delete.sql` | Adds project soft delete support used by the dashboard. |
| `20260413193000_workflow_foundation.sql` | Introduces `clients`, `album_inputs`, `selection_sets`, `album_versions`, `version_spreads`, `version_spread_images`, `proof_links`, `proof_comments`, `offers`, `offer_items`, `orders`, `order_items`, `studio_branding`, and the new workflow status set. |

## RLS Expectations

- Studio owners can fully manage their own projects and all child workflow entities.
- Public users can only read active proof-linked data and insert proof comments.
- Offers, orders, and branding remain studio-scoped only.

## App Connections

- Uploads and shortlist state write to `album_inputs`.
- Draft saves write to `album_versions`, `version_spreads`, and `version_spread_images`, with `version_spreads` carrying template metadata and deterministic spread keys.
- Public proof pages load by `proof_links.slug`.
- The dashboard and project workspace read `offers`, `orders`, and `studio_branding`.
