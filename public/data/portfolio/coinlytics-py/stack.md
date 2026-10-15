# Tech Stack — coinlytics

## Core Technologies

| Technology | Version | Role |
|---|---|---|
| Python | >= 3.10 | Language; uses `match`-style type narrowing, `dataclasses`, `decimal`, `xml.etree`, `hashlib`, `pathlib` — all stdlib |
| `coinbasis` | >= 0.1, < 0.2 | Cost-basis and statistics engine; provides `Portfolio`, `Buy`/`Sell`/`Income` transaction types, `CostBasisMethod`, `Holding`, `realized_gains()`, and `coinbasis.stats` (volatility, Sharpe, max drawdown, cumulative return) |
| `requests` | >= 2.28, < 3 | HTTP client for CoinGecko, DefiLlama, CryptoPanic, and RSS feeds |
| `decimal.Decimal` | stdlib | All money and cost-basis fields; `float` is used only in the stats/chart domain |
| `xml.etree.ElementTree` | stdlib | RSS XML parsing; complemented by a DOCTYPE entity-expansion guard |

## Development Tools

| Tool | Purpose |
|---|---|
| `pytest` | Test runner; all network calls are mocked — no live requests in CI |
| `ruff` | Linting and import sorting (`E`, `F`, `W`, `I` rule sets); `line-length = 100` |
| `setuptools >= 68` | Build backend; `py.typed` marker ships for downstream type checkers |
| `python -m build` | Produces sdist + wheel from `pyproject.toml` |

## Key Dependencies

| Package | What it provides | Why this choice |
|---|---|---|
| `coinbasis >= 0.1, < 0.2` | FIFO/HIFO/LIFO lot matching; `Portfolio.from_transactions`; `holdings(method)`; `realized_gains(method)`; `coinbasis.stats` math functions | Eliminates an entire class of cost-basis bugs by delegating all lot-selection and gain arithmetic to a dedicated engine rather than reimplementing it |
| `requests >= 2.28, < 3` | Synchronous HTTP with timeout, header, and error-response access | Straightforward synchronous I/O model; the library does not need async; `requests.HTTPError` carries the response object needed to inspect `status_code` and `Retry-After` |

## Deliberately Small Dependency Surface

`coinlytics` depends on exactly two third-party packages. I made this a design constraint:

- **No `defusedxml`** — a two-line DOCTYPE guard in `rss.py` closes the XML entity-expansion vector without adding a dependency.
- **No NLP/ML library** — a fixed keyword lexicon in `news.py` is sufficient for `bullish`/`bearish`/`neutral` headline triage and is fully auditable.
- **No `numpy` or `pandas`** — all statistics are delegated to `coinbasis.stats` (pure Python), and the analytics helpers (`correlation`, `portfolio_volatility`) are pure-math functions that need only `math.sqrt`.
- **No async runtime** — the synchronous `requests` model is appropriate for a library called by a CLI or scheduler; it avoids imposing an async contract on downstream users.

The result is a package that installs in a clean virtualenv with two `pip install` commands and no transitive dependency surprises.
