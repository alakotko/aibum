# `src/` — Application Source Code

All application logic lives here. This is the root of the Next.js App Router source tree.

## Directory Structure

| Directory      | Purpose |
|----------------|---------|
| `app/`         | Next.js App Router — pages, layouts, API routes, and route-level styles |
| `components/`  | Shared React components reused across multiple pages |
| `store/`       | Zustand state management stores for client-side UI state |
| `utils/`       | Pure helper functions and service-layer abstractions (Supabase clients, image processing) |

## Standalone Files

| File        | Purpose |
|-------------|---------|
| `proxy.ts`  | Supabase Auth middleware — refreshes user sessions on every request by intercepting cookies and calling `getUser()`. Exports `config.matcher` for Next.js route matching. |

## How It All Connects

```
app/ (pages & API routes)
 ├── imports components from  → components/
 ├── reads/writes state via   → store/
 ├── calls helper functions   → utils/
 └── server-side auth via     → proxy.ts
```

Pages in `app/` render UI using shared `components/`, consume global state from `store/` (Zustand), and call pure functions from `utils/` for tasks like Supabase client creation or thumbnail generation. The `proxy.ts` middleware runs on every navigable request to keep the Supabase auth session refreshed.
