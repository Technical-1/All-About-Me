# cryptolytics — Stack

## Core Technologies

| Technology | Version | Rationale |
|---|---|---|
| Rust | 2021 edition, MSRV 1.74 | Edition 2021 brings improved closure captures and `for`-loop ergonomics. MSRV 1.74 is the minimum needed for `let`-chains and stable `BTreeMap` const methods; wide enough to be usable on current stable toolchains without chasing latest features. |
| `#![forbid(unsafe_code)]` | — | The crate operates entirely on owned `f64` values and standard-library collections. No FFI, no raw pointers, no need for unsafe. The attribute is a hard compile-time guarantee, not just a lint suggestion. |
| `#![deny(missing_docs)]` | — | Every public item must carry a doc comment. Enforced at compile time so doc coverage cannot regress silently. |

## Key Dependencies

### Runtime

| Crate | Version | Role |
|---|---|---|
| `thiserror` | 1.x | Derives `std::error::Error` + `Display` for `AllocError` without boilerplate. Adds no runtime overhead — it is purely a derive macro. |
| `serde` | 1.x (optional) | Derive `Serialize`/`Deserialize` for `TargetStrategy`, `TradeAction`, and `RebalanceTrade` under the `serde` feature flag. Off by default so users who do not need serialization pay zero cost (no serde in the dependency tree at all). |

### Dev / Test

| Crate | Version | Role |
|---|---|---|
| `proptest` | 1.x | Property-based testing for statistical invariants: `volatility` always returns a non-negative value; `correlation` of a series with itself is always 1.0; equal-weight weights always sum to 1.0. Generates hundreds of random inputs automatically. |
| `serde_json` | 1.x | Used in `tests/serde_roundtrip.rs` to serialize and deserialize enum and struct values to JSON and assert round-trip identity. Only compiled when the `serde` feature is enabled. |

## What is deliberately absent

- **No `num-traits` or `nalgebra`**: the matrix operations needed here (a single 2D sum for `portfolio_volatility`, nested iteration for `correlation_matrix`) do not warrant pulling in a linear-algebra crate. The `BTreeMap`-of-tuples correlation structure is sufficient and keeps the API surface simple.
- **No `rust_decimal` or `bigdecimal`**: statistical estimation (standard deviation, Pearson correlation) is inherently approximate; decimal types add compile-time and runtime cost with no meaningful precision benefit for these calculations.
- **No async runtime**: every function is synchronous and pure. Adding an async dependency would be pure overhead for a no-I/O analytics library.
