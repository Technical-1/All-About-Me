# github-connector — stack

**State: `built` and running hourly on the tower.**

⛔⛔ This file read *"State: `planned`. No stack yet. Likely Python"* until
2026-08-25, while the thing was already deployed and archiving.

- **Python ≥ 3.11**, one runtime dependency: **`httpx`**.
- Runs from its **own `.venv`** as a systemd timer on the tower, hourly.
- Writes through **`raw-tier`**, the shared manifest every Source writes
  through — payload first, then the manifest row, which is the commit point.
- Its credential is a **fine-grained PAT** held on the tower at `0600
  root:root`. ⚠️ Its permissions are **not API-enumerable**, so what it can do
  cannot be read back from GitHub — a fact that has already produced one wrong
  finding, when a check run under a *different* credential reported a gap that
  did not exist.

## What it extracts, and why that is the whole design

```
DOC_DIRS  = (".portfolio/",)
DOC_FILES = ("CLAUDE.md",)
```

⭐ **That is the entire contract between a repo and the knowledge base.** A repo
documents itself in `.portfolio/`, and this Source carries it in — one
authoritative source, no hand-copied summary to rot.

⛔⛔ **It reads each repo's `default_branch`** (`sync.py:190`). A `.portfolio/`
that exists only on a side branch is **invisible to the KB**, and nothing
reports it as missing — the repo simply contributes its metadata and nothing
else.
