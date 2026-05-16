# Project Q&A Knowledge Base

## Overview

Snorlax Master Checklist is a single-page React app that tracks every Snorlax Pokémon TCG card ever printed — across every era, language, and variant (182 entries). It shows live TCGPlayer prices and card scans, lets you check off the ones you own, manually override images and prices per card, and move your whole collection between devices via a CSV export/import or print a paper checklist. It's fully client-side with no accounts or backend; everything persists in the browser, and it's deployed as a static site on Vercel (https://snorlax-tracker.vercel.app).

## Key Features

- **Complete catalog**: All 182 Snorlax printings — Wizards through Scarlet & Violet, TCG Pocket, plus Japanese/Korean/Chinese/European variants — grouped by era with filters and search.
- **Live prices + resolved images**: TCGPlayer prices fetched at runtime from pokemontcg.io; card scans resolved offline from TCGdex (with a labeled English proxy when no localized scan exists).
- **Owned tracking**: One-click checkbox per card, persisted per browser; a running collection-value total.
- **Manual overrides**: Per-card manual image (paste a URL or upload a downscaled file) and manual price, which win over fetched data everywhere.
- **Export / import / print**: CSV round-trip to move a collection between devices (merge, file wins on conflicts, owned synced); a print-friendly era-grouped checklist.

## Technical Highlights

### Hybrid image resolution
pokemontcg.io is missing many cards and has no non-English scans, and resolving images in the browser is slow and impossible to audit. I built an offline resolver (`scripts/resolve-images.ts`) that matches every card to a TCGdex scan by exact set + collector number + language — guarded by a Snorlax-name check that rejects the look-alike "Snorlax Doll" card — and falls back to a clearly labeled English proxy otherwise. The result is committed as `card-images.generated.ts`, so image accuracy is reviewable in a diff rather than guessed at runtime. Prices, which actually change, stay live.

### A CSV codec that survives base64
Uploaded card images are stored as base64 data URLs — which contain a comma (`data:image/webp;base64,…`). A naïve `split(",")` would shred them. The export/import uses a hand-written RFC-4180 codec (quoting, escaped quotes, embedded newlines, CRLF) so an entire collection — owned state, manual prices, and embedded images — round-trips through a single CSV intact.

### Behavior-preserving decomposition
The app started as one ~1,600-line file. I refactored it into focused, unit-tested modules (data, lib, hooks, components) without changing a pixel — verified by diffing every component against the original and locking the tricky logic (price-tier selection, reverse-holo handling, override merging) under tests.

## Development Story

- **Timeline**: Built iteratively in a series of brainstorm → spec → plan → review cycles.
- **Hardest part**: Getting image and price coverage right — the data sources disagree on IDs (the app's friendly IDs vs pokemontcg.io's scheme vs TCGdex's), so matching is inherently fuzzy and had to fail safe (correct-or-proxy, never a confidently-wrong image).
- **Lessons learned**: Empirical verification beats assumptions — a "pricing regression" turned out to be a perception effect (more images made always-missing prices visible), and a plausible-looking query syntax silently returned zero results until tested against the live API.
- **Future plans**: Optional second image source for the remaining Japan-only cards; a real per-tier price table in the detail view.

## Frequently Asked Questions

### How does the manual override system work?
A pure `applyUserOverrides` function layers a per-card `{ img?, price? }` record (persisted to `localStorage["snorlax_user_v1"]`) on top of the enriched card. Manual values win everywhere — grid, list, detail, and the collection-value total — and uploaded images are downscaled before storage with a size-budget guard so localStorage can't overflow.

### Why no backend or accounts?
The dataset is fixed and small, and the only dynamic data (prices) comes from a public API. Keeping it fully client-side means zero infrastructure and instant load; the CSV export/import covers cross-device portability without a server.

### How does the app handle a card with no available scan?
It tries an exact TCGdex match in the card's own language, then an English equivalent as a labeled proxy, then a placeholder (😴). It never shows a confidently-wrong image — unmatched cards are deliberate misses, surfaced in the resolver's summary.

### Why is the planning documentation not in the repo?
Design specs and implementation plans are kept local-only (gitignored) by choice; the repo holds the app, tests, and the portfolio docs in `.portfolio/`.

### What was the most challenging part?
Reconciling three card-ID schemes (the app's, pokemontcg.io's, TCGdex's) so images and prices land on the right card. The fix was to never trust a fuzzy match: exact set+number+language with a name guard, explicit proxy fallback, and an auditable generated artifact.

### What would you improve?
Source localized scans for the ~Japan-only printings that currently fall back to a proxy, surface the per-printing price table in the detail view, and add a small end-to-end test around the export → import → restore round-trip.
