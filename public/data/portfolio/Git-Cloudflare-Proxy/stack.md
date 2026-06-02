# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Runtime | Cloudflare Workers | compat date 2026-06-01 | Runs at the edge, free tier covers the traffic, and Durable Objects + Cache API are first-class |
| Language | TypeScript | 5.x (strict) | Type-safe binding access and request/response shapes with no build step beyond Wrangler |
| Stateful coordination | Durable Objects | SQLite-backed | The only primitive that gives a globally consistent per-IP counter |
| Edge cache | Cache API (`caches.default`) | platform | Purpose-built for HTTP responses; self-expiring via `Cache-Control` |

## Backend

- **Runtime**: Cloudflare Workers (V8 isolates, ESM modules)
- **API Style**: Transparent reverse proxy for GitHub REST (`/github/...`) and GraphQL (`/github/graphql`)
- **Auth**: Inbound — CORS origin allowlist or a constant-time shared-secret header; Upstream — GitHub PAT (`Bearer`) held as a Worker secret

## Infrastructure

- **Hosting**: Cloudflare Workers (served at the `workers.dev` URL)
- **CI/CD**: `wrangler deploy` (Durable Object migration applied on deploy)
- **Monitoring**: Workers observability enabled (`head_sampling_rate = 1`)

## Development Tools

- **Package Manager**: npm
- **CLI**: Wrangler 4
- **Testing**: Vitest + `@cloudflare/vitest-pool-workers` (tests execute inside the real Workers runtime)
- **Type checking**: `tsc --noEmit`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `wrangler` | Build, local dev, secret management, and deploy |
| `@cloudflare/workers-types` | Type definitions for the Workers runtime and bindings |
| `@cloudflare/vitest-pool-workers` | Runs Vitest specs inside `workerd` so Durable Objects and the Cache API behave as in production |
| `vitest` | Test runner |
