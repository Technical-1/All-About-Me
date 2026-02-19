# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript (ES Modules) | ES2024 | Worker source code |
| Runtime | Cloudflare Workers | — | Serverless edge execution |
| Deployment | Wrangler CLI | ^4.53.0 | Build, dev server, and deployment |
| Testing | Vitest | ~3.2.0 | Unit and integration testing |
| Type Checking | TypeScript | ^5.5.2 | Type safety for tests and config |

## Backend

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Framework**: None — vanilla Worker `fetch` handler
- **API Style**: REST (JSON responses)
- **Authentication**: Optional CoinGecko Pro API key via `COINGECKO_API_KEY` secret
- **Caching**: Cloudflare Cache API (`caches.default`)

## Infrastructure

- **Hosting**: Cloudflare Workers (edge-deployed globally)
- **Observability**: Cloudflare Workers observability (enabled in wrangler.jsonc)
- **CI/CD**: Manual deploy via `wrangler deploy`

## Development Tools

- **Package Manager**: npm
- **Formatting**: Prettier (`.prettierrc` config)
- **Editor Config**: EditorConfig (`.editorconfig`)
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers` for realistic Worker environment

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `wrangler` | Cloudflare Workers CLI for dev, deploy, and type generation |
| `@cloudflare/vitest-pool-workers` | Runs Vitest tests inside a real Workers runtime |
| `vitest` | Fast test runner |
| `typescript` | Type checking for test files and configuration |

## Notable Patterns

- **Zero runtime dependencies** — the Worker uses only built-in Web APIs (`fetch`, `URL`, `Headers`, `Response`, `caches`)
- **Single-file architecture** — all logic lives in `src/index.js` (~540 lines) for simplicity and fast cold starts
- **ES Module worker format** — uses `export default { fetch }` instead of the legacy `addEventListener` pattern
