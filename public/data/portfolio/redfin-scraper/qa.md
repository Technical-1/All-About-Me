# Project Q&A Knowledge Base

## Overview

Redfin Property Scraper is a cross-platform desktop application that enriches CSV files of property addresses with real estate data from Redfin. I built it to automate bulk property lookups - instead of manually searching Redfin for each address, I upload a CSV and get back estimated values, sale history, and property details for every address in the file.

## Key Features

- **API-First Data Extraction**: Uses Redfin's internal Stingray API for fast, structured data retrieval instead of slow browser scraping
- **Intelligent Fallback**: Automatically falls back to full Puppeteer browser scraping when API endpoints fail or return incomplete data
- **Batch CSV Processing**: Upload a CSV with Street/City/State/Zip columns and get back an enriched CSV with 15 new data columns
- **Real-Time Progress**: Visual progress bar, per-address status, and terminal-style log output showing success/failure for each address
- **Crash Recovery**: Checkpoint system writes each row immediately to disk, allowing resume from the exact point of failure
- **Cross-Platform Distribution**: Builds for macOS (DMG), Windows (NSIS/Portable), and Linux (AppImage/DEB) via GitHub Actions CI/CD

## Technical Highlights

### API-First Architecture (v4 Rewrite)
I rewrote the scraper from a pure Puppeteer approach to an API-first design. The key discovery was Redfin's Stingray API - internal JSON endpoints that return structured property data. The scraper now uses Puppeteer only for the one thing that requires a browser: resolving an address to a propertyId via Redfin's search. After that, parallel API calls fetch valuation and historical data in a fraction of the time. This dropped per-address time from ~30 seconds to ~13-15 seconds.

### Anti-Bot Evasion Strategy
Redfin has anti-bot detection, so I implemented a multi-layered evasion approach: puppeteer-extra-plugin-stealth patches common automation fingerprints (WebDriver flag, Chrome DevTools protocol detection, etc.), user agents rotate between 8 modern browser strings, typing speed is randomized per-character, and all delays use random ranges to avoid periodic patterns. The viewport dimensions even include slight random offsets.

### Crash Recovery via Checkpointing
For long batch jobs (87+ addresses taking ~19 minutes), I implemented a checkpoint system. Each processed row is immediately appended to a `.partial` output file, and a `.checkpoint` JSON file tracks the last completed index plus the input path. On restart, the scraper detects the checkpoint, loads partial results, and resumes from exactly where it left off. Checkpoint files are cleaned up after successful completion.

## Development Story

- **Timeline**: Evolved through 4 major versions - from basic Puppeteer scraping to the current API-first architecture
- **Hardest Part**: Figuring out Redfin's internal API endpoints and handling their JSONP-style response format (responses prefixed with `{}&&` that need to be stripped before parsing)
- **Lessons Learned**: Direct API calls are almost always faster and more reliable than browser scraping. I should have reverse-engineered the API earlier instead of fighting with CSS selectors that break on every Redfin redesign
- **Future Plans**: Could add rate limiting configuration in the GUI, support for multiple output formats (JSON, Excel), and possibly parallel address processing with multiple browser instances

## Frequently Asked Questions

### How does the API-first architecture work?
The scraper follows a 3-step pipeline for each address: (1) Puppeteer navigates to Redfin, types the address, and extracts the `propertyId` from the resulting URL, (2) Two parallel HTTPS requests hit the Stingray API for valuation and historical data, (3) If the API didn't return an estimate, Puppeteer performs full-page scraping as a fallback.

### Why did you choose Electron for the GUI?
I wanted a cross-platform desktop app that could bundle Puppeteer's Chromium browser. Electron was the natural choice since the scraper is already Node.js-based. It also made IPC between the GUI and scraper straightforward using Electron's built-in `ipcMain`/`ipcRenderer`.

### How does the scraper avoid getting blocked?
Multiple layers: puppeteer-extra-plugin-stealth hides automation fingerprints, user agents rotate between addresses, typing delays are randomized per-character, navigation delays use random ranges, and the viewport has slight random size offsets. Exponential backoff with jitter handles transient 403 blocks.

### What data does it extract per property?
15 columns: Redfin Estimate, Purchase Price, Year Purchased, Appreciation, Beds, Baths, Sq Ft, Lot Size, Year Built, Price/Sq Ft, Property Type, Listing Status, Property ID, Redfin URL, and Data Source (api vs browser).

### What was the most challenging part?
Handling the variety of CSS selectors across Redfin's pages. Different property types, listing statuses, and page versions use different DOM structures. I ended up maintaining arrays of fallback selectors for each data field (e.g., 6 different selectors for beds) and using a `trySelectors` method that iterates until one matches.

### What would you improve?
I'd add a configuration panel in the GUI for adjusting timing delays and retry counts, support for exporting to Excel/JSON, and possibly worker-based parallel processing to handle multiple addresses simultaneously. I'd also add integration tests that mock the API responses.

### How does the CSV validation work?
The scraper checks for required columns (Street, City, State, Zip Code) with flexible aliases (e.g., "street", "ADDRESS", "address" all map to the street field). It also warns about empty rows and suspicious address formats (too short, all numbers). Invalid addresses are skipped instantly during processing.

### How does crash recovery work?
Every processed row is immediately appended to a `.partial` output file. A `.checkpoint` JSON file stores the last completed index, input path, and timestamp. On restart, if a checkpoint exists for the same input file, the scraper loads partial results and resumes from the next unprocessed address. Both files are deleted after successful completion.
