# Architecture Overview

## System Diagram

```mermaid
flowchart TD
    subgraph Schedule
        Cron[GitHub Actions cron<br/>every 3 days @ 06:00 UTC]
        Manual[gh workflow run<br/>manual trigger]
    end

    subgraph Workflow [keepalive.yml]
        Checkout[actions/checkout@v6]
        SetupNode[actions/setup-node@v6<br/>node-version: 24]
        Test[npm test<br/>full suite]
        Run[node src/cli.ts]
        Commit[git add state/status.json<br/>git commit + push]
    end

    subgraph Code
        CLI[src/cli.ts<br/>main + STALE threshold]
        Registry[src/registry.ts<br/>parse UPSTASH_REGISTRY]
        Runner[src/runner.ts<br/>Promise.allSettled]
        Ping[src/keepalive.ts<br/>SET / GET / retry-once]
        Store[src/state-store.ts<br/>atomic load/save/merge]
    end

    subgraph External
        Upstash[(Upstash REST<br/>per-DB endpoint)]
        State[(state/status.json<br/>committed to main)]
    end

    Cron --> Checkout
    Manual --> Checkout
    Checkout --> SetupNode --> Test --> Run --> Commit
    Run --> CLI
    CLI --> Registry
    CLI --> Runner
    CLI --> Store
    Runner --> Ping
    Ping --> Upstash
    Store --> State
    Commit --> State
```

## Component descriptions

### `src/cli.ts`
- **Purpose**: Process entry point. Builds the runtime dependencies (live `pingDatabase`, `loadRegistry`, `loadState`/`saveState`) and hands them to `main()`. `main()` is exported for tests, which inject fakes.
- **Key responsibilities**:
  - Read `UPSTASH_REGISTRY` env var; eagerly parse it (so `labels` is immutable and the parse error path is straightforward).
  - Call the runner; load prior state; check `isRegistryUnavailable`.
  - Merge new ping results into state, write state, log results.
  - Apply the `[STALE]` prefix to hosts whose post-merge `consecutiveFailures > 5`.
  - Exit 0 only when every ping is `OK` and no gaps exist.

### `src/registry.ts`
- **Purpose**: Parse and validate the `UPSTASH_REGISTRY` JSON.
- **Key responsibilities**:
  - JSON parse with descriptive error messages naming the offending entry index.
  - Require non-empty `url` and `token` strings.
  - Require `https:` scheme (a leaked token over `http://` is a real risk).
  - Require non-empty host (catches `https:///path` typos that WHATWG URL parsing would otherwise normalize away).
  - Dedupe by host, merging distinct `label` values into a `labels[]` array.
  - Reject duplicate-host entries with mismatched tokens (a misconfiguration that would otherwise silently produce `AUTH_FAIL`).

### `src/runner.ts`
- **Purpose**: Orchestrate "discover, then fan-out ping" with no environmental coupling.
- **Key responsibilities**:
  - Accept injected `discover()` and `ping()` so the runner has no I/O of its own.
  - Catch discovery failures and return `discoverOk: false` (load-bearing: signals upstream to preserve previous state).
  - Run pings in parallel via `Promise.allSettled` so the total time is bounded by the slowest single host, not the sum.
  - Map rejected promises to `UNREACHABLE` `PingResult`s defensively (production `pingDatabase` never throws, but the dependency contract allows it).

### `src/keepalive.ts`
- **Purpose**: One ping against one Upstash DB.
- **Key responsibilities**:
  - Issue `SET upstasher:keepalive <iso> EX 86400` then `GET` to round-trip-verify.
  - Apply a 15-second `AbortSignal.timeout` to each fetch (so a wedged host can't block indefinitely).
  - Retry once on 5xx and on non-timeout thrown errors with a 500ms backoff.
  - Keep `AUTH_FAIL` (401/403), 4xx, round-trip-verify failures, and timeouts terminal (no retry).
  - Return a typed `PingResult`; never throw.

### `src/state-store.ts`
- **Purpose**: Read and write `state/status.json` safely.
- **Key responsibilities**:
  - `loadState`: return empty state on `ENOENT` (first run); throw with a descriptive message on parse failure (so corruption fails the workflow loudly).
  - `saveState`: write to `.tmp` then `renameSync` over the destination (atomic on POSIX).
  - `mergeState`: produce the next `StatusFile` by appending the new ping result to each DB's rolling 30-entry history; reset `consecutiveFailures` on `OK`, increment on failure.
  - `isRegistryUnavailable`: heuristic (`!discoverOk`, or `prevCount >= 1 && discoveredCount === 0`, or sudden >50% drop) to detect "the registry vanished" vs. "we have no DBs."

### `.github/workflows/keepalive.yml`
- **Purpose**: The actual cron.
- **Key responsibilities**:
  - Schedule (`0 6 */3 * *` UTC) plus `workflow_dispatch` for manual triggers.
  - `timeout-minutes: 10` so a wedged run can't lock out the next tick.
  - `npm ci` → `npm test` (gates every run on a green suite) → `node src/cli.ts`.
  - `Commit state` step only runs if `npm test` passed (`if: always() && steps.test.outcome == 'success'`), preventing false heartbeats.
  - Heartbeat commit (`--allow-empty`) only if the last real commit is >45 days old.
  - `git push` with a single 5-second retry, then fail the job — push failures are no longer silently masked.

## Data flow

1. **Trigger**: cron at 06:00 UTC every 3 days, or `gh workflow run keepalive`.
2. **Setup**: checkout, install Node 24, `npm ci`.
3. **Gate**: `npm test` must pass. If it fails, the `Commit state` step is skipped (no heartbeat commit on a failed run).
4. **Discover**: `realEntry()` reads `UPSTASH_REGISTRY` and parses it via `loadRegistry`. Parse errors are captured into `registryErr` and surfaced through `discover()` later.
5. **Ping**: `runner.run()` calls `Promise.allSettled(dbs.map(ping))`. Each ping does SET → GET with a 15s timeout and one retry on 5xx / non-timeout throws.
6. **Merge**: `main()` calls `loadState` (throws loudly on corruption), checks `isRegistryUnavailable`, calls `mergeState` to produce the next StatusFile.
7. **Persist**: `saveState` writes atomically via temp + rename. Log lines printed for each host (with `[STALE]` prefix if `consecutiveFailures > 5`).
8. **Commit**: workflow stages `state/status.json`, commits if changed (or empty-heartbeats if quiet >45 days), pushes (with a 5s retry on failure).
9. **Exit**: 0 if everything was OK and no gaps; 1 otherwise. Exit 1 triggers GitHub's workflow-failure email.

## External integrations

| Service | Purpose | Notes |
|---------|---------|-------|
| Upstash REST API | Receive SET/GET pings that reset the inactivity timer | One endpoint per DB; bearer-token auth. Auth method is `Authorization: Bearer <token>` per the REST URL the Upstash console provides. |
| GitHub Actions | Cron scheduler + runner + commit destination | The committed state is *also* the activity signal that prevents Actions itself from auto-suspending the workflow at the 60-day mark. |

## Key architectural decisions

### Manual registry instead of Vercel API auto-discovery
- **Context**: Original design auto-discovered DBs through the Vercel REST API.
- **Decision**: Pivoted to a single `UPSTASH_REGISTRY` GitHub secret containing a JSON array.
- **Rationale**: Vercel marks integration-injected credentials as `sensitive`, which the API deliberately omits the `value` field for. No token scope unlocks the actual credentials — they're decryptable only inside the deployment container at runtime. Manual registry trades a bit of setup friction for actually working.

### Atomic state writes (temp + rename)
- **Context**: `state/status.json` is the load-bearing verification artifact and the GH Actions anti-suspend signal. A partial write at the wrong moment silently truncates the rolling history.
- **Decision**: Always write to `state/status.json.tmp` then `renameSync` over the destination.
- **Rationale**: POSIX `rename()` is atomic. A killed process leaves either the old file or the new file — never a partial.

### Distinguish ENOENT from corruption in `loadState`
- **Context**: A blanket `try { JSON.parse(read()) } catch { return empty }` treats a missing file (first run, expected) the same as a corrupt file (something went wrong, need investigation).
- **Decision**: Only `ENOENT` returns empty state. Any other read error or any parse error throws.
- **Rationale**: Silent corruption combined with the next successful run overwrites history with a fresh empty record. Failing loudly forces a human to look before history is lost.

### Parallel pings via `Promise.allSettled`
- **Context**: With sequential `for...of await`, total runtime is O(N × per-ping latency). One wedged host blocks every subsequent host.
- **Decision**: Issue all pings in parallel; treat rejections as `UNREACHABLE`.
- **Rationale**: Pings are independent (different hosts, different tokens). Combined with the 15s fetch timeout, total run time is bounded by the slowest single host.

### Narrow retry policy
- **Context**: A single 502 from an Upstash edge restart used to produce a false-positive failure email until the next 3-day cron.
- **Decision**: One retry on 5xx and on non-timeout thrown errors with a 500ms backoff. 4xx, AUTH_FAIL, round-trip-verify failures, and timeouts stay terminal.
- **Rationale**: Retrying conditions that don't recover (bad token, wrong endpoint, wedged host) is churn. Retrying a 502 absorbs real-world platform blips without masking real outages.

### `npm test` gate before `Run keepalive`
- **Context**: Without a test gate, a code regression could ship via cron and silently degrade behavior.
- **Decision**: `npm test` runs first; `Commit state` is gated on test outcome (`if: always() && steps.test.outcome == 'success'`).
- **Rationale**: A failed test would otherwise still trigger the anti-suspend heartbeat commit, falsely crediting Actions with activity while masking the regression.

### Heartbeat commit when quiet >45 days
- **Context**: GitHub Actions auto-suspends scheduled workflows after 60 days of no repo activity. If no DB needs pinging (or all pings are NO-OP duplicates), the workflow generates no commits.
- **Decision**: If `state/status.json` has no real change and the last commit is older than 45 days, push an empty `--allow-empty` heartbeat commit.
- **Rationale**: 45 < 60 gives a 15-day safety margin. The heartbeat is the activity signal Actions needs to keep the cron alive.

### Native Node TypeScript stripping (no `tsx`)
- **Context**: Earlier the project used `tsx` to run `.ts` files directly.
- **Decision**: Switch to `node src/cli.ts` and `node --test test/*.test.ts`. Node 24+ ships with type-stripping enabled by default.
- **Rationale**: One fewer dependency, faster CI cold-start (-3s), no build step. The trade-off: we can't use TS-only runtime features (`enum`, `namespace`, parameter properties) — but we don't, and the type system encourages cleaner alternatives anyway.
