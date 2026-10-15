# Project Q&A

## Overview

Themed Crossword Generator is a platform for publishing branded, themed crosswords. An operator types a topic, or pastes a list of headlines, and gets back a newspaper-style grid. The grid is symmetric, every letter is checked, and the theme answers sit in the long marquee slots. The puzzle comes with clues, a fact-check pass and a quality grade, and can be published to the tenant's own puzzle site with a daily featured puzzle and a leaderboard. The interesting technical part is the division of labour. A constraint solver over a 229k-entry scored word list builds the grid, the LLM supplies only the themed answers and the clues, and a crossword-craft scorer decides what ships.

## Problem Solved

Branded crosswords for a team, a newspaper or a campus are usually hand-built by a constructor, which is slow and expensive. Generating them with an LLM alone gives you something that looks like a crossword but is not one: sparse grids, unchecked letters, invented phrases and confidently wrong trivia. This project produces puzzles that follow real construction rules, catches fabricated content before a customer sees it, and wraps the result in a self-serve site that a tenant can run and pay for without an operator.

## Target Users

- **Organisations that want a branded puzzle** (teams, publishers, schools): a hosted puzzle page in their colours, with a daily puzzle, an archive and a leaderboard to bring people back
- **Editors** who want today's stories in today's puzzle: paste the headlines, then see which ones made it into the grid as answers and which only through clues
- **Casual solvers**: a free single-player generator at `/legacy` with stats, streaks, sharing and offline puzzles

## Key Features

### Real grids with themed marquee entries
Each puzzle is built on an 11x11, 15x15 or 21x21 template, or on a shape the operator draws. Templates are measured against published-grid rules. The model's themed answers go into 7+ letter slots at symmetric positions, and the solver fills everything else from the dictionary.

### Quality report on every generation
The admin preview shows a 0-100 score, an A-F grade and up to six findings, worst first: a duplicate entry, a likely fabricated marquee answer, theme "wallpaper" clues, answers not in the word list. The operator knows exactly what to check before publishing.

### Multi-theme coverage
Up to 20 themes per puzzle. The coverage panel separates the themes that placed an answer of their own from those that appear only in a clue, so the operator can regenerate with an uncovered theme prioritised. At completion, the solver sees credit lines for the source stories.

### Drafts, tokens and checkout
One token buys a job of up to three drafts, and a failed generation refunds automatically. Tenants buy packs from $20 for a single puzzle down to $10 a puzzle at 50, through Stripe Checkout, and the balance updates from a signed webhook.

### Two puzzle styles
The default grid style puts a few theme answers among dictionary fill. The simple style is a criss-cross in which every answer is a theme word. It gives up the newspaper grid in exchange for full theme density, and it is audited so that no stray letter pairs form non-words.

### A complete solver
Keyboard and mobile clue-bar navigation, checker mode, three scattered hints that jump to their clue, a timer, saved progress, streaks and best times, four colour themes including high-contrast ones, share links, and an installable PWA with offline puzzles.

## Technical Highlights

### Arc-consistent fill search over word bitsets
A plain backtracking search with forward checking could not finish the larger templates within its time budget, and giving it ten times the budget barely moved the fill rate. That pattern points to too little inference rather than too little time. `fill()` in `lib/grid/filler.ts` now maintains arc consistency between slots and crossing squares. Each slot holds a bitset of its still-legal words, and each square holds a 32-bit mask of the letters still possible there. Placing a word propagates to a fixpoint, slots are chosen by MRV from a cached popcount, and candidates are ordered least-constraining first. The search is deterministic for a given pool, so an operator's retry is reproducible and the filler is unit-testable.

### Spending variance-reduction on the free step
Quality varied widely between fills of a single word pool. One measured run scored 55 to 85 across five fills of the same pool. Clue writing, meanwhile, is most of a puzzle's cost. `seedFillAndPick` in `lib/crossword-generator.ts` builds three fills from one pool and ranks them by fill rate and then by the clue-free `scoreFill`, and only the winner is clued. The tail improves with no extra model calls. The default of 3 was set against a pre-stated rule, because 5 added almost nothing.

### Fact-checking with a fresh context
Form checks cannot catch a fluent, on-theme clue about a player who does not exist. `lib/ai/fact-check.ts` filters clues with a free regex for checkable claims (about a quarter of them), then sends those to a verifier call that has no writing context. The verifier states the deciding fact in a few words before giving `true`, `false` or `unsure`. On a labelled fixture, stating the fact first raised catches from 5 of 14 fabrications to 12 of 14. Clues judged false are rewritten, and the pass can only replace clues, never fail a generation.

### Exactly-once money movement on Redis
Concurrency hazards exist on both sides of the ledger. Spending is a single `DECRBY`, compensated if it overshoots (`lib/tenant-tokens.ts`). Draft claims are a single `INCR` with a 24h TTL (`lib/draft-jobs.ts`). Stripe's at-least-once webhooks are handled by `SET NX` on the session id before the `INCRBY` (`lib/token-purchase.ts`). The webhook verifies the signature over the exact raw bytes rather than re-serialised JSON (`api/stripe-webhook.ts`).

## Engineering Decisions

### Solver-built grids over LLM-built grids
- **Constraint**: A puzzle sold as a crossword has to obey crossword rules, and the LLM is the most expensive and least reliable part of the pipeline
- **Options**: Ask the model for words and let a layout library arrange them, let the model choose slots in a fixed grid, or fix the grid and fill it from a dictionary
- **Choice**: A fixed symmetric mask filled from a scored, content-filtered word list, with only the theme entries supplied by the model
- **Why**: The layout-library approach produced grids that did not read as crosswords, and the model-picks-slots mode measured far below seeded fills while landing no theme entries. The dictionary approach is rule-compliant by construction and keeps model output short

### Flag uncertain answers instead of filtering them
- **Constraint**: A themed puzzle is bought for entries a static list cannot know, but invented phrases look the same
- **Options**: Drop anything not in the list, trust the model, or flag for review
- **Choice**: Keep the answer, mark it `novel` when the list does not carry it or the model said it was unsure, and show it to the operator. The hard gate rejects any that slip through unflagged
- **Why**: Only a human can tell a current-season name from a fabrication. Dropping them would remove the reason to buy a themed puzzle

### Hide quality-damaging controls from customers, not from the API
- **Constraint**: Obscure vocabulary and a high word-score floor measurably starve the theme or make fills incomplete, and drawing grids confused buyers
- **Options**: Remove the controls, leave them for everyone, or tier them by actor
- **Choice**: `src/tenant/exposure.ts` shows these controls only to the platform operator. The API still accepts them from anyone authorised to generate
- **Why**: Operators keep every dial for batch work and showpiece puzzles, customers get defaults the quality numbers were measured on, and the security boundary stays in `lib/tenant-authz.ts`

### PBKDF2 and stateless sessions on Web Crypto
- **Constraint**: The same auth code runs in Node functions, Edge Middleware and Vitest
- **Options**: scrypt or Argon2 through a native dependency, server-side sessions in Redis, or PBKDF2 with HMAC sessions
- **Choice**: PBKDF2-HMAC-SHA256 at 600k iterations via `crypto.subtle`, and self-contained HMAC session cookies with a 12h TTL (`lib/tenant-auth.ts`)
- **Why**: PBKDF2 is the only real KDF in all three runtimes without a dependency, and authorisation needs no Redis read. The trade-off is that revocation means rotating the secret, which is acceptable for a small set of tenant admins

## Frequently Asked Questions

### What does the model actually do, and what does code do?
The model makes up to three calls per puzzle: a themed word pool sized only to the theme slots, clues for the answers that landed, and the fact check. Everything else is deterministic code: choosing theme slots, filling the grid from the word list, picking the best candidate, scoring and gating. The model is Claude Sonnet 5 by default and can be set per call site in `lib/ai/models.ts`.

### How does it know a puzzle is good enough to publish?
`lib/quality-gate.ts` has two tiers. Hard failures return no puzzle and refund the token: a fill below 95%, a fill whose misses cannot be blackened into a legal grid, a themed puzzle with no theme entry, or an unknown answer that was not flagged. Soft issues, such as more than three wallpaper clues or more than one answer echoed in the puzzle's own clues, become warnings in the preview next to the A-F grade from `lib/quality-score.ts`.

### Can a tenant use their own grid shape?
Yes, through the platform operator. The grid designer (`src/tenant/GridDesigner.tsx`, backed by the pure state machine in `src/grid/maskEditor.ts`) supports 180-degree symmetry, drag painting, undo and keyboard input. It shows live slot statistics, and after a fill it highlights the slots the filler missed. Saved shapes are stored per tenant as compact bitsets, and a customer can pick a saved shape from a list.

### What happens if a generation fails after I've paid a token?
The token and the draft are both rolled back (`rollbackGeneration` in `lib/metering.ts`). A successful generation that you choose not to publish is not refunded, because that is what the other two drafts in the job are for.

### Can the content be trusted for a family audience?
The dictionary is rebuilt by `scripts/build-wordlist.ts` with an explicit blocklist (`data/wordlist-blocklist.txt`), because the upstream list scores entries for construction quality, not suitability. A score floor alone would let some vulgar entries through. A curated supplement adds real entries the list is missing, and the build fails if an entry appears in both files.

### How is the public generator protected from abuse?
Per-IP fixed-window limits in Upstash Redis are keyed on the edge-set `x-real-ip`: 10/min with a valid Turnstile token and 3/min without one. Turnstile is never a hard block. `PUBLIC_DAILY_GENERATION_CAP` adds an optional ceiling on total unmetered generations per UTC day. Tenant generations are metered instead, and they fail closed when Redis is unavailable.

### Does it work offline?
The single-player app does. The service worker precaches 15 pre-generated puzzles, one per theme, and the app falls back to them when the device is offline or when network errors persist after retries. Tenant pages need the API, because their puzzles live in Redis.

### Do old share links still work now that the root is a tenant site?
Yes. `resolveAppView` in `lib/tenants.ts` routes both `?p=` and the older `#puzzle=` links to the legacy solver before falling back to the default tenant. A shared puzzle is decoded from the URL itself, so links never expire and never call the API.
