# Project Q&A

## Overview

Git-Archiver Web is a free, serverless service for archiving public GitHub repositories. A user pastes a repo URL and receives a permanent `.tar.gz` snapshot stored in GitHub Releases. The whole stack runs on free tiers with no servers or database — this repo holds the frontend and the GitHub Actions archive engine; the API proxy is a separate Cloudflare Worker.

## Problem Solved

Public GitHub repositories can disappear — deleted by owners, taken down via DMCA, or made private. Git-Archiver Web preserves a snapshot so the code remains downloadable even if the original vanishes.

## Target Users

- **Developers** — preserve dependencies or references that might disappear
- **Researchers** — keep citable snapshots of code
- **Archivists** — bulk-preserve at-risk repositories

## Key Features

### One-click archiving
Paste a GitHub URL; the service clones, compresses, and publishes a snapshot as a GitHub Release.

### Bulk submission
Submit up to 20 repositories at once.

### Change-based deduplication
A repo is re-archived only when its latest commit changed since the last snapshot — unchanged repos are skipped instead of producing duplicate releases.

### Live source-status badges
Each repo card shows whether the original GitHub repo is still public, archived, or deleted, resolved for the whole page in a single batched request.

## Technical Highlights

### Issue-driven serverless pipeline
The frontend can't run server code, so submissions become labelled GitHub issues that trigger a GitHub Actions workflow (`archive.yml`). This turns GitHub's own infrastructure into a free, auditable job queue — every archive request is a visible, closable issue.

### Batched status to stay inside rate limits
The archive listing can render dozens of cards, each needing a live source-status badge. Rather than firing one request per card (which would blow the per-IP rate limit and leave most badges blank), the frontend collects every visible repo and resolves them in one `POST /bulk-status` call, painting all badges from the single response.

### Injection-safe CI
`archive.yml` consumes an attacker-controlled repository description. All untrusted values are passed through `env:` and referenced as quoted shell variables rather than interpolated into `run:` blocks, and a bash regression test (`scripts/test/ci-injection.test.sh`) asserts a malicious description is treated as inert data.

### Browser-verified, dependency-light tests
Pure helpers (URL parsing, date guards, the API client) are unit-tested under Node; the real page load is covered by a Playwright smoke test that drives Chromium against a fully-stubbed backend and asserts the shell renders, stats populate, cards appear, the batched badge resolves, and no uncaught errors fire — all with zero npm audit advisories in the toolchain.

## Engineering Decisions

### Static frontend over a framework
- **Constraint**: Small app, wanted zero build complexity
- **Options**: React/Vue SPA vs vanilla JS
- **Choice**: Vanilla JS, no build step
- **Why**: Instant loads, trivial to host on Pages, nothing to compile or keep patched

### Worker in its own repository
- **Constraint**: The backend deploys on a different cadence than the static site and holds its own secrets
- **Options**: Keep the worker as a subdirectory of this repo, or split it out
- **Choice**: Split into [Git-Archiver-Worker](https://github.com/Technical-1/Git-Archiver-Worker)
- **Why**: Independent CI and deploy, cleaner separation of the public static site from the credentialed backend

### GitHub Releases as storage
- **Constraint**: Needed free durable storage for large files plus one queryable manifest
- **Options**: S3, Cloudflare R2, GitHub Releases
- **Choice**: GitHub Releases, with a single `index` release holding `index.json`
- **Why**: Free, durable, CDN-backed, no extra account, and each release is independently addressable

## Frequently Asked Questions

### How does a submission turn into an archive?
The worker opens a GitHub issue labelled `archive-request`; that issue triggers `archive.yml`, which clones the repo, builds a `.tar.gz`, and publishes a Release. The frontend never touches repo contents directly.

### Can I archive private repos?
No — only public repositories are supported.

### What's the size limit?
2 GB per repository (the GitHub Release asset cap).

### How does change detection work?
Each archive records the source repo's latest commit hash in its metadata. On a re-archive, if the current commit matches the last one, the run is skipped — so the daily refresh job only creates releases for repos that actually changed.

### Why route reads through a worker instead of calling GitHub directly?
The browser would be unauthenticated (60 requests/hour per IP, quickly exhausted) and would hit CORS issues on Release-asset redirects. The worker uses a server-side token (5,000/hour) and returns clean, cached JSON.

### How is the frontend tested?
`npm test` runs Vitest unit tests plus a CI-injection shell check; `npm run test:e2e` runs the Playwright browser smoke tests. Both run in CI on every frontend change.
