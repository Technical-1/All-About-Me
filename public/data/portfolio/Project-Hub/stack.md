# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Desktop shell | Tauri | 2 | Native window + Rust backend with a web UI, small bundle |
| Language (backend) | Rust | edition 2021 | Safe, fast command layer and git/process work |
| Language (frontend) | TypeScript | ~5.8 | Type-safe UI and IPC contracts |
| UI library | React | 19 | Component model for the desktop UI |
| Database | SQLite (rusqlite, bundled) | 0.31 | Local-first persistence, no server |

## Frontend

- **Framework**: React 19
- **Routing**: TanStack Router 1.x (file-based, route tree generated via `tsr generate`)
- **State Management**: TanStack Query 5.x for server/IPC state + cache invalidation
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`), content scanning scoped to `src/`
- **Build Tool**: Vite 7
- **Icons / utils**: lucide-react, clsx, date-fns

## Backend

- **Runtime**: Rust + tokio (async, `spawn_blocking` for long work)
- **Framework**: Tauri 2 command/IPC model
- **API Style**: Tauri `invoke` commands (typed wrappers in `src/lib/tauri.ts`)
- **Authentication**: GitHub OAuth (localhost callback :8765, CSRF state, token file `~/.project-hub-token`)
- **HTTP client**: reqwest 0.12 (GitHub API, rate-limited)

## Infrastructure

- **Hosting**: N/A — local desktop app
- **CI/CD**: N/A (local `cargo test` / `tsc` / `vite build` gate changes)
- **Monitoring**: N/A

## Development Tools

- **Package Manager**: npm (frontend), Cargo (backend)
- **Linting**: cargo clippy
- **Formatting**: cargo fmt
- **Testing**: cargo test (Rust unit/integration suite); Vitest configured for frontend

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@tauri-apps/api` | Frontend → Rust IPC bridge |
| `@tanstack/react-router` | File-based routing |
| `@tanstack/react-query` | Data fetching, caching, invalidation |
| `tailwindcss` / `@tailwindcss/vite` | Styling (v4 Oxide scanner, scoped to `src/`) |
| `rusqlite` (bundled) | Embedded SQLite |
| `reqwest` | GitHub REST API client |
| `tokio` | Async runtime for backend commands |
| `chrono` | Timestamps / date math in work-log aggregations |
| `tauri-plugin-deep-link` | OAuth deep-link handling |
| `rfd` | Native file/directory pickers |
