# Tech Stack — coinbasis (Python)

## Core Technologies

| Technology | Version | Role |
|---|---|---|
| Python | >=3.10 | Runtime language. Tested on 3.10, 3.11, 3.12. |
| `decimal.Decimal` (stdlib) | — | All monetary arithmetic. A pinned 28-digit `decimal.Context` (ROUND_HALF_EVEN) is used for division to avoid floating-point rounding errors in cost basis. |
| `dataclasses` (stdlib) | — | Frozen dataclasses for all transaction variants and report types. Immutability enforces that ledger inputs cannot be mutated after validation. |
| `datetime` / `timezone` (stdlib) | — | UTC-aware timestamps throughout. The engine normalizes all inputs to UTC at construction time and raises `ValueError` on naive datetimes. |
| `enum` (stdlib) | — | `CostBasisMethod`, `IncomeSource`, `Term` — strongly typed enums used for dispatch rather than string constants. |
| `json` (stdlib) | — | JSON serialization in `serialization.py`. `parse_float=Decimal` is passed to `json.loads` to prevent silent float coercion of numeric Decimal fields. |
| `math` (stdlib) | — | Standard deviation, square root in the `stats` module. |

## Development Tools

| Tool | Version (from pyproject.toml) | Purpose |
|---|---|---|
| pytest | >=7 | Test runner. `testpaths = ["tests"]`, `-v` by default. End-to-end tests (`test_parity_e2e.py`) assert numeric correctness over representative ledgers. |
| ruff | >=0.4 | Linter and import sorter. Rules: E (pycodestyle errors), F (pyflakes), I (isort), UP (pyupgrade). Line length 99, target `py310`. |
| build | — | PEP 517 build frontend (`python3 -m build`) for producing sdist and wheel artifacts. |
| twine | — | Upload to PyPI. |
| hatchling | — | Build backend (declared in `[build-system]`). |

## Key Dependencies

**Runtime dependencies: zero.**

I chose to keep the runtime dependency list empty deliberately. Every feature in this library — cost-basis arithmetic, JSON serialization, tax bracket computation, portfolio statistics — is implemented using only Python's standard library. This means:

- No dependency-resolution conflicts for consumers embedding coinbasis in their own projects.
- No supply-chain exposure at runtime.
- No version pinning required in the consuming application's `requirements.txt` beyond `coinbasis` itself.

The trade-off is that performance-sensitive consumers who want NumPy-backed vectorized lot math would need to implement that layer themselves. For the accounting use case — ledgers of hundreds to low thousands of transactions — stdlib `Decimal` is fast enough that the overhead is not measurable.
