# Project Q&A Knowledge Base

## Overview

Redfin Property Scraper is a cross-platform Electron app that enriches a CSV of addresses with Redfin data: estimated value, last sale price and date, appreciation, beds, baths, square footage, year built, and more. Instead of searching Redfin one address at a time, a user drops in a spreadsheet, previews and trims it, and gets back CSV, Excel, or JSON output with a data-quality summary. The interesting technical angle is that it reads Redfin's own JSON endpoints through a bundled Chrome session, keeps a WASM SQLite cache across runs, and paces itself from the responses it gets back.

## Problem Solved

Manually researching properties on Redfin does not scale past a handful of addresses. Investors, agents, and analysts often need valuations and basic stats for dozens or hundreds of properties at once, and they re-check the same lists repeatedly. This tool turns a list into an enriched spreadsheet in one run, remembers what it has already looked up, and survives being stopped or crashing halfway through a long batch.

## Target Users

- **Real estate investors** — Bulk-evaluate a target list with current estimates, last sale price, and appreciation
- **Agents** — Pull basic stats and estimates across a territory without hundreds of manual searches
- **Property analysts** — Build a dataset for a valuation model, with Excel output that already has numeric cells

## Key Features

### Preview before scraping
Dropping a CSV shows the row count, validation warnings (empty or unusual addresses), the detected address columns highlighted, and the first 10 rows. Nothing is fetched until the user starts a run.

### Row and column selection
Each row has a checkbox, with select-all and a "Deselect duplicates" button that works across the whole file, not just the visible rows. The user can also untick any of the 15 enriched columns to leave them out of every output format.

### Test first row
One click scrapes only the first row and shows all 15 fields, so the user can confirm the result looks right before starting a long batch.

### Persistent cache
Found properties are remembered for 30 days and confirmed misses for 3 days. Re-running a list serves cached rows instantly, repeated addresses in one file are fetched once, and a "Force fresh" toggle and "Clear cache" button (with entry count and file size) are in the UI.

### CSV, Excel, and JSON output
CSV is always written; `.xlsx` and `.json` are optional. The Excel file stores currency and counts as real numbers with number formats, so it sorts and sums without cleanup.

### Adaptive pacing with a visible banner
When Redfin starts returning 403s, the delay between addresses increases and a banner says so. It returns to normal gradually once responses are clean again.

### Data-quality summary
After a run, the results panel shows how many addresses were found, per-column fill rates sorted lowest first, and how many rows came from the API, the browser fallback, both, or the cache.

### Stop, resume, start over
A Stop button finishes the current address and exits cleanly. Reopening the same file offers Resume or Start Over, and the progress bar picks up from the right row.

## Technical Highlights

### API calls that ride the browser's TLS session
Redfin's CDN rejects plain Node.js HTTPS requests, so `RedfinScraperV4.init()` in `scraper-v4.js` opens redfin.com in the bundled Chrome and injects `PuppeteerScraper.browserFetch` into `StingrayAPI` with `setFetcher`. Each request runs `fetch` inside the page with an `AbortController` timeout, and timeouts surface as status 0 so the client's retry logic treats them like any other transient failure. Because the fetcher is injected, `modules/api-client.test.js` exercises the client with a stub and no browser.

### Pacing driven by response codes
`AdaptivePacer` in `modules/rate-limiter.js` keeps the last 20 statuses, weighting 403 as 1.0 and network failures as 0.5. Once there are at least 5 samples and the weighted rate reaches 0.3, a blocked outcome raises the throttle level and the delay becomes baseline x 1.8^level, capped at 15 s. Only a streak of 10 clean responses steps it down one level. Separating "what can raise" from "what can lower" gives hysteresis without timers, which keeps the class pure and directly testable.

### Resume that cannot silently corrupt output
The checkpoint written after every row stores the input path and the row/column selection. `selectionMatchesCheckpoint` refuses to resume if the selection changed, and `resolveResumeState` refuses if the `.partial` file has fewer rows than the checkpoint claims. At the end, exports and the quality summary are built by re-reading the full `.partial`, not from in-memory rows, so a run resumed three times still produces one complete file.

### One address identity, used everywhere
`normalizeAddress` in `modules/address.js` lowercases, strips punctuation, and folds USPS-style suffixes and directionals ("North Main Street" and "N Main St" become the same key). It is the cache key, the in-run dedup key, and the basis of `computeDuplicateMask` in the preview, so "Deselect duplicates" and the cache agree on what a duplicate is.

## Engineering Decisions

### sql.js over a native SQLite module
- **Constraint**: The cache has to work in packaged builds for macOS x64 and arm64, Windows, and Linux.
- **Options**: `better-sqlite3` or `sqlite3` (native, rebuilt against Electron's ABI per target), a JSON file, or `sql.js` (WASM).
- **Choice**: `sql.js`, with `sql-wasm.wasm` bundled through electron-builder `extraResources` and located by `modules/cache-wasm-path.js`.
- **Why**: One WASM file works on every target with no native rebuild step in CI. Indexed lookups by address and property ID are still real SQL. The cost is that the database lives in memory and is flushed to disk, which `PropertyCache` does every 10 writes and on close.

### Bundle a pinned Chrome instead of relying on the user's
- **Constraint**: The app needs a real Chrome on machines where none may be installed, and the user-agent strings it advertises should match the browser actually running.
- **Options**: Full `puppeteer` (downloads Chromium at install time), detect a system Chrome, or `puppeteer-core` plus a pinned Chrome for Testing.
- **Choice**: `puppeteer-core` with Chrome for Testing 149 downloaded by `scripts/download-chrome.js` in `prebuild` and shipped in `extraResources`.
- **Why**: Every install runs the same browser build. `scripts/download-chrome.test.js` fails if the pinned major version drifts away from every Chrome user agent in `modules/config.js`, so the two are updated together.

### Fetch all fields, project only at write time
- **Constraint**: Users want to drop output columns, but the cache should be reusable by later runs that want different columns.
- **Options**: Skip fetching deselected fields, or fetch everything and filter on output.
- **Choice**: Always fetch all 15 fields; `writeOutputs` in `modules/exporters.js` applies the column projection to CSV, XLSX, and JSON alike.
- **Why**: Cached entries stay complete, all three formats are guaranteed to match, and the quality summary (computed before projection) does not report deselected columns as empty.

### Keep the Chrome sandbox on for end users
- **Constraint**: The app loads live pages and runs `fetch` against remote responses.
- **Options**: Always pass `--no-sandbox` for simplicity, or only where the OS requires it.
- **Choice**: `buildLaunchArgs` in `modules/puppeteer-scraper.js` adds `--no-sandbox` only in CI or the unpackaged dev environment.
- **Why**: The sandbox is a real security boundary on user machines; dropping it everywhere would trade safety for a convenience only needed in containers.

## Frequently Asked Questions

### What columns does my CSV need?
Street, city, state, and ZIP, with common variants accepted (`Street`/`Address`, `City`/`CITY`, `Zip Code`/`ZIP`/`zipcode`, and so on). Rows with an empty street or city are warned about and skipped; very short or digit-only streets are flagged as unusual. The app can save a template CSV for you.

### Why are some columns empty even when the address was found?
The API path fills estimate, last sale, appreciation, beds, baths, square footage, and year built. Lot size, price per square foot, property type, and listing status come from the property page, which is only scraped when the API returns no estimate. The quality panel's fill rates show exactly which columns are sparse for a given run.

### How do I tell where a row's data came from?
The `Data Source` column is `api`, `browser`, `api+browser`, or `cache`. The quality summary also totals rows by source.

### What happens if I run the same list twice?
Rows found in the last 30 days come straight from the local cache and are marked `cache`; addresses confirmed missing in the last 3 days are skipped. Tick "Force fresh" to re-fetch everything for one run, or "Clear cache" to empty it.

### What if I change the row selection and then press Resume?
The app starts over instead. The checkpoint records which rows and columns the original run used, and resuming with a different selection would mix two different row sets in one output file.

### Why does the Excel file behave differently from the CSV?
The CSV keeps Redfin's display strings (for example `$450,000`). The `.xlsx` converts currency and count columns to numbers with `$#,##0` and `#,##0` formats, leaving cells blank rather than 0 when a value is missing or unparseable. If the `.xlsx` is open in Excel and cannot be overwritten, the CSV and JSON are still written and the error is reported.

### Does it run on Apple Silicon?
Yes. electron-builder produces separate arm64 and x64 macOS builds. Note that the `prebuild` script downloads Chrome for the architecture of the machine running the build, so the bundled browser matches that machine's architecture.

### Why does macOS warn the first time I open it?
Builds are only signed and notarized when Apple Developer credentials are configured as GitHub Actions secrets; otherwise the binaries are unsigned and Gatekeeper warns on first launch.
