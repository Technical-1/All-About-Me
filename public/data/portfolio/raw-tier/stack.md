# raw-tier — stack

State: `building`. See `CLAUDE.md`.

- **Language:** Python, `requires-python = ">=3.11"`.
- **Runtime dependencies: none**, and the 2026-08-11 `sealed` amendment
  added none — `Path.stat` and `hashlib.file_digest` (3.11+, which is why
  the floor stays where it is) are both stdlib. Stdlib only — `sqlite3`,
  `hashlib`, `os`/`os.path`/`os.replace`, `pathlib`, `datetime`,
  `argparse`, `sys`, `time`, `json`, `collections.namedtuple`. ⭐ The
  2026-08-12 run record added none either: `json`, `time`, `os.fsync` and
  `datetime` are stdlib, and it deliberately does **not** import
  `source_alerter` — the reader's contract is honoured by shape, and the
  cross-repo seam is tested from the consumer's side. `pip install .` in a
  clean venv pulls in
  nothing beyond `raw_tier` itself; the only extra package a verification
  run needs is `pytest`, and that's test tooling, not a runtime dep of the
  installed package. This is a hard constraint (A9-adjacent: engines/Sources
  stay light), not an accident of what happened to get used.
- **Packaging:** `pyproject.toml`, `setuptools` build backend
  (`[build-system] requires = ["setuptools>=61"]`,
  `build-backend = "setuptools.build_meta"`), single flat package
  `raw_tier/`. Console script `raw-fsck = "raw_tier.cli:main"` registered
  via `[project.scripts]`.
- **Storage:** SQLite (`manifest.db` under the raw root, WAL journal mode)
  for the manifest; the plain filesystem for payloads. No external database,
  no ORM. ⭐ A **third** store under the same root — one **mirror** database
  per container source, SQLite again — was decided 2026-08-12 and is **not
  built** (ai-lab `specs/2026-08-12-relational-mirror.md`,
  `.portfolio/architecture.md`). It adds no dependency and no new technology:
  it is `sqlite3` reading `sqlite_master` and replicating rows.
- **Test tooling:** `pytest` (dev/test only, not a runtime dependency).
  `pytest.ini` points `testpaths` at `tests/`.
- **A9's Python rule binds engines; Sources may differ** — raw-tier is the
  shared library every Source writes through, so it is deliberately
  dependency-free at the boundary: a Source written in another language
  only needs to speak this SQLite schema and this filesystem layout, not
  import this package.
