# shopify-source — qa

**State: `live`.** The suite is real, and CI runs it on push and pull request.

> ⛔ **CORRECTED 2026-08-19.** This file read *"No tests yet — the test suite
> arrives with the first code"*. The code and its tests arrived 2026-08-14.

⛔ **The suite size is deliberately not stated** [RA-42] — a figure that changes
whenever anyone does the work belongs in a command, not a document:

```bash
.venv/bin/python -m pytest -q
```

⚠️ Use **this repo's own `.venv`** [RA-103]. Another repo's venv reports false
failures; `/usr/bin/python3` has no pytest at all.

⭐ **The notable test is `tests/test_raw_tier_dependency.py`.** `raw-tier` is a
real dependency that is deliberately **absent** from `pyproject.toml` [SP-32], so
it is enforced by **execution** — the test imports it and fails when it is
missing — in place of a requirement line pip could never satisfy [GS-14].

⚠️ A contract test here is a **specification** [PE-9]: editing one is an
amendment and a checkpoint decision, never a fix.
