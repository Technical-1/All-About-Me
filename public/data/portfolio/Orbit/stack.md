# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | ^5 | Type-safe app code across server and client components |
| Web framework | Next.js | 16.2.6 (Turbopack) | App Router, server components that read SQLite directly, two API routes |
| UI runtime | React | 19.2.4 | Server components plus small client islands |
| Styling | Tailwind CSS | ^4 (+ `@tailwindcss/postcss`) | Utilities over a token-based theme (`src/lib/theme/`) and shared primitives (`src/components/ui/`) |
| Graph rendering | Cytoscape | ^3.33.4 | Network view at `/network` |
| Data table | TanStack Table | ^8.21.3 | Sortable, filterable table at `/table` |
| Graph math | graphology + graphology-communities-louvain + graphology-metrics | ^0.26.0 / ^2.0.2 / ^2.4.0 | Weighted, seeded Louvain communities and betweenness centrality |
| SQLite | better-sqlite3 | ^12.10.0 | Read-only access to `chat.db` and the AddressBook from the app |
| Image processing | sharp | ^0.34.5 | Attachment thumbnails for `/gallery` |
| Local inference | `mlx-lm` via `uvx` | resolved at launch | OpenAI-compatible chat-completions server on Apple Silicon |
| Constrained decoding | `outlines[mlxlm]` | ==1.3.0 (pinned in `scripts/lib/mlx.mjs`) | Per-request JSON-schema output for the verifier, recall, and attribution passes |
| Model | Gemma 4 E4B, 4-bit QAT MLX build | pinned in `docs/local-llm-benchmark.md` | Extraction, verification, sentiment, and chat |
| MCP client | `@modelcontextprotocol/sdk` | ^1.29.0 | The daemon's connection to the `messages` and `memory` servers |
| HTTP client | undici | ^7.28.0 | Model requests with a 15-minute timeout instead of the default (`scripts/lib/model-fetch.mjs`) |
| Desktop | Electron | ^42.2.0 | Native shell, onboarding, and refresh IPC |

## Frontend

- **Framework**: Next.js 16 with the App Router; Turbopack is the default bundler
- **State management**: None. Server components load data and pass props; client wrappers hold local `useState`/`useMemo` for sorting (`useSortableRows`), network filters, selection, and the chat stream
- **Styling**: Tailwind v4 over typed theme tokens resolved to CSS custom properties: the dark "Observatory" theme by default, and a light "Annals" theme selected with `NEXT_PUBLIC_PRODUCT=annals`
- **Fonts**: IBM Plex Sans and IBM Plex Mono via `next/font/google`
- **Rule engine**: `src/lib/noticings/` holds per-page rule modules plus six cross-signal insight rules, all pure functions over typed contexts

## Backend / Data Layer

- **Runtime**: Node.js 20+ (per `@types/node: ^20`)
- **Data sources**:
  - `~/Library/Messages/chat.db` (read-only, via `better-sqlite3` in the app and the `sqlite3` CLI in the daemon)
  - The macOS AddressBook SQLite database (read-only, optional) for contact names
  - `memory.jsonl` from the `server-memory` MCP server for the knowledge graph
  - `viz/data/*` for generated state: `sentiment.jsonl`, `entity_handles.json`, `user-config.json`, `settings.json`, `intake-state.json`, `intake-log.jsonl`, `receipts.jsonl`, and `backups/`
- **API style**: Next.js server components, `/api/attachment/[id]` (and `/thumb`), `/api/owner`; the daemon exposes REST plus Server-Sent Events on `127.0.0.1:8318`
- **Authentication**: None. Single-user, loopback-only

## Local Intake Daemon

- **Entry point**: `viz/scripts/intaked.mjs`, plain ES modules with no build step
- **Process management**: launchd LaunchAgent written by `scripts/install-daemon.mjs`, preferring a dedicated `~/.orbit/bin/orbit-node` binary so Full Disk Access is granted to the daemon alone
- **Model server**: started on demand on port 8317 through `uvx`, stopped after 5 idle minutes, never started below 55% free memory
- **Network policy**: a global `fetch` guard rejects any non-loopback host (`scripts/lib/guard.mjs`)
- **Scheduling**: 15-minute debounce after `chat.db` activity, 6-hour staleness ceiling, weekly sentiment, 30-second tick, AC power required by default (`scripts/lib/settings.mjs`)

## MCP Layer

| Server | Transport | Source | Role |
|--------|-----------|--------|------|
| `messages` | stdio via `uvx` | `mac-messages-mcp` (PyPI) | Read messages, fuzzy search, find contacts, list chats, attachments |
| `memory` | stdio via `npx` | `@modelcontextprotocol/server-memory` (npm) | Knowledge-graph store: entities, relations, observations |

Both are registered in `.mcp.json` at project scope. An MCP-capable LLM client loads them in prompt mode, and the daemon connects to the same definitions in local mode.

## Desktop Shell

- **Framework**: Electron ^42.2.0
- **Architecture**: `electron/main.js` spawns Next on port 3737 and opens a context-isolated `BrowserWindow`. `preload.js` exposes `refresh`, `setup.detect/commit/seed`, and `config.read`. Refresh goes to the daemon in local mode (`local-refresh.js`) or to the `claude` CLI in headless mode for prompt mode (`refresh.js`).

## Infrastructure

- **Hosting**: N/A. Runs entirely on the user's Mac
- **CI/CD**: None
- **Monitoring**: The daemon's `/health` and `/status` endpoints (model state, queue depth, last sweep, groundedness totals), a sidebar status chip, and `~/Library/Logs/orbit-intaked.log`

## Development Tools

- **Package manager**: npm
- **Linting**: ESLint 9 with `eslint-config-next` 16.2.6
- **Formatting**: None enforced
- **Testing**: `node:test` throughout, with no framework. `npm test` runs the app's `*.test.ts[x]` files through `tsx`; `npm run test:scripts` runs the daemon and pipeline tests; the Electron helpers have their own `*.test.js` files. There are 100 test files: 59 in `src/`, 38 in `scripts/`, and 3 in `electron/`. Model, filesystem, `sqlite3`, `pkill`, and `memory_pressure` calls are injectable, so pipeline tests run without a model server, and the SQL metrics run against an in-memory seeded `chat.db` (`src/lib/metrics/test-db.ts`)
- **Evaluation tooling**: `scripts/score-graph.mjs` scores the live graph against a frozen gold set extracted by a frontier model from the same transcripts the pipeline sees; `scripts/gate-nruns.mjs` collects N-run score distributions per contact; `scripts/run-session.mjs` runs bounded evaluation sessions with backups, model-server recycling, and teardown; `scripts/lib/embed-score.mjs` adds an optional semantic tier using `@xenova/transformers` (bge-small, CPU) as a dev dependency
- **Type checking**: `npx tsc --noEmit` (no separate script)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` | App Router, server components, Turbopack |
| `better-sqlite3` | Synchronous read-only SQLite for `chat.db` and the AddressBook |
| `cytoscape` | Network rendering on `/network` |
| `graphology` + `graphology-communities-louvain` + `graphology-metrics` | In-memory graph, communities, centrality |
| `@tanstack/react-table` | Headless table at `/table` |
| `@modelcontextprotocol/sdk` | Daemon-side MCP client |
| `undici` | Long-timeout HTTP for local model calls |
| `sharp` | Attachment thumbnails |
| `electron` | Desktop shell (dev dependency, opt-in via `npm run app`) |
| `@xenova/transformers` | Local embedding similarity for dev-only scoring |
| `tsx` | TypeScript loader for `node --test` |

## Conventions Worth Knowing

- **No state library.** Data flows top-down from server components; interactivity is local.
- **`memory.jsonl` is the source of truth** for the graph. Write through the memory MCP server, never edit the file while a session is connected, and replace tagged lines instead of appending.
- **The model never computes numbers.** `[freq]` comes from SQL and `[sent]` aggregates are computed from the model's monthly rows.
- **`viz/data/` is gitignored.** It holds real names, handles, sentiment rationales, and verifier receipts.
- **Machine-specific constants** live in `viz/src/lib/sqlite.ts` (AddressBook source UUID) and `viz/src/lib/graph.ts` (default `npx` cache path, overridable with `MEMORY_FILE_PATH`).
