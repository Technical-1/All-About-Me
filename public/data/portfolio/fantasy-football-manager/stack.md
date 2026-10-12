# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language (job) | Python | 3.11 on the runner | Fast to write data and rules code in, and the official model SDK is first class |
| Language (site) | TypeScript | 5.9 | Types across the record schema catch a renamed field at build time |
| UI framework | React | 19.3 | Component model fits a set of screens that all read one record |
| Build tool | Vite | 6.4 | Quick builds and per-file code splitting, which the per-day chunks depend on |
| Storage | JSON files in git | n/a | One small record a day; history, diffs and rollback come for free |
| Key-value store | Upstash Redis | client 1.39 | Serverless-friendly counters and locks for the spending guards |

## Frontend

- **Framework**: React 19 with TanStack Router (file-based routes in `src/routes/`)
- **State Management**: Route loaders and component state; no global store, because every screen derives from the day's record
- **Styling**: CSS Modules with shared design tokens (`src/theme/tokens.css`)
- **Build Tool**: Vite, preceded by a data bridge (`scripts/build-data.mjs`) and followed by chunk-size and type checks

## Backend

- **Runtime**: Python 3.11 for the scheduled job; Node on Vercel for three serverless functions
- **Framework**: None. The job is plain modules under `ffm/`, and each function is a handler built by a factory so its model client and store can be injected in tests
- **API Style**: Three JSON endpoints under `/api/`
- **Auth**: A shared password checked in `middleware.ts` before any function runs, and again inside each handler

## Infrastructure

- **Hosting**: Vercel (static site plus functions)
- **CI/CD**: GitHub Actions runs the daily job and commits its output; every push to the main branch builds and deploys
- **Monitoring**: A run-status file written by the job, which the site reads to show a banner when a morning failed or never ran; per-call usage and cost recorded on every daily record

## Development Tools

- **Package Manager**: pip with a constraints file pinning every Python package; npm with a lockfile
- **Linting**: TypeScript `tsc --noEmit` as part of the build
- **Formatting**: None enforced
- **Testing**: pytest for the job, Vitest with Testing Library and jsdom for the site and the functions

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `anthropic` (Python) | Research with web search, trade judgment and the lineup review in the scheduled job |
| `@anthropic-ai/sdk` | The trade analyzer and the lineup question box in the serverless functions |
| `requests` | Sleeper and KeepTradeCut clients |
| `pyyaml` | League configuration, thresholds and feature flags in `config.yaml` |
| `@tanstack/react-router` | Typed, file-based routing with per-route data loading |
| `@upstash/redis` | Daily caps, the spend ceiling, the request lock and the usage log |
| `vite` | Build and code splitting |
| `vitest` | Component, route and handler specs |
| `pytest` | Unit, wiring and contract tests for the job, including the build bridge |
