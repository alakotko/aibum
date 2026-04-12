# `supabase/` — Database Schema & Migrations

Contains SQL migration files that define the Supabase PostgreSQL schema. These are applied in order to set up the database for the application.

## Migrations

| File | Purpose |
|------|---------|
| `20260406000000_init.sql` | **Foundation** — `profiles` table (linked to `auth.users`), `projects` table, `handle_new_user` trigger, and all RLS policies for ownership-based access. |
| `20260406000001_photos.sql` | **Photos** — `photos` table with project FK, Supabase Storage bucket (`photos`) creation, and RLS policies for owner read/write and public read. |
| `20260406000002_albums.sql` | **Albums** — `albums`, `spreads`, and `image_slots` tables for persisting album layouts. Full RLS chain verified through `projects → albums → spreads → slots`. |
| `20260406000003_comments.sql` | **Proofing** — `comments` table on spreads for client feedback. Public insert allowed (for shareable proof links). Adds `status` column to `albums` (draft/review/approved). |
| `20260406000004_photos_delete_policy.sql` | Adds missing `DELETE` RLS policy for the `photos` table. |
| `20260406000005_photos_thumbnail_path.sql` | Adds `thumbnail_path` column to `photos` for storing WebP thumbnail URLs. |
| `20260410000000_projects_soft_delete.sql` | **Soft delete** — Adds `deleted_at` column to `projects`, updates SELECT policy to hide deleted rows, creates `soft_delete_project()` SECURITY DEFINER function. |

## Entity Relationship

```
auth.users
  └── profiles (1:1)
       └── projects (1:many)
            ├── photos (1:many)
            └── albums (1:many)
                 └── spreads (1:many)
                      ├── image_slots (1:many) → photos
                      └── comments (1:many)
```

## Connections

- Tables are accessed by the app via Supabase client libraries in `src/utils/supabase/`.
- RLS policies enforce multi-tenant isolation — each studio owner can only access their own data.
- The `soft_delete_project` RPC is called from the projects dashboard page (`src/app/(dashboard)/projects/page.tsx`).
