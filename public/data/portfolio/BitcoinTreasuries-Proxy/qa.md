# Project Q&A Knowledge Base

## Overview

BitcoinTreasuries Proxy is a Cloudflare Worker that scrapes BitcoinTreasuries.net and serves the data as a clean JSON API. It powers the Bitcoin treasuries feature on BTC Explorer (btcexplorer.io), providing categorized data on public companies, private companies, ETFs, governments, and DeFi protocols that hold Bitcoin on their balance sheets.

## Key Features

- **HTML Scraping**: Extracts data from BitcoinTreasuries.net's HTML tables and treemap chart text, using multiple parsing strategies for resilience
- **Intelligent Fallback System**: Maintains a curated dataset of 100+ entities that supplements or replaces scraped data when the source site is unavailable or changes its structure
- **Automatic Entity Classification**: Categorizes entities into 12+ categories (mining, exchange, ETF, government, DeFi, software, fintech, etc.) based on name and ticker pattern matching
- **Edge-Cached JSON API**: Serves filtered, sorted treasury data with 6-hour caching and 24-hour stale-if-error for high availability
- **Static Asset Serving**: OG preview image and favicons served directly from Cloudflare's edge CDN via static assets binding, with `run_worker_first` routing to protect API endpoints

## Technical Highlights

### Multi-Strategy HTML Parsing
I built the scraper with two parsing strategies on the homepage: first, it parses HTML `<table>` rows extracting entity names from links, tickers from cells, countries from flag image URLs, and BTC amounts from numeric cells. Second, it extracts entities from the treemap chart text using regex pattern matching (bounded to 50KB to prevent overshoot into unrelated content). This layered approach makes the scraper resilient to partial site structure changes.

### Scrape-Then-Merge Data Pipeline
Rather than relying solely on scraping or solely on static data, I built a merge pipeline. If scraping returns 20+ entities, the fallback dataset fills in gaps (especially ETFs, governments, and DeFi protocols that live on separate pages). If scraping returns fewer than 20, the full fallback is used. This ensures the API always returns comprehensive data across all entity types.

### Defense-in-Depth Security
I hardened the API across multiple layers: CORS denies unknown origins (no wildcard fallback), the `type` query parameter is validated against a known set to prevent cache key poisoning, cache bypass requires a secret token (`REFRESH_SECRET`), non-GET methods return 405, and OPTIONS preflight only responds on valid routes. This prevents both direct attacks and abuse vectors like unbounded cache creation or upstream DoS via forced refreshes.

### Data Validation & Garbage Filtering
Scraping HTML can produce noisy data. I added validation filters that reject entries where the name lacks ASCII letters (catches emoji-only or Unicode garbage), where the ticker is a pure large number (catches BTC amounts misread as tickers), and where BTC holdings are zero or negative. This was added after real-world scraping surfaced these edge cases.

### Comprehensive Test Suite
The project has 38 automated tests: integration tests verify the full worker lifecycle (health, 404, 405, CORS, caching, filtering, data quality), while unit tests cover every exported pure function (parseBtcAmount, mapCountryCode, categorizeCompany, determineEntityType, cleanCompanyName). Tests include negative cases like origin prefix spoofing and cache key injection attempts.

## Development Story

- **Hardest Part**: Getting reliable data extraction from a SvelteKit site that doesn't expose a public API. The HTML structure varies between pages, and the site occasionally changes layout
- **Lessons Learned**: Always have a fallback data source when scraping; edge cases in HTML parsing are endless
- **Future Plans**: Could add scheduled cron triggers for background refresh and KV storage for persistent caching across deployments
- **Recent Addition**: Enabled Cloudflare static assets binding with `run_worker_first` routing pattern to serve OG images and favicons from the edge without Worker invocation

## Frequently Asked Questions

### How does the scraping work?
The worker fetches the BitcoinTreasuries.net homepage with browser-like headers (User-Agent, Accept, etc.) to avoid being blocked. It parses HTML `<table>` rows, extracting entity names from links, countries from flag image URLs, tickers from table cells, and BTC amounts from the last numeric cell in each row. It also extracts entities from treemap chart text as a secondary source (bounded to 50KB to avoid overshoot). Each fetch has a 10-second timeout with 3 retry attempts and exponential backoff. The retry logic is status-aware: it retries on 429/5xx responses but fails fast on 403/404.

### Why not just use an API?
BitcoinTreasuries.net doesn't expose a public API. The SvelteKit site renders data server-side, so scraping is the only option. I considered using their internal SvelteKit fetch endpoints, but those aren't documented or guaranteed to be stable.

### How does caching work?
Responses are cached at the Cloudflare edge using the Cache API with a 6-hour TTL. The `stale-if-error` directive extends this to 24 hours, meaning even if the scraper fails, users get the last known good data. Cache bypass requires a `REFRESH_SECRET` environment variable match (e.g., `?refresh=YOUR_SECRET`) to prevent abuse. Each validated entity type filter gets its own cache key — invalid type values are rejected before reaching the cache to prevent cache key poisoning.

### What happens when scraping fails?
If the scraper returns fewer than 20 entities (indicating a partial or total failure), the worker falls back to a hardcoded dataset of 100+ entities with recent BTC holdings. If scraping succeeds but is incomplete, the fallback data fills in missing entities, particularly for ETFs, governments, and DeFi protocols that aren't on the homepage.

### How are entities categorized?
The `categorizeCompany` function uses keyword matching on entity names and tickers. For example, names containing "mining", "mara", or "riot" are classified as mining companies. Names containing "etf", "ishares", or "grayscale" are classified as ETFs. There's a hierarchy of ~12 categories with a "public" default fallback.

### Why use Cloudflare Workers instead of a traditional server?
Workers run at the edge globally, which means low latency for BTC Explorer users worldwide. There's no server to maintain, scaling is automatic, and the built-in Cache API eliminates the need for an external caching layer like Redis.

### What's the `global_fetch_strictly_public` compatibility flag?
This Cloudflare Workers flag ensures that the `fetch()` API can only reach public internet addresses, not internal Cloudflare services or private IPs. It's a security measure that prevents the worker from being used as a proxy to internal resources.

### How is country data normalized?
Country data comes from flag image URLs in the HTML (e.g., `/countries/united-states`). The `mapCountryCode` function maps these slugs to ISO 2-letter codes using a lookup table of ~45 countries (including New Zealand, South Africa, Switzerland, Argentina, Gibraltar, Seychelles, and others). Unrecognized slugs have their normalized form (letters-only, lowercased) truncated to 2 uppercase characters as a best-effort fallback, falling back to `US` if the slug is empty.

### How are static assets served?
Static assets (the OG preview image `preview.png` and favicons) are served via Cloudflare's static assets binding. The `public/` directory is uploaded alongside the Worker, and Cloudflare serves matching file paths (`/assets/*`) directly from its edge CDN without invoking the Worker. The `run_worker_first: ["/", "/health"]` configuration ensures API routes always hit the Worker's fetch handler, preventing static files from accidentally shadowing the API. This approach provides zero Worker CPU cost for image requests while keeping API routing explicit and safe.

### How is the API secured?
The API uses multiple security layers: CORS whitelisting denies unknown origins instead of falling back to wildcard, preventing unauthorized cross-origin reads. The `type` query parameter is validated against a known set to prevent cache key poisoning. Cache bypass requires a `REFRESH_SECRET` environment variable. Non-GET methods return 405. OPTIONS preflight only responds on valid routes. The `global_fetch_strictly_public` compatibility flag prevents SSRF.
