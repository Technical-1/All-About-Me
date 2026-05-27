# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript (ES Modules) | ES2024 | Worker source code |
| Runtime | Cloudflare Workers | — | Serverless edge execution |
| Deployment | Wrangler CLI | ^4.53.0 | Build, dev server, and deployment |
| Testing | Vitest | ~3.2.0 | Unit and integration testing (29 tests) |
| Type Checking | TypeScript | ^5.5.2 | Type safety for tests and config |

## Backend

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Framework**: None — vanilla Worker `fetch` handler
- **API Style**: REST (JSON responses)
- **Authentication**: Optional CoinGecko Pro API key via `COINGECKO_API_KEY` secret; `REFRESH_SECRET` secret gates the cache-bypass query parameter
- **Caching**: Cloudflare Cache API (`caches.default`) — 12h TTL for `/`, 5min TTL for `/mstr/*`
- **HTTP client**: In-tree `fetchWithRetries` helper (10s per-attempt timeout, status-aware retry on 429/5xx, exponential backoff)
- **Logging**: Structured JSON events written to `console.log`, indexed by Cloudflare Workers Logs

## Infrastructure

- **Hosting**: Cloudflare Workers (edge-deployed globally)
- **Production URL**: `https://treasuries-proxy-coingecko.btc-treasuries.workers.dev`
- **Observability**: Cloudflare Workers Logs (`observability.enabled = true` in `wrangler.jsonc`)
- **CI/CD**: Manual deploy via `wrangler deploy`

## Development Tools

- **Package Manager**: npm
- **Formatting**: Prettier (`.prettierrc` config)
- **Editor Config**: EditorConfig (`.editorconfig`)
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers` for realistic Worker environment
- **Custom lint**: `npm run lint:fetches` greps `src/routes/` and `src/scraping/` for raw `fetch()` calls so every upstream call has to go through `fetchWithRetries`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `wrangler` | Cloudflare Workers CLI for dev, deploy, and type generation |
| `@cloudflare/vitest-pool-workers` | Runs Vitest tests inside a real Workers runtime |
| `vitest` | Fast test runner |
| `typescript` | Type checking for test files and configuration |

## Shared Data with Sibling Proxy

Two of this Worker's data files live in `data/` and are intentionally identical with the sibling `BitcoinTreasuries-Proxy` repository:

- `data/categories.json` — `byTicker` + `byNamePattern` lookup
- `data/countries.json` — ISO 3166-1 alpha-2 slug map

`data/KEEP_IN_SYNC.md` documents the rule: a change to either file must be applied to the sibling repo in the same change. The two proxies scrape different upstream sources (CoinGecko vs. BitcoinTreasuries.net) but produce a consistent enriched shape for the same frontend, so the category/country lookup tables stay in lockstep.

## Notable Patterns

- **Zero runtime dependencies** — the Worker uses only built-in Web APIs (`fetch`, `URL`, `Headers`, `Response`, `caches`, `AbortController`)
- **Modular extraction** — request handling is split into `src/index.js` (router), `src/routes/` (per-endpoint logic), `src/scraping/` (CoinGecko specifics + pure parser), and small focused modules for CORS, retries, normalization, and logging. The router is ~30 lines; the rest is testable in isolation.
- **Convention enforced by lint** — the rule "no raw `fetch()` outside `fetchWithRetries.js`" is checked by `npm run lint:fetches`, not just hoped for in code review
- **ES Module worker format** — uses `export default { fetch }` instead of the legacy `addEventListener` pattern
- **JSON-as-module imports** — `data/*.json` is imported with `import x from './x.json' with { type: 'json' }`, so data is bundled at deploy time with no runtime fetch
