# Q&A — coinbasis (Python)

## Overview

`coinbasis` is a pure-Python crypto tax-lot cost-basis accounting library: eight transaction event types, five lot-matching algorithms, an externally-tagged JSON wire format, and numeric outputs verified by an end-to-end test suite over representative ledgers.

## Problem Solved

Calculating capital gains on crypto holdings is not a simple sum. Every disposal — sale, trade, spend, or gift — must be matched against specific historical acquisition lots, each with its own cost basis and holding period. The matching method (FIFO, LIFO, HIFO, Average Cost, or Specific ID) produces materially different gain/loss figures. Gifts add another layer: the IRS dual-basis rule means the correct cost basis at disposal depends on whether the proceeds produce a gain, a loss, or land in the "dead zone" where neither applies.

I built this library to encapsulate all of that logic in one auditable, dependency-free package that can be embedded in a CLI, a web service, or a Jupyter notebook without coupling to any I/O strategy.

## Target Users

- **Python developers building crypto tax tools, portfolio trackers, or accounting integrations** — a correct accounting engine without reinventing lot-matching.
- **Engineers who need a scriptable accounting core** — one `pip install` with no transitive dependencies, embeddable in a CLI, web service, or notebook.
- **Tax professionals or power users** — Form 8949-shaped capital-gains rows and income events computed from a ledger they control.

## Key Features

### Compare cost-basis methods on the same ledger
Run one ledger under FIFO, LIFO, HIFO, or Average Cost and get different realized gains from each, or hand-pick lots with Specific ID through `LotPick` selections and the `*_with_selection` methods.

### Multi-wallet tracking
Each disposal draws only from the wallet it happens in, and transfers between your own wallets carry the original basis and acquisition date with them. A transfer's network fee is recorded as a small taxable disposal.

### Gifts, income, and trades
Received gifts keep the donor's basis and acquisition date; staking, mining, airdrop, and interest income open a lot at fair market value and appear in a yearly income report; crypto-to-crypto trades dispose of one asset and acquire the other in a single event.

### Tax-year reporting and estimates
`capital_gains_report` splits one UTC calendar year into short- and long-term totals, `valuation` prices open holdings against prices you supply (and lists any asset you did not price), and `tax_estimate` runs the result through progressive brackets.

### Portable ledgers
Ledgers and Specific-ID selections serialize to a self-describing JSON format, so a ledger can be saved, versioned, and replayed later.

## Technical Highlights

### 1. Unified lot-matching engine across five methods (`src/coinbasis/engine.py`, `src/coinbasis/method.py`)

The `_Engine` class implements a single ledger-replay loop that handles all five cost-basis methods via `Strategy`. For FIFO, LIFO, and HIFO, `order_for()` in `method.py` returns a sorted index list over the open-lot pool — tie-broken by `lot_id` for determinism. Average cost collapses the `(asset, wallet)` pool to a single synthetic lot with a blended basis at each disposal. Specific ID resolves caller-supplied `LotPick` objects (acquisition index + quantity) against the pool at disposal time. All five paths flow through the same `_acquire` / `_dispose` / `_take` machinery, so Trade and Spend need no per-method code, and the non-taxable moves (Transfer and GiftSent) share one `_take()` that re-pools under Average and draws FIFO otherwise.

### 2. IRS gift dual-basis rule (`src/coinbasis/engine.py::_gain_for`, `src/coinbasis/lot.py::GiftBasis`)

When a `GiftReceived` transaction is processed, the engine stores a `GiftBasis` (containing `fmv_per_unit`) on the created `Lot`. At disposal time, `_gain_for()` applies the three-way IRS rule: if proceeds exceed donor basis, the gain is `proceeds − donor_basis`; if proceeds are below `min(donor_basis, fmv)`, the loss is `proceeds − min(donor_basis, fmv)`; if proceeds fall between the two, neither gain nor loss is recognized (the dead zone). This logic is implemented once, at the `Lot` level, so it applies identically under FIFO, LIFO, HIFO, and Specific ID. Average Cost blends the pool into one basis, so the engine does not attach `GiftBasis` under that method.

### 3. Decimal-exact arithmetic with a pinned rounding context (`src/coinbasis/engine.py::_PREC28`, `_div()`)

All monetary arithmetic uses `decimal.Decimal`. Division — the one operation that can produce non-terminating decimals — is wrapped in `_div()`, which applies a pinned `decimal.Context(prec=28, rounding=ROUND_HALF_EVEN)`. This provides exact decimal arithmetic to 28 significant digits with banker's rounding, eliminating floating-point rounding errors in cost basis and making the end-to-end test suite capable of asserting exact `Decimal` equality across representative ledgers.

### 4. Per-wallet lot pooling with full basis and holding-period preservation across Transfers (`src/coinbasis/engine.py::_process`, `src/coinbasis/portfolio.py`)

The engine pools lots by `(asset, wallet)` key. A `Transfer` transaction disposes the fee leg as a taxable event, then calls `_take()` on the transfer quantity — moving `Lot` objects (preserving `cost_basis`, `acquired_at`, `lot_id`, and any `GiftBasis`) into the destination wallet pool. The receiving wallet's lots retain the original acquisition date, so the holding-period clock is not reset by a transfer. This is the correct IRS treatment and is verified by the end-to-end test suite (`tests/test_end_to_end.py::test_e2e_engine_transfer_fee`).

### 5. Progressive tax-bracket estimation (`src/coinbasis/tax.py`)

`TaxConfig` holds a short-term flat rate and a list of `TaxBracket` objects (each with an optional ceiling and a marginal rate). `estimate_long_term_tax()` walks the brackets in order, applying each marginal rate to the taxable slice of gain that falls within it. `TaxConfig.default()` provides a US preset (0% / 15% / 20% long-term brackets with ceilings at 47,025 and 518,900, and a 35% short-term rate). Net losses clamp to zero tax rather than producing a negative estimate. `reclassify()` re-buckets realized rows by whole days held under a different jurisdiction threshold, without re-running the engine.

## Engineering Decisions

### Decimal vs float for monetary arithmetic

**Constraint:** Crypto positions often involve fractional quantities (e.g., 0.00341827 BTC) multiplied by prices with many significant digits. Float arithmetic accumulates rounding errors across large lot pools.

**Options:** `float` (fast, built-in, accumulates error); `fractions.Fraction` (exact, very slow for large ledgers); `decimal.Decimal` with a configured context (exact to 28 digits, fast enough).

**Choice:** `Decimal` for all monetary values; `float` only in the `stats` module, which is standard for statistical functions.

**Why:** A bug caused by floating-point rounding in a cost-basis engine is invisible to users until they reconcile against their brokerage — at which point it may be too late to amend a return. Decimal eliminates that class of error. The `stats` module uses float because volatility, Sharpe ratio, and drawdown are summary statistics where float precision is appropriate.

---

### Frozen dataclasses for transaction variants over dicts or TypedDicts

**Constraint:** Eight transaction shapes must be defined, validated at construction, and dispatched on cleanly inside the engine.

**Options:** Plain dicts with a `type` key (flexible, untyped, no enforcement); `TypedDict` (typed, no methods); mutable dataclasses (typed, but state could be mutated post-validation); frozen dataclasses.

**Choice:** `@dataclass(frozen=True)` inheriting from a `Transaction` base.

**Why:** Frozen instances guarantee that a transaction cannot be modified after `validate()` has confirmed its invariants. They are hashable, can be stored in sets, and the class hierarchy provides clean `isinstance` dispatch in the engine. Each variant carries only the fields it needs.

---

### Zero runtime dependencies

**Constraint:** The library should be embeddable in any Python project without introducing transitive dependency conflicts.

**Options:** Depend on `pandas` for lot tabulation (heavy, forces a pandas version on consumers); depend on `attrs` or `pydantic` for dataclass features (additional install surface); stdlib only.

**Choice:** Zero runtime dependencies. All accounting, serialization, and statistical logic uses the Python standard library.

**Why:** A dependency on `pandas` or `pydantic` would make `coinbasis` a significant install footprint and create version-pinning friction for consumers who already depend on those libraries at different versions. The features needed here — immutable data containers, decimal math, JSON, and basic statistics — are all available in the stdlib.

---

### Pure library boundary (no I/O inside the package)

**Constraint:** The library needs to work inside a CLI, a FastAPI web service, a background job, and a Jupyter notebook, each with different I/O patterns.

**Options:** Provide `load_ledger(path: str)` helpers; provide async I/O variants; couple to a specific storage format.

**Choice:** The library accepts Python objects or strings as input and returns Python objects or strings as output. File loading and network access are left to the calling application.

**Why:** Any I/O inside the library would impose a synchronous / async strategy, a file-format assumption, and an error model on every consumer. Keeping the boundary at object-in / object-out means the same code works unchanged in every embedding context.

## Frequently Asked Questions

**Q: Why are `Transfer` transactions not taxable events, but their fees are?**

A: A transfer of crypto between your own wallets is not a disposal under IRS guidance — you still own the same asset, so no gain or loss is recognized. The network fee paid to execute the transfer, however, reduces the value of the asset you hold, which the IRS treats as a disposal of the fee quantity at fair market value. The engine implements this exactly: `_take()` moves the transfer quantity (preserving basis and acquisition date), while `_dispose()` is called on the fee portion at `fee_value`.

---

**Q: What is the "dead zone" in the gift dual-basis rule?**

A: When you receive crypto as a gift and later sell it, the IRS applies a dual-basis rule. If your proceeds exceed the donor's basis, you recognize a gain computed from the donor's basis. If your proceeds are below `min(donor_basis, fmv_at_receipt)`, you recognize a loss computed from that lower amount. If proceeds land between those two figures — at or above `min(donor_basis, fmv_at_receipt)` but no higher than the donor's basis — neither gain nor loss is recognized: the row is reported with a basis equal to proceeds, so the gain is zero. This is the dead zone. It only has width when the asset had already fallen below the donor's basis by the time it was gifted.

---

**Q: How does the Specific-ID method work?**

A: Instead of having the engine pick lots automatically, the caller provides a `LotSelection` — a dict mapping each disposal's input index to a list of `LotPick` objects (acquisition index + quantity) — and calls `realized_gains_with_selection`, `capital_gains_report_with_selection`, or `tax_estimate_with_selection`. Passing `CostBasisMethod.SPECIFIC_ID` to the automatic methods raises `SelectionRequired`. The engine maps each acquisition index to the lot it opened, checks that the picks sum exactly to the disposal quantity, and computes cost basis from the chosen lots. A disposal with no entry, or whose picks do not sum exactly, raises `MissingLotSelection`; a pick that references an unknown acquisition, or a lot in that wallet without enough remaining quantity, raises `InvalidLotSelection`. A Transfer with a non-zero fee needs an entry too, because its fee leg is a disposal; the transferred quantity itself moves in FIFO order.

---

**Q: Why does Average Cost not produce a short/long-term `Term` classification?**

A: The Average Cost method blends all lots in a pool into a single synthetic lot with a weighted average basis. In doing so, the engine cannot attribute a single acquisition date to the merged lot — lots acquired at different times are combined. Accordingly, `RealizedGain.term` and `RealizedGain.acquired_at` are both `None` for Average Cost disposals. The gain still appears in `CapitalGainsReport.total_gain`, but is excluded from `short_term_gain` and `long_term_gain`.

---

**Q: How is holding period calculated for gifts?**

A: The holding period for a gifted asset tacks from the donor's acquisition date, not the date of receipt. `GiftReceived` carries a `donor_acquired_at` field; the engine sets `acquired_at` on the created lot to `donor_acquired_at` rather than the gift receipt timestamp. This means if the donor held BTC for 2 years before giving it to you, your lot is immediately long-term upon receipt.

---

**Q: Why does `holdings()` return several rows for the same asset in one wallet?**

A: `holdings()` returns one `Holding` per open lot, sorted by the order the lots were opened, so you can see each lot's remaining quantity and basis. A partially transferred lot shows up in both wallets. `valuation()` is the aggregated view: it sums quantity and basis per asset across all wallets before pricing.

---

**Q: Can I use this in an async application?**

A: Yes. The library is entirely synchronous and stateless. `Portfolio` holds its transaction list internally; no threads or coroutines are involved. In an async context you can call `Portfolio` methods in a thread pool executor (`asyncio.to_thread`) if you want to keep the event loop free, but for typical ledger sizes the computation is fast enough that blocking is not a concern.

---

**Q: What JSON schema does the serialization module use?**

A: `serialization.py` uses an externally-tagged enum format: each transaction serializes to a single-key object whose key is the variant name and whose value contains the field dict. Example:

```json
{"Buy": {"timestamp": "2021-01-01T00:00:00Z", "wallet": "hot", "asset": "btc",
         "quantity": "1", "unit_price": "30000", "fee": "0"}}
```

`Decimal` fields are strings; timestamps are RFC-3339 UTC with a trailing `Z`. This schema is unambiguous when parsing without a schema — the outer key names the variant, enabling clean schema-free round-trip of ledger files. `lot_selection_to_json` / `lot_selection_from_json` use the same conventions for Specific-ID selections, and `report_to_json` serializes any report dataclass.

One limit: timestamps are written at whole-second precision, so a timestamp with microseconds comes back truncated to the second. Amounts round-trip exactly.
