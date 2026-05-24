# Project Q&A Knowledge Base

## Overview

Redis-Upstasher is a small TypeScript tool that keeps free-tier Upstash Redis databases alive by pinging each one every 3 days via a scheduled GitHub Actions workflow. Without these pings, Upstash auto-suspends free-tier databases after a period of inactivity, taking down anything that depends on them. The tool also commits its ping-results log back to the repo, which doubles as the activity signal that prevents GitHub Actions itself from auto-suspending the workflow at the 60-day mark.

It's a personal-infrastructure utility for keeping my own deployed projects on free tiers alive without paying for the next-tier-up just to avoid the inactivity timer. Single human operator, single repository secret containing the registry, no infrastructure to babysit.

## Key features

- **Manual JSON registry**: a single `UPSTASH_REGISTRY` GitHub secret holds every DB's REST URL + token + optional label. Add a new DB by appending one JSON object and pushing the secret.
- **Parallel pings with hard timeouts**: every host pinged simultaneously via `Promise.allSettled`, each fetch wrapped in a 15-second `AbortSignal.timeout`. One slow host can't block the rest of the run.
- **Atomic state writes**: `state/status.json` is written via temp + rename so a workflow interruption can't corrupt the rolling 30-entry-per-DB history.
- **`[STALE]` log prefix**: any host with more than 5 consecutive failures (18+ days at the 3-day cron) gets visually flagged in the failure email so persistent rot is distinguishable from blips.
- **Narrow retry policy**: one retry on 5xx and on non-timeout thrown errors. Auth failures, 4xx, round-trip-verify failures, and timeouts stay terminal — retrying them would just produce noise.
- **Audible CI**: `npm test` runs on every cron tick, gating the state-commit. A test regression skips the commit entirely (no false anti-suspend heartbeat).

## Technical highlights

### The "anti-suspend" trick that powers the whole thing
GitHub Actions auto-suspends scheduled workflows after 60 days of repository inactivity. That would defeat the entire purpose of a scheduled keepalive cron. The workaround: the workflow itself commits its results back to `main` after every run, generating real repo activity. On quiet runs where the state file didn't change, an empty `--allow-empty` heartbeat commit fires if the last real commit is older than 45 days. The whole system is recursively self-keeping-alive.

### Distinguishing "ENOENT" from "corrupt JSON" in `loadState`
The original code caught every error and returned an empty state on failure. That treated "first run, no state yet" identically to "this file got truncated mid-write." The next successful run would silently overwrite the corrupt remnant with a fresh empty record — losing the entire ping history that's the project's verification artifact. The fix distinguishes `ENOENT` (return empty, that's expected) from any other read/parse error (throw with a descriptive message, fail the workflow loudly so a human investigates). Paired with atomic writes via `renameSync`, the failure mode is now closed end-to-end.

### Native Node TypeScript instead of `tsx`
Node 22.18+ ships with TypeScript type-stripping enabled by default; Node 24 made it fully unflagged. That meant the original `tsx`-dependency was redundant. Switching to `node src/cli.ts` + `node --test test/*.test.ts` removed the dep entirely, shaved 3 seconds off every CI run, and eliminated the build-step failure mode. The trade-off: native stripping can't handle TS-only runtime features (`enum`, `namespace`, parameter properties), so the codebase has to stay conservative — which it already was.

### Defense-in-depth against hung pings
A single wedged Upstash host could previously block every subsequent ping in the run (sequential `for...of await`) and could keep the GitHub Actions job alive until the platform's 6-hour cap. Three layers fixed this: (1) a 15-second `AbortSignal.timeout` per fetch, (2) `Promise.allSettled` to fan out concurrently so one slow host can't delay the others, and (3) a 10-minute `timeout-minutes` cap on the job as a workflow-level safety net. Total worst-case runtime is now ~16 seconds in practice, with a hard ceiling of 10 minutes from the platform.

## Development story

- **Timeline**: original implementation took a weekend; the comprehensive hardening sweep (22 tracked issues across 7 phases) took about a day, driven by a multi-agent code review batch.
- **Hardest part**: the Vercel API → manual-registry pivot. The original design auto-discovered every Upstash DB through Vercel's REST API. Vercel marks integration-injected env vars as `sensitive`, which the API deliberately omits the `value` field for — even with `decrypt=true`, even via `vercel env pull`. Credentials are decryptable only inside the deployment container at runtime, by design. No token scope unlocks them. Days of probing the API surface ended in "this is impossible by design," and the project pivoted to the manual registry. Trades a bit of setup friction for actually working.
- **Lessons learned**:
  - "Whole-branch review at the end" catches things per-task review can't. A reviewer looking at every commit in isolation approved the `npm test` step in the workflow as correct, but only the final reviewer noticed that the pre-existing `if: always()` on the commit step meant a failed test could still produce an empty heartbeat commit — directly undermining the regression gate.
  - Manual workflow triggers before the real cron caught a Node-20-specific test crash that local tests didn't reproduce. `node:test` on Node 20+ kills tests where the only pending work is an `unref()`'d timer, and `AbortSignal.timeout()` uses exactly that. Easy fix; would have surfaced as a confused failure email at 6am UTC three days later otherwise.
  - The dependency-injection architecture (every component takes a `Deps` interface, never imports a side-effectful module directly) made test coverage cheap. The whole 41-test suite runs in ~600ms with no mocking framework and no network.
- **Future plans**: the system is in genuine "set and forget" steady state. The README, schema doc, failure-modes table, and token-rotation runbook live in `README.md` for when future-me needs to remember what this thing does. The next nontrivial maintenance window will be the Node 24 → 26 LTS bump when Node 26 reaches Active LTS in October 2026.

## Frequently asked questions

### How does the cron know when to fire?
GitHub Actions evaluates the `schedule:` block against UTC. `0 6 */3 * *` means "at 06:00 UTC every 3rd day of the month." It's not exactly every-72-hours (the gap between the 28th/31st and the 1st/3rd of the next month is irregular), but at this cadence it averages to about 10 pings per month per DB — well above Upstash's inactivity threshold.

### Why commit to `main` instead of a separate state branch?
Because the commit is *also* the GitHub Actions anti-suspend signal. Actions only counts activity on the default branch. Pushing state commits to a side branch would defeat the anti-suspend trick that keeps the cron alive after 60 days.

### Why a 3-day cron and not weekly or daily?
Upstash's inactivity timer is the operative constraint. The README claims 14 days (per the original author's notes); a 3-day cadence gives ~4 ping attempts per inactivity window, enough headroom that a single missed run (a CI outage, a transient network failure, a token rotation that takes a day to complete) doesn't risk suspension. Daily would be overkill and add 7× the commit noise; weekly cuts the safety margin too close.

### How do you handle a rotated Upstash token?
Token rotation steps live in the README's runbook section. Summary: regenerate in the Upstash console, swap the new value into your local copy of the registry JSON, `gh secret set UPSTASH_REGISTRY < registry.json`, trigger a manual run to verify. The old token is now invalid and any code using it will get `AUTH_FAIL`.

### What happens when a DB is deleted?
The next cron tick sees `UNREACHABLE` and exits 1. Email arrives. Two options: (a) the deletion was intentional, so remove the entry from the registry and update the secret; or (b) the deletion was accidental, restore the DB in Upstash. The state file's `lastResult` and `consecutiveFailures` track this — after 5 consecutive failures the `[STALE]` prefix appears in the log, making "this DB has been gone for a while" easy to spot.

### What if Upstash changes their REST API?
The `pingDatabase` function is the entire surface area we touch — one `POST` to `<restUrl>` with `Authorization: Bearer <token>` and a `["SET"/"GET", ...]` body. If they break that, the workflow fails with `UNREACHABLE` or 4xx errors, an email arrives, and a quick code adjustment fixes it. The dependency-injection architecture means swapping in a mock to develop the fix is straightforward.

### Why TypeScript for such a small project?
Because the types (`PingResult`, `Outcome`, `UpstashDB`, `StatusFile`) document the data flow more clearly than comments would, and because the editor experience (autocomplete, refactoring, errors on typos) is meaningfully better than plain JS even at this size. With Node 24's native TS stripping, the cost is literally zero — no build step, no dep, no startup penalty.

### What was the most challenging part of building this?
Believing that the Vercel API really, truly, deliberately would not return the secret values — even with `decrypt=true`. Reading the docs in detail and understanding the design intent (preventing credential exfiltration even from compromised CI tokens) is what unblocked the pivot to the manual registry. Sometimes the right answer is "the API was right and the original architecture was wrong."

### What would you improve?
- A Slack/Discord webhook on failure (faster than email) was considered and skipped — the value depended on actually caring about same-day notification, which for a personal tool isn't quite worth the setup.
- An auto-generated "status board" Markdown file showing each DB's current state would be neat for visibility but duplicates information already in `state/status.json`.
- The heartbeat-commit pattern works but adds noise to git history. A cleaner alternative would be triggering the workflow externally (e.g., via cron-job.org calling the GitHub API every 50 days), but that adds an external dependency.

Everything else is genuinely fine as-is.
