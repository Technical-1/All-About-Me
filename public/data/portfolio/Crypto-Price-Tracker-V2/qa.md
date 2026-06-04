# Project Q&A

## Overview

Crypto-Price-Tracker-V2 is a Rust TUI application for tracking a multi-coin, multi-wallet crypto portfolio in the terminal. It shows live prices, unrealized P&L, open lot holdings, allocation breakdown, capital-gains tax estimates with progressive brackets, tax-aware rebalancing with volatility and correlation analytics, and a reconstructed performance history with chart and day-by-day playback. The technically interesting part is that every derived view — from a cost-basis lot breakdown to a historical P&L chart — is computed from the same ledger replay using `coinbasis` and `cryptolytics`, with no separate storage of pre-computed results.

## Problem Solved

Tracking a crypto portfolio across multiple wallets typically means either a spreadsheet (manual, error-prone, no live prices) or a SaaS tool (privacy concerns, no control over tax logic). This app keeps the ledger as a local JSON file, delegates lot matching and tax math to an auditable Rust library, and renders everything in a terminal — no browser, no account, no data leaving the machine.

## Target Users

- **Individual crypto holders** who want cost-basis and capital-gains estimates without uploading their transaction history to a third party
- **Tax-aware traders** who need to see the P&L impact of a potential rebalance trade before executing it
- **Rust / TUI enthusiasts** who prefer a keyboard-driven, terminal-native workflow

## Key Features

### Six tab views, one shared state
All six views (Prices, Holdings, Valuation, Tax, Rebalance, Performance) read from the same `App` struct. Pressing `m` to cycle the cost-basis method triggers a single `recompute()` call that regenerates every derived report simultaneously — no partial invalidation, no stale cross-view inconsistency.

### Bracketed capital-gains tax estimation
The Tax view uses `coinbasis::tax::estimate` with a user-supplied `TaxConfig` that accepts a progressive `long_term_brackets` list alongside a flat `short_term_rate`. Brackets are ordered ascending with a `null` `up_to` for the top tier, matching typical jurisdictional structures (e.g. the US 0%/15%/20% long-term schedule). Reports are exportable to CSV and JSON with `e`.

### Rebalance with tax-aware sell-gain preview
The Rebalance view shows drift vs. target weights and suggests buy/sell amounts under Band or Full strategy. For sell suggestions, it calls `portfolio::estimate_sell_gain` — which models a hypothetical HIFO sell by diffing total realized gains with and without the trade — and displays the estimated taxable gain per suggested sell, so the user can evaluate the tax cost before executing.

### Per-coin volatility, correlation matrix, and backtest
When price history is available, `cryptolytics` computes daily return series per coin, per-coin daily and annualized volatility, a pairwise return correlation matrix, and a value-weighted portfolio volatility. A buy-and-hold backtest compares the return of current weights vs. target weights over the history window, giving a quick sanity check on whether a rebalance would have helped historically.

### Ledger-replay historical P&L reconstruction
The Performance view does not rely solely on the forward-recorded `history.jsonl` snapshots. `perf::reconstruct_series` walks every date in the price-history window, filters ledger transactions to those on or before that date, and calls `coinbasis::Portfolio::valuation` with that day's prices. This gives an accurate daily portfolio value from the start of the price-history window — including dates before the app was first launched — without any additional stored state.

### On-disk cache with last-good fallback
`PriceCache` (in `src/prices/cache.rs`) writes each successful `PriceBook` to `~/.cache/crypto-price-tracker-v2/pricebook.json`. On startup, it checks the TTL; if expired it falls back to the last-good cache (marked `[stale]` in the status bar). `--offline` skips all network calls and serves entirely from cache, making the app fully functional on a plane or behind a rate limit.

### CSV ledger import
`--import <csv>` parses `date,coin,action,quantity,price_usd,fee_usd[,wallet]` rows, deduplicates against the existing ledger, appends new transactions to `ledger.json`, and exits without launching the TUI. This lets users seed the ledger from exchange export CSVs without writing JSON by hand.

## Technical Highlights

### `Decimal` boundary at the CoinGecko adapter
All internal monetary values — prices, cost bases, gains, target weights, drift amounts — use `rust_decimal::Decimal`. The only place `f64` is introduced is in `prices/coingecko.rs`, where `Decimal::from_f64_retain` converts the `f64` fields returned by the CoinGecko API. Return series passed to `cryptolytics` remain `f64` because statistical operations (standard deviation, Pearson correlation) are numerically appropriate there. Keeping the conversion to a single file makes it straightforward to audit and test.

### Ledger-replay reconstruction without stored state
`perf::reconstruct_series` in `src/perf.rs` produces a full daily portfolio history by replaying the transaction ledger against per-coin price series. For each date in the union of history dates it calls `Portfolio::from_transactions` on the filtered ledger slice and `portfolio.valuation` with that day's prices. The alternative — recording a snapshot on every app launch — would produce sparse, uptime-dependent history. Replay is O(dates × transactions) but negligible for typical portfolio sizes and 90-day windows, and it produces complete history going back to the start of the price data regardless of when the app was first run.

### `estimate_sell_gain` via hypothetical portfolio diff
`portfolio::estimate_sell_gain` estimates the realized gain of a potential sell by building two `coinbasis::Portfolio` instances — one from the actual ledger, one with a synthetic `Sell` transaction appended — and diffing their total HIFO realized gains. This reuses the exact same lot-matching logic that produces the Tax view's numbers, so the sell-gain estimate in the Rebalance view is consistent with what the Tax view would show after the trade.

### `TestBackend`-based UI tests
`ui/mod.rs` includes tests that render the full TUI to a `ratatui::backend::TestBackend` (a 120×30 in-memory buffer) and assert on the rendered text — e.g. verifying that the tab bar shows all six view names and the current method label. This validates the integration of `App` state → `ui::draw` → ratatui layout without requiring a real terminal. The same `MockSource` used in integration tests provides deterministic price data.

## Engineering Decisions

### Delegate lot matching to coinbasis rather than implementing it inline
- **Constraint**: FIFO/LIFO/HIFO/Average lot matching with correct short/long-term classification, wash-sale bookkeeping, and progressive tax estimation is several hundred lines of stateful logic.
- **Options**: Implement in `portfolio.rs`; use `coinbasis`.
- **Choice**: `coinbasis`
- **Why**: Correctness for financial math is hard to verify incrementally. Delegating to a library with its own test suite means the lot-matching semantics are validated independently. The adapter in `src/portfolio.rs` is ~90 lines and easy to read; the lot-matching correctness lives in the library where it can be maintained and updated in isolation.

### Single synchronous `recompute()` over incremental invalidation
- **Constraint**: Holdings, valuation, capital gains, rebalance actions, and analytics all depend on the same set of inputs (method, year, prices, price history). They need to stay consistent.
- **Options**: Selective invalidation per changed field; full recompute on any change.
- **Choice**: Full recompute.
- **Why**: For portfolios with tens of coins over a 90-day history, a full pass takes well under a millisecond. The simplicity of always having a fully consistent `Derived` struct outweighs any marginal savings from tracking which reports are dirty. Selective invalidation would introduce dependency-tracking code that would itself be a source of subtle bugs.

### `tokio::mpsc` channel as the fetch–app boundary
- **Constraint**: Price fetches are async network calls; the TUI render and key-event handling run in the same thread. The app state must not block waiting for network I/O.
- **Options**: Arc<Mutex<App>> shared across tasks; message-passing channel; blocking fetch in a dedicated thread.
- **Choice**: `tokio::mpsc` channel with `FetchMsg` enum.
- **Why**: The channel enforces a clean ownership boundary: the fetch task owns the `CoinGeckoSource` and sends a `FetchMsg::Prices(Result<PriceBook, String>)` back; `main.rs` receives it and calls `app.set_prices`. No shared mutable state, no lock contention, no risk of a panic in a fetch task corrupting `App`.

### JSONL append format for `history.jsonl`
- **Constraint**: Performance snapshots are appended frequently (once per refresh interval) and the file can grow to thousands of entries over time.
- **Options**: Rewrite the full JSON array on each append; append one JSON object per line (JSONL).
- **Choice**: JSONL, with a legacy JSON-array reader for backward compatibility.
- **Why**: Rewriting the full array requires reading the entire file, deserializing it, appending, re-serializing, and writing — O(n) I/O per snapshot. JSONL append is O(1). The legacy reader in `perf::load_history` (`src/perf.rs`) tries JSON-array parsing first so existing files from earlier versions are not broken.

## Frequently Asked Questions

### What format does the ledger use?
`ledger.json` is a JSON array of `coinbasis::Transaction` tagged union values. Supported variants include `Buy`, `Sell`, `Income` (staking, mining), `Spend`, `Transfer`, `Trade`, `GiftSent`, and `GiftReceived`. Asset IDs are CoinGecko coin IDs (`bitcoin`, `ethereum`, `solana`, etc.), since those IDs are used to fetch prices. See `ledger.example.json` for a minimal example.

### How does the CSV import work?
`cargo run -- --import <file> --ledger <ledger>` reads a CSV with the header `date,coin,action,quantity,price_usd,fee_usd` plus an optional `wallet` column. Each row is parsed into a `coinbasis::Transaction`, checked against the existing ledger for duplicates (using `PartialEq` on the full transaction), and appended if new. Invalid rows (bad date format, zero quantity, unknown action) are skipped with a message to stderr. The command exits without launching the TUI.

### Do I need a CoinGecko API key?
Not for current prices — the public Demo endpoint works for `coins_markets`. However, the `coin_market_chart` endpoint (which feeds the Rebalance analytics and Performance reconstruction) is rate-limited without a key. Set `"api_key"` in `config.json` or export `COINGECKO_API_KEY` to use the Demo key or a Pro key. Set `"plan": "Pro"` for Pro-tier endpoints.

### How are progressive tax brackets applied?
The `tax` block in `config.json` maps directly to `coinbasis::tax::TaxConfig`. The `long_term_brackets` list is ordered ascending; each entry has an `up_to` threshold (or `null` for the top tier) and a `rate`. `coinbasis::tax::estimate` applies the brackets to the long-term gain total. The short-term gain is taxed at the flat `short_term_rate`. The Tax view shows short-term, long-term, and total estimated tax.

### What does the `--offline` flag do?
It skips all network calls. The app loads prices from `PriceCache::load_last_good` (any age) on startup and does not spawn fetch tasks. The status bar shows `[stale]` to indicate the prices are from a previous session. This is useful when the CoinGecko API is unavailable or rate-limited.

### How is portfolio volatility calculated?
`recompute_analytics` in `src/app.rs` calls `cryptolytics::volatility::volatility` on each coin's daily return series to get per-coin daily standard deviation. Portfolio volatility is computed via `cryptolytics::portfolio::portfolio_volatility` using value-weighted portfolio weights and the pairwise correlation matrix. Annualized volatility scales the daily figure by `sqrt(365)`.

### Can I track assets on multiple wallets?
Yes. Each `coinbasis` transaction includes a `wallet` field. The Holdings view can group open lots by wallet (`g` to toggle). Cost-basis lot matching is applied across wallets per asset, consistent with how most tax jurisdictions treat crypto (asset-level, not wallet-level, lot assignment for automatic methods).
