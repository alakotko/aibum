# `public/` — Static Assets

Static files served directly by Next.js at the root URL path. These are not processed by the build pipeline.

## Files

| File | Purpose |
|------|---------|
| `favicon.ico` | Browser tab icon (also referenced by `src/app/favicon.ico` in the App Router) |
| `file.svg` | Default Next.js icon asset |
| `globe.svg` | Default Next.js icon asset |
| `next.svg` | Next.js logo |
| `vercel.svg` | Vercel logo |
| `window.svg` | Default Next.js icon asset |

## Notes

- Most of these are default assets from the `create-next-app` scaffold and are not actively used by the application.
- User-uploaded photos are stored in **Supabase Storage** (not here) — see `src/store/useUploadStore.ts`.
