# Project Q&A Knowledge Base

## Overview

Treasuries Proxy is a Cloudflare Worker that powers the Bitcoin treasury data on btcexplorer.io. It scrapes, normalizes, and enriches CoinGecko's public company Bitcoin holdings data — adding industry categories and country metadata that CoinGecko doesn't provide — and serves it through a fast, cached edge API.

## Key Features

- **Multi-Source Treasury Fetching**: Uses a 3-tier fallback strategy (HTML scraping → Next.js JSON → API) to maximize data completeness and uptime despite CoinGecko's rate limits
- **Category Enrichment**: Curated mapping of 150+ companies to industry categories (mining, fintech, exchange, investment, etc.) and country codes
- **Edge Caching**: 12-hour Cloudflare Cache API with stale-if-error fallback ensures sub-millisecond responses and resilience against upstream failures
- **BTC Price Proxy**: Lightweight endpoint for current Bitcoin price with 24h change
- **MSTR Stock Proxy**: Dual-source proxy for Strategy (formerly MicroStrategy) stock data

## Technical Highlights

### Multi-Source Fallback Strategy
CoinGecko aggressively rate-limits their API, and the free tier returns fewer companies than the website shows. I built a 3-tier fetching strategy: first scrape the full HTML page and extract the `__NEXT_DATA__` JSON (which contains all 150+ companies), then try the build-specific Next.js JSON endpoint for cleaner data, and finally fall back to the public API if scraping fails. If everything fails, stale cache is served — the system never returns an empty response if it has previously succeeded.

### Normalized Category Mapping
CoinGecko's data doesn't include industry categories, which are essential for btcexplorer.io's filtering and visualization. I built a static lookup map using normalized keys (uppercase, stripped of punctuation) that matches on both ticker symbols and full company names. The IIFE pattern ensures the map is constructed once at module load time with zero per-request overhead.

### Zero-Dependency Architecture
The entire Worker has no runtime dependencies — it uses only built-in Web APIs (fetch, URL, Headers, Response, caches). This means instant cold starts, tiny bundle size, and no supply chain risk. The single-file architecture (~540 lines) keeps everything easy to reason about.

### Defensive Error Handling
Every endpoint handles upstream failures gracefully — the MSTR proxies stream response bodies directly (no buffering) with pinned `content-type: application/json` headers (preventing upstream header injection), the HTML scraper guards against malformed `__NEXT_DATA__` JSON and validates `buildId` with a regex before constructing URLs, the API path uses nullish coalescing (`??`) throughout to preserve legitimate zero values, and empty company lists are rejected rather than cached for 12 hours. Cache clones are created at each use site rather than shared, preventing stream consumption bugs.

## Development Story

- **Hardest Part**: Dealing with CoinGecko's anti-scraping measures and rate limiting. The HTML structure changes periodically when they update their Next.js build, requiring the fallback strategy.
- **Lessons Learned**: Edge caching with stale-if-error is essential for any proxy that depends on rate-limited upstream APIs. Building in fallback layers from the start saved significant debugging later.
- **Future Plans**: Potentially expand to Ethereum treasury data and add more granular caching strategies.

## Frequently Asked Questions

### How does the multi-source fallback work?
The worker first fetches the CoinGecko Bitcoin treasuries HTML page and looks for the `__NEXT_DATA__` script tag. If found and it contains a `buildId`, it tries the build-specific JSON endpoint (`/_next/data/{buildId}/treasuries/bitcoin.json`). If the HTML path fails entirely, it falls back to the CoinGecko public API (`/api/v3/companies/public_treasury/bitcoin`). If all sources fail and a cached response exists, it serves stale data.

### Why scrape the HTML instead of just using the API?
The CoinGecko HTML page contains the full dataset of 150+ companies, while the free API may return a limited subset. Scraping gives us the most complete data. The API serves as a reliable fallback when scraping is blocked.

### How does category mapping work?
Each company is matched against a curated `CATEGORY_MAP` using a normalized key (uppercase, no spaces/dots/hyphens). The map tries the ticker first, then the company name. If neither matches, it defaults to "public" category and "US" country.

### Why are there two MSTR stock endpoints?
Yahoo Finance and Stooq provide different data formats and have different availability characteristics. Having both sources gives btcexplorer.io redundancy for displaying Strategy's stock price alongside its Bitcoin holdings.

### How does caching work?
The worker uses Cloudflare's built-in Cache API (`caches.default`) with a 12-hour TTL. Responses include `stale-if-error` headers as a browser-side hint during upstream outages. The `?refresh=1&secret=` query parameter bypasses the cache for authenticated manual refreshes — the `REFRESH_SECRET` environment variable must be set via `wrangler secret put`. Empty company lists are never cached, preventing silent 12-hour data loss if CoinGecko changes their page structure.

### What happens during a CoinGecko rate limit (429)?
If the API returns a 429 and cached data exists, the worker serves the stale cached response. If no cache exists at all, it returns a minimal response with empty companies and an `error: 'upstream 429'` field so the frontend can show an appropriate message.
