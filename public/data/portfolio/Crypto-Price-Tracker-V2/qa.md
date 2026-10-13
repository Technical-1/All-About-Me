# Project Q&A

## Overview

Crypto-Price-Tracker-V2 is a Rust terminal app for tracking a multi-coin, multi-wallet crypto portfolio. Six tabbed views cover live prices and unrealized P&L, open positions, valuation and allocation, capital gains with a bracketed tax estimate, tax-aware rebalancing with volatility and correlation analytics, and historical performance with a chart and a playback mode. It is published on crates.io and through a Homebrew tap. The technically interesting part is that every view, including the historical P&L chart, is derived from one local transaction ledger: lot matching and tax math run through `coinbasis`, analytics through `cryptolytics`, and history is rebuilt by replaying the ledger rather than stored.

## Problem Solved

Tracking crypto across several wallets usually means either a spreadsheet (manual, error-prone, no live prices) or a hosted service (your full transaction history on someone else's server, and tax logic you cannot inspect). This app keeps the ledger as a local JSON file, delegates lot matching and tax math to an open Rust library, and runs entirely in the terminal. The only network traffic is price requests to CoinGecko.

## Target Users

- **Individual crypto holders** who want cost-basis and capital-gains estimates without uploading their transaction history to a third party
- **Tax-aware investors** who want to see the realized-gain impact of a rebalance before placing the trades
- **Terminal-first users** who prefer a keyboard-driven tool that installs with `cargo install` or `brew install`

## Key Features

### Six tab views, one shared state
All six views (Prices, Holdings, Valuation, Tax, Rebalance, Performance) read from the same `App` struct. Pressing `m` cycles the cost-basis method (FIFO → LIFO → HIFO → Average), and a single `recompute()` call rebuilds every derived report, so no view can show figures from a different method than its neighbour.

### Bracketed capital-gains tax estimation
The Tax view lists every disposal in the selected year with acquired/disposed dates, proceeds, basis, gain, and term, then shows short-term, long-term, and income totals. The estimate comes from `coinbasis::tax::estimate`. It classifies each row as long-term when the holding period exceeds `long_term_threshold_days`, taxes net short-term gains at a flat `short_term_rate`, and applies the ascending `long_term_brackets` list (a `null` `up_to` marks the top tier) to net long-term gains. `e` exports the report as CSV and JSON.

### Rebalance with tax-aware sell-gain preview
The Rebalance view compares current and target allocation side by side and suggests buy/sell amounts under the Band strategy (ignore drift inside the tolerance) or the Full strategy (`t` to toggle). Trades below `min_trade_usd` are dropped. Targets come from the config, equal weights, or market-cap weights (`w` to cycle). Each suggested sell shows the realized gain it would trigger, computed by `portfolio::estimate_sell_gain`.

### Per-coin volatility, correlation matrix, and backtest
When price history is available, `cryptolytics` computes per-coin and annualized volatility, a pairwise return-correlation matrix, and a value-weighted portfolio volatility (shown once at least two coins have history). A buy-and-hold backtest compares the return of current weights with target weights over the history window, as a quick check on whether the target allocation would have done better.

### Ledger-replay performance history with playback
The Performance view charts portfolio value and P&L over time, with volatility, Sharpe ratio, max drawdown, and cumulative return beneath. `p` switches to playback: a scrollable list of points, each with value, P&L, and a signed P&L bar, plus a per-coin quantity, price, and value breakdown for the selected point.

### Works offline, starts populated
`PriceCache` (`src/prices/cache.rs`) writes each successful price fetch to `pricebook.json` in the configured cache directory. On launch the cached prices appear immediately, marked `[stale]` once past the TTL, and live data replaces them when the fetch returns. `--offline` runs entirely from the cache.

### Zero-setup first run and CSV import
With no config anywhere, the app writes a starter config to `~/.config/crypto-price-tracker-v2/config.json` (respecting `$XDG_CONFIG_HOME`), and a missing ledger is an empty portfolio. `--import <csv>` then appends `date,coin,action,quantity,price_usd,fee_usd[,wallet]` rows to the ledger, skipping duplicates and invalid lines, and exits without opening the TUI.

## Technical Highlights

### Historical P&L without stored state
`perf::reconstruct_series` in `src/perf.rs` builds the performance series by replaying the ledger. For each timestamp in the fetched price history it keeps the transactions on or before that moment, builds a `coinbasis::Portfolio`, and values it with that point's prices. Recording a snapshot on each refresh, which the app also does in `history.jsonl`, only covers the time the app has been running. Replay covers the whole `history_days` window, including the period before the app was first launched. The view falls back to the recorded snapshots only when no price history is available.

### Sell-gain estimates that match the Tax view
`portfolio::estimate_sell_gain` turns a suggested sell into a quantity, appends a hypothetical `Sell` to a copy of the ledger, and diffs total HIFO realized gains with and without it. Because it reuses the same `coinbasis` lot matching as the Tax view instead of approximating from average cost, the estimate matches what the Tax view would report once the trade was entered. HIFO is used because it is the gain-minimizing way to fill the sell.

### Config discovery that is testable without touching `$HOME`
`config::resolve` takes the explicit, working-directory, and global candidate paths as arguments, and `global_config_path_from` takes the XDG and HOME values as arguments. Only thin wrappers read the real environment. Every branch — explicit wins, local beats global, global used, starter written — is unit-tested against temp directories, and relative `ledger_path`/`history.jsonl` resolve against the config's own directory so a global install works from any shell location.

### Headless UI tests with `TestBackend`
Each view module has tests that render into a `ratatui::backend::TestBackend` buffer and assert on the text — column headers, the BTC ticker, the tax estimate line, playback dates, the help overlay. This checks the whole path from `App` state through `ui::draw` and ratatui layout without a real terminal. `tests/integration.rs` drives `App` end to end with `MockSource` prices.

## Engineering Decisions

### Delegate lot matching to coinbasis rather than implementing it inline
- **Constraint**: Four cost-basis methods, holding-period classification, income reporting, and progressive tax estimation are stateful financial logic that is hard to verify incrementally.
- **Options**: Implement it in `portfolio.rs`; use the `coinbasis` crate.
- **Choice**: `coinbasis`.
- **Why**: The lot-matching semantics are tested in the library, and `src/portfolio.rs` stays a short adapter that adds market value and unrealized P&L. The same engine also powers the rebalance sell-gain estimate, so those two figures cannot drift apart.

### Single synchronous `recompute()` over incremental invalidation
- **Constraint**: Holdings, valuation, capital gains, rebalance actions, analytics, and the reconstructed series all depend on the same inputs (method, year, strategies, prices, history) and must stay consistent.
- **Options**: Selective invalidation per changed input; full recompute on any change.
- **Choice**: Full recompute.
- **Why**: A personal portfolio has tens of assets, so recomputing everything is cheap. Always rebuilding the full `Derived` struct means no dependency graph to maintain and no class of stale-data bugs.

### `tokio::mpsc` channel as the fetch–app boundary
- **Constraint**: Price and history fetches are network calls; key handling and rendering must never wait on them.
- **Options**: `Arc<Mutex<App>>` shared across tasks; a message-passing channel; blocking fetches on a separate thread.
- **Choice**: A bounded `tokio::mpsc` channel carrying a `FetchMsg` enum (`Prices` or `History`, each a `Result`).
- **Why**: `App` has one owner — the event loop in `src/main.rs` — and fetch tasks only send results back. There is no lock contention, and a failing fetch becomes a status-bar message instead of touching shared state.

### JSONL snapshots with a tolerant reader
- **Constraint**: Recorded snapshots accumulate over time, and older files used a pretty-printed JSON array without `cost`/`pl` fields.
- **Options**: Keep a single JSON array; store one JSON object per line (JSONL).
- **Choice**: JSONL. `perf::load_history` first tries the legacy array format, then reads line by line, and `#[serde(default)]` lets old snapshots load with zero cost/P&L.
- **Why**: JSONL stays readable and inspectable line by line, and old history files keep working after the format change. `record_snapshot` still rewrites the whole file on each write, after reading the last entry to enforce the minimum interval — simple and adequate at one snapshot per refresh interval.

## Frequently Asked Questions

### What format does the ledger use?
`ledger.json` is a JSON array of `coinbasis::Transaction` values, each tagged by variant: `Buy`, `Sell`, `Income` (e.g. staking), `Spend`, `Transfer`, `Trade`, `GiftSent`, and `GiftReceived`. Asset IDs are CoinGecko coin IDs (`bitcoin`, `ethereum`, `solana`, …) because they are also used to fetch prices. See `ledger.example.json` for a minimal example.

### How does the CSV import work?
`crypto-price-tracker-v2 --import <file>` reads a CSV whose first line is a header, followed by `date,coin,action,quantity,price_usd,fee_usd` rows with an optional `wallet` column (default `default`). `action` must be `buy` or `sell`, dates are `YYYY-MM-DD`, quantity must be positive, and a blank fee is `0`. Rows identical to an existing transaction are skipped, invalid rows are reported to stderr, and the command prints the added and skipped counts and exits. The target ledger is `--ledger` if given, otherwise the config's `ledger_path`.

### Where does it keep its files?
The config is `--config`, else `./config.json`, else `~/.config/crypto-price-tracker-v2/config.json` (created on first run). The ledger path and `history.jsonl` resolve relative to the config's directory. The price cache is `pricebook.json` under `cache.dir`, which defaults to `~/.cache/crypto-price-tracker-v2`. Exports are written to the working directory with a timestamp in the file name.

### Do I need a CoinGecko API key?
A key is recommended. Set `coingecko.api_key` in the config or export `COINGECKO_API_KEY` (the env var wins), and set `plan` to `Demo` or `Pro` to pick the matching client. Without a key the app sends keyless requests to the Demo base URL, which CoinGecko may throttle or reject. The per-coin history requests behind the Rebalance analytics and Performance view are the ones most likely to be limited.

### How is a gain classified as short- or long-term?
The tax estimate compares each disposal's holding period with `long_term_threshold_days` (365 in the example config). Gains held longer than that are long-term and go through the bracket list; the rest are taxed at `short_term_rate`. Negative net totals in either bucket produce zero tax for that bucket.

### What does `--offline` do?
It skips every network call. The app loads the cached price book (fresh if within the TTL, otherwise marked `[stale]`), never spawns fetch tasks, and stops the refresh countdown. Everything derived from the ledger still works; volatility, correlation, backtests, and the reconstructed history need fetched price history, so they stay empty.

### How is portfolio volatility calculated?
`recompute_analytics` in `src/app.rs` computes a return series per coin from its price history, takes each series' standard deviation with `cryptolytics::volatility::volatility`, and annualizes it with a 365-period factor. Portfolio volatility combines those figures with current market-value weights and the pairwise correlation matrix through `cryptolytics::portfolio::portfolio_volatility`. It needs at least two coins with history.

### Can I track assets across multiple wallets?
Yes. Every transaction carries a `wallet` field, and the Holdings view lists each open position by asset and wallet with its own cost basis and unrealized P&L. The CSV import takes the wallet from the optional seventh column.
