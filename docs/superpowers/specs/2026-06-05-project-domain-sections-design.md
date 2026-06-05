# Project Domain Sections — Design

**Date:** 2026-06-05
**Author:** Jacob Kanfer
**Status:** Awaiting review

## Problem

The projects page (`src/pages/projects/index.astro`) renders every repository as one
flat grid via `GitHubReposWall.tsx`, sorted only by `pushed_at`. With **116 repos** in
`public/data/private_repos.json`, recency is the *only* organizing principle a visitor
gets. The best work is buried, and a recruiter has no way to say "show me the AI
projects." The repo count has crossed the threshold where sectioning is warranted.

Note: the `category` field already exists in `GitHubRepoMetadata` (`github.ts`) with a
stub enum (`web | mobile | cli | ai | automation | other`), plus `categoryLabels`,
`categoryIcons`, and `getReposByCategory()` — but **0 of 116 repos** currently have it
set. The scaffolding was anticipated and never populated.

## Goal

Group the projects page into ~10 **domain shelves**, with **featured** and **archived**
status treated as cross-cutting layers. Each shelf reads as a complete, browsable set.

## Grouping model (locked)

**Axis:** Hybrid — domain is the primary split; featured/archived are cross-cutting
status, not domains.

**Taxonomy (Medium granularity, ~10 shelves).** Final names and exact membership are
finalized by the doc-read pass (Phase 1) and approved before wiring. Working set:

| Shelf | Approx. examples |
|---|---|
| AI & ML | Orbit, MultiAgent, Resume-Local-LLM, Kendra-who, serverless-document-pipeline |
| Crypto & Fintech | BTC/ETH-Explorer, coinbasis/coinlytics/cryptolytics, Crypto-Price-Tracker v1/v2 |
| Developer Tools & Infra | Git-Archiver ×4, RepoLens, Project-Hub, Local-Hoster, pythonforge |
| Automation & Scraping | EbayViews, redfin-scraper, Kanfer-D-Toolkit, Shopify-ATC, DailySMS, WebCrawler |
| iOS & Mobile | PixScan, SnapDragon, Emailer, Flux, MasterCode, GimmeThat |
| Creative & Generative | Differential-Growth, Pluribus, Signature-Studio, the ASCII family |
| Games & Puzzles | Blackjack-Trainer, Backgammon, Speed-Racer, Crossword-Gen, Snorlax |
| Security & Privacy | QuickPass v1/v2, RepoGuard, EmailAnalyzer, Private-Collab-Whiteboard |
| Client & Commercial Sites | Carmen, CSNY, E350, emissary-risk-ops, FISH-THEME, Terra-Moda |
| Web Apps & Utilities | Easy-Time-Blocking, Limitimer-Pro, Kid-Talk-Translator, NeoMatrix |

The doc-read may surface 1–2 repos that don't fit cleanly (e.g. hardware/embedded like
`EEL4599`, `NeoMatrix`) or a cohort with enough mass to argue for an 11th shelf. Any such
deviation is raised in the mapping review, not decided unilaterally.

### Status layers

- **Featured (6 repos):** Keep the hero band at top of the page (current behavior,
  driven by `featured_repos.json` / `FEATURED_REPO_NAMES`). Featured repos **also appear
  inside their domain shelf**, marked with a ★ badge, and **sort first** within the shelf.
  Rationale: shelves are browsable sets, so a "Crypto" shelf missing `BTC-Explorer` reads
  as broken. Only 6 repos repeat; the badge makes the repetition read as emphasis.
- **Archived / Academic:** Stay **in their domain shelf**, sorted **last**, visually
  dimmed. Keyed off the existing `repo.archived` flag (most coursework repos are already
  archived). No separate "Archive" or "Academic" section is created.

### Within-shelf sort precedence

1. Featured first (existing featured order, then recency).
2. Active (non-archived, non-featured) by `pushed_at` descending.
3. Archived last by `pushed_at` descending, dimmed.

`AHSR-senior-design-archive` is both featured and archived → featured wins, sorts first.

## Data plane

`private_repos.json` is **fully regenerated** every nightly sync
(`fetch_private_repos.js` line ~466 writes `enriched` rebuilt from the GitHub API). Only
data hardcoded in the script survives a sync (`FEATURED_REPO_NAMES`, `REPO_OVERRIDES`).

Therefore categories must live as a **code constant**, not in the JSON:

1. Add a `REPO_CATEGORIES` map (`name → domain-slug`) to `fetch_private_repos.js`.
2. `processRepo()` stamps `metadata.category` from that map (same merge path that
   `REPO_OVERRIDES` already uses at lines ~268–274). New/unlisted repos fall to `other`.
3. `github.ts`: replace the stub `category` enum with the ~10 domain slugs; update
   `categoryLabels` / `categoryIcons`; preserve `category` through `fetchReposFromJson`'s
   mapping (it already carries `metadata`).
4. `projects/index.astro` (or a new grouping component): group `getAllRepos()` output by
   `metadata.category` into shelves, apply the sort precedence, render the hero band
   unchanged above the shelves.

No new infrastructure — two existing mechanisms (featured list, override merge) are
extended.

## Build phases

### Phase 1 — Categorize (the real work, done first)

Read the portfolio docs for all 116 repos (91 have `architecture.md` / `stack.md` /
`qa.md` under `public/data/portfolio/<repo>/`; ~25 thin repos judged from description +
language + repo contents). Run as a **fan-out of parallel sub-agents** over slices of the
repo list, each returning `{repo, category, one-line evidence}`. Reconcile into one
consistent taxonomy and produce the full `name → domain` table.

**Gate:** The complete mapping (with evidence) is presented for review and approval
**before** it is wired into the site. No wrong buckets ship.

### Phase 2 — Render (after mapping approved)

One projects page that groups by `metadata.category` into the shelves, plus a **temporary
toggle bar** to explore layout variants live on the real data. Toggle axes:

- **Navigation:** sticky jump-nav (section index) ↔ no nav.
- **Card density:** roomy 3-col ↔ dense 4-col (reuses the existing `dense` prop on
  `GitHubReposWall`).
- **Shelf style:** wrapping grid ↔ horizontal scroll-row per domain.

= 8 combinations, all viewable by flipping toggles (no separate page builds). Jacob picks
the winning combination; the toggles are then stripped and only the winner's code remains.

## Out of scope (YAGNI)

- Multi-tag / filter-chip taxonomy (each repo has exactly one domain home).
- Per-domain detail pages or routes.
- Changing the project detail page (`projects/[slug].astro`).
- GitHub topics-based auto-categorization (categories are doc-derived and explicit).

## Update (post-gate refinement, 2026-06-05)

After the categorization review, two status shelves were added below the 10 domains:

- **Academic Coursework** — an explicit 4-repo shelf: `AHSR-senior-design-archive` (also
  featured), `APComputerScienceA2019-2020`, `Cplories-and-More`, `EEL4599-Final-Project`.
  Stored as `metadata.category: 'academic'`; always wins (even for featured AHSR).
- **Work in Progress** — derived at render time, not stored: any repo (outside Academic)
  **without a `.portfolio/preview.png`** lands here (~34 visible). The preview image is the
  showcase bar. `Technical-1` → Dev Tools; `Private-Collab-Whiteboard` and
  `Personal-Budget-Tool` confirmed in Web Apps & Utilities.

Shelf order: 10 domains → `other` → Academic Coursework → Work in Progress.

## Success criteria

- All 116 repos render under a domain shelf; none orphaned.
- Featured repos appear in both the hero band and their shelf (★, first).
- Archived repos sort last and are dimmed.
- Categories survive a `fetch_private_repos.js` run (verified by re-running the sync).
- One layout combination chosen; prototype toggles removed before merge.
