# Project Q&A Knowledge Base

## Overview

My dynamic GitHub profile README — the special `Technical-1/Technical-1` repo that GitHub renders as my profile page. Instead of a static markdown file, it features an animated SVG banner plus a custom split-panel widget (commits-per-month sparkline + top-10 languages by LOC) that auto-update daily via GitHub Actions querying the GraphQL API.

## Key Features

- **Auto-Updating Stats Banner**: ASCII-art logo + contact info + GitHub stats (commits, repos, stars, followers, LOC) rendered in a terminal-aesthetic SVG, regenerated every day from live GraphQL data.
- **Languages-by-LOC Widget**: A second 850×255 split-panel SVG showing my 12-month contribution sparkline (left) and top 10 programming languages by user-authored lines of code (right), with GitHub-official language colors.
- **Honest LOC Counting**: Owned forks whose upstream parent I also have access to are filtered out — no double-counting the same commits in two repos.
- **Self-Healing Resilience**: When GitHub's GraphQL backend persistently fails on a repo (e.g. 5+ minute history pagination triggering a 502), the script SKIP-caches that repo with prior LOC values preserved, then retries only when the repo gets new commits.
- **Dark/Light Theme Support**: Every SVG ships in dark + light variants, switched automatically via the README's `<picture>` element and `prefers-color-scheme` media query.
- **Intelligent Caching**: Per-repo LOC cache + per-language sidecar + per-month commits sidecar minimize API calls. Typical daily run: ~30 GraphQL calls, ~1.5 minutes total.
- **OG Preview Card**: A Playwright-rendered PNG (`.portfolio/preview.png`) generated daily from `og-preview.html` for social card metadata when the profile is linked.

## Technical Highlights

### Split-Panel Languages Widget
The languages widget is a single 850×255 SVG with two coordinated panels. The left panel renders a contributions-per-month sparkline using 12 vertical `<rect>` elements scaled to the busiest month, with GitHub's lighter contribution-graph green. The right panel renders up to 10 language rows using monospaced text `<tspan>` elements: dot leader, language name (padded to 14 chars), Unicode-block bar (max 20 blocks, scaled relative to the top non-Other language), abbreviated LOC count, and percentage. Sub-1% percentages display with one decimal so micro-languages don't show as `0%`. The entire widget is regenerated from sidecar caches each run.

### SKIP-Cache for Persistent GraphQL Failures
A single problematic repo (8.6M LOC, decade of history) had been causing the workflow to fail for five weeks straight before this fix. Retries didn't help — the GitHub backend was timing out at the same point every time. The solution: after five retries on persistent 502s OR `200`-with-empty-JSON-body responses, `recursive_loc()` returns a `'SKIP'` sentinel instead of raising. `cache_builder` then writes the cache row with the live commit `totalCount` but **preserves the prior LOC values**, so the row looks "fresh" on the next run and `recursive_loc` isn't called again until the repo gets new commits. Self-healing without a hardcoded denylist.

### Parent-Aware Fork Deduplication
Querying with `OWNER + COLLABORATOR + ORGANIZATION_MEMBER` affiliations returned both an original repo I collaborate on AND a fork of that same repo that I own. The same commits got counted twice — inflating LOC by ~8.6M (a single Go repo with massive history doubled). The fix: query `isFork` and `parent.nameWithOwner` per repo, then drop any fork whose parent is also in the user's edge list. Forks of unrelated upstream projects still count (their commits aren't anywhere else). The same filter applies to the repo count widget so all metrics stay consistent.

### Hash-Based LOC Cache with Smart Invalidation
Counting LOC across 100+ repos requires paginating per-commit history (50 commits per GraphQL request). The cache stores one row per repo keyed by `sha256(nameWithOwner)`: commit count, user-authored commits, additions, deletions. Each run, the script compares the live `totalCount` against the cached count — if equal, the expensive per-commit re-count is skipped. `flush_cache` was upgraded to preserve LOC values by hash when the edge list shrinks (e.g., when the fork filter activates), so cache invalidation doesn't wipe data we already paid to compute.

### Contribution Metric Choice
GitHub's API offers two seemingly similar fields: `totalCommitContributions` (commit-only, undercounts OSS work) and `contributionCalendar.contributionCount` (commits + PRs + issues + reviews, matches the green graph on the user's profile). The widget uses `contributionCalendar` and labels itself "Contributions" rather than "Commits" — accurate naming for the broader metric, and the sparkline visually matches what visitors see on the profile graph (~3,800/yr).

## Development Story

- **Origin**: Adapted from Andrew Grant's (`Andrew6rant`) dynamic GitHub profile README template, originally built on `jstrieb/github-stats`
- **The CI crisis**: The README build action was failing daily for 5+ weeks before being addressed. A single repo's commit-history pagination was reliably triggering GraphQL 502s, killing the whole pipeline. The fix walked through: add retry logic → realize retries weren't enough → SKIP-cache the failure → preserve LOC values on SKIP → catch `200`-with-empty-body as the same failure mode → discover and fix fork double-counting → align repo count widget with the same filter
- **Building the languages widget**: Started as a standalone SVG with ASCII art duplicated from the existing stats widget. Iterated through: full-width chart without ASCII → split-panel with new graphic on left → commits sparkline on left (with green bars) → lighter mint green for the bars → metric switch from `totalCommitContributions` to `contributionCalendar` (after a discrepancy was spotted between the widget total and GitHub's own profile graph) → expand from 6 to 10 languages → fix sub-1% percentages reading as `0%`
- **Hardest part**: Distinguishing between three legitimate "commit" metrics — commit_counter's cache-derived all-time count (3,356), totalCommitContributions's owned-repos-only count (653 last 12mo), and contributionCalendar's all-types count (~3,860 last 12mo) — and labeling each accurately
- **Lessons learned**: GitHub's GraphQL has multiple subtly-different fields for "the same" concept (contributions/commits/contribution-count). The documentation is precise but easy to misread. When numbers don't match across views, the metric definition is almost always the culprit, not a code bug.

## Frequently Asked Questions

### How do the stats update automatically?
A GitHub Actions workflow (`.github/workflows/build.yaml`) runs daily at 4 AM UTC. It checks out the repo, runs `scripts/today.py` which fetches fresh stats from the GitHub GraphQL API, updates the stats SVGs + the languages SVG + the OG preview PNG, and commits everything back to `main`. The push immediately updates what visitors see on the profile.

### Why two separate widgets instead of one?
The top widget (ASCII logo + contact + stats text) is the standard profile-banner aesthetic — the kind of thing visitors expect. The bottom widget (commits sparkline + languages bars) is a richer data visualization that wouldn't fit cleanly in the same 850×255 frame as the contact info. Both are 850×255 and share fonts, palette, and dot-leader rhythm so they feel like one design system.

### Why is the "Contributions" total different from the "Commits" stat?
They measure different things:
- "Commits: 3,356" — sum of commits authored by me on the default branch of every repo I track, all-time, from the LOC cache
- "Last 12mo: ~3,800 contributions" — all GitHub-tracked contributions (commits + PRs + issues + reviews) over the last 12 months, from `contributionCalendar`

Both are accurate; neither is "wrong." The labels are written to make the distinction clear.

### How does the SKIP-cache mechanism work?
When `recursive_loc()` exhausts five retries on persistent GraphQL gateway errors (502/503/504) or a `200`-with-empty-body response, it returns a `'SKIP'` sentinel. `cache_builder` writes the cache row with the live commit `totalCount` (so the row matches on next run and isn't re-queried) but preserves the prior LOC values from the existing cache row (so the displayed total doesn't drop). When the repo eventually gets new commits, the totalCount changes, the cache row no longer matches, and `recursive_loc()` is called fresh — self-healing without manual intervention.

### How does fork de-duplication work?
The `loc_query` GraphQL request fetches each repo's `isFork` flag and `parent.nameWithOwner`. After all pages of edges are accumulated, `filter_owned_forks()` drops any fork whose parent is also in the user's repo list — those represent the same commits as the original. Forks of upstream projects the user doesn't otherwise have access to are kept, since their commits are the only place the user's work shows. The repo count widget applies the same filter so all metrics stay consistent.

### Why use SVG instead of plain markdown?
Plain markdown can't do styled text, custom fonts, embedded charts, or animations. GitHub renders SVG inline within markdown READMEs, treating them like static images to the viewer. That makes SVG the only format that can show the terminal-aesthetic styled text, dot-leader alignment, animated ASCII art, and bar charts directly on the profile page.

### How does dark/light mode switching work?
The README uses HTML's `<picture>` element with a `<source media="(prefers-color-scheme: dark)">` referencing the dark SVG and a default `<img src=…>` referencing the light SVG. GitHub respects the media query, so visitors with dark mode see dark variants and everyone else sees light variants. Both modes use carefully-chosen color palettes (orange/blue keys + green accents in dark, brown/navy keys + dark-green accents in light).

### Why query the GraphQL API 12 times for monthly commits, and then drop back to 1 query?
First version: `totalCommitContributions` × 12 monthly windows (commit-only metric). Switched to: `contributionCalendar` × 1 yearly window (all contribution types). The yearly call returns weekly arrays of daily counts, which we sum by month locally. One API call instead of twelve, AND matches the green contribution graph on the user's profile.

### What's the cache-buster `?v=N` in the README image URLs for?
GitHub proxies SVG images through `camo.githubusercontent.com` and caches them aggressively. When the SVG file content changes but the URL stays the same, the proxy serves stale content for minutes. Appending `?v=N` and bumping N on layout changes forces the proxy to treat it as a new URL and fetch fresh.

### What was the development timeline?
The original profile README (adapted from Andrew Grant's template) existed for months before this session. The CI fixing + languages widget were built in a single intense iteration: ~22 commits, ~3 hours of work, from "actions broken for 5 weeks" to "custom split-panel widget showing 10 languages and 12 months of contributions, matching GitHub's profile graph exactly."
