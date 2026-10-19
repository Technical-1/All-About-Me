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
- **Styling**: Tailwind CSS v4 through `@tailwindcss/vite`, with content scanning scoped to `src/`; design tokens (`src/theme/tokens.css`) exposed as role utilities, light and dark
- **Components**: own primitives in `src/ui/` on Radix UI; cmdk for the ⌘K palette
- **Build Tool**: Vite 7
- **Icons and utilities**: lucide-react, clsx, date-fns

## Backend

- **Runtime**: Rust with tokio; long-running work goes to `spawn_blocking`
- **Framework**: Tauri 2 commands, with events for streaming updates
- **API Style**: Tauri `invoke` calls, wrapped one-to-one in `src/lib/tauri.ts`
- **Auth**: GitHub OAuth device flow with a public, compiled-in client id (no client secret, no local listener); multiple accounts, with tokens in the macOS Keychain and app-run git authenticated through the app binary acting as a git credential helper
- **HTTP client**: reqwest 0.12 with connect and request timeouts; rate-limit and expired-token responses are detected and surfaced, not retried

## Infrastructure

- **Hosting**: None. It is a local desktop app
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`): Rust tests, clippy, fmt and `cargo audit` on macOS; type check, build, Vitest and `npm audit` for the front end; build and tests for the MCP server. No release pipeline yet
- **Monitoring**: None
- **Packaging**: Tauri bundler configured for all targets; no code signing, notarization or updater is set up, so the app currently runs as a development build

## Development Tools

- **Package Manager**: npm for the UI and the MCP server, Cargo for the core
- **Linting**: `cargo clippy`; no JavaScript linter is configured
- **Formatting**: `cargo fmt`; no JavaScript formatter is configured
- **Testing**: `cargo test` for the Rust core (including fixture-driven GitHub and fake-agent tests); Vitest with happy-dom and Testing Library for the UI; `node --test` for the MCP server's schema check

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `tauri` | Window, IPC, app-data paths, event emission |
| `tauri-plugin-single-instance` | Keeps a second launch from opening a second writer on the database |
| `tauri-plugin-opener` | Opens GitHub's device-code page and external links |
| `rusqlite` (bundled) | Embedded SQLite |
| `reqwest` | GitHub REST and device-flow calls |
| `tokio` | Async runtime, child-process streaming for Fleet and investigations |
| `chrono` | Timestamps and the scheduler's local-time decisions |
| `walkdir` | Copying `.portfolio/` directories on archive and restore |
| `rfd` | Native folder picker and dialogs |
| `security-framework` | GitHub tokens in the macOS Keychain |
| `@tanstack/react-router` | File-based routing |
| `@tanstack/react-query` | Data fetching, caching, invalidation, polling |
| `radix-ui`, `cmdk` | Accessible primitives and the command palette |
| `tailwindcss` / `@tailwindcss/vite` | Styling |
| `rmcp` (pinned), `schemars` | The MCP server in the app binary (`--mcp`): protocol, stdio transport, tool schemas |

Sign-in uses GitHub's device flow; there is no deep-link plugin or localhost callback.
