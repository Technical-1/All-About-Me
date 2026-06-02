# Project Q&A

## Overview

EbayViews Desktop is a local PyQt6 app for controlled eBay listing request experiments. It lets a user fetch public seller listings, select items in a desktop table, tune conservative request settings, and watch progress/errors in real time while preserving a CLI path for single-item runs.

## Problem Solved

The original script demonstrated repeated HTTP requests to one item but had no guardrails: no selectable item workflow, no settings persistence, no progress UI, no retries, and no bounded worker pool. This version turns the idea into a more inspectable desktop application where request volume, concurrency, and failure states are visible and configurable.

## Target Users

- **Python desktop learners** — can study PyQt widgets, dialogs, signals, and background work in a compact application.
- **Engineers reviewing automation trade-offs** — can inspect how the project handles bounded concurrency, parsing uncertainty, retries, proxy rotation, and deterministic testing.
- **Portfolio reviewers** — can see a small script evolve into a structured package with UI, configuration, tests, and documentation.

## Key Features

### Seller listing retrieval

The app accepts a public seller URL and retrieves item IDs, titles, prices, and links. `SellerItemFetcher` follows pagination up to a configured limit and deduplicates listings by item ID before returning table-ready records.

### Selectable desktop workflow

`MainWindow` renders fetched items in a checkable `QTableWidget`, so the user can decide which listings to include. This makes selection explicit instead of requiring separate command-line runs for every item.

### Configurable request generation

`ViewGenerator` uses a bounded `ThreadPoolExecutor` and validated settings for concurrency, intervals, timeouts, retries, user-agent rotation, and optional proxies. The request engine returns structured results instead of relying on print statements.

### Real-time status feedback

Fetch and generation work run in background threads while Qt signals update the progress bar and log area. The UI remains responsive and user-facing errors appear in the same status surface as successful progress messages.

## Technical Highlights

### Robust parser fallback for public seller HTML

`ebayviews/fetcher.py` does not assume a single perfect selector. It scans item links for eBay item IDs, searches nearby containers for title and price signals, handles generic link text such as “View item,” follows `rel="next"` pagination, and raises `SellerFetchError` when parsing cannot produce usable listings.

### Bounded concurrency with structured outcomes

`ebayviews/generator.py` replaces raw thread spawning with `ThreadPoolExecutor`. Every request produces a `RequestResult` with item ID, request number, status, HTTP code, and error text, which gives both the UI and tests a stable contract to inspect.

### UI-safe background work

`ebayviews/app.py` keeps network calls out of the Qt main thread. Worker functions emit `fetched_signal`, `progress_signal`, `log_signal`, and `error_signal`, so widget updates happen through Qt's signal mechanism rather than direct mutation from worker threads.

### Test coverage without depending on the network

The default pytest suite mocks network calls and runs PyQt smoke tests offscreen. A separate live test uses the public seller URL only when `EBAYVIEWS_LIVE_TESTS=1` is set, which keeps everyday validation deterministic while still allowing a current eBay markup check.

## Engineering Decisions

### Desktop app plus CLI compatibility
- **Constraint**: The project needed a richer desktop workflow without losing the original one-command experiment.
- **Options**: Replace the script entirely, keep the script only, or share a request engine between UI and CLI.
- **Choice**: Share the request engine and keep `EbayViewBot.py` as a compatibility launcher.
- **Why**: This preserves the simple usage path while letting the UI and CLI benefit from the same safer generator code.

### Public HTML parsing over official API setup
- **Constraint**: Seller discovery should work without requiring credentials, tokens, or an API onboarding flow.
- **Options**: Use the official eBay API, automate a browser, or parse public HTML.
- **Choice**: Parse public HTML with BeautifulSoup.
- **Why**: HTML parsing is the lightest setup for a local learning tool. The docs and tests make the maintenance trade-off explicit.

### Conservative defaults over maximum throughput
- **Constraint**: Request generation can create network pressure quickly if concurrency and counts are left unchecked.
- **Options**: Maximize throughput, mirror the original unbounded thread model, or clamp settings.
- **Choice**: Clamp concurrency, retries, page limits, and minimum timeout values.
- **Why**: Safe defaults make behavior predictable and easier to reason about in both the UI and tests.

### Optional live test over live-dependent suite
- **Constraint**: A parser for public marketplace HTML benefits from real-page validation, but external pages are unstable.
- **Options**: Always test against eBay, never test against eBay, or make live tests opt-in.
- **Choice**: Keep deterministic tests as the default and gate the live test behind `EBAYVIEWS_LIVE_TESTS=1`.
- **Why**: The project gets fast reliable validation and still has a deliberate path for checking current eBay markup.

## Frequently Asked Questions

### Does the app use the official eBay API?

No. It fetches public seller pages and parses listing HTML with BeautifulSoup. That avoids credential setup, but it means parsing may need updates if eBay changes its markup.

### Does the app display live eBay view counts?

No. The app displays generated request progress, not live eBay view totals, because listing view counts are not reliably exposed in public page HTML.

### How does item selection work?

Fetched seller items are stored as `SellerItem` records and displayed in a checkable table. `MainWindow.selected_items()` reads checked rows and passes only those records to `ViewGenerator`.

### How are proxies configured?

The settings dialog accepts a local proxy file path. `load_proxies()` reads non-empty, non-comment lines and `ViewGenerator` rotates them across scheduled requests.

### What happens when a request fails?

`ViewGenerator` retries according to the configured retry count. If all attempts fail, it returns a failed `RequestResult` with error text and emits a log message for the UI.

### Can I still run it without the desktop UI?

Yes. `python EbayViewBot.py --item-id 123456789012 --views 3` runs the compatibility CLI path through the same generator module.

### How do I run the live seller-page test?

Run `EBAYVIEWS_LIVE_TESTS=1 pytest tests/test_live_ebay.py -q`. The default test suite skips that check so normal development does not depend on eBay network availability.
