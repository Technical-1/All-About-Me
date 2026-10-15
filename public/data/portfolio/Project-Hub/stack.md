# Technology Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Desktop shell | Tauri | 2 (`tauri = "2"`, lockfile 2.10.2) | Native window, a Rust backend, and a much smaller bundle than Electron |
| Language (backend) | Rust | edition 2021 | Safe concurrency for parallel git work, process supervision, and async streaming |
| Language (frontend) | TypeScript | ~5.8.3 | Typed IPC contracts between the UI and Rust commands |
| UI library | React | ^19.1.0 (lockfile 19.2.4) | Familiar component model for a dense, stateful UI |
| Database | SQLite via rusqlite (bundled) | 0.31 | Local-first and needs no server. WAL mode lets the MCP server share the file |
| MCP server runtime | Node.js + `@modelcontextprotocol/sdk` | ^1.0.0 (lockfile 1.26.0) | The reference SDK for stdio MCP servers |

## Frontend

- **Framework**: React 19
- **Routing**: TanStack Router 1.158 (file-based; `tsr generate` writes `src/routeTree.gen.ts`)
- **State management**: TanStack Query 5.90 for IPC-backed server state, with `keepPreviousData` on the project list. Today widgets poll every 60s and the running-servers list every 3s. Sync timing is shared through a small React context (`src/lib/sync-context.tsx`).
- **Live updates**: Tauri events (`fleet-agent-update`, `investigation-progress`) received with `@tauri-apps/api/event`
- **Styling**: Tailwind CSS 4.1 through `@tailwindcss/vite`, with the content scanner limited to `src/` (`@import "tailwindcss" source(".")`)
- **Build tool**: Vite 7 on a fixed port, 1421 (`strictPort`)
- **Icons / utilities**: lucide-react, clsx, date-fns 4

## Backend

- **Runtime**: Rust + tokio 1 (`full`). Blocking git and CLI work runs in `spawn_blocking`, and Fleet sessions run on `tokio::process`.
- **Framework**: Tauri 2 commands and events, 80 commands registered in `src-tauri/src/lib.rs`
- **API style**: Tauri `invoke` (typed wrappers in `src/lib/tauri.ts`)
- **Authentication**: GitHub OAuth with several accounts. It uses a localhost callback on :8765 with CSRF state, and stores accounts in `~/.project-hub-accounts.json` (mode `0600`).
- **HTTP client**: reqwest 0.12 with 10s connect / 30s total timeouts
- **Tauri plugins**: `opener`, `deep-link` (the `project-hub://` scheme), and `single-instance`, which is registered first so only one process writes to the database

## MCP Server (`mcp-server/`)

- **Transport**: stdio (`StdioServerTransport`)
- **Database driver**: better-sqlite3 ^11.0.0 (lockfile 11.10.0), opened with WAL journaling and foreign keys on
- **Build**: `tsc` to `dist/`, exposed as the `project-hub-mcp` bin
- **DB location**: `PROJECT_HUB_DB`, or by default the macOS app-data path for `com.project-hub.app`

## Infrastructure

- **Hosting**: none. This is a local desktop app.
- **CI/CD**: none. Changes are checked locally with `cargo test`, `cargo clippy`, and `npm run build` (`tsc && vite build`).
- **Packaging**: `tauri build` with `bundle.targets = "all"`
- **Monitoring**: none. Diagnostic `debug_log!` output is compiled out of release builds, while real errors still go to stderr.

## Development Tools

- **Package managers**: npm (frontend and MCP server), Cargo (backend)
- **Linting**: `cargo clippy`
- **Formatting**: `cargo fmt`
- **Testing**: `cargo test` runs about 180 Rust unit and integration tests, most against in-memory or temp-dir SQLite, covering migrations, capture, Today queries, the radar, Fleet helpers, scheduler logic, the OAuth account store, git helpers, and process validation. Vitest 3 is installed (`npm test`), but there are no frontend test files yet.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@tauri-apps/api` | Frontend IPC (`invoke`) and event subscriptions |
| `@tanstack/react-router` | File-based routing |
| `@tanstack/react-query` | Caching, polling, and invalidation of IPC-backed data |
| `tailwindcss` / `@tailwindcss/vite` | Styling with the v4 scanner limited to `src/` |
| `rusqlite` (bundled) | Embedded SQLite for the app |
| `reqwest` | GitHub REST client |
| `tokio` | Async runtime, streaming child processes, watch channels for cancelling Fleet sessions |
| `chrono` | Timestamps, local-time scheduling, and work-log date math |
| `tauri-plugin-single-instance` | Focuses the existing window instead of starting a second database writer |
| `walkdir` | Recursive `.portfolio/` copy when archiving and restoring |
| `rfd` | Native folder picker for clone directory and Link Local Path |
| `@modelcontextprotocol/sdk` / `better-sqlite3` | MCP server protocol and database access |
