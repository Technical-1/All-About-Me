# Project Q&A

## Overview

A Claude Code skill for preparing US federal tax-prep worksheets from bank
statement PDFs, backed by a deterministic Python engine. You open the repo in
Claude Code and invoke `prepare-1120` (C-corp) or `prepare-schedule-c` (sole
prop); the model orchestrates a five-phase flow, extraction, categorization
with user-gated learning, summary review, output generation, and a pre-flight
checklist, while every dollar of tax-law math stays in versioned Python form
modules. Supports US C-corporations (Form 1120 + Form 1125-A + state form +
Other Deductions statement) and sole proprietors / single-member LLCs
(Schedule C + Schedule SE + Form 8829 Simplified Method). Outputs a multi-sheet
Excel workbook plus a printable PDF labeled "Tax Preparation Worksheet, Not An
Official Tax Return," intended to be reviewed by a CPA before filing.

The interesting engineering angle is the division of labor: the model decides
*when* to run each step and explains the numbers, but never computes them, so
the output stays auditable. A close second is the four-layer privacy posture:
real tax data is structurally impossible to commit even with a careless
`git add .`.

## Problem Solved

A US small business owner with a year of bank statements still needs to do a
lot of mechanical work to file federal taxes, extract every transaction,
categorize it, sum by category, map those sums to specific IRS form line
numbers, and produce the right attachments for any line that needs an
itemized breakdown. The work is largely deterministic; it just hasn't been
packaged as a reusable tool for the case where you trust your own
categorization more than a generic SaaS would. This toolkit packages that
workflow, with strong privacy guarantees so it's safe to use on real data
inside a public-repo clone.

## Target Users

- **Small business owners filing their own return**: sole props or
  small-corp owners who'd otherwise build a one-off spreadsheet from scratch.
  They get a deterministic, line-by-line worksheet a CPA can review.
- **CPAs reviewing a client's bookkeeping**: the Audit sheet inside the
  workbook records every transaction's rule provenance, which makes
  spot-checking the categorization much faster than re-deriving it.
- **Engineers wanting an honest, working example** of how to structure a
  domain tool around year-versioned form mapping, layered rules, and
  privacy-by-construction.

## Key Features

### Skill-driven, five-phase workflow
The primary interface is a pair of Claude Code skills (`prepare-1120`,
`prepare-schedule-c`). Invoking one runs a fixed five-phase flow: setup
(locate the year's statements), categorize (propose a category for every
merchant the rules don't match, batch it to the user for confirmation, and
write back only what's confirmed), review the summary, generate the workbook
and worksheet, then a pre-flight checklist. The model orchestrates and
explains; the engine does the math. A raw CLI drives the same engine for
anyone not in a Claude Code session.

### Two entity types, explicit switch
C-corp returns (Form 1120) and Schedule C returns (sole prop) are two
separate CLI subcommands and two separate output paths. The
`entity_type` field in `vault/<year>/config.yaml` is the per-vault
declaration; the subcommands check it and error out clearly if the user
runs the wrong one. No magical inference, explicit by design.

### Bank-statement extraction with a typed hand-off
The deterministic `pdfplumber`-based parser handles the format the toolkit
ships with. On an unknown layout it returns zero transactions and raises a
custom `ExtractionNeedsHelp` exception carrying the PDF path; the CLI exits
with code 3 rather than crashing. That exit code is a hand-off seam. Under the
skill, the model reads the unparseable PDF directly (its file reader is
multimodal) and substitutes a transactions CSV, so no API key is involved. On
the headless path, the CLI instead falls back to the Anthropic SDK in two
stages, text-mode (cheap) then multimodal PDF (robust), when
`ANTHROPIC_API_KEY` is set.

### Year-versioned form mapping
Every form module lives under `forms/y2025/` and is a pure function
from `CategoryTotals` to `{line_number: Decimal}`. When 2026 IRS forms
ship, the next year is a sibling directory, `forms/y2026/`, copied
and edited. The diff between two years' modules is the only place
tax-law changes live.

### Decimal-only money with `float` rejection at the boundary
Every pydantic money field has a `mode="before"` validator that
rejects `float` and `bool`. The `bool` guard exists because `bool` is
an `int` subclass and `Decimal(True) == Decimal(1)` silently, which
would manifest later as a cents-off line on the return.

### Four-layer privacy posture
`.gitignore` rules + a `.githooks/pre-commit` shell hook + a
`scripts/check_clean.py` working-tree scanner + the `vault/<year>/`
convention. Single failures (gitignore typo, careless `git add .`)
are insufficient to leak data.

### Manual additions for non-bank line items
A `manual_additions.yaml` file lets users add mileage deductions,
expenses paid on a personal card, or year-end accrual adjustments:
line items that never appear in bank statements. These get merged
into the pipeline as ghost transactions with `rule_id =
"manual_addition"` for audit-trail provenance.

### Past-year reconciliation with transaction tracing
The `reconcile` command re-imports a prior year's statements, recomputes
the return with the current engine, and diffs it against what the user
actually filed (`filed_return.yaml`). Each line is classified match /
minor / material, missed deductions and over-claims are surfaced, and
every material discrepancy is traced back to the specific transactions
that explain it, output as a workbook sheet, a PDF, and a terminal
summary.

### Carryforward engine
Carryforward amounts brought into a year via `carryforward.yaml` are
consumed in the computation: a C-corp NOL fills Form 1120 line 29a
(post-TCJA 80%-of-taxable-income limit), a prior-year §179 disallowed
amount is applied against the current income limit, and prior-year
bonus/§179 assets keep depreciating on a user-supplied `remaining_basis`.
The ending carryforward state is surfaced in a "Carryforward" workbook
sheet, the worksheet PDF, and the terminal summary.

## Technical Highlights

### `ExtractionNeedsHelp` as a typed seam
- `src/tax_toolkit/extract.py:23` declares a custom exception carrying
  the unparseable PDF's path and a human-readable message. When the
  deterministic parser returns nothing and no API key is configured,
  this exception is raised. `src/tax_toolkit/cli.py` catches it across
  three subcommands and exits with code 3, never code 1, so an
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

### Out-of-band math verification independent of the engine
- A second, from-first-principles checker loads the canonical synthetic
  transactions, applies the rules in a parallel implementation, computes each
  expected form line independently, and compares against the toolkit's
  workbook. Because it shares no code with the engine, it catches design
  errors that unit tests miss: insurance double-counted across Form 1120
  Line 26 and Schedule C Line 27a, and meals dropped on Schedule C from a
  missing `Category.MEALS` branch in `summarize.py`. Each finding is pinned by
  a regression test in `tests/unit/test_stmt_other_deductions.py`,
  `tests/unit/test_schedule_c.py`, and `tests/unit/test_summarize.py`.

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
- **Choice**: (b), `forms/y2025/form_1120.py`, future `forms/y2026/form_1120.py`.
- **Why**: When 2026 forms ship, the work is a directory copy plus targeted edits. The diff between two years' modules is the only place tax-law changes live, which makes audit, testing, and CPA review tractable. Option (a) accumulates dozens of year-conditional branches over time.

### Model orchestrates, engine computes
- **Constraint**: A tax tool can't let a language model do the arithmetic, a single hallucinated line number is a wrong return. But the parts that genuinely benefit from a model (reading an unfamiliar bank PDF, guessing what an unknown merchant is) shouldn't be hard-wired into the engine either.
- **Options**: (a) Hard-wire SDK calls into `extract.py` / `categorize.py` and let the model touch numbers. (b) Make the engine math-and-storage-only, and let a Claude Code skill orchestrate it through a thin CLI seam.
- **Choice**: (b).
- **Why**: The `--emit-unmatched` flag writes the unmatched-transactions list to JSON without any model call; `--apply` writes back confirmed rules. The `prepare-1120` / `prepare-schedule-c` skill calls these two flags and does its merchant reasoning in between, but never sees or edits a computed total. The headless CLI uses the same subcommands with `--propose` / `--auto` and `ANTHROPIC_API_KEY`. Either drives the identical engine, so the math is the same regardless of who's at the wheel.

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

### Skill-first, with a headless CLI underneath
- **Constraint**: The toolkit should be approachable for someone who just wants to talk their way through a return, AND usable by a Python developer running it from a terminal or a CI job.
- **Options**: (a) CLI-only. (b) Skill-only. (c) Both, with the skill as the primary front end and the CLI as the engine seam underneath it.
- **Choice**: (c).
- **Why**: The Claude Code skill is the interface a user reaches for first, conversational, no API key, with confirmation gates. It drives the same `--emit-unmatched` / `--apply` CLI seam the headless path uses, so the engine has exactly one implementation. A user who prefers the terminal, or wants to automate, loses nothing; both audiences get the same math without forking the maintenance burden.

## Frequently Asked Questions

### Does this file my taxes for me?
No, and it deliberately doesn't try to. The output is labeled "Not An
Official Tax Return" and is meant to be transcribed onto the actual IRS
form by a CPA or by the user after review. That distinction keeps the
toolkit on the right side of "software that helps you do taxes" vs.
"licensed tax-preparation software," which carry meaningfully different
legal frameworks in some US states.

### How do I actually run it?
Clone the repo, open it in Claude Code, drop your bank-statement PDFs into
`vault/<year>/statements/`, and ask to prepare your return. The `prepare-1120`
(C-corp) or `prepare-schedule-c` (sole prop) skill activates and walks you
through setup, categorization, summary review, output, and a pre-flight
checklist. If you'd rather stay in a terminal, the same engine is a plain CLI:
`uv run tax-toolkit process --year <year>` (see the README for the full
command set).

### Why ship it as a Claude Code skill instead of just a CLI?
Two reasons. First, the genuinely fuzzy parts of tax prep, reading a bank PDF
in a layout you've never seen, deciding that "SQ *BLUE BOTTLE" is a coffee
expense, are exactly what a model is good at, and a skill lets the model do
them conversationally with a confirmation gate, no API key, and no glue code.
Second, and more important, it keeps the model *out* of the arithmetic. The
skill is explicitly an orchestrator: tax-law math lives in `src/tax_toolkit/forms/`,
and the model's job is to run the right command at the right time and explain
the result. That division is what makes a model-driven tax tool trustworthy:
the AI never computes a number that ends up on a form.

### What banks does it support?
The shipped deterministic parser handles the synthetic-example layout,
which is similar to a date-prefixed line-per-transaction format common
to large US retail banks. For real-world bank PDFs whose layout it
doesn't recognize, the engine exits with code 3 instead of guessing.
Under the skill, the model then reads the PDF directly and builds the
transactions table, no API key required. On the headless path, the CLI
falls back to Anthropic Claude (text-mode then multimodal PDF) when
`ANTHROPIC_API_KEY` is set.

### What entity types are supported?
The toolkit supports US C-corporations (Form 1120 + Form 1125-A COGS + Form 4562
depreciation + state form + Statement of Other Deductions for Line 26) and
sole proprietors / single-member LLCs (Schedule C + Schedule SE + Form 8829
Simplified Method home office + Form 4562 depreciation + optional state form).
State coverage: FL, TX, and VA (see the state-coverage Q&A below). Future work:
S-corp (Form 1120-S) and partnership (Form 1065).

### What state coverage is included?
Three states are supported, selected by a `state:` field in the per-year
`config.yaml`. The CLI dispatches one state form per vault based on that
field:

- **FL**: Florida F-1120 corporate income/franchise tax (C-corp only;
  Florida has no personal income tax, so Schedule C produces no state form).
  Default for backward compatibility with pre-v0.5 vaults.
- **TX**: Texas franchise (margin) tax. C-corps always produce this form.
  On the Schedule C side it fires only when `tx_franchise.is_llc: true`;
  bare sole proprietors without an LLC wrapper are exempt from Texas franchise
  tax.
- **VA**: Virginia Form 500 corporate income tax at 6% flat (C-corp);
  a VA Form 760 inclusion worksheet for Schedule C (Schedule C net profit
  and SE deductible half to report on the personal VA Form 760; doesn't
  compute full personal income tax).

Setting `state: null` skips all state forms. Each state is a sibling module
under `forms/y2025/`, adding a fourth state is a new file plus a dispatch
branch in `cli.py`.

### How does the toolkit handle equipment purchases and depreciation?
Capital asset purchases, computers, cameras, vehicles, furniture, office
equipment, are treated differently from regular operating expenses. A
categorization rule tags the bank transaction as `capital_asset`, which
excludes it from all expense line totals (the same mechanism used to exclude
inter-account transfers from revenue). The user then declares the asset in
`vault/<year>/assets.yaml` with its cost, placed-in-service date, recovery
period, business-use percentage, and depreciation method. At processing time
the toolkit computes the Form 4562 deduction and routes the result to
Schedule C Line 13 (sole prop) or Form 1120 Line 20 (C-corp).

Three depreciation methods are supported for 2025: §179 immediate expensing
(2025 cap $1,250,000, with phaseout above $3,130,000 and an income limit
so §179 cannot create a business loss), 40% first-year bonus depreciation
(the 2025 TCJA phase-down rate), and MACRS GDS half-year convention for
5-year property (computers, vehicles, equipment) and 7-year property
(furniture and fixtures). Prior-year assets already in service continue
depreciating off the MACRS table in subsequent years.

Every run that includes at least one depreciable asset generates a Form 4562
sheet and a Depreciation Schedule sheet in the workbook, and a Form 4562
section in the printable worksheet PDF. A runnable example is included in the
repository: `uv run tax-toolkit process-schedule-c --example depreciation-demo-2025`.

### Can I check a past year's return for errors?
Yes, that's what `tax-toolkit reconcile` does. You record what you actually
filed in `vault/<year>/filed_return.yaml` (any subset of the form's lines),
drop that year's statements in the vault, and run the command. The toolkit
re-imports the statements, recomputes the return with the current engine, and
diffs it against your filed figures. Each line is classified match / minor /
material; deduction lines the engine computed but your filed return omitted
are flagged as possible missed deductions; and each material discrepancy is
traced to the contributing transactions so you can see why the numbers differ.
The result is written as a Reconciliation workbook sheet, a PDF, and a terminal
summary, with a headline delta on net profit (Schedule C) or taxable income
(C-corp). A runnable demo with planted discrepancies ships in the repository:
`uv run tax-toolkit reconcile --example reconcile-demo-2025`.

One honest limitation: the toolkit ships only 2025 form modules, so a pre-2025
reconciliation recomputes with 2025 rules. Year-independent checks
(miscategorizations, omitted income, arithmetic) are accurate for any year, but
year-specific provisions, bonus depreciation percentage, §179 caps, the
standard mileage rate, differ, so the report prints a caveat for those lines
when the year predates 2025.

### How do carryforwards from a prior year get applied?
Record them in `vault/<year>/carryforward.yaml`: `nol_carryforward` (a
C-corporation net operating loss) and `section_179_carryforward` (a §179
deduction a prior year's income limit disallowed). On a run, the NOL fills Form
1120 line 29a, capped at 80% of taxable income (the post-2017 rule), and the
§179 carryforward is added to the current year's §179 elections and allowed up
to the business-income limit. For a depreciable asset placed in service in an
earlier year that is still being written off, a bonus or §179 asset, add a
`remaining_basis` field to its `assets.yaml` entry (the post-first-year MACRS
basis the depreciation table runs on, not net book value), and the toolkit
continues its MACRS schedule. After the run, a "Carryforward" workbook sheet,
a worksheet-PDF section, and the terminal summary show what rolls into next year:
the remaining NOL (including any current-year loss), the unused §179, and each
asset's remaining basis. These are explicit inputs rather than auto-derived
because the toolkit ships only 2025 rules and cannot accurately recompute a
prior year's depreciation or limits. A runnable demo:
`uv run tax-toolkit process --example carryforward-demo-2025`.

### How does the categorization actually work?
A regex rule is `{pattern, category, subcategory, type_hint?}`. The
engine walks rules in order (user rules first, then shipped defaults)
and the first match wins. Unmatched transactions are listed in a
JSON file via `tax-toolkit categorize --emit-unmatched`. Under the
skill, the model reasons about each unmatched merchant, proposes a
category, and presents the batch for confirmation; `tax-toolkit
categorize --apply` then appends only the confirmed rules to the
user's rules file. Over time, the user-scoped rules file grows to
cover most recurring merchants and the next year's run needs minimal
intervention.

### Does my bank data leave my machine?
It depends on the path and whether the deterministic parser succeeds:

- **Deterministic parse (either path):** if the shipped parser recognizes
  your statement layout, nothing leaves your machine: extraction,
  categorization against your rules, and all math are local.
- **Skill path, unknown layout:** the model reads the PDF inside your Claude
  Code session, so that statement's contents go to Anthropic as part of the
  conversation (no API key needed). Merchants it has to categorize are
  likewise reasoned about in-session.
- **Headless path, unknown layout:** with `ANTHROPIC_API_KEY` set, the CLI
  sends the failing PDF or its extracted text to the Anthropic API; the
  categorize `--propose` mode also calls the API, while `--emit-unmatched`
  does not.

In every case the engine's computations and your `vault/` files stay on disk.
What can leave is statement content the model needs to read or categorize.

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
