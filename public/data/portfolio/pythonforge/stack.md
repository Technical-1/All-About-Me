# Technology Stack

## Overview

quickforge is a pure Python CLI application built with modern 2025 tooling. I designed it to be both a functional tool and a reference implementation of the patterns it generates.

## Core Technologies

### Python 3.11+

**Version**: 3.11, 3.12, 3.13 supported

I chose Python 3.11 as the minimum version because:

- **Performance**: 10-60% faster than 3.10 due to specializing adaptive interpreter
- **Error messages**: Significantly improved error reporting with precise locations
- **Type hints**: Full support for modern typing features like `Self`, `TypeVarTuple`
- **Standard library**: `tomllib` included for TOML parsing

### Package Management: uv

**Version**: Latest (Rust-based)

I use `uv` for package management because:

- **Speed**: 10-100x faster than pip for dependency resolution
- **Lockfiles**: Native support for reproducible builds via `uv.lock`
- **Python management**: Can install and manage Python versions directly
- **Drop-in replacement**: Compatible with pip commands and pyproject.toml

### Build System: Hatchling

**Version**: Latest

I selected Hatchling as the build backend because:

- **Modern standards**: Full PEP 517/518/621 compliance
- **Minimal configuration**: Sensible defaults, works out of the box
- **uv compatibility**: Works seamlessly with uv workflows
- **Plugin ecosystem**: Extensible when needed

## Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **typer** | >=0.12.0 | CLI framework with rich integration |
| **rich** | >=13.0.0 | Beautiful terminal output, tables, panels |
| **jinja2** | >=3.1.0 | Template rendering for generated files |
| **questionary** | >=2.0.0 | Interactive prompts with validation |
| **pydantic** | >=2.0.0 | Data validation and configuration models |
| **tomli** | >=2.0.0 | TOML reading (consistent across versions) |
| **tomli-w** | >=1.0.0 | TOML writing |
| **tomlkit** | >=0.13.0 | Comment-preserving TOML manipulation |

### Dependency Rationale

**Typer over Click**: Typer is built on Click but provides automatic type inference from Python type hints, reducing boilerplate and improving IDE support.

**Pydantic v2**: The rewrite in Rust provides 5-50x faster validation while maintaining the same API. Essential for snappy CLI responses.

**tomlkit for upgrades**: Unlike tomli/tomli-w, tomlkit preserves comments and formatting when modifying TOML files. This is critical for the upgrade command where I modify existing pyproject.toml files.

**questionary**: Provides a better user experience than raw input() with validation, autocompletion, and styled prompts.

## Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **pytest** | >=8.0.0 | Test framework |
| **pytest-cov** | >=5.0.0 | Coverage reporting |
| **basedpyright** | >=1.20.0 | Static type checking |
| **pre-commit** | >=3.8.0 | Git hooks for code quality |
| **ruff** | >=0.8.0 | Linting and formatting |

### Why basedpyright?

I chose basedpyright over mypy because:

- **Speed**: 3-5x faster type checking
- **Stricter defaults**: Catches more bugs out of the box
- **Better errors**: More detailed error messages with suggestions
- **VS Code integration**: Excellent real-time feedback in the editor

### Why ruff?

Ruff replaces multiple tools with one fast solution:

- Replaces: flake8, black, isort, pyupgrade, bandit
- **Speed**: Written in Rust, 10-100x faster than alternatives
- **800+ rules**: Comprehensive linting coverage
- **Autofixes**: Can automatically fix most issues
- **Single config**: Everything in pyproject.toml

## CI/CD Infrastructure

### GitHub Actions

I use GitHub Actions for continuous integration:

```yaml
# Workflow structure
quality:        # Runs first: ruff check, ruff format, basedpyright
test:           # Runs after quality: pytest across Python 3.11/3.12/3.13
all-checks:     # Gate job: only succeeds if all others pass
```

**Key features**:
- **Concurrency control**: Cancels in-progress runs on new commits
- **Matrix testing**: Tests across all supported Python versions
- **Codecov integration**: Uploads coverage reports
- **uv caching**: Fast dependency installation

### Pre-commit Hooks

I configured pre-commit hooks for local development:

- **ruff check**: Lint on commit
- **ruff format**: Format on commit
- **basedpyright**: Type check on commit
- **trailing-whitespace**: Clean up whitespace
- **end-of-file-fixer**: Ensure newline at EOF

## Project Structure

```
quickforge/
├── src/
│   └── quickforge/
│       ├── __init__.py      # Version and exports
│       ├── cli.py           # Typer CLI commands
│       ├── models.py        # Pydantic data models
│       ├── generator.py     # Project generation logic
│       ├── auditor.py       # Project analysis
│       ├── upgrader.py      # Migration logic
│       └── templates/       # Jinja2 templates (20+ files)
├── tests/
│   ├── conftest.py          # pytest fixtures
│   ├── test_cli.py          # CLI tests
│   ├── test_models.py       # Model validation tests
│   ├── test_generator.py    # Generation tests
│   ├── test_auditor.py      # Audit tests
│   └── test_upgrader.py     # Migration tests
├── .github/
│   └── workflows/
│       ├── ci.yml           # CI workflow
│       └── publish.yml      # PyPI publishing
├── pyproject.toml           # All configuration
└── uv.lock                  # Locked dependencies
```

### Why src Layout?

I use the `src/` layout because:

- **Prevents accidental imports**: Can't import local package without installation
- **Cleaner testing**: Tests always run against installed package
- **Industry standard**: Recommended by Python Packaging Authority
- **IDE support**: Better autocompletion and refactoring

## Configuration Approach

All configuration lives in `pyproject.toml`:

- **[project]**: Package metadata (PEP 621)
- **[build-system]**: Build configuration (PEP 517)
- **[tool.ruff]**: Linting and formatting rules
- **[tool.basedpyright]**: Type checking settings
- **[tool.pytest]**: Test configuration
- **[tool.coverage]**: Coverage settings

I avoided separate config files (setup.cfg, .flake8, mypy.ini) to demonstrate modern best practices.

## Limitations

- **No Windows testing in CI**: I focused on Linux/macOS; Windows users may encounter path issues
- **No async support**: All operations are synchronous; could benefit from async file I/O
- **Template complexity**: Some templates have significant Jinja2 logic that could be refactored
- **Limited error recovery**: Some failures require manual cleanup
