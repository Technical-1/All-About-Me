# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|---|---|---|---|
| Language | Rust | 2021 edition | Memory safety without GC, strong types for financial arithmetic, and a single static binary that installs via Cargo or Homebrew |
| TUI framework | ratatui | 0.29 | Maintained successor to tui-rs; composable widgets (tables, charts, bar charts, tabs) and a `TestBackend` for headless rendering tests |
| Terminal backend | crossterm | 0.28 | Cross-platform raw mode; the `event-stream` feature exposes key events as an async `Stream` for `tokio::select!` |
| Async runtime | tokio | 1.36 | `rt-multi-thread` for background price fetches alongside the event loop; `mpsc` channel as the fetch → app boundary; `time` for the refresh tick |
| Decimal arithmetic | rust_decimal | 1 | Exact base-10 arithmetic for prices, cost basis, gains, and rebalance amounts |

Versions are the requirements declared in `Cargo.toml`; `Cargo.lock` pins the exact resolved versions.

## Domain Libraries

| Library | Version | Purpose |
|---|---|---|
| `coinbasis` | 0.2 (`serde` feature) | FIFO/LIFO/HIFO/Average lot matching, holdings, valuation, capital-gains and income reports, progressive tax estimation (`coinbasis::tax`), and the performance metrics in `coinbasis::stats` |
| `cryptolytics` | 0.1 | Return series, per-coin and annualized volatility, correlation matrix, value-weighted portfolio volatility, buy-and-hold backtest, and Custom/Equal/MarketCap target weights |
| `coingecko` | 1.1 | Typed client for `coins_markets` (quotes + sparklines) and `coin_market_chart` (price history), with Demo and Pro API-key constructors |

## Backend

- **Runtime**: Native binary on tokio; no server component
- **API Style**: Outbound REST calls to CoinGecko only
- **Auth**: CoinGecko API key from `COINGECKO_API_KEY` or `config.json`
- **Storage**: Local files — `config.json`, `ledger.json`, `history.jsonl` (JSONL), and a cached `pricebook.json`

## Serialization and I/O

| Package | Purpose |
|---|---|
| `serde` + `serde_json` | Config, ledger, cache, snapshot, and export serialization |
| `chrono` | `DateTime<Utc>` timestamps across the ledger, snapshots, and price history; date parsing for CSV import |

## CLI and Error Handling

| Package | Purpose |
|---|---|
| `clap` 4 (derive) | `--config`, `--ledger`, `--offline`, and `--import` flags |
| `anyhow` | Top-level error propagation in `main.rs` with context messages |
| `thiserror` | The `AppError` domain enum used across the library crate |

## Infrastructure

- **Hosting**: Not hosted — a local terminal app distributed through crates.io (`cargo install crypto-price-tracker-v2`) and a Homebrew tap (`Technical-1/tap`)
- **CI/CD**: GitHub Actions. `ci.yml` runs `cargo fmt --check`, clippy with `-D warnings`, tests, and `cargo doc` (warnings denied) on pushes and pull requests. `release.yml` publishes to crates.io and creates a GitHub Release on `v*` tags. `bump-homebrew.yml` updates the tap formula's tarball URL and SHA-256 using a deploy key scoped to the tap repo.
- **Monitoring**: None — the status bar shows loading state, `[stale]` cached data, and fetch errors
- **Release build**: LTO enabled in `[profile.release]`

## Development Tools

| Tool | Purpose |
|---|---|
| Cargo | Build and package manager |
| `cargo fmt` | Formatting (default rustfmt config) |
| `cargo clippy` | Linting; CI denies warnings |
| `cargo test` | Unit tests next to each module, `TestBackend` view tests, and `tests/integration.rs` |

## Key Dependencies

| Package | Purpose |
|---|---|
| `rust_decimal_macros` | `dec!(...)` decimal literals in the example config and tests |
| `futures` | `StreamExt` for polling the crossterm event stream |
| `reqwest` 0.12 | Declared alongside `coingecko` (which uses it for HTTP); not imported directly by this crate's source |
