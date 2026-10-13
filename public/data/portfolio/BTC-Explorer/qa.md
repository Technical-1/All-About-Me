# Project Q&A

## Overview

BTC Explorer ([btcexplorer.io](https://btcexplorer.io)) is a real-time Bitcoin explorer and learning site. You can watch unconfirmed transactions arrive over a WebSocket, check fees, mempool depth, hashrate and difficulty progress, and compare the live price with a power-law model. It also tracks how much BTC companies, ETFs and governments hold, and explains the protocol from proof of work to Taproot. The interesting engineering is resilience: the site has no backend of its own and depends on about eight free public APIs, so every data source has a timeout, a TTL cache and a fallback chain, and the 3D scenes are isolated so a WebGL failure cannot take a page down.

## Problem Solved

Block explorers like mempool.space are built for looking up transactions and blocks. Market sites show price but not the network underneath it. Educational content usually sits apart from live data. BTC Explorer puts all three in one place: you can watch the mempool fill, see what fees it is driving, and read how difficulty adjustment or SegWit works on the same site, using live numbers rather than screenshots.

## Target Users

- **Bitcoin-curious newcomers** — a visual, live introduction to how the network operates, with explainers next to real data
- **Holders and market watchers** — fee tiers, the power-law deviation, BTC dominance, and who holds the most BTC, all on one site
- **Engineers** — a compact example of building a resilient real-time dashboard entirely on keyless public APIs

## Key Features

### Live transaction stream
The Live page subscribes to Blockchain.info's WebSocket and lists the newest 100 unconfirmed transactions with value, size and input/output counts. It also shows running tx/s and average-size stats and the last 10 blocks. A toggle swaps the list for a 3D transaction-flow scene. Pause, resume and reset controls let you freeze the feed to inspect it.

### Network dashboard
Block height, mempool.space's four recommended fee tiers, mempool transaction count, virtual size and total pending fees, 3-day average hashrate, and progress to the next difficulty adjustment. Block height is also shown in the site-wide nav.

### Market analytics
A log-scale price chart built from CryptoCompare daily closes bucketed to month-end. If that API is unavailable, the chart falls back to a curated series of 50 historical events, from the whitepaper (2008-10-31) to the US Strategic Bitcoin Reserve (2025-01-20), whose tooltips show each event. Alongside it: adoption-by-country charts (attributed periodic estimates) and a halving chart that plots block reward as bars and price as a line on a second axis.

### Power law model
The model price is `10^intercept × years_since_genesis^slope`, with coefficients and an R² of 0.9565 stored in `powerLawParams`. The page compares it with the live price, shows the current deviation, finds the first model year that crosses $100K, $250K, $500K and $1M, and projects what an investment would be worth in a chosen year. The chart runs from 2010 to 2040, with ×3.5 and ÷3.5 bands.

### Treasury tracker
A searchable, sortable table of entities holding BTC: public and private companies, ETFs, governments and wrapped/DeFi tokens. It includes a type breakdown, a top-10 bar chart and a category pie chart, with USD values computed from the live BTC price. Category filters are generated from the data, and only categories with at least three entities appear.

### Strategy (MSTR) page
Strategy's holdings, cost basis, purchase timeline and capital structure, with the live MSTR share price from `/api/mstr`.

### Technology and wallets
Expandable explainers on blockchain structure, PoW, ECDSA and Schnorr, Lightning (with live node, channel and capacity counts), difficulty adjustment, halving, SegWit and Taproot. A wallet guide compares six hardware wallets (Ledger, Trezor, Coldcard, Keystone, Tangem, BitBox02) and six software wallets (Sparrow, BlueWallet, Exodus, Electrum, Phoenix, Muun).

## Technical Highlights

### An unmount-safe WebSocket with capped backoff and a REST fallback
`useBlockchainWebSocket` in `src/lib/useBlockchain.js` reconnects on close with exponential backoff (3 s base, 30 s cap), resetting the attempt counter on a successful open. Before closing, `disconnect()` sets an unmounting flag and detaches `onclose`, so React StrictMode's mount, unmount, remount cycle cannot leak a second socket or schedule a reconnect after teardown. `useBlockchain.websocket.test.jsx` checks all three behaviours against a mocked `WebSocket`. If no block arrives within 5 s of connecting, or the socket fails, the hook backfills the last 10 blocks from mempool.space and de-duplicates by hash.

### Collision-free React keys for a high-rate stream
The Live list re-renders on every incoming transaction. Keying rows by `hash` alone breaks when a payload has no hash, because every such row collapses to the same `'unknown'` key, and React then reuses the wrong DOM nodes and animations. `normalizeTransaction` derives `tx-<hash>` when a hash exists and falls back to `tx-seq-<n>` from a monotonic counter otherwise. Rows are memoized and keyed by that value, so `AnimatePresence` only animates genuinely new entries.

### Partial failure instead of total failure
`fetchMempoolSnapshot` sends five mempool.space requests through `Promise.allSettled` under one shared 8 s `AbortController`. Each rejected or non-OK response becomes `null` for that field only, and `parseBlockHeight` makes sure a malformed body yields `null` rather than `NaN`. The same idea runs through the rest of the data layer: each fetcher returns `null` on failure instead of throwing, and each hook substitutes the cached value or a dated static snapshot.

### Cache-first rendering on every visit
Each query hook reads a localStorage entry through `getCached(key, maxAgeMs)` and passes it to TanStack Query as `initialData`, so a returning visitor sees last-known values immediately. Each dataset has its own TTL: 2 min for mempool, 5 min for price, 30 min for Lightning, 24 h for price history, and 6 h for treasuries. `refetchInterval` returns `false` while the tab is hidden, so background tabs stop polling.

## Engineering Decisions

### Same-origin serverless function for the MSTR quote
- **Constraint**: Yahoo Finance rejects browser-style requests without a proper User-Agent, and Stooq sends no CORS headers, so neither can be called from the page.
- **Options**: A third Cloudflare Worker, a standing Node backend, or dropping the live quote.
- **Choice**: `api/mstr.js` on Vercel: Yahoo first, Stooq as fallback, `s-maxage=60, stale-while-revalidate=120`.
- **Why**: Same-origin means no preflight. Server-side code can set the header the browser cannot, and the CDN cache keeps upstream traffic flat. In development, the Vite proxy in `vite.config.js` points `/api/mstr` at Yahoo, and the client parses both response shapes, so local dev needs no extra tooling.

### Pure fetchers, thin hooks
- **Constraint**: The fallback chains are the most branch-heavy code in the app and the most likely to break.
- **Options**: Inline fetch logic inside each `useQuery`, or extract it.
- **Choice**: Every network path is an exported async function. Hooks only add caching and polling.
- **Why**: The fetchers are tested by stubbing `fetch`, with no provider or render needed (`useBlockchain.fetchMempoolSnapshot`, `.priceHistory`, `.globalStats` and `.lightningStats` tests). `Layout` reuses the same functions to prefetch price and mempool data on nav hover.

### TanStack Query over a global store
- **Constraint**: Six REST query hooks with refresh windows from 45 s to 24 h, plus a push stream, all of which must degrade gracefully.
- **Options**: Redux Toolkit with RTK Query, Zustand with hand-written fetching, or Context with `useEffect`.
- **Choice**: TanStack Query for REST data, a dedicated hook with refs for the WebSocket, and component state for the treasury page.
- **Why**: Visibility-aware polling, dedupe, retry and `initialData` come built in. The WebSocket stays outside Query because it is a push stream with its own lifecycle, not a request.

### WebGL behind lazy imports and error boundaries
- **Constraint**: Three.js is the heaviest dependency, and WebGL is not available on every device.
- **Options**: Bundle it globally, replace the scenes with static images, or isolate them.
- **Choice**: A dedicated `three` chunk in `vite.config.js`, scenes loaded with `React.lazy` inside Home and Live, and each `Canvas` wrapped in its own `ErrorBoundary` with a placeholder. The route tree has an outer boundary as well.
- **Why**: Pages without 3D never download it, and a GPU failure costs one decorative panel instead of the route. Static images would have lost the interactive orbit controls.

## Frequently Asked Questions

### Are the live transactions real?
Yes. They are unconfirmed transactions as relayed by Blockchain.info's public WebSocket (`unconfirmed_sub`). Values are summed from each transaction's outputs and converted from satoshis. Fees, mempool depth, hashrate and difficulty come separately from mempool.space.

### What happens when an API is down or rate-limited?
The affected panel falls back in order: an alternate provider (CoinGecko, then Coinbase for price; Yahoo, then Stooq for MSTR), then the cached value in localStorage, then a dated static snapshot or bundled dataset. Fields with no data show a dash. The rest of the page is unaffected.

### Why does the price chart sometimes show events instead of a smooth line?
The chart prefers CryptoCompare's keyless daily history, which covers the most recent 2,000 days. That endpoint has a low quota. When it returns an error, the chart switches to the curated 50-event series, which reaches back to the 2008 whitepaper and explains what happened at each point. The live series is cached for 24 hours to keep requests rare.

### How is the power-law model computed, and is it advice?
`calculatePowerLawPrice` in `src/lib/bitcoinData.js` counts years since the genesis block (2009-01-03) and returns `10^intercept × years^slope`. The coefficients are fixed and published with their R² rather than refit live. It is a statistical fit, not a forecast, and the page, the Strategy page and the site footer all state that the content is educational and not financial advice.

### Where does the treasury data come from, and how fresh is it?
BitcoinTreasuries.net, reached through a Cloudflare Worker that adds CORS and caching. The browser caches the result for 6 hours and re-checks every 5 minutes while the page is open. Payloads with fewer than 10 valid entities are rejected. If the Worker is unreachable, a bundled 43-entity dataset is used. `?refresh=1` bypasses the cache and `?clearcache=1` deletes it.

### Does the 3D work on low-end or mobile devices?
It is optional. The scenes appear only on Home and Live, load lazily, and sit inside error boundaries. If WebGL fails, Home shows a plain panel and Live shows "3D view unavailable on this device", while the stream list keeps working.

### How is accessibility enforced?
In the code: keyboard-operable nav dropdowns (Enter, Space, ArrowDown, Escape), `aria-expanded` and `aria-haspopup` on menu toggles, a skip-to-content link and visible focus rings. In tooling: `eslint-plugin-jsx-a11y` recommended rules, plus a Lighthouse CI gate that fails the build if the accessibility score drops below 0.8.

### How is it tested?
With Vitest and React Testing Library in jsdom: 34 cases across 11 files. They cover each fetcher's success and failure paths, `parseBlockHeight` and `normalizeTransaction` edge cases, the WebSocket's unmount and backoff behaviour, `ErrorBoundary` fallbacks, the halving chart's dual-axis structure, and the shared holdings constants. CI runs lint, tests, coverage and a production build on every push to `main`.
