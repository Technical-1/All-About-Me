# raw-tier — stack

State: `building`. See `CLAUDE.md`.

- **Language:** Python, `requires-python = ">=3.11"`.
- **Runtime dependencies: none.** Stdlib only — `sqlite3`, `hashlib`,
  `os`/`os.path`/`os.replace`, `pathlib`, `datetime`, `argparse`, `sys`,
  `collections.namedtuple`. `pip install .` in a clean venv pulls in
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
  no ORM.
- **Test tooling:** `pytest` (dev/test only, not a runtime dependency).
  `pytest.ini` points `testpaths` at `tests/`.
- **A9's Python rule binds engines; Sources may differ** — raw-tier is the
  shared library every Source writes through, so it is deliberately
  dependency-free at the boundary: a Source written in another language
  only needs to speak this SQLite schema and this filesystem layout, not
  import this package.
