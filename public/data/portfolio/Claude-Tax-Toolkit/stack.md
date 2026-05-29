# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Python | 3.11+ | Mature ecosystem for PDF parsing, money arithmetic, and the IRS/financial domain. The `Decimal` standard library and `pydantic` v2 strict mode together let me enforce money-precision invariants at the type boundary. |
| Models / validation | pydantic | 2.5+ | Strict-mode `BaseModel` rejects `float`/`bool` for money fields, validates regex patterns at load time, supports `Literal` types for enum-like config fields. Replaces a layer of hand-written validation. |
| CLI | typer | 0.12+ | Built-in `prompt` / `confirm` for the `init` interactive setup. Less ceremony than click for a single-author project; the type annotations double as docs. |
| PDF parsing | pdfplumber | 0.11.x | Reliable text extraction from text-based bank PDFs, doesn't require Java like camelot. The synthetic statements are generated to match a layout pdfplumber handles cleanly. |
| Output (xlsx) | openpyxl | 3.1+ | Industry-standard xlsx writer; supports hidden sheets (used for the Audit sheet), cell formatting, and multi-sheet workbooks without external runtime deps. |
| Output (PDF) | reportlab | 4.1+ | Pure-Python PDF generation; deterministic byte output (modulo a wall-clock timestamp). Used both to render the consumer-facing Worksheet PDF and to generate the synthetic example fixtures. |
| Optional LLM | anthropic | 0.40+ | Used only when `ANTHROPIC_API_KEY` is set, as a fallback for unknown bank-statement formats and unmatched-merchant categorization. The toolkit is fully usable without it. |
| Config / rules | PyYAML | 6.0+ | All user-facing config (`config.yaml`, `rules.yaml`, `manual_additions.yaml`) is YAML for human editability. |

## Backend (CLI engine)

- **Runtime**: Python 3.11+ (uses union types like `Decimal | None` and `dict[str, Decimal]` natively)
- **Package layout**: src-layout (`src/tax_toolkit/`)
- **Entry point**: `tax-toolkit = "tax_toolkit.cli:app"` (declared in `pyproject.toml`)
- **State**: filesystem only — `vault/<year>/` directories per tax year. No database.

## Infrastructure

- **Hosting**: none — local CLI tool. Users clone the repo and run it on their own machine.
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) — installs deps, runs unit + integration + privacy test suites, runs `check_clean` against the working tree to gate accidental real-data leakage in PRs.
- **Monitoring**: none required (no server).

## Development Tools

- **Package Manager**: [uv](https://github.com/astral-sh/uv) — chosen for fast installs and a single lockfile (`uv.lock`) committed to the repo
- **Build backend**: hatchling
- **Testing**: pytest 8.x + pytest-cov 5.x — ~284 tests across `tests/unit/`, `tests/integration/`, and `tests/privacy/`
- **Privacy enforcement**: a `.githooks/pre-commit` shell script (`make setup` installs it) + a `scripts/check_clean.py` working-tree scanner (`make check-clean`)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `pydantic` | Runtime data validation for `Transaction`, `Rule`, `CategoryTotals`, `YearConfig`, `ManualAddition`. The strict-mode + `mode="before"` validator pattern is core to the money-precision discipline. |
| `typer` | CLI subcommands (`init`, `process`, `process-schedule-c`, `reconcile`, `extract`, `categorize`) and interactive prompts (`typer.prompt`, `typer.confirm`) for the setup wizard. |
| `pdfplumber` | Bank-statement PDF text extraction. The toolkit's deterministic parser walks pdfplumber's per-page text lines and matches a date-prefix + amount-suffix regex against a known transaction-line shape. |
| `openpyxl` | Builds the multi-sheet xlsx output. Hidden-sheet support (`ws.sheet_state = "hidden"`) is how the Audit sheet carries categorization provenance without cluttering the user's view. |
| `reportlab` | Renders the printable Worksheet PDF and generates the synthetic-example statement fixtures. The `Table` + `Paragraph` API gives enough layout control without HTML→PDF conversion overhead. |
| `anthropic` | Optional. Two methods on the SDK wrapper: `extract_transactions_from_text` (sends pdfplumber-extracted text) and `extract_transactions_from_pdf` (multimodal, sends the PDF as a base64-encoded document attachment). Both return strict JSON the engine deserializes into `Transaction` objects. |
| `pyyaml` | All user-editable config files use YAML. The user-rules file gets appended-to by `categorize --apply`, so write-back preserves comment-free safe-dump output. |

## Configuration & runtime files

- `pyproject.toml` — project metadata + dependency pins
- `rules/default_rules.yaml` — shipped merchant → category regex rules
- `vault/<year>/config.yaml` — per-year per-vault settings (entity type, filing status, inventory, home office)
- `vault/<year>/rules.yaml` — user-scoped rules layered on top of defaults
- `vault/<year>/manual_additions.yaml` — non-bank line items
- `vault/<year>/filed_return.yaml` — what was actually filed, for past-year reconciliation
- `vault/<year>/carryforward.yaml` — NOL / §179 carryforward brought into the year
- `.githooks/pre-commit` — privacy enforcement at commit time
- `scripts/check_clean.py` — release-checklist scanner
- `Makefile` — `make setup / test / test-unit / test-integration / test-privacy / check-clean / example / clean`
