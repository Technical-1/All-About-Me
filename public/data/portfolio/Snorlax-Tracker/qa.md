# Project Q&A

## Overview

Snorlax Master Checklist is a single-page React app that tracks every Snorlax Pokémon TCG card ever printed — 182 entries across every era, language, and variant. It shows live TCGPlayer prices and card scans, lets you check off the ones you own, override images and prices per card, and move your whole collection between devices via CSV export/import (or print a paper checklist). It's fully client-side with no accounts or backend; everything persists in the browser, and it's deployed as a static site on Vercel.

## Problem Solved

Tracking a deep collection across decades of printings is hard because the data is fragmented: pokemontcg.io has live English prices but no non-English scans and is missing many cards entirely; TCGdex has scans across languages but no prices. Existing trackers either skip variants, mislabel cards, or require an account. This project resolves all 182 Snorlax printings against the right scan offline (auditable in a diff), pulls live prices for the ones that have them, and stores everything in the browser so there's no signup and no server bill.

## Target Users

- **Snorlax collectors** — track every printing including TCG Pocket, Japanese/Korean/Chinese/European variants, and reverse-holos
- **TCG hobbyists building a focused single-card collection** — the architecture generalizes; the data layer is one file
- **Developers curious about client-side-only apps** — full RFC-4180 CSV codec, deterministic image resolution, and zero backend in ~2k lines of TypeScript

## Key Features

### Complete catalog
All 182 Snorlax printings — Wizards through Scarlet & Violet, TCG Pocket, plus Japanese/Korean/Chinese/European variants — grouped by era with filters and search.

### Live prices + resolved images
TCGPlayer prices fetched at runtime from pokemontcg.io; card scans resolved offline from TCGdex with a labeled English proxy when no localized scan exists. Images never change at runtime — they're baked at build time.

### Owned tracking
One-click checkbox per card, persisted per browser. A running collection-value total updates as you check cards (using manual price overrides where set, fetched price otherwise).

### Manual overrides
Per-card image (paste a URL or upload a file — uploads are downscaled and budget-checked before storage) and manual price. Manual values win over fetched data everywhere, including the value total.

### Export / import / print
CSV round-trip to move a collection between devices (merge rules: owned synced, file wins on manual fields when present). A print-friendly era-grouped checklist for taking to events.

## Technical Highlights

### Hybrid image resolution: offline matching, runtime prices
pokemontcg.io misses many Snorlax cards and has no non-English scans, and resolving images in the browser is slow and impossible to audit. The offline resolver (`scripts/resolve-images.ts`) matches every card to a TCGdex scan by exact set + collector number + language — guarded by a name check that rejects the look-alike "Snorlax Doll" card — and falls back to a clearly labeled English proxy otherwise. The result is committed as `src/data/card-images.generated.ts`, so image accuracy is reviewable in a diff rather than guessed at runtime. Prices, which actually change, stay live.

### A CSV codec that survives base64
Uploaded card images are stored as base64 data URLs — which contain a comma (`data:image/webp;base64,…`). A naïve `split(",")` would shred them. The export/import uses a hand-written RFC-4180 codec (quoting, escaped quotes, embedded newlines, CRLF) in `src/lib/collectionCsv.ts` so an entire collection — owned state, manual prices, and embedded images — round-trips through a single CSV file intact.

### Pure-logic libs + thin hooks + presentational components
All non-trivial behavior (CSV codec, override merge, price-tier selection, image resolver) lives in pure modules in `src/lib/` with unit tests. Hooks (`useOwnedCards`, `useUserCardData`, `useCardPrices`) own persistence and fetching; components are thin. UI changes can't silently break the tricky logic because it's not in the UI.

### ID reconciliation with fail-safe matching
Three different ID schemes exist across the data sources: the app's friendly IDs, pokemontcg.io's IDs (which postdate many older cards), and TCGdex's set+collector-number scheme. The resolver never trusts a fuzzy match — it requires set+number+language to align exactly, then double-checks the card name. The output is correct-or-proxy, never confidently wrong; unmatched cards surface in the resolver's run summary so they're visible rather than buried.

## Engineering Decisions

### localStorage-only persistence over a backend
- **Constraint**: Users want to track ownership and customize per-card data across sessions and devices, but the app is a hobby project.
- **Options**: Firebase/Supabase backend with accounts; URL-hash state; pure local persistence with manual export.
- **Choice**: Browser `localStorage` (`snorlax_v3` = owned set, `snorlax_user_v1` = manual overrides), plus CSV export/import for cross-device portability.
- **Why**: Zero infrastructure cost, instant first load, no privacy concerns, and the CSV doubles as a portable backup. The trade-off — no automatic device sync — is solved by the import flow.

### Build-time image resolution over runtime API calls
- **Constraint**: Image data is essentially static (a printing's artwork doesn't change), but live API resolution would be slow and unreviewable.
- **Options**: Fetch images at runtime from pokemontcg.io / TCGdex; preload at build time; commit a static image map.
- **Choice**: Offline resolver that writes `card-images.generated.ts`, committed to the repo.
- **Why**: Each card's image URL is visible in git diffs, so a wrong match shows up in code review rather than silently rendering the wrong scan. The browser does zero image resolution work — it just renders the resolved URL.

### Inline styles over a CSS framework
- **Constraint**: The app has ~10 components, a clear visual style, and no team to onboard.
- **Options**: Tailwind, CSS Modules, styled-components, inline styles.
- **Choice**: Inline `style={{...}}` throughout, plus one injected `@media print` rule for the print view.
- **Why**: Zero build-time CSS overhead, no class-name collisions, and the component file *is* the styling — easy to grok. For a 2k-line app this is faster to iterate on than any abstraction.

## Frequently Asked Questions

### How does the manual override system work?
A pure `applyUserOverrides` function layers a per-card `{ img?, price? }` record (persisted to `localStorage["snorlax_user_v1"]`) on top of the enriched card. Manual values win everywhere — grid, list, detail, and the collection-value total — and uploaded images are downscaled before storage with a size-budget guard so localStorage can't overflow.

### Why no backend or accounts?
The catalog is fixed and small, and the only dynamic data (prices) comes from a public API. Keeping it fully client-side means zero infrastructure, instant load, and no privacy surface; the CSV export/import covers cross-device portability without needing a server.

### How does the app handle a card with no available scan?
It tries an exact TCGdex match in the card's own language, then an English equivalent as a labeled proxy ("EN proxy" badge), then a 😴 placeholder. It never shows a confidently-wrong image — unmatched cards are deliberate misses, surfaced in the resolver's run summary.

### What happens when I import a CSV from another device?
Owned state is synced to the file (the file is authoritative). Manual price/image from the file overwrite local values when present; blank fields in the file keep what's already there. Images that would push localStorage over budget are skipped and reported by name, so nothing fails silently.

### Why does my collection value sometimes change without buying anything?
Prices are live from pokemontcg.io and update with TCGPlayer market data. To pin a price, set a manual override on the card's detail view — that value will win everywhere.

### Can I share my collection without setting up an account?
Yes — export your CSV and send it to anyone. They can import it into their own browser instance. Owned state and manual overrides travel together.

### How is the catalog kept up to date when new Snorlax cards print?
Add an entry to `src/data/cards.ts` and run `npm run resolve-images`. The script re-resolves the new card's scan against TCGdex and updates the committed image map; the next build picks it up. No DB migration, no deploy hook.

### Why are old cards missing prices?
Cards whose IDs predate pokemontcg.io's current scheme have images (resolved from TCGdex) but no live price. Set a manual price on those if you want them counted in the collection-value total.
