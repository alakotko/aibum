# `src/app/api/` — Server-Side API Routes

Next.js Route Handlers that run on the server. These endpoints are called by client-side code (stores, pages) via `fetch()`.

## Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/analyze` | `POST` | AI image analysis — sends photo bytes to AWS Rekognition for blur and closed-eye detection |
| `/api/projects/[id]` | — | Reserved project-level API (currently empty directory) |

### `/api/analyze` (Detail)

**Input:** `{ imageUrls: string[] }` — array of public photo URLs to analyze.

**Behavior:**
1. If AWS credentials are configured → fetches each image as raw bytes, sends to Rekognition `DetectFaces` with `Attributes: ['ALL']`, and returns quality flags (Blur, Closed Eyes).
2. If AWS credentials are missing → returns deterministic mock results for development (every 5th photo flagged as blurry, every 7th as closed eyes).

**Output:** `{ results: [{ url, flags: [{ type, confidence }] }], isMock: boolean }`

## Connections

- Called by `useGalleryStore.analyzePhotos()` and by the debounced `scheduleAnalysis()` function in `useUploadStore` (both in `src/store/`).
- Uses AWS SDK (`@aws-sdk/client-rekognition`) — credentials from environment variables.
- No Supabase dependency — operates purely on public image URLs.
