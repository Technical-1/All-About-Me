# simplefin-intake — stack

**State: `running`.** Tasks 1–5 built, tested and deployed on the tower;
⚠️ the deployed build is an earlier one than this tree — it has none of the
`local-error` exit class, the run lock, the `SQLITE_BUSY` contention split or
the `skipped_reason` record field. See `CLAUDE.md`.

- **Language:** Python, `requires-python = ">=3.11"`. [A9] does not bind
  Sources, but this one is Python because it imports `raw_tier`.
- **Runtime dependencies: stdlib only, plus `raw_tier`.** No HTTP client
  library — the SimpleFIN surface is one POST and one GET, so an SDK would be
  a dependency to audit for no benefit. `urllib`, `ssl`, `socket`, `sqlite3`,
  `json`, `base64`, `hashlib`, `os`, `stat`, `pathlib`, `argparse`,
  `datetime`, `logging`, `time`, `dataclasses`, `errno`, `fcntl`.
  - ⚠️ **`ssl` and `socket` are imported by `faults.py` for their exception
    TYPES, not to open anything.** `ssl.SSLError` and `socket.gaierror` put a
    foreign code in `.errno` (OpenSSL's and `getaddrinfo`'s), and the numbers
    collide with `EPERM` and `EIO` — so the classifier has to name the types
    to refuse them before it reads an errno at all.
  - ⚠️ **`sqlite3.Error.sqlite_errorcode` is 3.11+**, which is where the
    `SQLITE_BUSY`-vs-corruption split reads from. It is the reason
    `requires-python` cannot drop below 3.11 — the alternative is matching on
    SQLite's message text, which is prose it is free to reword.
  - ⚠️ **`fcntl` is POSIX-only**, which is why the run lock lives in its own
    module (`runlock.py`) and is imported by `cli` alone: the deployment is
    Ubuntu on the tower, and the boundary is visible rather than smeared
    through the package.
  - **`raw_tier`** is the frozen sibling contract this Source writes through.
    It is not published to an index, so `pyproject.toml` records it as a
    comment rather than a PEP 508 entry: `pip install -e /path/to/raw-tier`.
- **Packaging:** `pyproject.toml`, setuptools backend, one flat package
  declared explicitly (`[tool.setuptools] packages = ["simplefin_intake"]`) so
  a new top-level directory cannot silently change what ships [SF-11].
  Console script `simplefin-intake = "simplefin_intake.cli:main"`.
- **State on disk** — four files, all under `SIMPLEFIN_STATE_DIR` (default
  `/data/fast/state/simplefin-intake`), plus the shared raw tier:

  | path | what |
  |---|---|
  | `access_url` | the bearer credential, mode 600, plain text, never logged |
  | `cursors.db` | SQLite, **WAL**: poll cursor, backfill frontier, per-account backfill state, and the **gap sweep** position |
  | `last-run.json` | the [NT-1] run record — `mac-control-app`'s interface |
  | `sync.lock` | the whole-run `flock`. Empty, never read, ⚠️ **never unlinked** — it is a rendezvous point, and deleting it on release gives two processes two inodes to lock and both the belief that they hold it. Beside the state it protects, and on the same volume |
  | `RAW_TIER_ROOT` (default `/data/fast/state/raw`) | the raw tier, **shared across every Source**, which is why it has its own env var rather than being derived from this Source's state dir |

  ⚠️ `cursors.db` is WAL to match the manifest: in rollback-journal mode a
  read-only connection cannot recover the hot journal a sync killed at reboot
  leaves behind, and the tower dual-boots.
- **Credential storage:** mode 600 plus the tower's LUKS-encrypted disk is the
  whole story — no keyring, no second layer, same posture as raw-tier's
  manifest. `load_access_url` **raises** on a looser mode rather than warning.
- **Scheduling:** an hourly systemd timer with `Persistent=true`, so an hour
  missed during a Windows stint is caught up on boot. ⭐ **The units live in
  the `tower` repo**, not here — they describe that machine, not this package.
  `tower/provision/bootstrap.sh --only sources` installs them and enables the
  **timer** (never the service; it is `Type=oneshot`).
- **Test tooling:** `pytest` only, plus `setuptools` as a *test* dependency
  for the wheel-build test, which runs `--no-build-isolation --no-index` so
  the suite never reaches the network. No HTTP-mocking library: tests
  monkeypatch `bridge.get_accounts` or `bridge._request`, which is enough
  surface not to need one.
