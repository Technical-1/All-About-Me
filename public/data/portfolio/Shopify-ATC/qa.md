# Project Q&A

## Overview

Shopify-ATC is a command-line tool that reads any Shopify store's public catalog and prints direct add-to-cart links for every product variant. It exists because Shopify quietly exposes two useful public features — a JSON product feed and one-click cart permalinks — and stitching them together turns "browse, click product, pick size, add to cart" into a single list of ready-to-use links. Output is available as text, JSON, or CSV.

## Problem Solved

Adding an item to a Shopify cart normally means loading the product page and selecting a variant by hand. For checking many products quickly — or scripting around availability — that's slow. Shopify-ATC collapses it into one command that emits a permalink per variant, with optional in-stock filtering.

## Target Users

- **Shoppers who want a fast path to checkout** — generate a link that drops a specific size/variant straight into the cart.
- **Developers and analysts** — pull a store's variants, prices, and stock status as JSON or CSV for scripting or a spreadsheet.

## Key Features

### Add-to-cart permalinks
For each variant the tool builds `…/cart/add?id=<variant_id>&quantity=<n>`, Shopify's documented permalink format, with a configurable quantity.

### In-stock filtering
`--in-stock-only` removes sold-out variants (and products left with none), so the output only contains things that can actually be purchased.

### Multiple output formats
`text` for reading, `json` for piping into other tools, and `csv` for spreadsheets — selected with `--format`.

## Technical Highlights

### Typed errors that own their exit codes
The store can fail in several distinct ways: unreachable host, an HTTP error status, or a URL that isn't a Shopify storefront at all. `client.py` models these as a `ShopifyError` hierarchy where each subclass sets an `exit_code` class attribute (`NetworkError`=2, `HTTPError`=3, `NotShopifyError`=4). The CLI catches the base class and returns `exc.exit_code`, so there is no mapping table and shell scripts can branch on the failure type.

### Robust parsing of untrusted JSON
A real store's `products.json` can be malformed in subtle ways — a `null` products array, or a variant missing its `id`. The parse step in `fetch_products` wraps both the key access and the variant comprehension, so any of these collapse into a clean `NotShopifyError` (exit 4) instead of a raw `TypeError`/`KeyError` traceback. Prices are a quieter trap: the type is `Optional[str]`, but some stores return a bare JSON number. `_coerce_price` stringifies at the parse boundary so the annotation holds, and the CSV cell sanitizer stringifies again defensively — either layer alone fixes the crash, but hardening both means a `Variant` built by any future path still can't break the renderer.

### CSV-injection-safe output
Product and variant titles come from arbitrary external stores, i.e. untrusted input. The CSV renderer prefixes any cell beginning with a formula trigger (`=`, `+`, `-`, `@`, tab, carriage return) with a quote, following the OWASP guidance, so opening the file in a spreadsheet can't execute an injected formula.

### Pure, exactly-asserted formatters
The three renderers are pure functions (data in, string out), which lets the tests assert exact output — full text blocks, parsed JSON fields, and literal CSV rows — without mocking. Combined with a mocked HTTP layer, the whole suite runs offline and deterministically.

## Engineering Decisions

### Read-only by design
- **Constraint**: Automating real checkouts with stored payment details is fragile and a poor fit for a portfolio tool.
- **Options**: Build a full auto-checkout flow vs. stop at link generation.
- **Choice**: Generate links only — no login, no payment, no checkout.
- **Why**: It keeps the tool useful and safe, relies solely on public endpoints, and avoids storing anything sensitive.

### `argparse` over a CLI framework
- **Constraint**: A handful of flags and one positional argument.
- **Options**: `click`/`typer` vs. the standard library.
- **Choice**: `argparse`.
- **Why**: Zero extra dependencies, and it already provides choices validation, `--help`, and `--version`. Custom `type=` callables add positive-integer validation for `--limit`/`--quantity`.

### A package, not a script
- **Constraint**: The original was a single file with a hardcoded store and an interactive prompt.
- **Options**: Extend the one file vs. split into a package.
- **Choice**: Three focused modules (`client`, `formatters`, `cli`) behind a console entry point.
- **Why**: Each layer has one responsibility and is independently testable, and the tool installs as a real `shopify-atc` command.

### Token-less publishing via OIDC
- **Constraint**: Shipping to PyPI on every GitHub release needs upload credentials, and a long-lived API token stored as a CI secret is a standing leak risk.
- **Options**: Store a PyPI API token in GitHub Actions secrets vs. use PyPI's trusted-publisher flow.
- **Choice**: OIDC trusted publishing — the release workflow mints a short-lived, repository-scoped token at publish time.
- **Why**: No secret to rotate or leak; PyPI verifies the workflow's identity directly, so the only thing that can publish `shopify-atc` is this repo's release job.

## Frequently Asked Questions

### How do I install it?
`pip install shopify-atc` (or `pipx install shopify-atc` for an isolated install). It's published on PyPI at [pypi.org/project/shopify-atc](https://pypi.org/project/shopify-atc/) and exposes a `shopify-atc` command. Runs on Python 3.9 through 3.13.

### How does it get a store's products without an API key?
Every Shopify storefront publishes its catalog at `/products.json`. The tool issues a single GET to `<store>/products.json?limit=250` and parses the response.

### How are the add-to-cart links built?
From each variant's numeric `id`, formatted as `<store>/cart/add?id=<id>&quantity=<n>` — Shopify's built-in cart permalink. `--quantity` controls the number.

### What happens if I point it at a site that isn't a Shopify store?
The response won't contain a `products` array, so the tool exits with code 4 and the message "Not a Shopify storefront (no products.json)".

### Does it work on every Shopify store?
It works on any store that leaves `/products.json` public, which is the default. A store that has explicitly disabled the endpoint will return an error.

### Can I use the output in a spreadsheet or another program?
Yes — `--format csv` produces a spreadsheet-ready file (with formula-injection protection) and `--format json` produces structured data for scripting.

### Does it store payment information or complete a purchase?
No. It only reads public data and prints links. There is no login, no stored card data, and no checkout step.
