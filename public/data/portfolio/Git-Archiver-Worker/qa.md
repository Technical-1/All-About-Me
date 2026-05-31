# Project Q&A

## Overview

The Git-Archiver Worker is the Cloudflare Worker backend for Git-Archiver Web, a free service that archives public GitHub repositories. It's a stateless edge proxy that keeps a GitHub token off the client, validates and rate-limits submissions, opens issues to trigger the archive pipeline, and serves cached read endpoints. The interesting part is doing all of that on free tiers while staying inside GitHub's API rate limits.

## Problem Solved

A static frontend can't safely talk to GitHub: calling the API from the browser is unauthenticated (60 requests/hour per IP, exhausted in minutes) and any embedded token is exposed. This worker is the thin trusted layer that holds the credential, raises the effective limit to 5,000/hour, and shields the browser from CORS friction on GitHub Release assets — without standing up a real server.

## Target Users

- **The Git-Archiver Web frontend** — calls these endpoints to submit repos and render the archive listing
- **Self-hosters / forkers** — anyone who wants to run the archiver on their own Cloudflare + GitHub accounts

## Key Features

### Submission proxy with server-side validation
`POST /submit` and `/bulk-submit` validate the URL against GitHub's naming rules, confirm the repo exists, is public, and is under the size cap, then open a labelled `archive-request` issue that triggers the archive workflow. Up to 20 repos can be submitted at once.

### Batched source-status checks
`POST /bulk-status` returns the online/deleted/archived/DMCA status for many repositories in a single rate-limited call, so the listing page can show a live badge on every card without firing dozens of separate requests.

### Authenticated, cached read endpoints
`/index`, `/readme`, and `/pending` proxy GitHub through the worker's token with short-lived caching, so the browser gets fast responses, never sees the token, and never trips GitHub's anonymous rate limit.

## Technical Highlights

### One batched call instead of N metered ones
The listing renders up to 50 cards, each needing a status badge. At 30 `/status` requests/min per IP, a single render would rate-limit itself and silently drop ~20 badges. `handleBulkStatus` accepts a list and fans out with `Promise.all`, collapsing 50 metered calls into one. The per-repo logic lives in `getRepoStatus()`, shared with the single `/status` path so the two can't drift.

### Opposite failure modes for opposite risks
`checkRateLimit()` fails **closed** when KV is unavailable — during an outage, denying requests prevents unlimited abuse. The duplicate-request and same-day-release checks fail **open** — a rare duplicate archive is far cheaper than blocking every legitimate submission. The "safe" default is chosen per check based on whether it guards against abuse or against unavailability.

### Cache writes that actually persist
`cachedFetch()` re-caches successful responses with an allowlisted header set (guarding against cache poisoning) and commits the write through `ctx.waitUntil()`. Without that, a fire-and-forget `cache.put()` can be discarded when the isolate shuts down immediately after responding — quietly defeating the cache.

### Secret-safe structured logging
The `Logger` class emits one JSON object per log with a request ID and duration, and scrubs `ghp_`/`gho_`/`ghs_` tokens, bearer headers, and sensitive keys before anything is written, with length truncation to bound log-injection. Debugging via `wrangler tail` never risks leaking the PAT.

## Engineering Decisions

### Worker proxy vs. direct browser-to-GitHub
- **Constraint**: Static frontend, no backend, must not expose a token, must survive realistic traffic on GitHub's limits.
- **Options**: Call GitHub directly from the browser (anonymous), embed a token client-side, or proxy through a worker.
- **Choice**: Proxy through a Cloudflare Worker holding the token as a secret.
- **Why**: Only the proxy keeps the credential private *and* lifts the rate ceiling to 5,000/hr; caching at the edge amortizes the extra hop.

### Fixed-window rate limiting vs. sliding window
- **Constraint**: Need per-IP throttling that's cheap on KV (every read/write is a billable op and adds latency).
- **Options**: Sliding-window log (accurate, many KV ops) or fixed-window counter (one read + one write).
- **Choice**: Fixed window keyed on a time-bucketed `windowId`.
- **Why**: Burst tolerance at window edges is acceptable for this workload, and the op count stays minimal — which itself avoids a self-inflicted KV bottleneck.

### Issue creation as the pipeline trigger
- **Constraint**: The worker must kick off a clone/compress/publish job it can't run itself (Workers have no filesystem or long-running compute).
- **Options**: Call a separate build service, or use GitHub's own infrastructure.
- **Choice**: Open a labelled issue; a GitHub Actions workflow in the companion repo reacts to it.
- **Why**: Reuses GitHub Actions as a free job runner and gives every request a visible, auditable trail (the issue) with zero added infrastructure.

## Frequently Asked Questions

### How does a submission actually start an archive?
`POST /submit` opens a GitHub issue labelled `archive-request` in the companion repo. A workflow there is triggered by that label and does the clone, compression, and Release upload. The worker only validates and enqueues — it never touches repo contents.

### Why route reads through the worker instead of calling GitHub from the page?
Two reasons: the browser would be unauthenticated (60 req/hr/IP, quickly exhausted) and would hit CORS issues on GitHub Release asset redirects. The worker uses the server-side token (5,000 req/hr) and returns clean JSON, with caching on top.

### What stops someone from spamming submissions?
Per-IP fixed-window rate limiting in KV, with stricter budgets on write endpoints (`/submit`, `/bulk-submit`) than reads. Limits are surfaced via `X-RateLimit-*` headers, and the limiter fails closed if KV is unavailable.

### How does it avoid creating duplicate archives?
Before enqueuing, the worker checks for an existing open `archive-request` issue for the exact owner/repo and for a Release already created the same day. The match is exact (parsed from the issue's `url:` line), so `foo/bar` isn't confused with `foo/bar-baz`.

### What does `/bulk-status` return?
A map keyed by `owner/repo`, each value reporting `online`/`status` (active, archived, deleted, or DMCA). It accepts up to the bulk limit in one call and is what powers the source-status dots on the listing page.

### How do I run it on my own accounts?
Set the `RATE_LIMIT` KV namespace id in `wrangler.toml`, add the three secrets (`GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`) with `wrangler secret put`, and `wrangler deploy`. CI deploys automatically once `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set as repo secrets.

### Why is CORS wide open (`ALLOWED_ORIGIN = "*"`)?
It's a public, read-heavy API meant to be embeddable. Writes are protected by per-IP rate limiting and server-side validation rather than origin checks, and no cookies or sessions are used, so a permissive CORS policy doesn't expand the attack surface.
```