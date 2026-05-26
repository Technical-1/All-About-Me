# Project Q&A Knowledge Base

## Overview

Redfin Property Scraper is a cross-platform desktop application that enriches CSV files of property addresses with real estate data from Redfin. I built it to automate bulk property lookups — instead of manually searching Redfin for each address, I upload a CSV and get back estimated values, sale history, and property details for every address in the file.

## Problem Solved

Manually researching properties on Redfin doesn't scale past a handful of addresses. Realtors, investors, and analysts often need to compare valuations, recent sale prices, square footage, and year built across dozens or hundreds of properties. This tool turns a CSV of addresses into an enriched CSV in one click, with crash recovery so long jobs survive interruptions.

## Target Users

- **Real estate investors** — Bulk-evaluate potential acquisitions by enriching a list of addresses with current Redfin estimates, last sale price, and appreciation
- **Realtors and agents** — Pull comps and listing details across territories without 100+ manual searches
- **Property analysts** — Build datasets for valuation models without paying for an enterprise data API

## Key Features

### API-First Data Extraction
Uses Redfin's internal Stingray API for fast, structured data retrieval instead of slow browser scraping. Per-address time dropped from ~30 seconds to ~13–15 seconds.

### Intelligent Fallback
Automatically falls back to full Puppeteer browser scraping when API endpoints fail or return incomplete data, so a single API change doesn't break the tool.

### Batch CSV Processing
Upload a CSV with Street/City/State/Zip columns and get back an enriched CSV with 15 new data columns: Redfin Estimate, Purchase Price, Year Purchased, Appreciation, Beds, Baths, Sq Ft, Lot Size, Year Built, Price/Sq Ft, Property Type, Listing Status, Property ID, Redfin URL, and Data Source.

### Real-Time Progress
Visual progress bar, per-address status, and terminal-style log output show success or failure for each row as the job runs.

### Crash Recovery
Each processed row is written to a `.partial` output file immediately, with a `.checkpoint` JSON tracking progress. If the app crashes or is killed, restarting resumes from the last completed address.

### Cross-Platform Distribution
Builds for macOS (DMG), Windows (NSIS/Portable), and Linux (AppImage/DEB) via GitHub Actions.

## Technical Highlights

### API-First Pipeline in `scraper-v4.js`
The scraper runs a 3-step pipeline for each address: Puppeteer resolves the address to a `propertyId` (the only step that truly needs a browser), two parallel HTTPS requests fetch valuation and historical JSON, and Puppeteer only runs full-page scraping if the API returned no estimate. `Promise.all` runs the AVM and historical-data fetches concurrently, which is the single biggest win in throughput.

### Anti-Bot Evasion Layers
Redfin actively blocks obvious automation. `PuppeteerScraper` in `scraper-v4.js` combines `puppeteer-extra-plugin-stealth` (patches the WebDriver flag and other automation fingerprints), an 8-string user-agent rotation, randomized per-character typing speed, jittered navigation delays, and slight random offsets on viewport dimensions. Exponential backoff handles transient 403 blocks.

### Resilient Selector Fallbacks
Redfin's DOM varies by property type, listing status, and the day of the week. Rather than chasing every redesign, the browser-fallback path keeps an ordered array of selectors for each field (e.g., six different selectors for beds) and a `trySelectors` helper that returns the first match. This isolates DOM churn to one small file change.

### Stingray JSONP Quirk
Redfin's internal endpoints prefix every response with `{}&&` — a JSONP-style guard. `StingrayAPI` strips that prefix before `JSON.parse`. Missing this step was the silent bug that wasted the most debugging time, and it's now the first thing the response handler does.

## Engineering Decisions

### API-first over pure browser scraping
- **Constraint**: Pure Puppeteer scraping was ~30s/address and broke on every Redfin layout tweak
- **Options**: Stick with browser scraping and harden selectors, find a third-party real-estate API, or reverse-engineer Redfin's own internal API
- **Choice**: Use Redfin's internal Stingray API for data, keep Puppeteer only for address-to-propertyId resolution
- **Why**: 10x faster, returns structured JSON instead of scraped DOM, and the API surface changes less often than the visible HTML. Browser fallback covers the case where the API does change

### Electron for the desktop shell
- **Constraint**: Non-technical users need to drag a CSV onto a window — a CLI was a non-starter
- **Options**: Electron, Tauri, or a hosted web app with file upload
- **Choice**: Electron
- **Why**: Puppeteer is Node.js-based and already bundles Chromium-like dependencies, so Electron lets the GUI and scraper share one process model. IPC between the renderer and main process via `ipcMain`/`ipcRenderer` is built in. A hosted web app would require running a backend with headless Chrome, which adds infra cost and rate-limit exposure

### Native `https` module instead of axios/fetch
- **Constraint**: Bundle size and dependency count matter for an Electron app — every extra package ships in the installer
- **Options**: `axios`, `node-fetch`, undici, or the built-in `https` module
- **Choice**: Node's built-in `https`
- **Why**: The scraper only hits three endpoints with one auth pattern. Pulling in a full HTTP client for that is overkill, and it keeps the dependency tree minimal for security review

### Checkpoint to disk per row, not per batch
- **Constraint**: An 87-address job takes ~19 minutes. A crash at minute 18 shouldn't lose 17 minutes of work
- **Options**: In-memory progress with a final write, periodic batch flush every N rows, or row-by-row append
- **Choice**: Append each row to a `.partial` file immediately, and update a small `.checkpoint` JSON after every row
- **Why**: Disk writes per row are cheap relative to the ~14s/row network cost. Resume logic is trivial — load the partial, read the checkpoint index, start from the next row. Files are cleaned up on successful completion

## Frequently Asked Questions

### What CSV columns does the input need?
Street, City, State, and Zip Code, with case-insensitive aliases (e.g., "street", "ADDRESS", "address" all map to the street field). Empty rows are warned but skipped, and suspicious addresses (too short, all numbers) are flagged before processing starts.

### Why is the first address slower than the rest?
The first address pays the Puppeteer cold-start cost — launching headless Chrome, loading the stealth plugin, and warming up the user-agent pool. Subsequent addresses reuse the same browser instance, so they hit the steady-state ~13–15s rate.

### Can I run this on a server or in CI?
Technically yes, but it's not the design target. The app expects a desktop user to drop a CSV onto the window. For headless use you'd need to invoke `scraper-v4.js` directly from Node with the input path, and bypass the Electron GUI layer.

### What happens if Redfin blocks my IP?
The scraper detects 403 responses and applies exponential backoff with jitter before retrying. If blocks persist across retries, the row is marked as failed in the output CSV and the job continues. Stealth fingerprinting and user-agent rotation reduce but don't eliminate the chance of a block on long runs.

### How do I know which rows came from the API vs. the browser fallback?
The output CSV includes a "Data Source" column showing `api` or `browser` per row. This is useful when auditing accuracy — API responses are structured and consistent, while browser-scraped rows are subject to selector quirks.

### Does it work on Apple Silicon?
Yes. The macOS build is a universal DMG covering both x64 and arm64. The bundled Chromium binary is downloaded for the host architecture by the `download-chrome` prebuild script.

### What's the Stingray API and is it documented?
Stingray is Redfin's internal data service that powers their own website. It is not publicly documented — the endpoints used here (`/stingray/api/home/details/avm`, `avmHistoricalData`, `propertyParcelInfo`) were identified by inspecting network traffic from `redfin.com`. They can change without notice, which is exactly why the browser fallback exists.

### Why does the macOS build show a security warning?
Unless the app is signed and notarized with an Apple Developer ID, macOS Gatekeeper warns on first launch. The repo includes `docs/CODE_SIGNING.md` with instructions for signing and notarizing your own build. Pre-built releases are unsigned by default.
