# Project Q&A

## Overview

A small Cloudflare Worker that sits between the RepoLens app and GitHub's API. Unauthenticated GitHub access is capped at 60 requests/hour, which is far too low to analyze a repository; by proxying through a single authenticated token, the worker gives every RepoLens visitor the authenticated 5,000/hour limit without ever exposing the token. The interesting part is doing this safely at the edge — globally consistent rate limiting and caching despite Workers' many-isolate execution model.

## Problem Solved

RepoLens analyzes public repositories for visitors who aren't logged in. Hitting GitHub directly from the browser burns through the 60/hour anonymous limit almost immediately. The proxy fronts GitHub with one server-held token so anonymous users get useful rate limits, while keeping the token secret and preventing the proxy itself from being abused as an open relay.

## Target Users

- **RepoLens (the app)** — calls the proxy from both the browser and its server routes to fetch repo data for anonymous users.
- **The maintainer** — operates one cheap, observable edge service instead of embedding a token in the app or running a server.

## Key Features

### Authenticated rate-limit pass-through
Every proxied call carries a read-only GitHub PAT, so anonymous RepoLens users effectively share the authenticated 5,000/hour budget instead of the anonymous 60/hour.

### Globally consistent per-IP rate limiting
A Durable Object holds one counter per client IP, so the 200-requests-per-5-minutes cap is enforced across all of Cloudflare's edge, not per isolate.

### Edge response caching
Successful GitHub responses are cached for five minutes via the Cache API, keyed so the same query served to any allowed origin reuses one entry.

### Read-only, origin-restricted access
REST is GET-only, GraphQL mutations are rejected, browser callers are limited to an origin allowlist, and server callers authenticate with a constant-time secret.

## Technical Highlights

### A single authoritative counter on a many-isolate runtime
Workers don't run as one process — they run across many ephemeral V8 isolates, so module-level state isn't shared or durable. The rate limiter routes each IP to one `RateLimiter` Durable Object via `getByName(ip)` (`src/rate-limiter.ts`). The DO is single-threaded, so the counter's read-modify-write happens with no interleaving, and it persists across requests minutes apart. This was confirmed in production: requests issued from one IP over several minutes accumulated into one counter and tripped a `429` exactly as expected — behavior an in-memory `Map` could never produce.

### Errors that can't escape the handler
The fetch handler `await`s the REST/GraphQL handlers inside its `try/catch` (`src/index.ts`), and any non-JSON upstream reply (for example an HTML 5xx page) is wrapped as a clean `502` JSON envelope rather than throwing. Returning the handler promise without `await` would let rejections bypass the catch and surface as an opaque error.

### Read-only enforced before the body is parsed
`handleGraphQL` rejects bodies over 100 KB using the declared `Content-Length` first and the actual length second, then parses, then rejects `mutation` operations. Ordering the cheap length check before the expensive parse means the mutation/parse step can't itself become a memory-exhaustion vector. Cache keys are a SHA-256 hash of the body, so they stay fixed-size regardless of query length.

### CORS kept out of the cache
Cached entries store only the upstream payload; the `Access-Control-Allow-Origin` header is re-applied per request. One cached response therefore serves any allowed origin correctly, instead of pinning the cache to whichever origin missed first.

## Engineering Decisions

### Durable Object vs. KV vs. in-memory for rate limiting
- **Constraint**: The per-IP cap must hold globally, and Workers state is per-isolate.
- **Options**: Module-level `Map`, Workers KV, or a Durable Object.
- **Choice**: Durable Object.
- **Why**: The `Map` doesn't share state across isolates; KV is eventually consistent, so concurrent bursts read a stale count and slip past. A DO gives one strongly-consistent, single-threaded counter per IP.

### Shared secret vs. leaving server calls on CORS
- **Constraint**: Server-side callers send no `Origin`, so the CORS allowlist can't authorize them.
- **Options**: Open up no-origin requests, hardcode a secret, or use a real secret.
- **Choice**: A Worker secret compared with `crypto.subtle.timingSafeEqual`.
- **Why**: Opening no-origin requests turns the proxy into an open relay for the token; a hardcoded secret ships to anyone who reads the client. A stored secret compared in constant time gates server access without a timing side-channel.

### Cache API vs. KV for responses
- **Constraint**: Cache repeated reads cheaply with a short TTL.
- **Options**: Workers KV or the Cache API.
- **Choice**: Cache API (`caches.default`).
- **Why**: It's built for HTTP responses, costs nothing, and expires via `Cache-Control` — no manual TTL bookkeeping or KV write-rate limits.

## Frequently Asked Questions

### How do anonymous users get a higher rate limit without seeing the token?
The token lives only as a Cloudflare Worker secret and is attached server-side to each upstream call. Clients talk to the proxy, never to GitHub directly, so they benefit from the authenticated limit while the token never leaves the edge.

### What stops someone else from using the proxy as a free GitHub relay?
Browser requests must come from an allowlisted origin; server requests must present the `X-RepoLens-Server` secret (constant-time compared). Anything else gets a `403`. On top of that, every caller is rate-limited per IP.

### Why is REST restricted to GET and GraphQL mutations blocked?
The product only reads public data. Enforcing read-only at the proxy means the guarantee holds even if the upstream token's scope were ever broadened, rather than trusting token scope alone.

### How is the per-IP limit consistent if Workers run on many isolates?
Rate-limit state lives in a Durable Object addressed by `getByName(ip)`, which always routes a given IP to the same single-threaded instance. The counter is therefore global and atomic, unlike isolate-local memory.

### What happens when GitHub returns an error or non-JSON page?
GitHub error statuses are passed through; if the body isn't valid JSON (e.g. an HTML gateway error), the worker returns a `502` with a JSON error envelope so clients always get parseable output.

### How is it tested?
A Vitest suite runs inside the real Workers runtime via `@cloudflare/vitest-pool-workers`, covering CORS, the origin allowlist, the secret path, the Durable Object rate limiter, caching (MISS→HIT), and the GraphQL guards.
