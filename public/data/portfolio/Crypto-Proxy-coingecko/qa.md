# Project Q&A Knowledge Base

## Overview

Treasuries Proxy is a Cloudflare Worker that powers the Bitcoin treasury data on btcexplorer.io. It scrapes, normalizes, and enriches CoinGecko's public company Bitcoin holdings data — adding industry categories and ISO country metadata that CoinGecko doesn't provide — and serves it through a fast, cached edge API.

Production: `https://treasuries-proxy-coingecko.btc-treasuries.workers.dev`

## Key Features

- **Multi-Source Treasury Fetching**: 3-tier fallback (HTML scraping → Next.js JSON → API) to maximize completeness despite CoinGecko's rate limits, with stale-cache served on total upstream failure
- **Category Enrichment**: Curated mapping of 150+ companies to industry categories (mining, fintech, exchange, investment, etc.) and ISO 3166-1 alpha-2 country codes, stored in `data/categories.json` and `data/countries.json`
- **Edge Caching**: 12-hour Cloudflare Cache API for `/`, 5-minute cache for `/mstr/*`, with `stale-if-error` hints and an empty-result guard that refuses to poison the cache
- **Resilient Upstreams**: All non-streaming outbound calls share `fetchWithRetries` — 10s per-attempt timeout, status-aware retry on 429/5xx, exponential backoff
- **Strict CORS**: `btcexplorer.io` (and localhost in dev) only; unknown origins receive no `Access-Control-Allow-Origin` header
- **Structured Observability**: One-line JSON events (`scrape_result`, `cache_hit`, `price_fetch_result`, `mstr_fetch_error`, `refresh_requested`) indexed by Cloudflare Workers Logs
- **BTC Price Proxy**: Lightweight `/price` endpoint for current Bitcoin price with 24h change
- **MSTR Stock Proxy**: Dual-source `/mstr/yahoo` and `/mstr/stooq` endpoints, both edge-cached

## Technical Highlights

### Multi-Source Fallback Strategy
CoinGecko aggressively rate-limits their API, and the free tier returns fewer companies than the website shows. The treasury route in `src/routes/treasury.js` first scrapes the HTML page and extracts the `__NEXT_DATA__` JSON (which contains all 150+ companies), then tries the build-specific Next.js JSON endpoint for a cleaner payload, and finally falls back to the public API. If every upstream fails and a cached body exists, the route returns it with `x-cache: stale`. The system never blanks out the frontend once it has previously succeeded.

### Pure Parser Extracted for Fixture Testing
`parseTreasuryHtml(html)` lives in `src/scraping/coingecko.js` as a pure function — it takes HTML, returns `{ nextData, companies }`, and never touches the network. That separation lets `test/scraping/parseTreasuryHtml.spec.ts` exercise the parser against a checked-in HTML fixture in `test/fixtures/coingecko-treasuries.html`, locking the regex / JSON-shape contract without needing live upstream calls.

### Shared `fetchWithRetries` for Every Upstream
`src/fetchWithRetries.js` wraps `fetch` with a 10-second `AbortController` timeout, retries only on 429 / 500 / 502 / 503 / 504, and uses exponential backoff between attempts. Every non-streaming upstream call routes through it — the treasury HTML scrape, the Next.js JSON fetch, the public API, the price endpoint, and the MSTR proxies. The `npm run lint:fetches` script greps `src/routes/` and `src/scraping/` for raw `fetch(` calls so regressions get caught at code-review time.

### Caching the MSTR Stock Proxies
`/mstr/yahoo` and `/mstr/stooq` previously hit Yahoo Finance and Stooq on every request, which produced intermittent 502s when those upstreams rate-limited Cloudflare's IP ranges. `src/routes/mstr.js` now serves both endpoints from a 5-minute edge cache keyed by source. Stock prices aren't latency-critical for a Bitcoin-treasuries view, and the cache cuts upstream calls dramatically.

### Strict CORS with No Wildcard
`src/cors.js` allowlists `https://btcexplorer.io` and `https://www.btcexplorer.io` (plus localhost when `ENVIRONMENT=dev`). Unknown origins get no `Access-Control-Allow-Origin` header at all — the previous wildcard fallback is gone. `Vary: Origin` is always set so caches don't cross-pollinate origin-specific headers.

### Structured Observability
`src/observability.js` exposes `logEvent(event, fields)`, which writes a single JSON object per `console.log` line. Cloudflare Workers Logs indexes JSON automatically, so I can filter by `event:"scrape_result" outcome:"stale"` or `upstream_status:429` without parsing free-form strings. Every scrape branch (success, empty, error, 429-falls-back-to-stale) emits an event with `outcome`, `upstream_status`, `parsed_count`, and `duration_ms`.

### Defensive Error Handling
Every endpoint handles upstream failures gracefully — the MSTR proxies pin `content-type: application/json` instead of reflecting upstream headers, the HTML scraper guards against malformed `__NEXT_DATA__` JSON and validates `buildId` with a regex before constructing URLs, the API path uses nullish coalescing (`??`) throughout to preserve legitimate zero values, and empty company lists are rejected rather than cached for 12 hours. Cache `Response` objects are cloned at each use site rather than shared, preventing stream-consumption bugs.

### `data_source`, `parsed_count`, `scraped_at` in the Response
The `/` payload includes three diagnostic fields the frontend can read: `data_source` (`"scrape"` for a fresh upstream parse, `"fallback"` for a seed-on-429 shape), `parsed_count` (number of companies in this response), and `scraped_at` (ISO timestamp of when this body was generated). Combined with the `x-cache` header (`hit`/`miss`/`stale`), the frontend can show whether the chart is live or stale without guessing.

## Engineering Decisions

### HTML scraping as the primary data source (API as fallback)
- **Constraint**: The CoinGecko free API returns a partial subset of treasury-holding companies, but btcexplorer.io needs the full ~150-company list. The public HTML page contains all of them.
- **Options**: (a) Pay for a CoinGecko Pro API key for the full dataset, (b) scrape the HTML page and parse `__NEXT_DATA__`, (c) hand-maintain the company list.
- **Choice**: Scrape the HTML page first, then try the build-specific Next.js JSON endpoint, then fall back to the public API.
- **Why**: Scraping gets the full dataset for free, and the layered fallback means a single upstream change can't take the endpoint down. A Pro key is still supported via `COINGECKO_API_KEY` if cost stops mattering later.

### Static category map instead of dynamic classification
- **Constraint**: CoinGecko doesn't expose industry categories or country codes for treasury holders, but the frontend filters by both.
- **Options**: Call an external classification API per company, run a classification model, or hand-curate a static map.
- **Choice**: A static map in `data/categories.json` (ticker exact-match plus name-pattern regex list) and `data/countries.json` (slug → ISO 3166-1 alpha-2), loaded as JSON modules so the data is bundled at deploy time with no runtime fetch.
- **Why**: Company industries are stable (a mining co. stays a mining co.), classification is deterministic and free, and there's no per-request latency or external dependency to monitor. Putting the data in JSON files also lets the sibling `BitcoinTreasuries-Proxy` repo consume byte-identical maps.

### `?refresh=<SECRET>` — the parameter value IS the secret
- **Constraint**: An open `?refresh` parameter could be hammered to force continuous upstream scraping, tripping CoinGecko's rate limits and breaking the whole site.
- **Options**: No bypass at all, IP allowlist, signed token, separate `secret=` parameter, or a shared secret as the parameter value.
- **Choice**: Bypass cache only when `?refresh=<SECRET>` matches the `REFRESH_SECRET` env var. There is no separate `secret=` field. If `REFRESH_SECRET` is unset, no value can match and the bypass path is closed by default.
- **Why**: One value to manage, one comparison to make, and the closed-by-default behavior means a missing secret can't accidentally leave the bypass open. A wrong or missing refresh value is silently ignored so probing looks identical to normal traffic.

### Refusing to cache empty results
- **Constraint**: If CoinGecko changes their page structure, scraping can return an empty company list. Caching that for 12 hours would silently blank btcexplorer.io's main view.
- **Options**: Cache whatever comes back, return stale-on-empty without caching, or 502 on empty.
- **Choice**: Treat empty enriched lists as a failure — serve stale cache if available, otherwise return 502 — and never write empty data into the cache.
- **Why**: A noisy failure is recoverable; a silent 12-hour blank page is not.

### Cache `/mstr/*` for 5 minutes
- **Constraint**: Yahoo Finance and Stooq both rate-limit Cloudflare IP ranges. Hitting them on every request produced intermittent 502s and added latency to a non-critical chart.
- **Options**: No cache, KV cache, edge Cache API, or stop proxying MSTR entirely.
- **Choice**: 5-minute edge cache via `caches.default`, keyed by source, with the same `fetchWithRetries` retry policy as the rest of the Worker.
- **Why**: Stock prices on a Bitcoin-treasuries view don't need sub-minute freshness, the cache cuts upstream calls by ~99% at our traffic, and 5 minutes is short enough that intraday moves still surface within a normal page-view window.

## Frequently Asked Questions

### How does the multi-source fallback work?
`src/routes/treasury.js` first fetches the CoinGecko Bitcoin treasuries HTML page and runs it through `parseTreasuryHtml` in `src/scraping/coingecko.js`. If a `buildId` is present (regex-validated against `^[a-zA-Z0-9_-]{1,64}$`), it tries the build-specific JSON endpoint `/_next/data/{buildId}/treasuries/bitcoin.json`. If the HTML path fails entirely, it falls back to the public API `/api/v3/companies/public_treasury/bitcoin`. If all sources fail and a cached body exists, the cached body is served with `x-cache: stale`. If nothing exists at all, it returns a 502 instead of caching an empty payload.

### Why scrape the HTML instead of just using the API?
The CoinGecko HTML page contains the full dataset of 150+ companies, while the free API returns a smaller subset. Scraping gives us the most complete data; the API is a reliable backstop when scraping is blocked.

### How does category mapping work?
`src/scraping/categorize.js` reads `data/categories.json` and does an exact-match `byTicker` lookup first; on miss it walks the `byNamePattern` regex list. The helper compiles patterns that start with `(?i)`-style inline flags into JavaScript regexes with the right flags argument (JS doesn't support inline flag syntax natively). Country slugs are mapped through `data/countries.json` to ISO 3166-1 alpha-2 codes (e.g. `united-kingdom` → `GB`).

### Why is there a synthetic HTML fixture instead of a real CoinGecko snapshot?
Honestly: CoinGecko's HTML page is behind Cloudflare bot protection. `curl` with any User-Agent returns a 403 challenge page, not the real HTML — so a captured-on-disk real snapshot wasn't possible from my development machine. The fixture in `test/fixtures/coingecko-treasuries.html` is a ~5.9 KB synthetic page with a `__NEXT_DATA__` script block whose shape matches what the parser expects. It locks the parser contract (regex extraction, JSON parse, path into `props.pageProps.initialState.page.treasury.treasuryData`) and would catch a refactor that broke that contract. It would NOT catch real-world CoinGecko HTML drift — the Worker itself reaches CoinGecko fine, so the right follow-up is a scheduled in-Worker canary that fetches the live HTML and compares parsed counts against a baseline. That's a known gap, not a hidden one.

### Why are there two MSTR stock endpoints?
Yahoo Finance and Stooq provide different data formats and have different availability characteristics. Having both sources gives btcexplorer.io redundancy for displaying Strategy's stock price alongside its Bitcoin holdings. Both endpoints now share a 5-minute edge cache to keep upstream calls cheap and avoid Yahoo's rate limits.

### How does caching work?
`/` uses Cloudflare's Cache API (`caches.default`) with a 12-hour TTL. Responses include `stale-if-error` headers as a hint during upstream outages. The `?refresh=<SECRET>` query parameter bypasses cache only when the parameter value matches the `REFRESH_SECRET` secret set via `wrangler secret put`. Empty company lists are never cached, preventing silent 12-hour data loss if CoinGecko changes their page structure. `/mstr/yahoo` and `/mstr/stooq` use a separate 5-minute cache keyed per source.

### What happens during a CoinGecko rate limit (429)?
If the API returns a 429 and cached data exists, the worker serves the stale cached response with `x-cache: stale` and logs `scrape_result outcome:"stale" upstream_status:429`. If no cache exists at all, it returns a minimal seed response — empty companies, `data_source: "fallback"`, `error: "upstream 429"` — so the frontend can show an appropriate state instead of failing the request entirely.

### Why split the code into modules instead of keeping it in one file?
The previous single-file layout had grown to the point where the cache logic, scraping logic, normalization, and CORS handling were all interleaved, which made it hard to unit-test any one piece without the others. Pulling the parser into `src/scraping/coingecko.js` lets it be exercised against an HTML fixture. Pulling retries into `src/fetchWithRetries.js` makes the timeout / backoff policy a single source of truth (and lets `npm run lint:fetches` enforce it). The router in `src/index.js` is now ~30 lines and reads top-to-bottom.
