# cryptolytics — Q&A

## Overview

`cryptolytics` is a pure Rust library for portfolio risk and allocation analytics. It takes `f64` price or return series as input and produces volatility estimates, correlation matrices, Sharpe ratios, drawdown figures, target weights, rebalancing trades, and buy-and-hold backtest results. Nothing is fetched, written, or mutated outside the call stack.

## Problem Solved

Calculating portfolio metrics in Rust requires assembling several interdependent computations: period returns from prices, standard deviations from returns, a correlation matrix from multiple return series, a quadratic-form portfolio variance from weights and correlations, and finally rebalancing trades from current holdings vs. target weights. No focused, dependency-light Rust crate assembles them together. `cryptolytics` provides them as a coherent library usable in any Rust project without pulling in a heavy data-science stack.

## Target Users

- Rust developers building portfolio management tools, algorithmic trading systems, or quantitative analysis pipelines who need standard risk metrics without taking on a heavy dependency tree
- Backend services that need deterministic, reproducible portfolio computations embedded directly in Rust rather than calling out to an external numerical service
- Developers building on top of [`coinbasis`](https://crates.io/crates/coinbasis) who want to pair accounting data (realized P&L, cost basis) with behavioral analytics (volatility, correlation, Sharpe)

The crate is not crypto-specific; the name reflects its origin, but every function operates on generic `f64` series.

## Key Features

- **Eight focused modules** covering the full analytics pipeline from raw prices to rebalancing trades
- **Pure functions** — no side effects, no I/O, no global state; every function takes owned or borrowed data and returns a value
- **`Option` over panic** — functions that require at least 2 data points return `None` on short series rather than panicking or producing `NaN`
- **`BTreeMap` throughout** — deterministic, sorted iteration across all multi-asset APIs
- **Optional serde** — `Serialize`/`Deserialize` for `TargetStrategy`, `TradeAction`, and `RebalanceTrade` behind a feature flag; zero cost when disabled
- **No unsafe code** — `#![forbid(unsafe_code)]` is a hard compile-time guarantee
- **Full doc coverage** — `#![deny(missing_docs)]` ensures every public item is documented

## Technical Highlights

### `portfolio_volatility` — quadratic form variance

`src/portfolio.rs` implements the standard multi-asset portfolio variance formula:

```
σ_p = sqrt( Σᵢ Σⱼ wᵢ wⱼ σᵢ σⱼ ρᵢⱼ )
```

The implementation iterates over all ordered pairs `(i, j)` from the weights `BTreeMap`. When `i == j` the correlation is hardcoded to `1.0` (self-correlation); for off-diagonal pairs it looks up the value from the provided correlation `BTreeMap`, defaulting to `0.0` if the pair is absent. This means a caller can pass a sparse correlation map — assets with no measured correlation are treated as uncorrelated rather than causing an error. The function returns `0.0` rather than `NaN` when variance is zero or negative due to floating-point rounding.

### `target_weights(MarketCap, …)` — dropping zero caps and renormalizing

`src/allocation.rs` filters the asset list to those with a positive market cap before computing proportional weights:

```rust
let usable: Vec<(String, f64)> = assets
    .iter()
    .filter_map(|a| caps.get(a).copied().filter(|c| *c > 0.0).map(|c| (a.clone(), c)))
    .collect();
let total: f64 = usable.iter().map(|(_, c)| c).sum();
```

Assets with a zero or missing cap are silently excluded from the output map. Weights are then normalized over the usable total rather than over all assets. Only when no usable caps remain does the function return `Err(AllocError::NoMarketCapData)`. This is intentional: callers maintaining a portfolio list often include newly listed assets that do not yet have cap data.

### `buy_and_hold_return` — renormalizing over usable assets

`src/backtest.rs` accepts a `BTreeMap<String, Vec<f64>>` of price histories and a weight map. Before computing the weighted return it filters to assets with `>= 2` prices and a nonzero starting price, then divides each weight by the sum of usable weights:

```rust
let wsum: f64 = usable.iter().map(|(_, w)| w).sum();
usable.into_iter()
    .map(|(a, w)| (w / wsum) * (h[h.len() - 1] / h[0] - 1.0))
    .sum()
```

This means a portfolio with three assets where one has only one historical price point still produces a valid return figure for the other two, with weights renormalized to sum to 1.0 over the usable set. When no assets are usable the function returns `0.0`.

## Engineering Decisions

### `f64` vs. a decimal type for financial arithmetic

**Constraint**: The library needs `sqrt`, division, and accumulated sums for standard deviation, Pearson correlation, and quadratic-form variance.

**Options**:
1. `f64` — native IEEE 754 double precision; `sqrt` is a single CPU instruction
2. `rust_decimal` / `bigdecimal` — arbitrary precision; no native `sqrt`; significant overhead

**Choice**: `f64`.

**Why**: Risk analytics is statistical estimation, not exact accounting. Population standard deviation and Pearson correlation are approximate by construction — a decimal type would add overhead and complexity with no accuracy benefit. Exact decimal arithmetic belongs in `coinbasis` (cost-basis, tax lot totals), not here.

---

### `Option<f64>` return type vs. `f64` with sentinel or panic

**Constraint**: Functions like `volatility`, `correlation`, `sharpe_ratio`, `max_drawdown`, and `cumulative_return` are undefined on series of fewer than 2 elements, or when a series has zero variance.

**Options**:
1. Panic — simple to implement; dangerous in library code
2. Return `0.0` or `f64::NAN` as a sentinel — computable but easy to misuse silently
3. Return `Option<f64>` — caller must explicitly handle the `None` case

**Choice**: `Option<f64>`.

**Why**: A single data point is a valid caller state (a newly tracked asset), not a programmer error. `NaN` propagates silently through arithmetic and is hard to detect downstream. Panicking in a library function is inappropriate. `Option` forces the caller to decide what to do, which is correct for a library with no knowledge of its caller's fallback strategy.

---

### `BTreeMap` vs. `HashMap` for multi-asset containers

**Constraint**: Multiple functions iterate over or build maps keyed by asset name, and the results need to be reproducible for tests and serialization.

**Options**:
1. `HashMap` — O(1) average lookup; nondeterministic iteration order
2. `BTreeMap` — O(log n) lookup; sorted, deterministic iteration order

**Choice**: `BTreeMap`.

**Why**: With a handful of assets (typical: 3–50), the difference between O(1) and O(log n) lookup is immaterial. Deterministic ordering means `correlation_matrix` output and `compute_trades` output are stable across runs, which simplifies testing, diffing serialized output, and reasoning about results. The cost is negligible; the benefit is meaningful.

---

### Optional `serde` feature vs. always-on

**Constraint**: Some callers want to serialize `RebalanceTrade` results to JSON (e.g. for an API response); others are purely computational and do not want serde in their dependency tree.

**Options**:
1. Always derive `Serialize`/`Deserialize` — simplest API; forces serde on all users
2. Feature flag — callers opt in; zero cost when not needed

**Choice**: Feature flag (`features = ["serde"]`).

**Why**: `serde` pulls in two crates and proc-macro compilation time. A pure analytics library used in a compute-heavy context has no reason to pay that cost. The feature flag is idiomatic Rust (same pattern used by `chrono`, `uuid`, etc.) and adds no complexity for callers who do want it.

---

### Self-contained crate vs. depending on `coinbasis`

**Constraint**: `cryptolytics` and `coinbasis` address complementary concerns for the same user base (portfolio tooling).

**Options**:
1. Single crate with both accounting and analytics — simpler discovery; coupled concerns
2. Two independent crates — each can be used alone; each can be tested alone

**Choice**: Two independent crates.

**Why**: Accounting correctness (exact decimal arithmetic, per-lot tracking, wash sale rules) and statistical estimation (floating-point math, probability distributions) are fundamentally different problem domains with different correctness criteria. Coupling them would force every user of one to take a dependency on the other, and would make it harder to reason about correctness in either domain.

## FAQ

**Why is this called `cryptolytics` if it works for any asset?**

The crate was built in the context of a crypto portfolio tracker, which explains the name and the `crates.io` keywords. Every function operates on plain `f64` series with string asset identifiers — there is nothing crypto-specific in the implementation. It works equally well for equities, ETFs, or any other asset class.

**Does `correlation_matrix` compute all N² pairs or just the upper triangle?**

All N² ordered pairs, including both `(a, b)` and `(b, a)`. The resulting `BTreeMap<(String, String), f64>` is symmetric: `corr[(a, b)] == corr[(b, a)]`, which makes lookups straightforward (`corr.get(&(i.clone(), j.clone()))`) without requiring callers to normalize key order.

**Why does `compute_trades` include assets present in `target_weights` but absent from `current_values`?**

A rebalancing engine may want to introduce a new position — an asset not currently held. `compute_trades` unions the keys from both maps so that new target positions generate a `Buy` trade with a `current` value of `0.0`. The total portfolio value is still calculated from `current_values` only.

**What does `amount` mean in `RebalanceTrade` when no price is available?**

`amount` is `delta_usd / price` — the number of units to trade. When the asset has no entry in the prices map (or a zero price), `amount` is `0.0`. The `delta_usd` field still carries the dollar value of the required trade; the caller is responsible for converting to units once price data is available.

**Is `volatility` sample or population standard deviation?**

Population: divide by `n`, not `n-1`. This matches the convention used in crypto/finance tooling where the full available return series is treated as the population rather than a sample drawn from a larger distribution.
