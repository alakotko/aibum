# `src/app/login/` — Authentication Page

Handles studio owner sign-in and sign-up via Supabase Auth.

## Files

| File | Purpose |
|------|---------|
| `page.tsx` | Client component — email/password form with sign-in / sign-up toggle |
| `login.module.css` | Login page styles |

## Behavior

- **Sign Up** — Creates a Supabase Auth user with `studio_name` in user metadata. The `handle_new_user` database trigger auto-creates a matching `profiles` row.
- **Sign In** — Authenticates via `signInWithPassword()` and redirects to `/projects`.
- **Error handling** — Displays Supabase error messages inline.

## Connections

- Uses `src/utils/supabase/client.ts` for browser-side Supabase Auth calls.
- On successful sign-in, navigates to `/projects` (the dashboard).
- Does **not** use any Zustand stores — standalone auth flow.
