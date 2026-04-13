# Albumin

Albumin is a workflow-first white-label album sales app for photographers. The product centers on one path: upload project photos, shortlist the album set, generate a draft version, share a branded proof link, turn the approved package into a manual order, and track fulfillment through delivery.

## Current MVP Shape

- **Projects** are the operational hub for a shoot or wedding.
- **Album inputs** store uploaded source images plus shortlist state and AI quality flags.
- **Draft versions** persist proofable album versions with spread snapshots.
- **Proof links** publish a public client-facing review surface backed by Supabase data.
- **Offers and orders** model manual package selection, payment tracking, and fulfillment handoff.
- **Studio branding** powers the white-label proof experience.

## Workflow

1. Create a project.
2. Upload photos into `album_inputs`.
3. Shortlist the photos that should feed the album.
4. Save a draft version and automatically publish a proof link.
5. Collect comments on `/proof/[slug]`.
6. Create an offer and convert it into a manual order.
7. Advance the order through `payment_pending` → `paid` → `fulfillment_pending` → `shipped` → `delivered`.

## Stack

- Next.js 16 App Router
- React 19
- Supabase Auth, Postgres, Storage, and RLS
- Zustand for upload/input selection state
- AWS Rekognition endpoint for technical photo flags

## Local Setup

1. Install dependencies with `npm install`.
2. Create `.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
AWS_REGION=your_aws_region
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

3. Run `npm run dev`.
4. Apply the Supabase migrations before exercising the new workflow schema.

## What Is Explicitly Deferred

- Hosted gallery replacement as a core MVP surface
- Slideshow builder
- Social export
- Direct print lab API routing
- Full free-form client editing inside proofs

The repo is intentionally optimized for the album proofing and sales workflow, not for a gallery-first product direction.
