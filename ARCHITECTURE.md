# Albumin Architecture

## Summary

Albumin is structured around a workflow-first project model:

`projects -> album_inputs -> album_versions -> proof_links -> offers -> orders`

The application keeps upload and curation interactions client-side where responsiveness matters, and relies on Supabase tables plus RLS for durable workflow state.

## Runtime Structure

### App Router

- `src/app/(dashboard)/projects` lists projects and opens the workflow workspace.
- `src/app/(dashboard)/projects/[id]` is the core project surface with `Photos`, `Drafts`, `Proof`, `Offers`, and `Orders` tabs.
- `src/app/(dashboard)/orders` aggregates studio orders across projects.
- `src/app/(dashboard)/branding` manages white-label proof identity.
- `src/app/proof/[id]` is the public proof page loaded by proof-link slug.
- `src/app/api/analyze` batches AWS Rekognition-based photo analysis.

### Client State

- `useUploadStore` manages optimistic upload queue state and storage writes.
- `useGalleryStore` now acts as the project input store for `album_inputs`, selection state, and AI flags.
- Draft spreads are generated client-side with a deterministic template engine and persisted only when the user saves a version.

### Supabase

- **Auth**: studio owner sign-in and session refresh via `proxy.ts`.
- **Storage**: uploaded images and generated thumbnails in the `photos` bucket.
- **Postgres**: workflow entities for proofing, offers, orders, and branding.
- **RLS**: every new workflow table is scoped to studio ownership, with narrow public access for active proof links and proof comments.

## Data Model

### Core entities

- `projects`: top-level shoot/work item plus overall workflow status
- `clients`: project-level client metadata
- `album_inputs`: uploaded photos, shortlist state, and AI flags
- `selection_sets`: named sets of shortlisted inputs
- `album_versions`: persisted draft/proof versions
- `version_spreads` and `version_spread_images`: immutable spread snapshots for a saved version
- `proof_links`: public tokenized proof access
- `proof_comments`: client feedback tied to proof links and optional spreads
- `offers` and `offer_items`: manual package proposals
- `orders` and `order_items`: manual payment/fulfillment tracking
- `studio_branding`: white-label studio presentation

### Workflow statuses

Projects and downstream entities align on:

- `draft`
- `client_review`
- `changes_requested`
- `approved`
- `payment_pending`
- `paid`
- `fulfillment_pending`
- `shipped`
- `delivered`

## Main Flows

### 1. Upload and shortlist

1. The user uploads files in the `Photos` tab.
2. `useUploadStore` writes originals and thumbnails to storage.
3. The app inserts `album_inputs` rows and swaps optimistic items with persisted records.
4. The user marks inputs as `shortlisted`, `excluded`, or `unreviewed`.

### 2. Save draft and publish proof

1. The user generates a spread layout from shortlisted inputs.
2. Saving a draft creates a new `album_version`.
3. The app snapshots spreads into `version_spreads` and `version_spread_images`, including template metadata and deterministic spread keys.
4. A `proof_link` is created immediately for the saved version.
5. The project moves into `client_review`.

### 3. Convert approval into revenue operations

1. The studio creates an `offer` after proof review.
2. The offer can be converted into an `order`.
3. The order is advanced manually through payment and fulfillment states.
4. Project status is updated to match the order lifecycle.

## Notes

- The old gallery-first prototype is no longer the design center.
- Remote Google font fetching was removed from the root layout so local builds work in restricted environments.
- Next.js 16 App Router guidance in `node_modules/next/dist/docs/` should be treated as the source of truth for file conventions and server/client boundaries.
