# Project Q&A

## Overview

**quickforge** is a Python CLI that bootstraps a complete, modern Python project with one command. It solves the recurring tax of wiring up a package manager, linter, formatter, type checker, test runner, CI config, and editor settings every time you start something new. The target user is a Python developer who wants a fresh project on uv + ruff + basedpyright + pytest without spending an afternoon assembling boilerplate.

## Problem Solved

Most Python scaffolding tools either ship outdated defaults (setup.py, black + isort + flake8, mypy) or require so much customization up front that you might as well configure things by hand. quickforge picks one opinionated stack — the one I'd configure manually in 2025 — and emits it correctly in seconds. It also goes the other direction: `audit` and `upgrade` modernize existing projects without trashing user-authored configuration.

## Target Users

- **Python developers starting a new project** — get a working library, CLI, FastAPI service, app, or PEP 723 script with sensible defaults already wired
- **Maintainers of legacy projects** — migrate from Poetry/pip/setuptools to uv and from black/isort/flake8/mypy to ruff + basedpyright without rewriting pyproject.toml by hand

## Key Features

### One-command project creation
`quickforge new myproject` produces a `src/` layout package, configured `pyproject.toml`, pytest skeleton, GitHub Actions CI, pre-commit hooks, and VS Code settings. Both interactive prompts and a fully scriptable `--yes` mode are supported.

### Five project archetypes
`library`, `cli` (Typer), `api` (FastAPI), `app`, and `script` (PEP 723 inline dependencies). Each archetype renders only the templates relevant to it, so a CLI project doesn't ship empty FastAPI scaffolding.

### Audit and upgrade
`quickforge audit` detects the existing toolchain by signature (lock files, pyproject sections, tool-specific configs) and scores the project from 100. `quickforge upgrade` migrates Poetry/pip/pipenv/setuptools to uv and black/isort/flake8/mypy to ruff + basedpyright, while preserving inline comments via `tomlkit`.

### Modular feature add-ons
`quickforge add` injects Docker, GitHub Actions, MkDocs, pre-commit, VS Code settings, or a devcontainer into an existing project. Each feature has its own template set and is independently testable.

## Technical Highlights

### Comment-preserving TOML edits during upgrades
Standard `tomli`/`tomli-w` round-trips destroy comments and reflow whitespace, which is unacceptable when modifying a user's hand-written `pyproject.toml`. The upgrader uses `tomlkit`, which parses TOML into a document model that retains formatting, so migrations land as surgical edits rather than rewrites. See `src/quickforge/upgrader.py`.

### Signature-based toolchain detection
The auditor identifies the active package manager, linter, formatter, and type checker by looking for `poetry.lock`, `Pipfile.lock`, `[tool.black]` sections, `.flake8` files, etc. — not by asking the user. This makes audit and upgrade work on any project without configuration. Detection logic lives in `src/quickforge/auditor.py`.

### Atomic generation with cleanup on failure
Project creation is a linear pipeline (`validate -> create dirs -> render templates -> write files -> git init -> validate output`). Each stage tracks what it created; on failure, the generator unwinds and removes partial directories rather than leaving a half-formed project on disk. See `src/quickforge/generator.py`.

### Conditional template rendering
Templates are tagged by archetype and feature flags. `cli.py.j2` is rendered only for `--type cli`; the FastAPI router only for `--type api`; Docker, MkDocs, devcontainer files only when their flags are set. The generated tree contains only files the user actually asked for.

### Context-aware escaping in a code generator
Jinja2 autoescaping is built for HTML; for emitting TOML and Python it's the wrong default, so it's disabled — which means free-text fields (a project description, an author name) could otherwise inject a stray quote or brace and break the generated files. Rather than sanitizing input globally, I escape at the point of use with destination-specific filters in `src/quickforge/generator.py`: `toml_escape` for TOML strings, `py_escape` for Python literals and docstrings, and `fstring_escape` for f-string contexts (which additionally doubles braces so they aren't parsed as replacement fields). The result is that a description containing `"` and `{}` is preserved verbatim in `pyproject.toml` while the file still parses as valid TOML.

## Engineering Decisions

### tomlkit vs tomli for upgrades
- **Constraint**: Upgrading a project must not destroy comments or formatting in `pyproject.toml`
- **Options**: `tomli` + `tomli-w` (lossy round-trip), regex-based edits (fragile), `tomlkit` (round-trip preserving)
- **Choice**: `tomlkit` for the upgrader's write path; `tomli` for read-only parsing where round-tripping isn't needed
- **Why**: `tomlkit` keeps the user's documentation intact, which is the whole point of in-place migration

### Typer vs Click vs argparse
- **Constraint**: Need a CLI with subcommands, rich help, and good DX, without writing parser boilerplate
- **Options**: argparse (verbose), Click (mature but decorator-heavy), Typer (Click underneath, infers from type hints)
- **Choice**: Typer
- **Why**: Function signatures double as the CLI definition, Rich integration is built in, and Click's ecosystem is still available underneath when needed

### Detection-based audit vs explicit declaration
- **Constraint**: Need to audit arbitrary user projects, not just ones generated by this tool
- **Options**: Require a `quickforge.toml` config file, infer from `pyproject.toml` alone, fingerprint by files on disk
- **Choice**: File fingerprinting plus `pyproject.toml` parsing
- **Why**: Zero-configuration UX; works on projects that have never heard of quickforge, including legacy setup.py / Pipfile / Poetry repos

### src/ layout for the generated default
- **Constraint**: New projects should resist a known Python footgun (importing the in-tree package instead of the installed one during testing)
- **Options**: Flat layout (simpler), src/ layout (industry standard, immune to in-tree shadowing)
- **Choice**: src/ layout
- **Why**: PyPA recommends it, tests run against the installed package, and IDE refactoring is more reliable

## Frequently Asked Questions

### Why another Python scaffolder?
Most existing tools encode a 2018-era stack (setup.py, black, isort, flake8, mypy, pip) and treat modern tools as add-ons. quickforge inverts that: uv, ruff, basedpyright, and pytest are the defaults; legacy tools are not options. The generated project is what I'd produce manually if I had unlimited time on day one.

### Why uv instead of Poetry or pip?
uv is written in Rust and resolves dependencies an order of magnitude faster, manages Python versions itself, and produces a portable `uv.lock`. It also accepts the same `pyproject.toml` standards that Poetry helped establish, so the migration cost is small.

### Why ruff instead of black + isort + flake8?
One tool replaces three, with a single config block in `pyproject.toml` and substantially faster runs. The autofix surface is wider, and rule coverage is broader than the combined set it replaces.

### Why basedpyright instead of mypy?
basedpyright (a fork of pyright) is significantly faster, stricter by default, and produces clearer error messages with better editor integration. For new projects starting fresh, the stricter defaults catch bugs the day they're written.

### What happens if my project description or author name contains quotes or braces?
It's handled. Because the generator emits code and config (not HTML), free-text fields are escaped per destination — TOML strings, Python literals/docstrings, and f-strings each have their own escaping rule — so a description like `He said "hi" {now}` lands intact in `pyproject.toml` and the generated Python still compiles.

### Which licenses generate a real LICENSE file?
All six offered (MIT, Apache-2.0, GPL-3.0-only, BSD-3-Clause, Unlicense, Proprietary) emit a complete `LICENSE` file, and the project's PyPI trove classifier and SPDX expression are set to the correct values for the chosen license — including the `LicenseRef-` form for the non-SPDX Proprietary case.

### Can I customize the generated templates?
Not at the moment — templates are bundled with the package. The intent is that the generated output is opinionated. If you need a different stack, fork the project or modify the generated files after creation.

### Does it support monorepos?
No. Each `quickforge new` invocation produces a single project. For monorepos, use uv workspaces directly on top of the generated projects.

### How does the audit score work?
The auditor starts at 100 and deducts per finding by severity (critical -20, error -10, warning -5, info -1). 80+ is healthy, 60–80 needs attention, under 60 indicates real technical debt. The threshold is configurable.

### What happens if an upgrade fails partway?
`quickforge upgrade` writes a timestamped backup to `.quickforge_backup_<timestamp>/` before changing anything. `--dry-run` prints the planned changes without writing. If the migration aborts mid-way, the backup is the recovery path.

### Why 80% as the default coverage gate?
80% is the inflection point where coverage starts catching real regressions without becoming theater. It leaves room for untested edge cases and config glue while requiring meaningful tests for core paths. The number lives in the generated `pyproject.toml` and is easy to change.
