# Architecture

## System Diagram

```mermaid
flowchart TD
    CLI["cli.py<br/>argparse + main()"] -->|normalize_url| C["client.py"]
    CLI -->|fetch_products| C
    C -->|GET /products.json| Shop[("Shopify store<br/>public endpoint")]
    Shop -->|JSON| C
    C -->|list[Product]| CLI
    CLI -->|filter_in_stock optional| C
    CLI -->|render| F["formatters.py<br/>text / json / csv"]
    F -->|string| CLI
    CLI -->|stdout| User([User])
    C -.->|ShopifyError| CLI
```

## Component Descriptions

### Client
- **Purpose**: Fetch a store's public catalog and turn raw JSON into typed domain objects.
- **Location**: `shopify_atc/client.py`
- **Key responsibilities**: URL normalization; HTTP GET of `/products.json`; parsing into `Product`/`Variant` dataclasses; translating every failure into a typed `ShopifyError` subclass; the `filter_in_stock` helper.

### Formatters
- **Purpose**: Render parsed products into the three output formats.
- **Location**: `shopify_atc/formatters.py`
- **Key responsibilities**: Pure functions (`render_text`, `render_json`, `render_csv`) dispatched by `render()`; building `/cart/add` and product-page URLs; CSV-injection neutralization for untrusted text cells.

### CLI
- **Purpose**: Parse arguments and wire the pieces together.
- **Location**: `shopify_atc/cli.py`
- **Key responsibilities**: `argparse` definition; positive-integer validation for `--limit`/`--quantity`; mapping a caught `ShopifyError` to its process exit code.

## Data Flow

1. The user runs `shopify-atc <url> [flags]`.
2. `cli.main` normalizes the URL and calls `client.fetch_products`.
3. `fetch_products` GETs `<url>/products.json?limit=N` and parses the response into `list[Product]`.
4. If `--in-stock-only` is set, `filter_in_stock` keeps only available variants.
5. `formatters.render` turns the products into a string in the requested format.
6. The string is written to stdout; any `ShopifyError` is printed to stderr and its exit code returned.

## External Integrations

| Service | Purpose | Notes |
|---------|---------|-------|
| Shopify storefront `/products.json` | Read the public product catalog | No auth; `limit` capped at 250 by Shopify; a 15s request timeout is applied |

## Key Architectural Decisions

### Errors carry their own exit code
- **Context**: A CLI needs distinct exit codes so scripts can branch on failure type, and the original 2022 version collapsed every failure into one bare `except`.
- **Decision**: A `ShopifyError` base class with an `exit_code` class attribute, subclassed as `NetworkError` (2), `HTTPError` (3), and `NotShopifyError` (4).
- **Rationale**: The CLI layer stays trivial — `except ShopifyError as e: print(e); return e.exit_code` — with no exception-to-code mapping table to maintain. Adding a new failure mode is one subclass.

### Formatters are pure functions
- **Context**: Output needs to support three formats and be easy to test.
- **Decision**: Each renderer takes data and returns a string; no I/O happens inside them. The CLI owns the single `print`.
- **Rationale**: Pure renderers are tested with exact-string assertions and no mocking, and the same functions could back a web UI later without change.

### Offline tests via a mocked HTTP layer
- **Context**: Tests that hit live stores would be slow, flaky, and dependent on a third party's stock levels.
- **Decision**: Mock `requests.get` with `monkeypatch` and assert against fixtures.
- **Rationale**: The suite is deterministic and runs in well under a second across the full Python version matrix in CI.

### Packaged with a console entry point
- **Context**: The 2022 version was a loose script with a hardcoded store and an `input()` prompt.
- **Decision**: A `shopify_atc` package with a `shopify-atc` console script declared in `pyproject.toml`.
- **Rationale**: Installs cleanly with `pipx`/`pip`, exposes a real CLI surface, and separates the data, formatting, and interface layers into independently testable modules.
