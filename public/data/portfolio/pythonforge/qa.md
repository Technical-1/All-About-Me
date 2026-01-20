# Project Q&A

## Project Overview

**quickforge** is a modern Python project bootstrapper that creates production-ready Python projects with a single command. It solves the problem of repetitive project setup by generating complete project structures with 2025's best toolchain already configured: uv for package management, ruff for linting/formatting, basedpyright for type checking, and pytest for testing. The target users are Python developers who want to start new projects quickly without spending hours configuring build tools, CI/CD pipelines, and development environments.

## Key Features

### 1. One-Command Project Creation

Run `quickforge new myproject` and get a complete, working project with:
- Proper package structure (src layout)
- All tools configured in pyproject.toml
- GitHub Actions CI/CD pipeline
- Pre-commit hooks ready to install
- VS Code settings optimized for the toolchain
- Test skeleton with pytest and coverage

### 2. Multiple Project Types

I support five project types tailored to different use cases:
- **library**: PyPI-publishable packages with src layout
- **cli**: Command-line tools with Typer integration
- **api**: FastAPI/Flask web services
- **app**: Standalone applications
- **script**: Single-file scripts with PEP 723 inline dependencies

### 3. Interactive and Scriptable

The CLI works in two modes:
- **Interactive**: Prompts guide you through all options with descriptions
- **Non-interactive**: Pass flags for CI/CD usage (`--yes` skips all prompts)

### 4. Project Auditing

The `quickforge audit` command analyzes existing projects and identifies:
- Legacy tooling (black, flake8, mypy) that could be modernized
- Missing type annotations and coverage
- Configuration improvements
- Security best practices

### 5. Automated Migration

The `quickforge upgrade` command migrates projects from:
- Poetry/pip/pipenv/setuptools to uv
- black/isort/flake8 to ruff
- mypy to basedpyright

It preserves comments and formatting in existing configuration files.

### 6. Feature Addition

Add optional features to existing projects with `quickforge add`:
- github-actions: CI/CD workflow
- docker: Dockerfile and docker-compose.yml
- docs: MkDocs with Material theme
- pre-commit: Git hooks configuration
- vscode: IDE settings and extensions
- devcontainer: Dev container for VS Code

## Technical Highlights

### Challenge: Comment-Preserving TOML Updates

When upgrading projects, I needed to modify pyproject.toml without destroying users' carefully written comments and documentation. I solved this by using `tomlkit` instead of standard TOML libraries. tomlkit parses TOML into a document model that preserves whitespace, comments, and formatting, allowing surgical modifications.

### Challenge: Cross-Platform Path Handling

Template paths needed to work across macOS, Linux, and Windows. I used `pathlib.Path` throughout and carefully handled path separators in templates. The src layout path is dynamically computed based on project type.

### Challenge: Atomic Project Generation

If generation fails midway, users shouldn't be left with a broken partial project. I implemented cleanup logic that removes partially created directories on failure, and validation that verifies the generated project is syntactically correct before reporting success.

### Innovation: Detection-Based Auditing

Rather than requiring users to declare their tooling, the auditor automatically detects what tools are in use by checking for lock files, configuration sections, and tool-specific files. This zero-configuration approach means it works on any Python project.

### Innovation: Template Condition System

Templates are conditionally rendered based on project configuration. For example, `cli.py.j2` is only rendered for CLI projects, while `main.py.j2` is rendered for app and API projects. This keeps the generated code minimal and relevant.

## Frequently Asked Questions

### Q1: Why create another project scaffolding tool?

I found that existing tools either generate outdated structures (using setup.py, black, mypy) or require significant configuration. I wanted a tool that embodies 2025 best practices out of the box, with zero configuration needed for the common case. quickforge generates exactly what I would set up manually for a new project.

### Q2: Why uv instead of Poetry or pip?

uv is 10-100x faster than pip and Poetry because it's written in Rust. It handles dependency resolution, virtual environments, and Python version management in one tool. The speed difference is noticeable on every operation, making development more pleasant.

### Q3: Why ruff instead of black and flake8?

ruff combines linting (flake8, pylint) and formatting (black, isort) into one tool that's 10-100x faster. Having one configuration section instead of three separate tools simplifies maintenance. ruff also has more rules and better autofix capabilities.

### Q4: Why basedpyright instead of mypy?

basedpyright is faster (3-5x), has better error messages, and integrates seamlessly with VS Code. It's stricter by default, which catches more bugs. The "based" fork adds additional checks beyond standard pyright.

### Q5: Can I customize the generated templates?

Currently, templates are bundled with the package and not user-customizable. This is intentional to ensure consistency and correctness. If you need significant customization, you can use quickforge as a starting point and modify the generated files, or fork the project.

### Q6: Does quickforge support monorepos?

Not currently. Each invocation creates a single project. For monorepos, I'd recommend using uv workspaces directly. This might be added in a future version.

### Q7: How does the audit scoring work?

The audit starts at 100 points and deducts based on findings:
- Critical issues: -20 points
- Errors: -10 points
- Warnings: -5 points
- Info: -1 point

A score above 80 is considered healthy, 60-80 needs attention, and below 60 indicates significant technical debt.

### Q8: What happens if the upgrade fails?

Before making any changes, `quickforge upgrade` creates a timestamped backup of all configuration files in `.quickforge_backup_TIMESTAMP/`. If something goes wrong, you can restore from this backup. The upgrade also supports `--dry-run` to preview changes without applying them.

### Q9: Why is the coverage requirement set at 80%?

I believe 80% is a pragmatic target that encourages good testing habits without becoming burdensome. It allows for untested edge cases and configuration code while ensuring core functionality is covered. The threshold is configurable in the generated pyproject.toml.

### Q10: How do I contribute to quickforge?

The project is open source on GitHub. To contribute:
1. Clone the repository
2. Run `uv sync --extra dev` to install dependencies
3. Run `uv run pre-commit install` to set up hooks
4. Make changes and ensure `uv run pytest` passes
5. Submit a pull request

I welcome contributions for new project types, additional features, and bug fixes.
