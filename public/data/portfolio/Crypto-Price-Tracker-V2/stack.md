# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|---|---|---|---|
| Language | Rust | 2021 edition | Memory safety without GC, strong type system for financial Decimal arithmetic, async support via tokio |
| TUI framework | ratatui | 0.29 | Maintained fork of tui-rs; composable widget model with `TestBackend` for headless testing |
| Terminal backend | crossterm | 0.28 | Cross-platform raw mode and event stream; `event-stream` feature provides an async `futures::Stream` of key events |
| Async runtime | tokio | 1.36 | `rt-multi-thread` for background price fetches concurrent with the event loop; `mpsc` channel as the fetch → app boundary |
| Decimal arithmetic | rust_decimal | 1 | Exact base-10 arithmetic for monetary values; avoids floating-point rounding in gains and allocation weights |

## Domain Libraries

| Library | Version | Purpose |
|---|---|---|
| `coinbasis` | 0.2 | FIFO/LIFO/HIFO/Average lot matching, `CapitalGainsReport`, `PortfolioReport`, income tracking, progressive tax bracket estimation |
| `cryptolytics` | 0.1 | Daily return series, per-coin volatility, annualized vol, pairwise correlation matrix, value-weighted portfolio vol, buy-and-hold backtest |
| `coingecko` | 1.1 | Typed client for `coins_markets` (prices + sparklines) and `coin_market_chart` (historical prices); Demo and Pro plan support |

## Serialization and I/O

| Package | Purpose |
|---|---|
| `serde` + `serde_json` | Config, ledger, and cache serialization; `PriceBook` and `Snapshot` round-trip through disk as JSON / JSONL |
| `chrono` | `DateTime<Utc>` timestamps throughout ledger, snapshots, and price history; `serde` feature for JSON round-trips |

## CLI and Error Handling

| Package | Purpose |
|---|---|
| `clap` (derive) | `--config`, `--ledger`, `--offline`, `--import` flags with zero boilerplate |
| `anyhow` | Top-level error propagation in `main.rs` with context chaining |
| `thiserror` | `AppError` domain enum used throughout the library crate |

## Development Tools

| Tool | Purpose |
|---|---|
| `cargo fmt` | Code formatting (rustfmt default config) |
| `cargo clippy` | Linting; CI runs with `-D warnings` |
| `cargo test` | Unit tests co-located with source modules; integration test in `tests/integration.rs` |

## Key Dependencies

| Package | Purpose |
|---|---|
| `rust_decimal_macros` | `dec!(...)` compile-time decimal literals used throughout tests |
| `futures` | `StreamExt` for the crossterm async event stream |
| `reqwest` | HTTP client underlying the `coingecko` crate |

## Infrastructure

- **Hosting**: Not deployed — local binary, `cargo run --release`
- **CI/CD**: None configured; `cargo test` and `cargo clippy` run locally
- **Monitoring**: None — status bar shows last fetch time and stale indicator
