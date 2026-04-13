# MVP Features: Albumin White-Label Album Sales

## North Star

Albumin is not a gallery-first product. The MVP is a workflow tool for wedding and portrait photographers that moves a project from uploaded photos to approved album order:

`photo upload/import -> photographer review -> draft version -> white-label proof -> package selection -> manual payment tracking -> fulfillment handoff`

## Personas

- **Photographer**: owns the project, curates inputs, saves drafts, sends proofs, builds offers, and manages order status.
- **Couple / client**: opens a branded proof link, reviews spreads, and leaves feedback.
- **Operator**: manually tracks payment and fulfillment once the package is approved.

## Core MVP Modules

### 1. Project and input management

- Create projects for events or shoots.
- Upload source files with optimistic UI and background processing.
- Generate thumbnails and AI quality flags.
- Mark uploaded inputs as `shortlisted`, `excluded`, or `unreviewed`.

### 2. Draft versioning

- Generate an auto-layout from shortlisted inputs.
- Persist the result as an `album_version`.
- Snapshot spreads and images so each saved version is proofable and auditable.

### 3. White-label proofing

- Create a public proof link when a draft version is saved.
- Show studio branding on the proof page.
- Allow clients to leave comments tied to a proof link and spread.
- Track project state through `client_review`, `changes_requested`, and `approved`.

### 4. Commercial workflow

- Create offers with line items and package totals.
- Convert offers into manual orders.
- Track manual payment and fulfillment with statuses:
  - `payment_pending`
  - `paid`
  - `fulfillment_pending`
  - `shipped`
  - `delivered`

### 5. Branding

- Maintain studio-level branding for proof surfaces:
  - studio name
  - logo URL
  - primary and accent colors
  - support email
  - proof headline and subheadline

## Success Metrics

- **Album attach rate**: how many active projects reach a saved draft and proof link.
- **Approval speed**: time from first proof published to approved status.
- **Order conversion**: share of approved projects that become manual orders.
- **Operational visibility**: share of active projects with an explicit workflow status instead of ad hoc tracking.

## Explicit Non-MVP Scope

These items are intentionally deferred so the product stays focused:

- Hosted gallery replacement as a primary product surface
- Slideshow builder
- Social media export tooling
- Direct multi-lab print API routing
- Full free-form client editing inside proofs
- Online checkout integration

## Build Order

1. Workflow schema and RLS foundation
2. Shared workflow statuses and type contracts
3. Workflow-first dashboard and project navigation
4. Public proof page backed by proof links
5. Offer and order tracking
6. Documentation and scope cleanup

## Product Principle

The MVP should look and behave like a tool that helps photographers close album sales faster, not like a prototype for browsing or publishing galleries.
