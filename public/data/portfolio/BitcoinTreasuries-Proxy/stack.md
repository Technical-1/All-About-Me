# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript | ES2024 | Worker logic, scraping, data transformation |
| Runtime | Cloudflare Workers | v4 (compatibility_date: 2025-12-09) | Serverless edge compute platform |
| Caching | Cloudflare Cache API | Built-in | Edge response caching with TTL and stale-if-error |
| Static Assets | Cloudflare Static Assets | Built-in | Edge CDN serving for OG image and favicons |

## Backend

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Framework**: None (vanilla Worker `fetch` handler)
- **API Style**: REST (GET-only JSON API)
- **Authentication**: None (CORS origin whitelisting only)

## Infrastructure

- **Hosting**: Cloudflare Workers (edge-deployed globally) with static assets CDN
- **Production URL**: `https://treasuries-proxy.btc-treasuries.workers.dev`
- **CI/CD**: Manual via `wrangler deploy`
- **Monitoring**: Cloudflare Workers observability (enabled in `wrangler.jsonc`) + Workers Logs indexing of structured `logEvent` JSON lines from `src/observability.js`

## Development Tools

- **Package Manager**: npm
- **Linting**: N/A
- **Formatting**: Prettier (tabs, single quotes, 140 char width, semicolons)
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers`
- **Type Checking**: TypeScript (strict mode, JS files allowed via `allowJs`)
- **Editor Config**: EditorConfig (tabs, LF line endings, UTF-8)
- **Deploy Tool**: Wrangler CLI

## Key Dependencies

Zero runtime dependencies. The Worker runs on the Cloudflare runtime alone - no parser libraries, no HTTP client, no logging framework. The dev dependencies below exist only for the local toolchain.

| Package | Purpose |
|---------|---------|
| `wrangler` | Cloudflare Workers CLI for dev server and deployment |
| `@cloudflare/vitest-pool-workers` | Runs Vitest tests inside a Workers-compatible environment |
| `vitest` | Test runner and assertion library |
| `typescript` | Type checking for JavaScript source files |

## Notable Configuration

| Setting | Value | Why |
|---------|-------|-----|
| `compatibility_flags` | `global_fetch_strictly_public` | Ensures `fetch()` only reaches public internet (security) |
| `main` | `src/index.js` | Module entry; the entry file is ~15 lines and delegates to `routes.js`. No build step. |
| `observability.enabled` | `true` | Cloudflare dashboard logging and tracing; pairs with `logEvent` JSON output for Workers Logs |
| `assets.directory` | `./public/` | Serves static files (OG image, favicons) from edge CDN |
| `assets.run_worker_first` | `["/", "/health"]` | Ensures API routes always hit Worker, not asset lookup |
| `vitest.miniflare.modulesRules` | `{ type: 'Text', include: ['**/*.html'] }` | Lets the fixture-based parser tests import `test/fixtures/bitcointreasuries-homepage.html` as a UTF-8 string |
