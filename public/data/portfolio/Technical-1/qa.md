# Project Q&A Knowledge Base

## Overview

My dynamic GitHub profile README — the special `Technical-1/Technical-1` repo that GitHub renders as my profile page. Instead of a static markdown file, it features an animated SVG banner plus a custom split-panel widget (commits-per-month sparkline + top-10 languages by LOC) that auto-update daily via GitHub Actions querying the GraphQL API.

## Key Features

- **Auto-Updating Stats Banner**: ASCII-art logo + contact info + GitHub stats (commits, repos, stars, followers, LOC) rendered in a terminal-aesthetic SVG, regenerated every day from live GraphQL data.
- **Languages-by-LOC Widget**: A second 850×255 split-panel SVG showing my 12-month contribution sparkline (left) and top 10 programming languages by user-authored lines of code (right), with GitHub-official language colors.
- **Honest LOC Counting**: Merge commits (whose API additions are combined diffs that re-count underlying work) are skipped, and owned forks whose upstream parent I also have access to are filtered out — no double-counting the same lines in two places.
- **Self-Healing Resilience**: When GitHub's GraphQL backend persistently fails on a repo (e.g. 5+ minute history pagination triggering a 502), the script SKIP-caches that repo with prior LOC values preserved, then retries only when the repo gets new commits.
- **Dark/Light Theme Support**: Every SVG ships in dark + light variants, switched automatically via the README's `<picture>` element and `prefers-color-scheme` media query.
- **Intelligent Caching**: Per-repo LOC cache + per-language sidecar + per-month commits sidecar minimize API calls. Typical daily run: ~30 GraphQL calls, ~1.5 minutes total.
- **OG Preview Card**: A Playwright-rendered PNG (`.portfolio/preview.png`) generated daily from `og-preview.html` for social card metadata when the profile is linked.

## Technical Highlights

### Split-Panel Languages Widget
The languages widget is a single 850×255 SVG with two coordinated panels. The left panel renders a contributions-per-month sparkline using 12 vertical `<rect>` elements scaled to the busiest month, with GitHub's lighter contribution-graph green. The right panel renders up to 10 language rows using monospaced text `<tspan>` elements: dot leader, language name (padded to 14 chars), Unicode-block bar (max 20 blocks, scaled relative to the top non-Other language), abbreviated LOC count, and percentage. Sub-1% percentages display with one decimal so micro-languages don't show as `0%`. The entire widget is regenerated from sidecar caches each run.

### Merge-Commit Double-Counting Fix
The single biggest accuracy bug: GitHub's GraphQL `Commit.additions` on a *merge* commit returns the combined diff — every change the merge brings in — which re-counts work already attributed to the underlying non-merge commits. One dormant collaborator repo reported **8.6M lines for ~376k real lines**: a 23× inflation from 26 PR-merge commits. The fix adds `parents { totalCount }` to the history query and skips any commit with `totalCount > 1`, mirroring `git log --no-merges`. This alone dropped the displayed LOC from inflated millions to an honest per-author total.

### Hardcoded Overrides for Repos the API Can't Count Honestly
Two repo classes defeat even the merge-fixed live counter. **Subtree-merged archives** pull whole sub-repos in via merge commits, so skipping merges leaves them reporting near-zero. **Dormant repos** (one untouched since 2023) reliably 502 on their history walk no matter how many retries. A top-of-file `LOC_HARDCODE` dict, keyed by `owner/repo`, pins each one's `additions`/`deletions`/`my_commits` (from local `cloc` and `git log --no-merges --shortstat`) and fires before the commit-count drift check so these repos never re-query GitHub. An optional `language_breakdown` distributes additions across the languages actually in the tree (`cloc` on `git ls-files`) rather than GitHub's single Linguist-chosen `primaryLanguage` — which, for one repo that accidentally committed `node_modules`, mislabeled 376k mostly-JavaScript additions as "Go."

### SKIP-Cache for Transient GraphQL Failures
Even healthy repos occasionally hit GitHub backend hiccups (502/503/504, or a `200` with an empty body) mid-pagination. Zeroing those rows corrupts the total — this caused a 20M → 4M regression on 2026-05-24. The fix: after five retries on persistent gateway errors OR `200`-with-empty-JSON-body responses, `recursive_loc()` returns a `'SKIP'` sentinel instead of raising. `cache_builder` writes the cache row with the live commit `totalCount` but **preserves the prior LOC values**, so the row looks "fresh" on the next run and isn't re-queried until the repo gets new commits. Self-healing: a push to the repo invalidates the row and a fresh attempt happens automatically.

### Parent-Aware Fork Deduplication
Querying with `OWNER + COLLABORATOR + ORGANIZATION_MEMBER` affiliations returned both an original repo I collaborate on AND a fork of that same repo that I own. The same commits got counted twice — inflating LOC by millions when a large repo with massive history doubled up. The fix: query `isFork` and `parent.nameWithOwner` per repo, then drop any fork whose parent is also in the user's edge list. Forks of unrelated upstream projects still count (their commits aren't anywhere else). The same filter applies to the repo count widget so all metrics stay consistent.

### Hash-Based LOC Cache with Smart Invalidation
Counting LOC across 100+ repos requires paginating per-commit history (50 commits per GraphQL request). The cache stores one row per repo keyed by `sha256(nameWithOwner)`: commit count, user-authored commits, additions, deletions. Each run, the script compares the live `totalCount` against the cached count — if equal, the expensive per-commit re-count is skipped. `flush_cache` was upgraded to preserve LOC values by hash when the edge list shrinks (e.g., when the fork filter activates), so cache invalidation doesn't wipe data we already paid to compute.

### Contribution Metric Choice
GitHub's API offers two seemingly similar fields: `totalCommitContributions` (commit-only, undercounts OSS work) and `contributionCalendar.contributionCount` (commits + PRs + issues + reviews, matches the green graph on the user's profile). The widget uses `contributionCalendar` and labels itself "Contributions" rather than "Commits" — accurate naming for the broader metric, and the sparkline visually matches what visitors see on the profile graph (~3,800/yr).

## Engineering Decisions

### Skip merge commits when counting LOC
- **Constraint**: GitHub's GraphQL `Commit.additions` on a merge reports the combined diff, double-counting work already in the underlying commits — inflating one repo 23× (8.6M vs ~376k real lines).
- **Options**: Trust the API totals, subtract an estimated merge factor, or filter merges out entirely.
- **Choice**: Add `parents { totalCount }` to the query and skip any commit with `totalCount > 1`.
- **Why**: Exactly mirrors `git log --no-merges`, the canonical "real authorship" view — no heuristics, no magic constants, and it's the single largest accuracy improvement to the LOC total.

### `contributionCalendar` over `totalCommitContributions`
- **Constraint**: GitHub exposes multiple "commit-like" metrics with subtly different definitions. `totalCommitContributions` undercounts OSS work because it only includes commits to repos the user owns or has explicit access to.
- **Options**: `totalCommitContributions` (commit-only), monthly windowed queries, or `contributionCalendar.contributionCount` (commits + PRs + issues + reviews).
- **Choice**: A single `contributionCalendar` yearly query, summed by month locally.
- **Why**: One API call instead of twelve, and the number matches the green graph on the GitHub profile exactly — so visitors don't see a discrepancy between the widget and the official profile view.

### Two-tier failure handling: SKIP-cache for transient, hardcode for permanent
- **Constraint**: GraphQL counting fails in two distinct ways — *transient* backend hiccups on otherwise-healthy repos, and *permanent* unreliability on a few repos (dormant repos that always 502, or subtree-merged archives that count to near-zero once merges are skipped).
- **Options**: One mechanism for both (either retry-forever, or a blanket denylist), or distinct handling per failure mode.
- **Choice**: Transient failures → SKIP-cache (preserve prior LOC, retry next run). Permanent failures → a small `LOC_HARDCODE` table of locally-verified `cloc` numbers that bypasses GraphQL entirely.
- **Why**: SKIP-cache self-heals when GitHub recovers, but a repo that *always* fails would SKIP forever and burn retries every run — those few get pinned instead. Keeping the table tiny and locally-verified avoids it becoming a stale denylist.

### Parent-aware fork filtering vs. affiliation filtering
- **Constraint**: Querying with `OWNER + COLLABORATOR + ORGANIZATION_MEMBER` affiliations sometimes returned both an upstream repo and the user's fork of it, causing the same commits to be counted twice.
- **Options**: Drop the COLLABORATOR affiliation (loses real contributions), drop all forks (loses legitimate work on forks of upstream projects), or filter parent-aware.
- **Choice**: Query `isFork` and `parent.nameWithOwner` per repo, then drop only forks whose parent is also in the user's edge list.
- **Why**: Honest LOC count without losing legitimate fork contributions. Forks of unrelated upstream projects still count because their commits live nowhere else.

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

### Why was the LOC count once wildly inflated, and how is it accurate now?
The counter originally summed `Commit.additions` for every user-authored commit. But on a *merge* commit, GitHub returns the combined diff — the union of everything the merge brings in — so the same lines got counted again. One repo with 26 PR-merges reported 8.6M lines for ~376k of real work. The fix queries each commit's `parents { totalCount }` and skips anything with more than one parent, exactly like `git log --no-merges`. The displayed total is now per-author, non-merge additions only.

### Why are a few repos' LOC values hardcoded?
A small `LOC_HARDCODE` table pins LOC for repos the live API can't count honestly: subtree-merged archives (whose real content lives in merge commits the counter now skips) and a dormant repo that reliably 502s on its history walk. Each pinned value comes from local `cloc` or `git log --no-merges --shortstat`, and an optional `language_breakdown` splits the additions across the languages actually in the tree instead of GitHub's single `primaryLanguage` guess. The override fires before the cache's drift check, so these repos never re-query GitHub.

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

### How long does a typical workflow run take?
About 1.5 minutes for ~30 GraphQL calls on a typical day, thanks to the per-repo LOC cache only re-querying repos whose `totalCount` changed. A cold run with no cache takes closer to 10 minutes across 100+ repos.

### Where did the design come from?
The stats-widget structure is adapted from Andrew Grant's (`Andrew6rant`) dynamic GitHub profile README template, which is itself built on `jstrieb/github-stats`. The split-panel languages widget, the SKIP-cache resilience layer, the parent-aware fork filter, and the OG preview pipeline are this profile's own additions.
