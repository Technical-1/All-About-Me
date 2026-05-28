# Project Q&A

## Overview

A privacy-first CLI for preparing US federal tax-prep worksheets from bank
statement PDFs. Supports US C-corporations (Form 1120 + Form 1125-A + state
form + Other Deductions statement) and sole proprietors / single-member LLCs
(Schedule C + Schedule SE + Form 8829 Simplified Method). Outputs a
multi-sheet Excel workbook plus a printable PDF labeled "Tax Preparation
Worksheet — Not An Official Tax Return," intended to be reviewed by a CPA
before filing. The interesting engineering angle is the four-layer privacy
posture: real tax data is structurally impossible to commit even with a
careless `git add .`.

## Problem Solved

A US small business owner with a year of bank statements still needs to do a
lot of mechanical work to file federal taxes — extract every transaction,
categorize it, sum by category, map those sums to specific IRS form line
numbers, and produce the right attachments for any line that needs an
itemized breakdown. The work is largely deterministic; it just hasn't been
packaged as a reusable tool for the case where you trust your own
categorization more than a generic SaaS would. This toolkit packages that
workflow, with strong privacy guarantees so it's safe to use on real data
inside a public-repo clone.

## Target Users

- **Small business owners filing their own return** — sole props or
  small-corp owners who'd otherwise build a one-off spreadsheet from scratch.
  They get a deterministic, line-by-line worksheet a CPA can review.
- **CPAs reviewing a client's bookkeeping** — the Audit sheet inside the
  workbook records every transaction's rule provenance, which makes
  spot-checking the categorization much faster than re-deriving it.
- **Engineers wanting an honest, working example** of how to structure a
  domain tool around year-versioned form mapping, layered rules, and
  privacy-by-construction.

## Key Features

### Two entity types, explicit switch
C-corp returns (Form 1120) and Schedule C returns (sole prop) are two
separate CLI subcommands and two separate output paths. The
`entity_type` field in `vault/<year>/config.yaml` is the per-vault
declaration; the subcommands check it and error out clearly if the user
runs the wrong one. No magical inference — explicit by design.

### Three-stage bank-statement extraction
The deterministic `pdfplumber`-based parser handles the format the toolkit
ships with. When it returns zero transactions on an unknown layout, the
toolkit checks for `ANTHROPIC_API_KEY` and, if set, falls back to
Anthropic Claude in two stages — text-mode (cheap) then multimodal PDF
(robust). When neither is available, a custom `ExtractionNeedsHelp`
exception carries the PDF path; the CLI exits with code 3 so an outer
process can substitute its own reader without conflating paths.

### Year-versioned form mapping
Every form module lives under `forms/y2025/` and is a pure function
from `CategoryTotals` to `{line_number: Decimal}`. When 2026 IRS forms
ship, the next year is a sibling directory — `forms/y2026/` — copied
and edited. The diff between two years' modules is the only place
tax-law changes live.

### Decimal-only money with `float` rejection at the boundary
Every pydantic money field has a `mode="before"` validator that
rejects `float` and `bool`. The `bool` guard exists because `bool` is
an `int` subclass and `Decimal(True) == Decimal(1)` silently — which
would manifest later as a cents-off line on the return.

### Four-layer privacy posture
`.gitignore` rules + a `.githooks/pre-commit` shell hook + a
`scripts/check_clean.py` working-tree scanner + the `vault/<year>/`
convention. Single failures (gitignore typo, careless `git add .`)
are insufficient to leak data.

### Manual additions for non-bank line items
A `manual_additions.yaml` file lets users add mileage deductions,
expenses paid on a personal card, or year-end accrual adjustments —
line items that never appear in bank statements. These get merged
into the pipeline as ghost transactions with `rule_id =
"manual_addition"` for audit-trail provenance.

## Technical Highlights

### `ExtractionNeedsHelp` as a typed seam
- `src/tax_toolkit/extract.py:23` declares a custom exception carrying
  the unparseable PDF's path and a human-readable message. When the
  deterministic parser returns nothing and no API key is configured,
  this exception is raised. `src/tax_toolkit/cli.py` catches it across
  three subcommands and exits with code 3, never code 1 — so an
  outer caller (a script, a CI runner, or a different process) can
  distinguish "the toolkit can't parse this format" from "the toolkit
  crashed." Exit code 3 became the contract for handing the PDF to a
  different reader without re-coupling the engine to any specific
  alternative.

### Rule provenance through the workbook's hidden Audit sheet
- `src/tax_toolkit/output/workbook.py` writes an Audit sheet
  (`ws.sheet_state = "hidden"`) that records, per transaction:
  `rule_id`, `confidence`, `source_file`, `source_page`,
  `category`, `subcategory`. Three categories of `rule_id` show up:
  `rule:N` for default + user rules, `transfer_detector` for
  paired inter-account transfers, and `manual_addition` for
  YAML-injected ghost transactions. A reviewer can answer "why is
  this $487 PayPal charge in Operating Expenses?" without re-running
  the engine.

### Independent math verification caught three real bugs
- After v0.3.0 (which had 141 passing tests) I wrote an out-of-band
  verification that loads canonical synthetic transactions, applies
  rules in a parallel implementation, and computes expected line
  values from first principles — then compares to the toolkit's
  workbook. It found three bugs the unit tests missed: insurance
  double-counted in Form 1120 Line 26 and Schedule C Line 27a,
  meals silently dropped on Schedule C (no `Category.MEALS` branch
  in `summarize.py`). All three are now covered by regression tests
  in `tests/unit/test_stmt_other_deductions.py`,
  `tests/unit/test_schedule_c.py`, and `tests/unit/test_summarize.py`.
  The lesson worth keeping: synthetic data tests the code; only
  fresh-perspective verification tests the design.

### Pre-commit hook reads staged content, not the working tree
- `.githooks/pre-commit` scans every staged file via `git show ":$f"`
  rather than the working-tree path, so a developer who stages a
  clean version and then dirties the working copy can still commit
  cleanly. The hook also catches PDFs outside `examples/`, EIN-shaped
  text content, and filename patterns like `*real-data*` / `*-private-*`
  / `*confidential*` (both case-variants since git globs are
  case-sensitive on Linux/CI even though HFS+ on macOS is not).

## Engineering Decisions

### Year-versioned form modules vs. one parametrized file
- **Constraint**: IRS form line numbers and rates change every tax year. Sometimes lines get renumbered, not just rate values.
- **Options**: (a) One `form_1120.py` with `if year == 2025:` branches. (b) One sibling directory per tax year.
- **Choice**: (b) — `forms/y2025/form_1120.py`, future `forms/y2026/form_1120.py`.
- **Why**: When 2026 forms ship, the work is a directory copy plus targeted edits. The diff between two years' modules is the only place tax-law changes live, which makes audit, testing, and CPA review tractable. Option (a) accumulates dozens of year-conditional branches over time.

### Engine ↔ intelligence layer split
- **Constraint**: Some users have an Anthropic API key and want full automation; others don't and shouldn't be blocked from running the toolkit; others use an agent runtime that does the AI work itself.
- **Options**: (a) Hard-wire SDK calls into `extract.py` / `categorize.py`. (b) Make the engine math-and-storage-only; expose SDK calls and agent-driven flows as substitutable intelligence layers.
- **Choice**: (b).
- **Why**: The `--emit-unmatched` flag writes the unmatched-transactions list to JSON without any SDK call; `--apply` writes back confirmed rules. An agent runtime calls these two CLI flags and does its own reasoning between them. The SDK path uses the same CLI subcommands with `--propose` / `--auto` and `ANTHROPIC_API_KEY`. Either substitutes cleanly for the other.

### Decimal everywhere vs. float-with-discipline
- **Constraint**: Floating-point arithmetic introduces small rounding errors that compound across thousands of transactions and surface as cents-off totals on the filed return.
- **Options**: (a) `float` everywhere with rounding at output. (b) `Decimal` end-to-end with `float`-rejection validators at the type boundary.
- **Choice**: (b).
- **Why**: Catches money-precision bugs at construction time rather than as a downstream rounding mismatch. The custom validator also rejects `bool` (because `Decimal(True) == Decimal(1)` silently); that guard came from a code-review finding during real-data validation and is now a regression test.

### Privacy as four layers, not one
- **Constraint**: A toolkit for handling real tax data has to make accidental commits structurally impossible, not just "carefully" possible.
- **Options**: (a) Rely on `.gitignore` alone. (b) Pre-commit hook with EIN-pattern detection. (c) Working-tree scanner. (d) All of the above.
- **Choice**: (d).
- **Why**: A single failure (gitignore typo, careless `git add -A`, IDE auto-stage, a copy-paste of a real account number into a comment) shouldn't be enough to leak data. The four layers cover different failure modes: `.gitignore` blocks tracked-files-by-default; the hook catches whatever gets through to staging including EIN-shaped content; the scanner is a release-time check before `git push`; the `vault/<year>/` convention is the human contract for where real data goes. Each layer is cheap; together they're robust.

### CLI-first with optional agent-runtime integration
- **Constraint**: The toolkit should work for a Python developer who runs it from a terminal, AND for someone driving it via an external agent runtime that prefers conversational workflows.
- **Options**: (a) CLI-only. (b) Agent-runtime-only. (c) Both, with the runtime artifacts shipped in the repo and the CLI as the canonical entry.
- **Choice**: (c).
- **Why**: CLI is the canonical interface. An external agent runtime can drive the same engine through the `--emit-unmatched` / `--apply` CLI seam, so users on either path get the same math without forking the maintenance burden — fixes in the engine reach both audiences.

## Frequently Asked Questions

### Does this file my taxes for me?
No, and it deliberately doesn't try to. The output is labeled "Not An
Official Tax Return" and is meant to be transcribed onto the actual IRS
form by a CPA or by the user after review. That distinction keeps the
toolkit on the right side of "software that helps you do taxes" vs.
"licensed tax-preparation software," which carry meaningfully different
legal frameworks in some US states.

### What banks does it support?
The shipped deterministic parser handles the synthetic-example layout,
which is similar to a date-prefixed line-per-transaction format common
to large US retail banks. For real-world bank PDFs whose layout it
doesn't recognize, the toolkit falls back to Anthropic Claude
(text-mode then multimodal PDF) when `ANTHROPIC_API_KEY` is set; if
not set, it exits with code 3 and a message pointing at the
agent-runtime alternative.

### What entity types are supported?
v0.4 supports US C-corporations (Form 1120 + Form 1125-A COGS +
Florida F-1120 + Statement of Other Deductions for Line 26) and
sole proprietors / single-member LLCs (Schedule C + Schedule SE +
Form 8829 Simplified Method home office). Future work: S-corp (Form
1120-S), partnership (Form 1065), and Form 4562 depreciation.

### Why is there only Florida state coverage on the C-corp side?
The C-corp synthetic example I built it against was a Florida
business. Florida's corporate income/franchise tax (Form F-1120) is
implemented as `forms/y2025/form_fl_f1120.py`. Adding another state
is a sibling file in the same directory — the form module reads
Schedule C / Form 1120 federal taxable income as its starting point
and applies state-specific apportionment and rate. The architecture
supports it; I just haven't shipped other states yet.

### How does the categorization actually work?
A regex rule is `{pattern, category, subcategory, type_hint?}`. The
engine walks rules in order — user rules first, then shipped defaults
— and the first match wins. Unmatched transactions are listed in a
JSON file via `tax-toolkit categorize --emit-unmatched`; the user (or
an agent) reasons about each one and writes confirmations back, and
`tax-toolkit categorize --apply` appends the confirmed rules to the
user's rules file. Over time, the user-scoped rules file grows to
cover most of their recurring merchants and the next year's run
needs minimal intervention.

### Does my bank data leave my machine?
Not unless `ANTHROPIC_API_KEY` is set AND the deterministic parser
fails on a PDF. In that case the toolkit sends the failing PDF (or
its extracted text) to Anthropic for parsing. With no API key, all
processing is local. The categorize step's `--propose` mode also
uses the API; the alternative `--emit-unmatched` mode does not.

### Why YAML for the rules and config?
Human-editable; supports comments; round-trips cleanly through
`PyYAML`'s safe-dump for the learn-on-confirm append behavior. The
toolkit also generates an annotated `config.yaml` via
`tax-toolkit init --template` for users who prefer editing files
directly over interactive prompts.

### How do I add a state form for my state?
Create `forms/y2025/form_<state>.py` modeled on `form_fl_f1120.py`,
implement `map(totals, ...) -> dict[str, Decimal]`, and add a sheet
for it in `output/workbook.py`. The Florida module is ~50 lines; a
similarly-simple state should be in that range, plus an integration
test or two.
