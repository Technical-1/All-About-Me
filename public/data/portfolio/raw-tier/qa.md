# raw-tier — qa

State: `building` — ⭐ **live on the tower**, with both amendments (`sealed`,
the relational `mirror`) deployed 2026-08-12. See `CLAUDE.md`.

## ⭐ The suite is the frozen Source contract [PE-9]

As of this task (Task 7, the final task of the raw-tier build plan), this
test suite stops being "tests for a library in progress" and becomes the
**frozen contract every Source is written against** [PE-9]. Contract tests
are specifications, not incidental coverage: a behavior change here is a
contract change for every Source that writes through `RawStore`, not a
refactor-and-move-on.

## Suite size

⛔ **The count is not stated here** [RA-42] — it read **606** for seventeen days
and was **814** when next measured. `.venv/bin/python -m pytest -q`.
⭐ The 2026-08-13 shape, kept as the record: **606 across 33 files** (re-derived from
`pytest --collect-only` 2026-08-13; the mirror added 206 cases in 12 new
files). ⚠️ That command counts parametrised cases — earlier versions of this
table said 29 when the suite already collected 31, 77 while
`test_migrate_sealed.py`'s 101 cases were already in the tree, 201 until the
2026-08-12 fix round, **248 across "fifteen files" while the tree already held
354 across eighteen**, and **400 while the mirror's files were already in the
tree**. ⭐ **Re-derive it from the tree; never carry it forward.** That
instruction was already written here and was **not followed twice**, which is
why it now carries two counter-examples.

| File | Tests | Pins |
|---|---|---|
| `test_schema.py` | 6 | manifest DDL: `raw_objects`/`raw_subjects` shape, the RT-17 primary key `(source, doc_id, sha256)`, `storage` CHECK constraint, indexes |
| `test_write_raw.py` | 5 | `write_raw` payload-then-row commit discipline |
| `test_versions_and_dedupe.py` | 6 | RT-15 `last_seen` dedupe semantics, RT-17 content versioning, `get_current` ordering (mutation-tested) |
| `test_write_ref.py` | 3 | `write_ref` verify-before-write (referent must exist before the row is inserted) |
| `test_subjects_and_reads.py` | 4 | `add_subjects`/`subjects_for` idempotence, `iter_current` one-row-per-document guarantee |
| `test_fsck.py` | 7 | fsck coverage counts + all four violation classes, including `unreadable` |
| `test_sealed_schema.py` | 10 | the `storage` CHECK widened by exactly one value, never dropped or loosened |
| `test_write_sealed.py` | 22 | `write_sealed`: zero reads on re-registration, `SealBroken` on a size change, and what identifies an existing row |
| `test_fsck_verify.py` | 10 | the deep verify: catches a byte flipped in place, off by default, reports coverage, never writes |
| `test_cli.py` | 4 | `raw-fsck` exit codes and the verify line (the CLI had no tests before) |
| `test_migrate_sealed.py` | 117 | `scripts/migrate_sealed.py`: refusals, the one-transaction rebuild, backup/restore, per-row comparison in and after the transaction, the rollback that cannot run |
| `test_fsck_verify_versions.py` | 18 | ⭐ [SS-1] a path with MORE THAN ONE row: superseded vs mismatch, `ref` drift, one open per path (counted), the bucket accounting |
| `test_cli_verify_report.py` | 5 | what `--verify` prints: coverage vs health, and absence vs zero when it did not run |
| `test_sealed_adoption.py` | 15 | ⭐ 2026-08-12: `write_sealed` over a manifest that already holds a `ref` row — the defect that made the mode a no-op, adoption, and the two refusals |
| `test_seal_conflicts.py` | 16 | ⭐ 2026-08-12: `sealed` rows at one path promising different sha256 — the forward hazard in Task 4's `UPDATE` |
| `test_migrate_sealed_rows.py` | 106 | `scripts/migrate_sealed_rows.py`: the scoped seal of the 19,729 attachment rows, and the refusal to seal `chat.db` |
| `test_run_record.py` | 35 | ⭐⭐ 2026-08-12: `--run-record` — the `exit_class` mapping, the two-class severity split, `warnings[]`/`errors[]` as an alerting channel, no path in the record, the atomic write, the absent-root and record-inside-the-tier refusals |
| `test_orphan_age.py` | 11 | ⭐ 2026-08-12: the in-flight/aged orphan split, the boundary, and ⛔ that `st_mtime` is not the field (rsync `-a` preserves the origin's) |

### ⭐ The mirror's fifteen new files — 206 cases, 2026-08-12

| File | Tests | Pins |
|---|---|---|
| `test_fsck_fix_round_1.py` | 13 | ⭐ the pre-deploy round's `fsck` findings, each with the failure it would otherwise have produced **on a healthy run** |
| `test_python39_importable.py` | 18 | ⭐ the Mac's 3.9 floor: what a Source may import without the tower's interpreter |
| `test_mirrorstore.py` | 17 | the row-grain manifest: `mirror_rows`/`mirror_tombstones`/`mirror_tables`/`mirror_sweeps`/`mirror_cursor`/`mirror_brakes`, and the `(tbl, pk, row_sha)` key — ⛔ **never `(tbl, pk)`** |
| `test_mirror_replication.py` | 19 | complete replication: `sqlite_master` read at run time, every table, every column, `pk`/`row_sha` derivation, dedupe bumping `last_seen` per row [RT-15] |
| `test_fsck_mirrors.py` | 19 | ⛔ a declared mirror is **not** an orphan; sidecars **exempted, never declared**; a retired path is **not** a `missing_payload` and is counted as its own class |
| `test_mirror_tombstones.py` | 17 | a tombstone MARKS and never deletes; `iter_current` hides them **by default**; ⭐ `iter_tombstoned` returns them with `last_seen` — the closing point, ⛔ not `tombstoned_at` |
| `test_mirror_brake_latch.py` | 16 | ⛔ the mass-tombstone brake **latches** rather than firing once — [RM-L] found it single-shot, postponing every fabricated tombstone by exactly one run — and stands down where its premise is false |
| `test_mirror_guards.py` | 15 | the disjoint-key-space (restore/renumber) brake and the runaway versions-per-entity guard |
| `test_mirror_sweeps_and_coverage.py` | 15 | ⛔⛔ **no tombstone without a COMPLETED sweep** [RM-D] — an interrupted sweep leaves `completed_at` NULL and writes **zero** tombstones; `source_count=None` is ⛔ never `0` |
| `test_mirror_policies.py` | 12 | the three policies, declared **per table**: EVENT keeps every version, STATE keeps latest + tombstone, TRANSIENT keeps latest and writes ⛔ no tombstone |
| `test_mirror_declaration.py` | 11 | the policy is **declared as data** and an unknown word **raises** — ⛔ declared, never silent; a policy change is reported |
| `test_mirror_fix_round_1.py` | 10 | the pre-deploy round: a policy change, a non-unique key, a stale sweep, a held lock |
| `test_mirror_event_tombstones.py` | 9 | ⭐⭐ **spec §3.3** — an EVENT tombstone is written, carries `policy='event'`, and that policy is **frozen at write time**, ⛔ never joined from `mirror_tables` |
| `test_run_record_mirrors.py` | 9 | `mirror.counts` and `mirror.sweeps` reach the run record **separately**, neither standing in for the other; a count shortfall is `data-error`, ⛔ **no new `exit_class`** |
| `test_cli_mirror_report.py` | 6 | what `raw-fsck` prints: `Mirrors: N declared, M missing, K retired` on **both** walks, and coverage **absent** rather than zero when the deep half did not run |

**Six** files predate the 2026-08-11 `sealed` amendment.
⭐ **No test file that predates the amendment has been modified** — all six
are byte-identical to `main` as of the amendment
(`git diff --quiet main -- <path>`), which is the check that `copy` and `ref`
behave exactly as they did.

⭐⭐ **The mirror kept that discipline, and one file is the honest exception.**
It added **fifteen** test files plus two fixtures and changed exactly one line
of pre-existing test text: `test_migrate_sealed_rows.py`'s `NEW_SCHEMA`
constant, which gained `raw_mirrors`. ⚠️ **That is a drift alarm doing its job,
not a weakened test** — the file keeps a copy of the library's DDL and
`test_the_fixture_schema_is_the_librarys` fires the moment `raw_tier/schema.py`
changes. ⛔ **No assertion was touched, no case was weakened, and the
`raw_objects` half is byte-for-byte what it was** — that migration neither
reads nor rebuilds the new table. ⭐ **Stated here rather than rounded to
"nothing was modified"**, because a contract suite that quietly absorbs an edit
is exactly what [PE-9] forbids.

⭐ **The run record (2026-08-12) modified NOTHING.** Every one of the eighteen
files that existed before it is byte-identical to `main`, machine-checked
(`git ls-files tests | xargs shasum -a 256 -c`); the 46 new cases are two new
files. The change is opt-in behind `--run-record`, and the CLI's output and
exit code without the flag were compared **byte-for-byte against a `main`
worktree** on the same fixture, with and without `--verify`: identical.

⚠️ **Five cases inside the amendment's own files have been amended**, across
two files, each saying so in its own docstring, and none of them on `main`:

- four cases in `test_fsck_verify.py` [SS-1, 2026-08-11], because the deep
  verify's scope changed under them (`copy` in, per-row `ref` comparison
  out); the behaviour they stopped describing is pinned in
  `test_fsck_verify_versions.py`;
- `test_the_seal_is_measured_against_the_latest_version` in
  `test_write_sealed.py` [2026-08-12] — its docstring called two sealed rows
  at one path legitimate, which is backwards, and its stand-in for the bulk
  migration was the **unscoped** `UPDATE`. The behaviour it pins is
  unchanged.

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

## The `sealed` amendment (2026-08-11) — what it pins, and how

- **Zero reads, counted — never timed.** A sealed row is written once and
  re-registered 100 times, and the test asserts **zero** payload reads by
  spying on `Path.read_bytes`, `Path.open` *and* `builtins.open` (filtered
  to the raw root, read modes only). Spying on `read_bytes` alone would
  pass an implementation that swapped it for `open(...).read()` or
  `hashlib.file_digest`, which would cost exactly the same 52.9 GB an hour.
  A timing assertion would pass on a fast disk while the read was still
  happening.
- **A size change is a finding, not a version.** Pinned in both directions
  (grown and truncated — a `>` where `!=` belongs would miss the truncation,
  which is the likelier corruption), and pinned negatively: no second row,
  no `last_seen` bump, and `SealBroken` is asserted *not* to subclass
  `ValueError`/`OSError` so a Source's existing `except OSError` cannot
  swallow it.
- **What identifies "an existing row"**, component by component. Four
  separate tests, one per component of `(source, doc_id, path,
  storage='sealed')`, each constructed so that dropping *that* component
  changes the result: another source's row at the same path, another
  document's row at the same path, the same document at a different path,
  and a `ref` row that changed (which must stay a legitimate
  `new_version`, never a false finding).
- **The blind spot is a test.** `stat` cannot see a byte flipped in place;
  a test asserts exactly that, so it is a stated limitation rather than an
  unnoticed hole, and so nobody "fixes" it by putting the read back.
- **The verify line, even when off.** `Deep verify: OFF — 0 payloads
  re-hashed` is asserted on the *default* run. Silent measurement drift is
  the house bug class: "0 mismatches" with no statement of whether anything
  was hashed reads exactly like a clean deep check.
- **Mutation-verified by actually running the mutants.** 25 mutants across
  `schema.py`, `store.py`, `fsck.py` and `cli.py`, run with
  `PYTHONDONTWRITEBYTECODE=1` and `__pycache__` dropped between each; a
  mutant that fails to compile or breaks the import is recorded INVALID and
  re-cut, not counted as a kill. All 25 killed. Three first-cut mutants hit
  an *identical substring earlier in the file* (in `write_ref`, `get_current`
  and `_bump_if_known`) and had to be re-targeted at longer unique strings —
  a mutant that lands somewhere other than the line you meant is a false
  reading in both directions.
- ⭐ **Mutating the guard the new branch sits above** turned up a real
  pre-existing gap: removing `_resolve`'s `isabs` check killed nothing,
  because the escape check catches every absolute path *outside* the root
  and no test covered an absolute path *inside* it. Now pinned.
- ⭐ **[SS-1] — the shape a test never built.** The deep verify shipped with
  10 cases and 178 green tests, and was wrong on the live manifest the day
  it ran, because every test built **one row per path** while `ref` exists
  to record **many rows per path**. What now pins it: the live shape itself
  (5 versions, 1 file → 1 verified, 4 superseded, **0 mismatches**), the
  bucket accounting (verified + mismatched + superseded + drifted covers
  every row at a hashed path, once), and **one open per distinct path,
  counted** — spying `builtins.open`, `Path.open` *and* `Path.read_bytes`,
  because "it got faster" is not evidence that a file was read once.
- **22 more mutants for the [SS-1] fix, 22 killed**, cut at the
  version-selection logic specifically (`PROMISED_IMMUTABLE`'s membership,
  match-any vs match-none, the superseded arithmetic, the newest-version
  tie-break, per-path vs per-row iteration, and the CLI's ON/OFF gate).
  ⭐ **Two survived the first pass and were real gaps**: `verified_rows +=
  matched → += 1` (no test had two rows matching one file) and
  `RefDrifted.versions` counting every row at the path rather than the `ref`
  rows (no drifted path also carried a `copy` row). Both are now pinned.

## The fix round (2026-08-12) — what it pins, and how

⛔ **The amendment's central feature was a no-op against the live manifest,
and 201 green tests said otherwise.** `write_sealed` looked for a row that
was already `sealed`; every row it exists for is still `ref`, so it re-read
the referent on every poll and returned `"dedupe"` off the `ref` row. ⭐ Every
observable was identical to the working fast path — the tests all built the
sealed row *through `write_sealed` itself*, which is the one starting state
the tower is not in.

- **The starting state is the live one.** Every case in
  `test_sealed_adoption.py` begins with `write_ref`, because that is what
  19,712 rows on the tower are. The regression case is three polls: the
  actions must read `adopted, dedupe, dedupe` and the reads must total ONE.
- **Reads counted, and counted ONCE.** The fixture spies all three routes
  (`Path.read_bytes`, `Path.open`, `builtins.open`) like the amendment's,
  but with a re-entrancy guard: `read_bytes` is `self.open('rb').read()`, so
  one physical read fires two spies. `== []` never showed that; "exactly N
  reads for N files" would have counted routes instead of reads.
- **The transition has an action of its own.** `"adopted"` is asserted to be
  none of `new`/`new_version`/`dedupe`: a caller logging actions is what has
  to be able to see it, since nothing else could.
- **`fetched_at` survives adoption, `last_seen` moves.** Adoption changes
  what is promised about the bytes, not when they arrived.
- **Both refusals, and that they cost no read.** A path with a version
  history (chat.db) and a `copy` row (the live `notes` rows) are refused from
  the manifest alone, with `reads == []` asserted — the answer is not in the
  file.
- **The forward hazard is a test file.** `test_seal_conflicts.py` runs the
  unscoped `UPDATE raw_objects SET storage='sealed'` over chat.db's shape and
  asserts fsck reports it, on the CHEAP walk, and fails the run — and that
  the *scoped* migration (`WHERE source='imessage-attachments'`) leaves 5
  honestly-unpromised rows and a clean report.
- **Mutation-verified, 25 mutants, 25 killed** (`PYTHONDONTWRITEBYTECODE=1`,
  every `__pycache__` dropped between mutants, a mutant that does not compile
  or breaks the import recorded INVALID and re-cut). ⭐ **Three survived the
  first pass and were real gaps**: `> 1` → `> 2` on the version-history
  refusal (the case used five versions, so two never proved anything),
  dropping `AND path=?` from the history lookup (no document had rows at two
  paths), and `SealConflict.rows` counting every row at the path rather than
  the sealed ones (no conflicted path also carried a `ref` row). All three
  are now pinned by name.

## Verification

- `python -m pytest -q` — **606 collected**, on the Mac (2026-08-13, re-run).
  ⚠️ This line said "29 passed" while the tree held 201, and "248 passed"
  while it held 606; a count that is copied rather than re-run is a claim
  about a suite nobody ran.
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
- ~~Streaming hashes~~ — ⭐ **built, and this entry was wrong when written**:
  the deep verify streams with `hashlib.file_digest` (`fsck.py`), which is
  why the Python floor stays at 3.11 (`.portfolio/stack.md`). A sealed
  attachment may be a video, so reading it whole would trade one cost for
  another. `write_raw`/`write_ref` still hash the payload in memory, which is
  what those two are handed.
- A delete/erase API (spec §3 — no delete API is itself part of the
  contract, not a gap).

## Known deferred minors (carried from earlier tasks, still open)

- ~~`collect_error` in `fsck.py` only special-cases `PermissionError`~~ —
  ⭐ **CLOSED, and it was already closed when this said otherwise**:
  `fsck.py`'s `collect_error` collects **any** `OSError` (a directory
  vanishing mid-walk raises `FileNotFoundError`, not `PermissionError`).
- `test_fsck.py` has an unused `import pytest`.
- No `Connection.close()` / context-manager story for `RawStore` yet.
- `write_ref`'s `FileNotFoundError` message says "missing" even when the
  referent path exists but is a directory, not a file. (`write_sealed`
  inherits the same wording, deliberately — the behaviour is pinned, the
  wording is not.)
- ~~The deep verify covers `ref` and `sealed` only~~ — ⭐ **CLOSED and
  inverted by [SS-1], 2026-08-11**: `copy` is now verified and `ref` is
  compared per path against every version recorded for it. The gap that
  remains is stated as a number, `unpromised_rows`: every `ref` row is one
  whose changed bytes cannot be told from the origin doing what `ref` exists
  for. ⭐⭐ **It is now ZERO**, and it took both amendments: `sealed` moved the
  attachment rows (**19,760 sealed rows / 47 GB** live) and the **mirror**
  retired `imessage/chat.db`, the only other `ref` path. ⚠️ Its 20 rows remain
  in the manifest forever — there is no delete API — but the path is
  **retired** and no Source writes a `ref` row any more.

None of these block the PE-9 freeze; they're recorded so freezing the
contract doesn't also freeze them as "intentional."

## ⭐ What the mirror still has to prove — carried open

⛔ **These are not covered by any test, because no test can cover them.**

| open | why it stays open |
|---|---|
| ⚠️ **[SS-7] `chat.db`'s rot hole** | **MITIGATED, ⛔ not closed** [SS-23]. *"A second version is itself a finding"* was tested and is **false** — 819 of 515,387 messages carry `date_edited` and ~8% mutate per poll, so a rotted row is indistinguishable from a real edit. ⭐ What the mirror bought: rot can no longer **destroy** an archived row, only add a bogus one beside it |
| ⚠️ **`runs.jsonl` has no logrotate** | **~85 KB/run → ~742 MB/yr** with all eight containers mirroring. Operational, and recorded so it is found before the disk is |
| ⚠️ **`reminders`' queue-shaped tables** | `ZREMCDOPERATIONQUEUEITEM`, `ZREMCDTEMPLATEOPERATIONQUEUEITEM`, `ZREMCDCHANGETRACKINGSTATE`, `ZREMCKSERVERCHANGETOKEN` are declared **`state`** and **watched**. ⛔ **Name-shape is not evidence** — [MA-2]'s decoy opened cleanly and answered queries too. ⭐ The sweeps make it observable: a `state` table the ORIGIN prunes shows a non-zero `tombstoned` |
| ⛔ **the mirror's on-disk size** | **MEASURE THIS FIRST.** ~1.3M rows was *derived* from ~2.5 versions per message, never measured; the first full sweep recorded **515,555 message rows at 1.0 versions/entity**, still climbing toward the measured ratio |

## The run record (2026-08-12) — 42 mutations, 0 survivors

⭐ The sweep targets **the `exit_class` mapping specifically**, because that
is where a wrong answer is silent: a mis-mapped class either pages a phone
about a healthy machine or says nothing about a rotted byte, and both look
like a green run. Run with `PYTHONDONTWRITEBYTECODE=1` and every
`__pycache__` dropped between mutants [SF-30], each mutant compiled before it
is measured, and each one run against **both repos' suites** — the writer's
tests here and `source-alerter`'s seam tests, because half of what these
mutants break is only visible at the reader.

What the 42 cover: every finding downgraded, escalated, or dropped from the
table; the in-flight orphan, `ref` drift, superseded and unpromised rows each
promoted to a fault (the four cry-wolf regressions); the severity order
reversed; both class VALUES renamed to something the reader never learned;
`errors[]` filled on an ok run and emptied on a fault; `warnings[]` carrying
the errors; `deep_verify` forced true; `_count` stuck at 0 and at 1; the
grace window at 0 and at a week; `st_ctime` swapped for `st_mtime`; the two
buckets swapped; the age subtraction inverted; `clean` narrowed; and, on the
reader's side, `integrity-error` removed from the fault set, thresholded at
3, and declared benign.

⚠️ **One survivor, fixed rather than argued away:** the crash record filling
`warnings[]` as well as `errors[]`. It is behaviourally harmless today —
`failed` suppresses `partially-blind`, so no notification changes — and that
is precisely what made it the kind of drift nothing would catch. The
invariant was stated in the module docstring and enforced nowhere; it is
pinned now.
