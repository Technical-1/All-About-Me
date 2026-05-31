# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Runtime | Cloudflare Workers (V8 isolate) | compat date 2024-01-01 | Free tier, global edge, zero servers to run |
| Language | JavaScript (ES modules) | — | No build step; the worker is a single readable module |
| Storage | Cloudflare KV (`RATE_LIMIT`) | — | Low-latency edge counters for rate limiting |
| Cache | Cloudflare Cache API | — | Built-in, free, cuts GitHub API traffic |

## Backend

- **Runtime**: Cloudflare Workers, single `fetch` handler in `src/index.js`
- **API Style**: Small REST surface — 8 endpoints (`/submit`, `/bulk-submit`, `/bulk-status`, `/pending`, `/index`, `/readme`, `/status`, `/health`)
- **Auth**: No client auth (stateless public API); a server-side GitHub PAT (Cloudflare secret) authenticates all outbound GitHub calls
- **Abuse control**: Per-IP fixed-window rate limiting in KV, with `X-RateLimit-*` headers

## Infrastructure

- **Hosting**: Cloudflare Workers (`git-archiver` service)
- **CI/CD**: GitHub Actions → `cloudflare/wrangler-action` deploys on push to `main`
- **Secrets**: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` via `wrangler secret`; `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets
- **Monitoring**: Structured JSON logs via `wrangler tail` (token-redacting Logger)

## Development Tools

- **CLI**: Wrangler 3
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers` (runs tests inside a real `workerd` runtime, not a Node shim)
- **Package Manager**: npm

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `wrangler` | Local dev, deploy, log tailing for the worker |
| `vitest` | Test runner |
| `@cloudflare/vitest-pool-workers` | Executes tests in the Workers runtime so `fetch`/`Request`/`Response`/`caches` behave as in production |
```