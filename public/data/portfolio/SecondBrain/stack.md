# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Desktop shell | Tauri | 2 | Native window with a Rust core and a web front end, far smaller than Electron |
| Backend language | Rust | 2021 edition | Safe systems code for storage, OS integration, and orchestration |
| Database | SQLite via `rusqlite` | 0.31 (bundled) | Zero-config single-file store; bundled build avoids a system dependency |
| Frontend framework | React | 19 | Familiar component model; concurrent features for a responsive UI |
| Sidecar runtime | Bun | latest | Fast startup and a built-in test runner for the API process |

## Frontend

- **Framework**: React 19
- **Routing**: TanStack Router 1.158 (file-based routes under `src/routes/`)
- **Server state**: TanStack Query 5.90 — caching, mutations, and key-based invalidation
- **Styling**: Tailwind CSS v4 (via the Vite plugin)
- **Build tool**: Vite 7
- **Language**: TypeScript 5.8
- **HTML sanitization**: DOMPurify 3.3 for rendering email bodies safely

## Backend (Rust core)

- **Runtime**: Tokio 1 (full features)
- **IPC**: Tauri 2 commands, each returning `Result<T, String>`
- **Database**: `rusqlite` 0.31 (bundled SQLite, WAL mode, foreign keys on)
- **HTTP**: `reqwest` 0.12 for calls to the sidecar
- **Other**: `chrono` (time), `uuid` v4 (ids), `base64`, `dirs`, `dotenvy`

## Sidecar (Bun + Express)

- **Framework**: Express 5.1, bound to `127.0.0.1:3847`
- **AI**: `@anthropic-ai/sdk` 0.52 (Claude); Voyage AI embeddings over `fetch`
- **Google**: `googleapis` 146 (Gmail + Calendar)
- **Microsoft**: `@microsoft/microsoft-graph-client` 3.0 with `@azure/msal-node` 2.16 (Outlook, Calendar, Teams)
- **Calendar files**: `node-ical` 0.20 for `.ics` parsing
- **Hardening**: `express-rate-limit` 8.2; AES-256-GCM token encryption

## Infrastructure

- **Hosting**: Local desktop application — no servers to run
- **CI/CD**: None (personal project)
- **Monitoring**: None

## Development Tools

- **Package managers**: npm (frontend/Tauri), Bun (sidecar), Cargo (Rust)
- **Type checking**: `tsc --noEmit`
- **Testing**: `cargo test` for the Rust core; `bun test` for sidecar helpers

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `tauri` | Desktop shell and the Rust↔JS command bridge |
| `rusqlite` (bundled) | Embedded SQLite — primary data store and vector store |
| `@tanstack/react-query` | Caches Rust command results and coordinates invalidation |
| `@tanstack/react-router` | File-based routing for the app's views |
| `@anthropic-ai/sdk` | Claude calls for scoring, planning, vision, and email analysis |
| `googleapis` | Gmail and Google Calendar access |
| `@microsoft/microsoft-graph-client` + `@azure/msal-node` | Outlook, Calendar, and Teams access |
| `node-ical` | Parsing imported `.ics` calendar files |
