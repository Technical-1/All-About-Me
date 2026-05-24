# Technology Stack

## Core technologies

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Language | TypeScript | `^6.0.3` | Type safety for the parsing, state, and ping logic. |
| Runtime | Node.js | `24` (LTS) | Native TS stripping, AbortSignal.timeout, `node:test`, `Promise.allSettled`. |
| Test runner | `node:test` | built-in | No third-party test framework. Flat tests, dependency injection over module mocking. |
| Type definitions | `@types/node` | `^25.9.1` | Type definitions for Node's built-in modules. |

## Infrastructure

- **Compute**: GitHub Actions `ubuntu-latest` runners (transient, 10-minute job cap).
- **Scheduler**: GitHub Actions cron (`0 6 */3 * *` UTC) plus `workflow_dispatch` for manual runs.
- **Persistent state**: a single committed file (`state/status.json`) on `main`. The git history *is* the database.
- **Secrets**: one repository secret (`UPSTASH_REGISTRY`) containing the entire DB registry as JSON.
- **External services**: Upstash REST API endpoints (one per registered DB).

## Workflow actions

| Action | Version | Why |
|---|---|---|
| `actions/checkout@v6` | latest | Check out the repo so commits can be made & pushed. v6 uses Node 24 internally. |
| `actions/setup-node@v6` | latest | Install Node 24. v6 uses Node 24 internally. |

## Development tools

- **Package manager**: `npm` (with lockfile committed).
- **Build step**: none. Node strips TypeScript types natively at load time.
- **Linting / formatting**: none. The codebase is small enough (~250 LOC across 6 files) that style consistency is enforceable by review.
- **Type checking**: TypeScript compiler is available locally but not run in CI. Native Node TS-stripping doesn't type-check, but the dependency-injected architecture makes test feedback fast enough that runtime errors surface immediately.
- **Test invocation**: `node --test test/*.test.ts`.
- **CI**: GitHub Actions (the same workflow that runs the keepalive cron also gates on `npm test`).

## Key dependencies

| Package | Purpose |
|---|---|
| `typescript` | Compiler / language server for editor tooling; not run at build or runtime. |
| `@types/node` | Type definitions for `node:fs`, `node:test`, `node:url`, `AbortSignal`, etc. |

That's the entire dependency tree. No runtime dependencies, two dev-only dependencies. `npm ci` installs 2 packages.

## Languages / APIs in use

- **TypeScript**: interfaces, type aliases, `import type`, narrow union types (`'OK' | 'UNREACHABLE' | 'AUTH_FAIL'`).
- **Node.js APIs**:
  - `node:fs` — `readFileSync`, `writeFileSync`, `mkdirSync`, `renameSync`.
  - `node:path` — `dirname`, `join`.
  - `node:url` — `pathToFileURL` for ESM entry-point detection.
  - `node:test` — `test` (no `describe`), executed via `node --test`.
  - `node:assert/strict` — `assert.equal`, `assert.deepEqual`, `assert.throws`, `assert.match`.
  - `fetch` (global, WHATWG) — Upstash REST calls.
  - `AbortSignal.timeout` — 15s per-fetch deadline.
  - `Promise.allSettled` — parallel ping fan-out.
- **Shell** (in the workflow): bash inside `run: |` blocks, `gh` CLI for triggering/inspecting.

## Why this stack

- **No build step**: avoids the entire "is my build artifact up to date?" failure mode. Source files are what runs.
- **No third-party runtime deps**: nothing to dependabot, nothing to audit, no supply-chain attack surface beyond Node itself.
- **`node:test` over Jest/Vitest**: zero install footprint, no mocking framework needed (dependency injection covers it), runs natively.
- **Single committed state file**: trivially inspectable, recoverable from git history, doubles as the GitHub Actions anti-suspend signal.
- **TypeScript without a compiler step**: catches the obvious mistakes in the editor, costs nothing at runtime.
