# raw-tier — qa

State: `building`. See `CLAUDE.md`.

## ⭐ The suite is the frozen Source contract [PE-9]

As of this task (Task 7, the final task of the raw-tier build plan), this
test suite stops being "tests for a library in progress" and becomes the
**frozen contract every Source is written against** [PE-9]. Contract tests
are specifications, not incidental coverage: a behavior change here is a
contract change for every Source that writes through `RawStore`, not a
refactor-and-move-on.

## Suite size

**29 tests**, all green, across six files:

| File | Tests | Pins |
|---|---|---|
| `test_schema.py` | 6 | manifest DDL: `raw_objects`/`raw_subjects` shape, the RT-17 primary key `(source, doc_id, sha256)`, `storage` CHECK constraint, indexes |
| `test_write_raw.py` | 4 | `write_raw` payload-then-row commit discipline |
| `test_versions_and_dedupe.py` | 5 | RT-15 `last_seen` dedupe semantics, RT-17 content versioning, `get_current` ordering (mutation-tested) |
| `test_write_ref.py` | 3 | `write_ref` verify-before-write (referent must exist before the row is inserted) |
| `test_subjects_and_reads.py` | 4 | `add_subjects`/`subjects_for` idempotence, `iter_current` one-row-per-document guarantee |
| `test_fsck.py` | 7 | fsck coverage counts + all four violation classes, including `unreadable` |

## What's pinned, and how

- **Commit-point ordering via simulated crash.** `write_raw`/`write_ref`
  tests don't just assert the happy path — they exercise the
  payload-before-row ordering by simulating a crash between the two steps
  (e.g. monkeypatching the insert to fail after the payload write) and
  asserting the resulting state is an orphan file, never a row with no
  payload behind it. This is what makes payload-then-row an enforced
  invariant instead of a comment.
- **RT-15 dedupe semantics.** Writing identical content twice for the same
  `(source, doc_id)` is asserted to be a `last_seen`-only bump — no second
  row, no second file write, `WriteResult("dedupe", sha, None)`. Writing
  *different* content for the same `(source, doc_id)` is asserted to insert
  a new row (`"new_version"`) and leave the prior version's row intact and
  queryable via `versions()` — the archive-forever guarantee (RT-11), not
  an aspiration.
- **`get_current` ordering, mutation-tested.** The tie-break chain
  (`fetched_at` DESC, then `last_seen` DESC, then — in `iter_current` —
  `rowid` DESC) is pinned by a test constructed so that removing any one
  tie-break level would change the result: rows are seeded with
  deliberately colliding `fetched_at`/`last_seen` values so the test fails
  if the ordering silently degrades to "whatever SQLite returns first."
  This is the guard against the class of bug the fix-round history on this
  task flagged (window-function tie-break gap, fixed before Task 5 closed).
- **fsck coverage, not just violations [RT-6].** `test_fsck.py` asserts the
  *coverage counts* (`checked_rows`, `checked_files`) on a clean store, not
  only that violation lists are empty — a report that only ever prints
  zeros is not distinguishable from a report that never checked anything,
  and RT-6 exists precisely to make that distinction visible.
- **`unreadable`.** Added after the rest of `FsckReport`'s shape was fixed:
  a directory the walk can't enter (permission denied) is recorded by
  relative path and makes `FsckReport.clean` `False` even with zero
  orphans/missing/dangling — an unreadable directory is a coverage gap,
  not a clean bill of health. Covered by `test_fsck.py` and surfaced by the
  CLI as its own `UNREADABLE {d}` line.

## Verification (Task 7)

- `python -m pytest -q` — 29 passed, on the Mac.
- Clean-venv install (`python -m venv … && pip install -q . pytest`) — zero
  runtime dependencies pulled in beyond `raw_tier` itself; `pytest -q` green
  in the clean venv.
- `raw-fsck` against an empty/nonexistent root — prints the zero-coverage
  line and exits 0 (a fresh root is a legitimate clean state, not an
  error).
- Repeated **on the tower** (not just the Mac) per PE-2's machine-provenance
  rule — see the Task 7 report for the captured tower output.

## Deliberately not built (YAGNI, per the plan's self-review)

- Retention policies (spec §6.2 — measurable later, not urgent now).
- An exclusion list (§6.1 — lives at derivation, not in raw-tier).
- Path-building helpers (Sources own their own paths; raw-tier only
  validates and resolves what it's given).
- Streaming hashes (a contract-invisible optimization; `hashlib.sha256` on
  the full in-memory payload is what's tested and what ships).
- A delete/erase API (spec §3 — no delete API is itself part of the
  contract, not a gap).

## Known deferred minors (carried from earlier tasks, still open)

- `collect_error` in `fsck.py` only special-cases `PermissionError`; other
  `OSError` subclasses during the walk are still silently absorbed by
  `os.walk`'s default `onerror` behavior being overridden but not fully
  handled for every error type.
- `test_fsck.py` has an unused `import pytest`.
- No `Connection.close()` / context-manager story for `RawStore` yet.
- `write_ref`'s `FileNotFoundError` message says "missing" even when the
  referent path exists but is a directory, not a file.

None of these block the PE-9 freeze; they're recorded so freezing the
contract doesn't also freeze them as "intentional."
