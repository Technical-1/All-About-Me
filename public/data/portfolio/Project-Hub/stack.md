# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Desktop shell | Tauri | 2 | Native window with a Rust core and a web UI, and a much smaller bundle than Electron |
| Language (core) | Rust | edition 2021 | Safe concurrency for git, child processes and background tasks |
| Language (UI) | TypeScript | ~5.8 | Typed contract across the IPC boundary |
| UI library | React | 19 | Familiar component model; fast iteration on a UI that changed a lot |
| Database | SQLite via rusqlite (bundled) | 0.31 | One local file, no server, real SQL for the Today aggregations |
| MCP server runtime | Node.js | not pinned | Runs the MCP TypeScript SDK; kept as a separate package from the app |

## Frontend

- **Framework**: React 19
- **Routing**: TanStack Router 1.x, file-based; the route tree is generated with `tsr generate`
- **State Management**: TanStack Query 5.x for everything that comes from the Rust core, with interval polling for views that other processes can change
- **Styling**: Tailwind CSS v4 through `@tailwindcss/vite`, with content scanning scoped to `src/`
- **Build Tool**: Vite 7
- **Icons and utilities**: lucide-react, clsx, date-fns

## Backend

- **Runtime**: Rust with tokio; long-running work goes to `spawn_blocking`
- **Framework**: Tauri 2 commands, with events for streaming updates
- **API Style**: Tauri `invoke` calls, wrapped one-to-one in `src/lib/tauri.ts`
- **Auth**: GitHub OAuth web flow with a localhost callback on port 8765 and a `state` check; multiple accounts stored in `~/.project-hub-accounts.json` with owner-only permissions (plain JSON, not the system keychain)
- **HTTP client**: reqwest 0.12 with connect and request timeouts; rate-limit and expired-token responses are detected and surfaced, not retried

## Infrastructure

- **Hosting**: None. It is a local desktop app
- **CI/CD**: None
- **Monitoring**: None
- **Packaging**: Tauri bundler configured for all targets; no code signing, notarization or updater is set up, so the app currently runs as a development build

## Development Tools

- **Package Manager**: npm for the UI and the MCP server, Cargo for the core
- **Linting**: `cargo clippy`; no JavaScript linter is configured
- **Formatting**: `cargo fmt`; no JavaScript formatter is configured
- **Testing**: `cargo test` for Rust unit tests. The UI and the MCP server have no tests; Vitest is installed but there are no test files

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `tauri` | Window, IPC, app-data paths, event emission |
| `tauri-plugin-single-instance` | Keeps a second launch from opening a second writer on the database |
| `tauri-plugin-opener` | Opens the browser for OAuth and external links |
| `rusqlite` (bundled) | Embedded SQLite |
| `reqwest` | GitHub REST and OAuth calls |
| `tokio` | Async runtime, child-process streaming for Fleet and investigations |
| `chrono` | Timestamps and the scheduler's local-time decisions |
| `walkdir` | Copying `.portfolio/` directories on archive and restore |
| `rfd` | Native folder picker |
| `dotenvy` | Loads the OAuth client id and secret from `.env` in development |
| `@tanstack/react-router` | File-based routing |
| `@tanstack/react-query` | Data fetching, caching, invalidation, polling |
| `tailwindcss` / `@tailwindcss/vite` | Styling |
| `@modelcontextprotocol/sdk` | MCP server protocol and stdio transport |
| `better-sqlite3` | The MCP server's SQLite driver (a native addon) |

`tauri-plugin-deep-link` is also registered, with a `project-hub://` scheme, but sign-in uses the localhost callback and nothing sends a deep link.
