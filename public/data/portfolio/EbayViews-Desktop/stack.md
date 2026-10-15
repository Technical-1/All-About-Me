# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Python | 3.10+ | Keeps the desktop, parsing, and request code in one approachable runtime. |
| Desktop UI | PyQt6 | `>=6.6` | Mature native widgets, table support, dialogs, and thread-safe signal delivery. |
| HTTP client | requests | `>=2.31` | Clear synchronous request API that works well inside bounded worker threads. |
| HTML parsing | beautifulsoup4 | `>=4.12` | Practical, forgiving parser for public marketplace HTML. |
| User-agent rotation | user_agent | `>=0.1.10` | Generates varied browser-style request headers without maintaining a local list. |
| Testing | pytest | `>=8.0` | Small, fast test runner with clean monkeypatching for UI and network tests. |

## Desktop Application

- **Framework**: PyQt6
- **Main window**: `MainWindow` in `ebayviews/app.py`
- **Settings UI**: `SettingsDialog` backed by `AppConfig`
- **State management**: In-memory `SellerItem` list plus persisted JSON settings
- **Threading model**: Background `Thread` wrappers for fetch/generation and Qt signals for UI updates

## Networking and Parsing

- **Seller fetcher**: `SellerItemFetcher` in `ebayviews/fetcher.py`
- **Request engine**: `ViewGenerator` in `ebayviews/generator.py`
- **Concurrency**: `ThreadPoolExecutor` with validated max worker count
- **Retries**: Configurable retry count with short backoff between attempts
- **Proxy support**: Optional newline-delimited local proxy file

## Infrastructure

- **Hosting**: None; local desktop application
- **Configuration storage**: Local JSON at `~/.ebayviews/config.json`
- **CI/CD**: None configured in the repo
- **Monitoring**: UI log area and Python logging

## Development Tools

- **Package Manager**: `pip`
- **Virtual Environment**: Python `venv`
- **Linting**: None configured
- **Formatting**: None configured
- **Testing**: pytest unit, CLI, parser, generator, UI smoke, and optional live tests

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `PyQt6` | Builds the desktop window, settings dialog, item table, progress bar, and log output. |
| `requests` | Fetches seller pages and item pages from worker threads. |
| `beautifulsoup4` | Parses seller listing HTML into structured item data. |
| `user_agent` | Generates browser-style `User-Agent` headers when rotation is enabled. |
| `pytest` | Runs deterministic unit/smoke tests and the gated live seller-page parser test. |

## Runtime Configuration

| Setting | Default | Validation |
|---------|---------|------------|
| Concurrency | `5` | Clamped to `1–25` |
| Interval seconds | `0.25` | Minimum `0` |
| Timeout seconds | `10` | Minimum `1` |
| Retries | `2` | Clamped to `0–10` |
| Max seller pages | `5` | Clamped to `1–25` |
| User-agent rotation | `true` | Boolean |
| Proxy file | Empty | Missing files resolve to no proxies |
