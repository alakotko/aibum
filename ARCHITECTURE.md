# Albumin — Project Architecture Overview

> AI-powered photo album web app for professional photographers. Built with Next.js 16, Supabase, Zustand, and AWS Rekognition.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                          │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │  Zustand      │   │  React Pages │   │  Shared Components     │  │
│  │  Stores       │◄──┤  (App Router)│──►│  (UploadProgressTray)  │  │
│  │              │   │              │   │                        │  │
│  │ GalleryStore │   │ /login       │   └────────────────────────┘  │
│  │ UploadStore  │   │ /projects    │                                │
│  └──────┬───────┘   │ /gallery     │                                │
│         │           │ /proof       │                                │
│         ▼           └──────┬───────┘                                │
│  ┌──────────────┐          │                                        │
│  │  Utils        │          │                                        │
│  │ (thumbnails,  │          │                                        │
│  │  autoLayout)  │          │                                        │
│  └──────────────┘          │                                        │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ fetch()
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER (Next.js API)                        │
│                                                                     │
│  ┌──────────────┐   ┌──────────────────────────────┐               │
│  │ /api/analyze  │   │  proxy.ts (Auth Middleware)   │               │
│  │ AWS Rekognit. │   │  Session refresh on each req  │               │
│  └──────────────┘   └──────────────────────────────┘               │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SUPABASE (Backend-as-a-Service)               │
│                                                                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────────────────┐ │
│  │   Auth    │  │  Storage   │  │  PostgreSQL (RLS-protected)     │ │
│  │ (email/   │  │ (photos    │  │                                  │ │
│  │  password)│  │  bucket)   │  │  profiles → projects → photos   │ │
│  └──────────┘  └───────────┘  │  projects → albums → spreads     │ │
│                                │  spreads → image_slots, comments │ │
│                                └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Map

```
albuminbrowser/
├── public/               Static assets (SVGs, favicon) — mostly unused scaffolding
├── src/
│   ├── app/              Next.js App Router — all pages, layouts, and API routes
│   │   ├── (dashboard)/  Auth-protected route group with sidebar layout
│   │   │   └── projects/ Project listing + per-project gallery workspace
│   │   ├── api/          Server endpoints (AI analysis)
│   │   ├── login/        Authentication page
│   │   └── proof/        Public client proofing page
│   ├── components/       Shared React components (UploadProgressTray)
│   ├── store/            Zustand stores (gallery state, upload pipeline)
│   ├── utils/            Helpers (Supabase clients, image processing, auto-layout)
│   └── proxy.ts          Auth middleware for session refresh
├── supabase/
│   └── migrations/       SQL migrations defining the full DB schema + RLS
├── AGENTS.md             AI agent instructions for Next.js conventions
├── CLAUDE.md             Project context for AI pair programming
└── package.json          Dependencies: Next.js 16, React 19, Zustand, Supabase, AWS SDK
```

> Each directory contains its own `README.md` with detailed descriptions and connection maps.

---

## Data Flow

### 1. Upload Pipeline

```
User drops files
  → useUploadStore.addFiles()
    → generateThumbnail() (canvas resize → WebP data URL)
    → useGalleryStore.addOptimisticPhotos() (instant preview)
  → useUploadStore.processQueue()
    → Supabase Storage upload (full image + WebP thumbnail)
    → Supabase DB insert (photos table)
    → useGalleryStore.swapOptimisticPhoto() (replace blob with real URL)
    → scheduleAnalysis() (debounced batch → /api/analyze)
```

### 2. AI Analysis

```
/api/analyze receives image URLs
  → Fetches raw bytes from public URLs
  → AWS Rekognition DetectFaces (ALL attributes)
  → Returns quality flags: Blur (sharpness < 60), Closed Eyes
  → useGalleryStore updates photo.aiFlags
  → Gallery UI renders ⚠️ warning badges
```

### 3. Album Export

```
Gallery "Album Builder" tab
  → generateAutoLayout() chunks photos into spreads
  → User customizes (re-shuffle, background colors)
  → "Export for Proofing" button
    → Supabase inserts: album → spreads → image_slots
  → Client receives proof link (/proof/:id)
    → Paginated spread viewer + comment sidebar
```

---

## Database Schema (ERD)

```
auth.users
  └─ profiles (1:1, cascade delete)
       └─ projects (1:many, cascade delete)
            ├─ photos (1:many, cascade delete)
            │    ↑
            │    └── image_slots.photo_id (FK)
            │
            └─ albums (1:many, cascade delete)
                 └─ spreads (1:many, cascade delete)
                      ├─ image_slots (1:many, cascade delete)
                      └─ comments (1:many, cascade delete)
```

All tables use **Row Level Security (RLS)** to enforce multi-tenant isolation — each authenticated user can only access their own studio's data. The `comments` table is the exception: it allows public inserts for the client proofing workflow.

---

## Key Technology Decisions

| Decision | Rationale |
|----------|-----------|
| **Zustand** over Redux/Context | Minimal boilerplate, direct inter-store calls via `getState()`, no provider wrapping |
| **Optimistic UI** for uploads | Users see thumbnails instantly — no waiting for upload + DB round-trip |
| **Client-side thumbnails** | Canvas-resized WebP prevents loading 1000+ full-res images into browser memory |
| **Dual storage** (full + thumb) | Avoids expensive CDN image transforms — free tier friendly |
| **Soft delete** for projects | Uses a SECURITY DEFINER function to avoid PostgREST RETURNING+RLS conflicts |
| **Route group** `(dashboard)` | Shared sidebar layout without polluting the URL path |
| **Mock Rekognition** fallback | Allows full development flow without AWS costs during feature development |

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous JWT key
AWS_REGION=                     # AWS region for Rekognition (default: us-east-1)
AWS_ACCESS_KEY_ID=              # AWS IAM access key
AWS_SECRET_ACCESS_KEY=          # AWS IAM secret key
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
