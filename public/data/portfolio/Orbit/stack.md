# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | ^5 | Type-safe app code across server + client |
| Web framework | Next.js | 16.2.6 (Turbopack) | App-router pages, request-memoized data loading, server components for SQLite reads |
| UI runtime | React | 19.2.4 | Server + client components |
| Styling | Tailwind CSS | v4 (+ `@tailwindcss/postcss`) | Utility-first styling, no custom design system |
| Graph rendering | Cytoscape | ^3.33 | Network view at `/network` |
| Tables | TanStack Table | ^8.21 | Sortable headless tables on `/table`, `/groups`, `/sentiment`, etc. |
| Graph math | graphology + graphology-communities-louvain | ^0.26 / ^2.0 | Community detection for cluster coloring |
| SQLite | better-sqlite3 | ^12.10 | Direct read-only access to `chat.db` and AddressBook |
| Image processing | sharp | ^0.34 | Attachment thumbnails for `/gallery` |

## Frontend

- **Framework**: Next.js 16 with the App Router and Turbopack as the default bundler
- **State management**: None — server components fetch, client components receive props; small `useState`/`useMemo` islands where interactive
- **Styling**: Tailwind v4, configured via `postcss.config.mjs`
- **Build tool**: Turbopack (replaces Webpack; ~260ms cold start observed)
- **Fonts**: Geist Sans + Geist Mono via `next/font/google`

## Backend / Data Layer

- **Runtime**: Node.js 20+ (per `@types/node: ^20`)
- **Data sources**:
  - `~/Library/Messages/chat.db` — iMessage SQLite database (read-only)
  - macOS AddressBook SQLite (read-only) for contact-name fallback
  - `memory.jsonl` from the `server-memory` MCP for the knowledge graph
  - `viz/data/*` — generated artifacts (sentiment scores, handle→entity map)
- **API style**: Next.js server components + a single `/api/attachment/[id]` route for streaming attachment bytes
- **Authentication**: None — local-only single-user tool

## MCP Layer

| Server | Transport | Source | Role |
|--------|-----------|--------|------|
| `messages` | stdio via `uvx` | `mac-messages-mcp` (PyPI) | Read messages, search, find contact, list chats |
| `memory` | stdio via `npx` | `@modelcontextprotocol/server-memory` (npm) | Knowledge graph store — entities, relations, observations |

Both registered in `.mcp.json` at project scope; Claude Code auto-loads them when started in this directory.

## Desktop Wrapper (optional)

- **Framework**: Electron ^42.2
- **Architecture**: `electron/main.js` spawns Next as a child process on port 3737, waits for the URL to respond, opens a `BrowserWindow`. `electron/preload.js` exposes an IPC bridge for the in-app Refresh button to invoke `claude` headlessly against `prompts/update.md` + `prompts/sentiment.md`.

## Infrastructure

- **Hosting**: N/A — runs entirely on the user's local Mac
- **CI/CD**: None set up
- **Monitoring**: None — manual inspection of `memory.jsonl` and the UI

## Development Tools

- **Package manager**: npm
- **Linting**: ESLint 9 with `eslint-config-next`
- **Formatting**: None enforced (no Prettier config in repo)
- **Testing**: `node --test` with `tsx` for `*.test.ts` files (see `src/lib/sentiment.test.ts`, `src/lib/tfidf.test.ts`)
- **Type checking**: `npx tsc --noEmit` (no separate `typecheck` script)
- **Concurrency utility**: `concurrently` + `wait-on` available for orchestrating Electron + Next together

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` | Framework — App Router, server components, Turbopack |
| `react` / `react-dom` | UI runtime |
| `cytoscape` | Force-directed network rendering on `/network` |
| `graphology` + `graphology-communities-louvain` | In-memory graph + Louvain community detection |
| `@tanstack/react-table` | Headless sortable tables across the tabular pages |
| `better-sqlite3` | Synchronous SQLite access to `chat.db` + AddressBook |
| `sharp` | On-the-fly attachment thumbnail generation |
| `electron` | Optional native desktop wrapper |
| `tsx` | TypeScript loader for `node --test` and CLI smoke scripts |
| `tailwindcss` + `@tailwindcss/postcss` | Styling |

## Conventions Worth Knowing

- **No state library.** Data flows top-down via server components; interactivity is local.
- **`memory.jsonl` is the source of truth** for the relationship graph; treat it as append-only and use `delete_observations` + `add_observations` to update tagged lines (never duplicate).
- **`viz/data/` is gitignored** — those files contain personal contact names and sentiment scores. Don't commit them.
- **Path constants in `viz/src/lib/sqlite.ts` and `viz/src/lib/graph.ts`** are macOS- and machine-specific (AddressBook UUID, npx cache hash). Update if cloning to another machine.
