# `src/components/` — Shared React Components

Reusable UI components that are used across multiple pages or layouts.

## Directory Structure

| Directory | Component | Purpose |
|-----------|-----------|---------|
| `Upload/` | `UploadProgressTray` | Floating upload status overlay — shows progress bar and completion state |

### `Upload/UploadProgressTray`

A fixed-position tray rendered by the dashboard layout (`src/app/(dashboard)/layout.tsx`). It:

- Subscribes to `useUploadStore` from `src/store/` to read the upload queue.
- Displays a progress bar with `completed / total` counter during active uploads.
- Shows "All uploads complete!" or error counts when the queue drains.
- Prevents accidental page navigation during uploads with a `beforeunload` warning.

| File | Purpose |
|------|---------|
| `UploadProgressTray.tsx` | Component logic and rendering |
| `UploadProgressTray.module.css` | Tray positioning and progress bar styles |

## Connections

- **Consumed by** `src/app/(dashboard)/layout.tsx` — rendered in the dashboard shell so it persists across all project pages.
- **Reads from** `useUploadStore` (`src/store/useUploadStore.ts`) — does not write state, only observes the queue.
