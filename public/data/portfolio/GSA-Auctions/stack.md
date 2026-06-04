# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Python | >=3.10 | Strong regex/HTTP/HTML story for a scraping + data pipeline; fast to iterate |
| Config | pydantic-settings | >=2.0 | Typed settings from `.env`/env vars with validation and sane defaults — every business knob is configurable |
| HTTP | requests | >=2.31 | Simple, well-understood client; handles redirects and sessions |
| Scraping | beautifulsoup4 | >=4.12 | Parses eBay sold/completed search HTML for real closing prices |
| Output | rich | >=13.0 | Readable terminal tables and clickable links |
| State | JSON (stdlib) | — | Single-writer JSON files persist scan/cache/outcome state and diff cleanly in version control |

## Backend / CLI

- **Runtime**: Python >=3.10, no server component
- **Entry points**: `gsa-finder` (scan + `log-*`/`stats`/`doctor` subcommands) and `gsa-refresh-prices` (price-cache refresh)
- **External sources**: GSA Auctions v2 REST API (auth via `X-Api-Key` header); eBay public sold/completed search (scraped, no API key)
- **Pricing**: Scraped sold comps cached to JSON, with a curated local price reference and model knowledge base as fallback

## Infrastructure

- **Hosting**: Runs locally or unattended on GitHub Actions — no dedicated server
- **CI/CD**: GitHub Actions — a scan workflow (every 4h) and a price-refresh workflow (daily) that commit state/cache back to the repo
- **Persistence**: Single-writer JSON state files committed to the repository so scheduled runs share one source of truth
- **Monitoring**: structured logging via the stdlib `logging` module; a `doctor` command for setup self-checks

## Development Tools

- **Package Manager**: pip (editable install via `pyproject.toml`)
- **Linting / Formatting**: Ruff (>=0.1), line length 100
- **Testing**: pytest (>=7.0) with `responses` (>=0.23) for HTTP mocking — the suite runs fully offline
- **Task runner**: `make` (`make setup`, `make test`, `make lint`, `make doctor`)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `requests` | HTTP client for the GSA API and eBay scraping |
| `beautifulsoup4` | Parse eBay sold-listing HTML into prices |
| `pydantic` / `pydantic-settings` | Typed configuration and data models |
| `python-dotenv` | Load `.env` for local configuration |
| `rich` | Terminal tables and formatted output |
| `discord-webhook` | Optional deal + closing-soon alerts to a Discord channel |
| `responses` (dev) | Mock GSA/eBay HTTP calls so the test suite runs without network |
| `ruff` (dev) | Linting and formatting |
| `pytest` (dev) | Test runner (200+ tests, no network) |

## Bundled Data

| File | Purpose |
|------|---------|
| `data/zip_coordinates.json`, `data/city_state_coordinates.json` | Offline US centroids for haversine distance (no paid geocoding) |
| `data/keywords.json` | Tiered keyword list for computer filtering |
| `data/computer_models.json`, `data/price_reference.json` | Model knowledge base and local price fallback |
| `data/price_cache.json`, `data/scan_state.json`, `data/outcomes.json` | Single-writer JSON state (ship empty; populated by the refresh job, the scan, and the operator respectively) |
