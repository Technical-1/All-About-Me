# Tech Stack — coinbasis (Python)

## Core Technologies

| Technology | Version | Role |
|---|---|---|
| Python | >=3.10 (`requires-python`) | Runtime language. CI tests 3.10, 3.11, 3.12, and 3.13; the PyPI classifiers list 3.10 through 3.12. Ruff targets `py310`, so the code sticks to syntax available on the oldest supported version. |
| `decimal.Decimal` (stdlib) | — | All monetary arithmetic. A pinned 28-digit `decimal.Context` (ROUND_HALF_EVEN) is used for division to avoid floating-point rounding errors in cost basis. |
| `dataclasses` (stdlib) | — | Frozen dataclasses for all transaction variants and report types. Immutability enforces that ledger inputs cannot be mutated after validation. |
| `datetime` / `timezone` (stdlib) | — | UTC-aware timestamps throughout. `Transaction.__post_init__` normalizes every timestamp to UTC at construction and raises `ValueError` on naive datetimes, so the engine never compares mixed time zones. |
| `enum` (stdlib) | — | `CostBasisMethod`, `IncomeSource`, `Term` — strongly typed enums used for dispatch rather than string constants. |
| `json` (stdlib) | — | JSON serialization in `serialization.py`. `ledger_from_json` passes `parse_float=Decimal` and `parse_int=Decimal` to `json.loads`, so a ledger that encodes amounts as JSON numbers is still decoded without passing through `float`. |
| `math` (stdlib) | — | Standard deviation, square root in the `stats` module. |

## Development Tools

| Tool | Version (from pyproject.toml) | Purpose |
|---|---|---|
| pytest | >=7 | Test runner. `testpaths = ["tests"]`, `-v` by default. 192 tests across 14 files; `tests/test_end_to_end.py` asserts exact `Decimal` results over representative ledgers, and `tests/test_examples.py` runs every script in `examples/`. |
| ruff | >=0.4 | Linter and import sorter. Rules: E (pycodestyle errors), F (pyflakes), I (isort), UP (pyupgrade). Line length 99, target `py310`. |
| build | — | PEP 517 build frontend (`python3 -m build`) for producing sdist and wheel artifacts. |
| twine | — | `twine check` on built distributions; releases themselves go through the publish workflow below. |
| hatchling | — | Build backend (declared in `[build-system]`). Ships both license files via `license-files`, and includes `CHANGELOG.md` and the tests in the sdist. |

## Infrastructure

- **CI**: GitHub Actions (`.github/workflows/ci.yml`) installs `.[dev]` and runs `pytest -v` on Python 3.10, 3.11, 3.12, and 3.13 for every push and pull request.
- **Release**: `.github/workflows/publish.yml` runs when a GitHub release is published. It builds the sdist and wheel, uploads them to PyPI through trusted publishing (OIDC, so no API token is stored in the repo), and attaches the same files to the GitHub release.
- **Distribution**: published on PyPI as `coinbasis`; ships a `py.typed` marker so type checkers use the inline annotations.
- **Hosting / monitoring**: none. It is a library with no service component.

## Key Dependencies

**Runtime dependencies: zero.**

I chose to keep the runtime dependency list empty deliberately. Every feature in this library — cost-basis arithmetic, JSON serialization, tax bracket computation, portfolio statistics — is implemented using only Python's standard library. This means:

- No dependency-resolution conflicts for consumers embedding coinbasis in their own projects.
- No supply-chain exposure at runtime.
- No version pinning required in the consuming application's `requirements.txt` beyond `coinbasis` itself.

The trade-off is that performance-sensitive consumers who want NumPy-backed vectorized lot math would need to implement that layer themselves. For the accounting use case — ledgers of hundreds to low thousands of transactions — stdlib `Decimal` is fast enough that the overhead is not measurable.
