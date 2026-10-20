# compute-base — architecture map

**What it is.** The library the compute engines share. The first three engines
(shopify, messages, email) each carried their own copy of the run shell; this
repo holds one copy, and engines 4–8 are born on it. It is the "extraction
checkpoint" of the engine build method, named `compute-base`.

**Layout.**

| Path | Holds |
|---|---|
| `compute_base/shell/` | the run shell: run lock, in-progress record, triggers, schedule, change gate, no-network guard, code identity, run record, stale, freshness, run driver (empty at the skeleton) |
| `compute_base/db.py` | the one SQLite connection helper every layer opens through; at SQLite defaults |
| `compute_base_testkit/` | shared test helpers, probes and tools, in the same distribution |
| `tests/test_self_scan.py` | no third-party import, nothing in the transitive stdlib network closure, no raw-tier path, no socket at import — each with in-test negative controls |
| `tests/test_db_defaults.py` | `db.connect` reads the same as bare `sqlite3` on every pragma SQLite lists and six connection attributes, and passes `sqlite3.connect` no argument beyond the path (and `uri=True` read-only) |
| `tests/test_package.py` | every package directory listed in `pyproject.toml` |

**Boundaries.** Standard library only; zero declared dependencies. No network
or model client (deterministic compute). The raw tier is read only through
`raw_tier`'s readers, never by path.

**Install.** Engines pin it non-editable at a commit on the tower; editable
only in development venvs.
