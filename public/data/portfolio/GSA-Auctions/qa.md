# Project Q&A

## Overview

GSA Auctions Computer Profit Finder is a command-line tool that scans active listings on GSA Auctions (the U.S. government's surplus marketplace), identifies computer lots, parses their hardware specs out of terse government descriptions, prices them against **real eBay sold comps**, accounts for the cost of actually getting each lot home, and flags the ones worth bidding on. The interesting technical core is a pricing pipeline that scrapes sold prices into a cache decoupled from the scan, a location-aware profit model, and a learning loop that calibrates its own estimates against logged outcomes.

## Problem Solved

Government surplus auctions regularly list desktops and laptops below resale value, but the listings are noisy, numerous, and pickup-bound. Manually reading every lot, deciphering its specs, checking comparable *sold* prices, and working out whether it's still profitable after fees and the cost of hauling it home is slow and error-prone. This tool automates that funnel and surfaces only the lots with real, location-adjusted profit potential — and gets sharper as you feed it real results.

## Target Users

- **Resellers / refurbishers** — find underpriced computer lots with a profit estimate that already nets out eBay fees and the real cost of pickup or freight from the lot's location.
- **IT buyers** — quickly locate specific models and configurations in surplus inventory.

## Key Features

### Sold-comp pricing with a decoupled cache
Resale value comes from scraped eBay *sold* listings — real closing prices, not asking prices — cached to JSON. A separate refresh job repopulates the cache, so scans run fast and offline and never depend on a live scrape succeeding. No eBay API key is required.

### Location-aware profit
Set a home ZIP and the tool computes the real cost to acquire each lot from its GSA pickup city: a round-trip drive for nearby lots, or per-unit freight for far ones, using offline US centroid data. A great-looking lot across the country stops looking profitable once its freight is priced in.

### BUY / WATCH / SKIP with honest margin
BUY clears configurable profit and ROI-margin bars; WATCH is the positive-but-marginal band; SKIP is everything else. Margin is ROI on total cash outlay, so zero-bid lots aren't unfairly disqualified.

### Timely alerts
A rich terminal table every run, optional Discord alerts for BUYs (with comps, distance, logistics cost, ROI, days-left, and a direct bid link), and a second "closing soon" nudge when a still-qualifying BUY is about to end — fired at most once per lot.

### A learning loop that calibrates itself
Log real bid/win/resale outcomes through the CLI; once there are enough paired data points, the scan scales future resale estimates by a correction factor derived from your own history.

## Technical Highlights

### Storage specs that don't masquerade as RAM
Government descriptions list memory and disk in the same `<number>GB` shorthand, so a naive pattern reads `256GB SSD` as 256 GB of RAM. The RAM matcher in `listing_parser.py` uses a negative lookahead that rejects a `GB` token immediately followed by a storage type (`SSD`/`HDD`/`NVME`/`SATA`/`M.2`), while still accepting a bare `8GB` as memory — so both `16GB DDR4, 256GB SSD` and the keyword-less `I5-9500, 8GB, 256GB SSD` parse correctly.

### Scraping that fails safe
`ebay_scraper.py` pulls eBay's public sold/completed results with rotating user agents and retry/backoff, then trims the top/bottom outliers before taking a median. Crucially, a CAPTCHA/challenge page or an unparseable result returns `None`, never a number — a blocked scrape can't silently become a fabricated price and trigger a bad BUY. Because the scraper only feeds a cache, a failed run just leaves slightly staler data.

### A cache that can't quietly miss
The pricing reader and the refresh writer both build their eBay query and its normalized cache key through one shared module (`price_queries.py`). A drifting key format between the two would mean the cache never hits and the feature dies silently; centralizing it makes that mismatch structurally impossible, and an end-to-end test asserts a real populated-cache hit through the lookup path.

### Calibration that converges instead of oscillating
The correction factor is the clamped median of actual-over-predicted resale across logged outcomes. The prediction stored for each lot is the *raw*, uncalibrated estimate; the factor is applied only to the live decision. Storing the already-calibrated value instead would make the factor feed back on itself and swing between runs — so the analyzer keeps a raw `raw_resale_value` snapshot separate from the calibrated `total_resale_value`.

## Engineering Decisions

### Decouple price-gathering from the scan
- **Constraint**: Resale accuracy depends on scraping, which is the slowest and least reliable stage, yet the scan must always produce alerts.
- **Options**: Scrape live inside each scan, or scrape into a cache the scan reads.
- **Choice**: A separate refresh job writes a cache; the scan only reads it.
- **Why**: A failed or throttled scrape degrades to staler cache data instead of breaking the scan, and scans stay fast and offline.

### Scraped sold comps, no API
- **Constraint**: The useful signal is *sold* prices; an asking-price feed over-values lots and a keyed API adds rate limits and a dependency.
- **Options**: Active-listing API with a discount fudge factor, or scraped sold/completed results.
- **Choice**: Scrape sold comps and trim outliers.
- **Why**: Sold prices are the real money signal, need no key, and the scraper fails to *nothing* rather than to a fabricated price.

### Single-writer JSON state over a database
- **Constraint**: State must survive ephemeral scheduled runs and be writable from the scan, the refresh job, and manual outcome logging.
- **Options**: A shared SQLite file, or one JSON file per writer.
- **Choice**: Three single-writer JSON files, committed back from automation.
- **Why**: JSON diffs cleanly in version control and the one-writer rule eliminates the binary-merge conflicts a shared database would create between local logging and the scheduled jobs.

### ROI denominator: total outlay, not bid
- **Constraint**: Many lots open at a `$0` high bid, and those are often the best deals.
- **Options**: Margin relative to the current bid, or to total cash outlay.
- **Choice**: Total outlay (bid + transport + fees).
- **Why**: Dividing by the bid forces a free-start lot to a `0%` margin and disqualifies it; total outlay is well-defined for those lots and is the honest measure of money at risk.

## Frequently Asked Questions

### Does it need any API keys?
Only a free GSA Auctions key for the listings. Pricing uses scraped eBay sold comps, not an eBay API, so there are no eBay credentials to manage.

### Where do the resale prices come from?
A cache of scraped eBay *sold/completed* listings (`data/price_cache.json`), refreshed by the `gsa-refresh-prices` job. If a lot or part isn't in the cache, the tool falls back to a curated local price reference and a model knowledge base.

### How does it account for where a lot is located?
Set `HOME_ZIP`. The tool computes offline haversine distance from your ZIP to the lot's city/state (using bundled US centroid data) and charges a round-trip drive for nearby lots or per-unit freight for far ones. Without a home ZIP it falls back to flat per-form-factor shipping.

### How is profit calculated?
Estimated resale value (whole unit or sum of parts, whichever is higher) minus the current bid, eBay's final-value fee (configurable, ~12.95% + a per-order fee), and the transport cost — then scaled by the learned calibration factor.

### What do BUY, WATCH, and SKIP mean?
BUY clears both the profit threshold and the ROI-margin bar; WATCH is profitable but below the BUY bar; SKIP is unprofitable or has no usable pricing data. All thresholds are configurable.

### How does the learning loop work?
After a scan, `log-bid <uid> --amount X` snapshots the raw prediction for a lot; `log-outcome` and `log-resale` record what happened. Once you have enough paired (predicted, actual) rows, the scan derives a correction factor and scales future resale estimates by it. `gsa-finder stats` shows your win rate, realized ROI, and the current factor.

### Can it run unattended?
Yes — two GitHub Actions workflows run the scan (every 4 hours) and the price refresh (daily), commit the updated state and cache back to the repo, and send Discord alerts.

### How do I preview without scraping or writing state?
Run `gsa-finder --dry-run`: it fetches and parses listings but skips price lookups and writes nothing, so a quick preview never marks lots as seen or starves the next real run.

### Is the tool fragile to eBay changing its site?
The scraper depends on eBay's sold-results markup, so selectors may need occasional updates, and scraping can be rate-limited from cloud IPs. Both are contained: a failed scrape returns nothing (never a bad price) and only affects cache freshness, not the scan itself.
