# Q&A — coinlytics

## Overview

`coinlytics` is a Python library that provides portfolio analytics and market data for a crypto tracker ecosystem. It sits between the `coinbasis` cost-basis engine and an application layer, handling all network I/O, caching, and analytics that an app needs to display current prices, portfolio performance, rebalancing recommendations, staking yields, and news.

## Problem Solved

Building a crypto portfolio tracker requires fetching live prices from rate-limited public APIs, maintaining a usable offline state when the network is unavailable, computing tax-aware rebalancing recommendations, reconstructing historical portfolio value from a transaction ledger, and surfacing news sentiment — while keeping the dependency footprint small enough that the package installs quickly and doesn't impose transitive dependency pain on downstream consumers. `coinlytics` solves all of these as a self-contained library layer.

## Target Users

- Developers building crypto portfolio applications or CLIs in Python who want a tested, well-structured analytics layer rather than writing their own CoinGecko client, caching logic, and rebalancing math.
- Projects already using `coinbasis` for cost-basis tracking that need a networking and analytics companion.

## Key Features

### Resilient CoinGecko client with keyless-first routing, TTL cache, and offline fallback

(`src/coinlytics/prices/client.py`, `src/coinlytics/prices/cache.py`)

The `CoinGeckoClient` implements a layered request strategy: check the on-disk cache first; if stale or absent, try the public keyless endpoint; if that returns HTTP 429 and an API key is configured, immediately switch to the keyed endpoint (Demo or Pro, routing the correct base URL and auth header per the `plan` field); apply exponential backoff with `Retry-After` header support; if all retries are exhausted and a stale cache entry exists, serve it with `PriceBook.stale=True` rather than raising. Only when there is no cache at all does it raise `RateLimitedError` or `PriceSourceError`. `DiskCache` writes entries atomically via `tempfile.mkstemp` + `os.replace` to prevent corrupt reads under concurrent use.

### Tax-aware rebalancing via `coinbasis` simulation

(`src/coinlytics/rebalance.py`)

`compute_trades` supports Band and Full rebalancing strategies. For each proposed sell, it estimates the HIFO realized gain without reimplementing any lot-selection logic: it appends a simulated `coinbasis.Sell` transaction to a throwaway `coinbasis.Portfolio`, calls `realized_gains(HIFO)`, and subtracts the original portfolio's gain total to get the delta. The result — a `TaxEstimate(realized_gain, method=HIFO)` — is attached to the `RebalanceAction` so an app can display "you'll owe approximately $X in gains" before the user executes a rebalance.

### Historical P&L reconstruction by replaying the ledger

(`src/coinlytics/history.py`)

`reconstruct_series` iterates over a set of target dates and, for each date, calls `holdings_as_of` to filter the full transaction ledger to entries on or before that UTC end-of-day, builds a `coinbasis.Portfolio` from those transactions, aggregates holdings per asset across wallets, and values each asset at the historical price supplied by the caller. The output is a list of `{date, value, cost, pl}` dicts. This approach produces accurate historical P&L because it uses exact Decimal cost-basis from `coinbasis` rather than deriving holdings from a float accumulation.

### XML DOCTYPE entity-expansion guard in the RSS fetcher

(`src/coinlytics/rss.py`)

Python's `xml.etree.ElementTree` does not resolve external entities (no XXE), but can expand internal entities declared in a DOCTYPE, enabling "billion laughs" DoS. Because legitimate RSS feeds never include a DOCTYPE declaration, `fetch_rss` refuses any document whose text contains `<!DOCTYPE` (case-insensitive) before passing it to the parser. This closes the vector with a two-line check, keeping the package stdlib-only without adding a `defusedxml` dependency.

## Engineering Decisions

### Keyless-first vs. always requiring an API key

**Constraint:** CoinGecko offers a public keyless endpoint that works for low-frequency access, and a Demo/Pro keyed endpoint for higher limits. Requiring an API key at configuration time would add setup friction for simple use cases.

**Options considered:** (A) Always require a key; simpler routing logic. (B) Keyless-first, escalate to keyed on 429; more complex client but zero-config for casual use.

**Choice:** Option B — keyless-first with keyed escalation on HTTP 429.

**Why:** The library is designed to work without any configuration for read-only price lookups. A developer building a tracker for personal use should not need to register an API key to fetch BTC/ETH prices. The escalation logic adds roughly 30 lines of code in `_attempt_phase` but eliminates the onboarding friction entirely.

### Delegating cost-basis to `coinbasis` vs. reimplementing

**Constraint:** Rebalancing and history reconstruction both need accurate lot-level holdings and realized-gain calculations.

**Options considered:** (A) Reimplement HIFO/FIFO lot matching inline in `coinlytics`; no additional dependency. (B) Delegate entirely to `coinbasis`; adds one dependency but eliminates a large category of bugs.

**Choice:** Option B — `coinbasis` owns all lot-selection and gain arithmetic.

**Why:** Cost-basis accounting has many edge cases (wash sales, partial fills, decimal rounding, multi-wallet consolidation). Reimplementing this in a networking/analytics library would duplicate the engine, create a maintenance surface for correctness bugs, and obscure where the authoritative calculation lives. The `coinbasis` API is stable and versioned; the pin `>=0.1,<0.2` ensures compatibility without absorbing breaking changes.

### On-disk cache vs. in-memory cache

**Constraint:** A CLI-driven tracker may restart between price checks. An in-memory cache evaporates on restart, defeating the offline-fallback guarantee.

**Options considered:** (A) In-memory `dict` with TTL; zero disk I/O. (B) On-disk JSON cache with SHA-256 keyed filenames; survives restarts.

**Choice:** Option B — `DiskCache` with atomic writes.

**Why:** The offline last-good fallback is only meaningful if the cache outlives the process. The SHA-256 key scheme keeps filenames stable across parameter changes, and atomic writes (`os.replace`) prevent the client from ever reading a half-written entry. The trade-off is a small disk read on each cache check, which is negligible for a tool fetching prices on a human-scale schedule.

### Naive keyword lexicon vs. an NLP library for sentiment

**Constraint:** Headlines need to be classified as `bullish`, `bearish`, or `neutral` with no false-positive substring matches.

**Options considered:** (A) Ship a pre-trained sentiment model or wrap an NLP library; higher accuracy on complex phrasing. (B) Fixed keyword lexicon with whole-word regex matching; zero dependencies, fully auditable.

**Choice:** Option B — fixed `BULLISH` / `BEARISH` word sets with `\bword\b` regex matching.

**Why:** The output categories are coarse (`bullish`/`bearish`/`neutral`), and crypto news headlines are typically unambiguous: "Bitcoin surges to new high" maps cleanly to `bullish`. The whole-word boundary prevents `ban` from matching `banana` or `high` from matching `highway`, which eliminates the most common false-positive failure mode of naive substring matching. Adding an NLP dependency for marginal accuracy improvement on three-category classification of short headlines would be engineering overreach.

## Frequently Asked Questions

**Do I need a CoinGecko API key?**
No. `CoinGeckoClient` works without any API key by default — it uses the public CoinGecko endpoint. You only need to set `api_key` and `plan` if you want higher rate limits. When configured, the key is used only as a fallback: the client always tries the keyless endpoint first and escalates to the keyed endpoint only on HTTP 429.

**How does it avoid hitting rate limits?**
Three mechanisms work together. First, the TTL on-disk cache means a fresh entry is served without any network request — if you fetch prices every two minutes and the default `cache_ttl=120` is in effect, you only hit the network once per window. Second, if the keyless endpoint does return 429, the client immediately retries with the configured API key rather than giving up. Third, exponential backoff with `Retry-After` header support paces retries. If all retries are exhausted and a stale cache entry exists, it is returned rather than raising an error.

**What happens when the network is completely unavailable?**
`CoinGeckoClient` falls back to the last successfully cached response and sets `PriceBook.stale=True` on the returned object. The app can inspect this flag and surface a notice like "showing last-good data from N minutes ago." If there is no cache entry at all (first run, cache cleared), a `RateLimitedError` or `PriceSourceError` is raised.

**How accurate is the HIFO tax estimate for rebalancing?**
The estimate is calculated by appending a simulated sell to the real `coinbasis.Portfolio` and reading the realized-gain delta — it uses the same lot-selection algorithm (`coinbasis.CostBasisMethod.HIFO`) that the portfolio engine uses for real disposals. It is accurate in the sense that it reflects the actual lots that would be matched. It does not account for wash-sale rules, jurisdiction-specific adjustments, or fees on the simulated transaction (fees default to zero for the simulation). It is an estimate for planning purposes, not a tax return.

**How accurate is the news sentiment?**
The sentiment classifier is a keyword heuristic. It counts headline words against a fixed `BULLISH` and `BEARISH` lexicon using whole-word matching. It handles clear-cut cases (headlines containing "surge", "crash", "rally", "hack") correctly and produces `neutral` when the counts are tied or no lexicon words appear. It will misclassify nuanced phrasing, sarcasm, or headlines where a bearish event is framed positively. It is appropriate for a quick `bullish`/`bearish`/`neutral` triage display, not for trading signals.

**Does it support CoinGecko Pro, or only the free tier?**
Both. Set `plan="pro"` in `CoinGeckoConfig` to route keyed requests to `pro-api.coingecko.com` with the `x-cg-pro-api-key` header. Set `plan="demo"` (the default) for the Demo key tier, which uses the same base URL as the public endpoint but with the `x-cg-demo-api-key` header.

**How does it integrate with `coinbasis`?**
`coinlytics` takes `coinbasis` objects as inputs — it never manages the ledger or writes transactions itself. The app builds a `coinbasis.Portfolio` from a transaction ledger and passes it to `compute_trades` (for tax-aware rebalance estimates) or to `history.reconstruct_series` (which accepts raw `coinbasis.Transaction` objects). Performance metrics are computed by calling `coinbasis.stats` functions on a value series. This means `coinlytics` has no opinion about how you store or load your ledger — it only consumes what you hand it.

**How is all network I/O mocked in tests?**
The `CoinGeckoClient` test suite patches `requests.get` with `unittest.mock.patch`. Higher-level tests (rebalance, history, perf, staking) use `MockClient`, which satisfies the structural `PriceSource` protocol and returns caller-supplied fixture data with no network dependency at all. No test in the suite makes a real HTTP request, which means the test suite runs fully offline and deterministically.
