# Project Q&A

## Overview

Shopify Add-to-Cart Builder turns any Shopify storefront into a filterable grid of products where every variant has a ready-to-use `…/cart/add` permalink. You paste a store URL, and the app fetches the whole public catalog, generates a one-click add-to-cart link for each variant, and lets you search, filter, expand, copy, and export the results. The interesting part is doing all of that with a single stateless serverless call and zero backend storage — everything after the fetch happens in the browser.

## Problem Solved

Shopify exposes deep-link "cart permalinks" (`/cart/add?id=<variant>&quantity=<n>`) that add a specific variant straight to the cart, but there's no built-in way to enumerate them for a store. Building those links by hand means digging variant IDs out of a store's `products.json` one at a time. This app generates all of them at once and makes them filterable and exportable.

## Target Users

- **Resellers and bulk buyers** — who want a fast link to a specific variant (or many units of it) without clicking through product pages.
- **Developers and marketers** — who need add-to-cart links for campaigns, QA, or tooling and want them as a CSV/JSON dataset.

## Key Features

### One-click links for every variant
Each variant gets a precomputed `/cart/add?id=<variant>&quantity=<n>` permalink. The quantity is a single global setting applied when links are built, so one click can add multiple units.

### Expandable variant cards
Each product renders as one card; expanding it stacks every variant with its own copy-link and open-in-store action, plus a "copy all" for the product. Variant names and prices use a monospace face so sizes and amounts line up and stay scannable.

### Data-driven filtering
Search, availability, vendor, type, tags, and price-range filters all run client-side against the in-memory catalog, with sorting by price, title, or stock. Facet options are derived from the catalog itself, and a facet with only one possible value (such as a single-brand store's vendor list) hides itself because it can't narrow anything.

### Injection-safe export
The current filtered view exports to CSV or JSON, or copies every link to the clipboard.

## Technical Highlights

### Discovering the real pagination contract
The catalog first appeared to hold thousands of duplicate products. The cause was that the public `/products.json` endpoint ignores `since_id` (an Admin-API-only parameter), so `since_id`-based paging kept re-fetching page one. The fix in `lib/shopify/client.ts` switches to `?page=N` paging and de-duplicates by product id across pages, stopping when a page is short or contributes nothing new — which also protects against stores that ignore pagination entirely. A real ~600-product store now reports its true size instead of inflating into thousands of rows.

### Defense-in-depth SSRF protection
Because the route fetches arbitrary user-supplied URLs, `lib/shopify/url.ts` resolves DNS and rejects any host whose IPs land in private, loopback, link-local, or carrier-grade-NAT ranges (IPv4 and IPv6, including IPv4-mapped form), and restricts scheme and port. Crucially, `lib/shopify/client.ts` follows redirects manually and re-validates every hop, so a public host can't 3xx-redirect the fetch toward an internal address — a bypass a single up-front check would miss.

### SSR-safe session caching
`lib/catalog/cache.ts` persists the built catalog, store URL, quantity, and filter state to `localStorage` so a refresh restores the session with no refetch. The large catalog and the small filter state live under separate keys, so typing in a filter never re-serializes the whole catalog. Restoration happens in a mount effect rather than during render to avoid a hydration mismatch, and every storage call is wrapped so a quota error or disabled storage degrades to a normal refetch instead of crashing.

### Spreadsheet-injection-safe CSV
`lib/catalog/export.ts` prefixes any cell beginning with a formula leader (`=`, `+`, `-`, `@`, tab, carriage return) with a single quote and quotes/escapes every field, so opening an exported catalog in a spreadsheet can't execute a cell as a formula.

## Engineering Decisions

### Server-side fetch, client-side everything else
- **Constraint**: `/products.json` sends no CORS header, so the browser can't read it; but filtering and export are pure data transforms.
- **Options**: A full query API that filters server-side; or a thin proxy plus client-side logic.
- **Choice**: A single stateless serverless route that fetches and normalizes the catalog, with all filtering/sorting/export in the browser.
- **Why**: One request per build keeps the server cheap and stateless, and every later interaction is instant. A single store's catalog fits in memory, so server-side querying would add latency and state for no gain.

### Stateless, database-free design
- **Constraint**: The app only consumes public data and holds no user accounts.
- **Options**: Add a database/cache layer; or keep everything ephemeral.
- **Choice**: No database — the catalog lives in memory and `localStorage`, and abuse is bounded by an in-memory per-IP rate limiter (`lib/ratelimit.ts`).
- **Why**: Nothing needs to persist server-side. The honest limitation is that the rate limiter is per-instance, so it's a courtesy throttle rather than a hard global guarantee — acceptable for a read-only public-data tool.

### One card per color instead of merging colorways
- **Constraint**: Shopify lists each color as a separate product, so a base item can appear a dozen-plus times and read as duplication.
- **Options**: Heuristically merge colorways into one card; or keep them separate and label them.
- **Choice**: Keep one card per product and surface the colorway as a highlighted tag.
- **Why**: Every add-to-cart link must map 1:1 to a real product page; heuristic merging (e.g. by title prefix) would risk grouping genuinely distinct SKUs and break that guarantee. Labeling the differentiator fixes the perception without the risk.

## Frequently Asked Questions

### Why is the catalog fetched on the server instead of the browser?
Shopify's `/products.json` doesn't send an `Access-Control-Allow-Origin` header, so a browser `fetch` to it is blocked by CORS. A small serverless route fetches it instead and returns typed JSON the page can read.

### How do you stop the fetch route from being abused as an SSRF proxy?
The submitted URL is normalized, restricted to http/https on standard ports, and DNS-resolved; any host resolving to a private, loopback, link-local, or CGNAT address is rejected. Redirects are followed manually and re-validated at every hop, and callers are rate-limited per IP.

### Will the generated add-to-cart links actually work?
Yes — they're standard Shopify cart permalinks (`/cart/add?id=<variant>&quantity=<n>`). Opening one adds that variant to the store's cart. Shopify still enforces real inventory, so a link for a sold-out or over-quantity variant is capped or rejected at the store, not by this app.

### Does refreshing the page re-download the whole store?
No. After a build, the catalog, store URL, quantity, and filter state are cached in `localStorage` and restored on load, so a refresh is instant with no network call. Pressing "Build links" always fetches fresh data and replaces the cache.

### Why did the product count look smaller than expected after a fix?
An earlier version multiplied the catalog because the storefront feed ignored the `since_id` parameter and kept returning the first page. Switching to page-based pagination with de-duplication makes the count reflect the store's true number of products.

### Why are there separate cards for the same item in different colors?
Shopify models each color as its own product with its own URL, and the whole point of the tool is that each card's links map 1:1 to a real product. Rather than risk merging distinct items incorrectly, each card shows its colorway as a labeled tag so they read as distinct.

### Is my data sent anywhere when I export or copy links?
No. Export and clipboard actions run entirely in the browser on the already-loaded catalog; nothing is uploaded.

### What happens if I paste a non-Shopify URL?
If the site has no readable `/products.json`, the route returns a "not a Shopify storefront" error and the UI explains it, rather than failing silently.
