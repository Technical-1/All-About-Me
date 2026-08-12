# raw-tier — architecture

State: `building` — the library is built; its suite is the frozen Source
contract [PE-9]. See `CLAUDE.md`.

## Package layout

```
raw_tier/
  __init__.py   re-exports RawStore, WriteResult, SealBroken, FsckReport,
                HashMismatch
  schema.py     SCHEMA — the raw_objects / raw_subjects DDL
  store.py      RawStore: write_raw, write_ref, write_sealed, get_current,
                versions, add_subjects, subjects_for, iter_current;
                SealBroken
  fsck.py       fsck(store, *, verify=False, orphan_grace_seconds=…,
                now=None) -> FsckReport
  runrecord.py  ⭐ the deep verify's last-run.json: the exit_class mapping
                and an atomic writer. Read by `source-alerter`
  cli.py        console entry point:
                raw-fsck [ROOT] [--verify] [--run-record PATH]
```

Everything hangs off one class, `RawStore`, opened against a root directory
that holds the payload tree and the manifest database (`<root>/manifest.db`,
SQLite, WAL mode). ⭐ A **third component** — relational **mirrors** — was
decided 2026-08-12 and is **not built**: it is peer to those two, it is not a
payload, and no code in this package touches it yet. See
[`mirror` — the third component](#mirror--the-third-component-of-the-raw-tier).

## The manifest — `raw_objects` / `raw_subjects`

`raw_objects` is the shared table every Source writes through — one shared
manifest is what makes "raw before deriving" testable instead of aspirational
(spec §2.1). Its primary key is **`(source, doc_id, sha256)`** — the RT-17
key. That triple, not a synthetic id, is what "one row per distinct content
version of a document" means in this store: the same `(source, doc_id)` can
have many rows (one per content version ever seen), but the same content
seen twice collapses to one row whose `last_seen` moves forward instead of
duplicating.

Single writer per source is the operative assumption: concurrent writers of
the SAME source may see `IntegrityError` on a racing insert (harmless — one
row wins, payloads are identical by sha); different sources never collide
(the PK leads with source).

Columns: `path` (relative to the raw root; carries the `<account>` segment
for multi-account providers per PF-53), `storage`
(`copy` | `ref` | `sealed`), `bytes`,
`fetched_at` (when *this content* first appeared), `last_seen` (when the
origin last confirmed it — RT-15). `doc_id` is origin-assigned, never
locally minted (RT-11): raw-tier does not invent identity, it records the
identity the Source already has.

`raw_subjects` (`source, doc_id, identifier`) is a separate append-only
table linking documents to subject identifiers, populated idempotently by
`add_subjects` (engines' normalize stage, RT-10) and queried by
`subjects_for`.

## Payload-then-row

`write_raw` and `write_ref` both honor the same commit-point rule (§4.1):
the payload must be durable on disk **before** the manifest row is
inserted, never the other way round. Concretely:

- `write_raw`: write bytes to `<path>.part`, `os.replace()` it onto the
  final path (atomic on the same filesystem), *then* `INSERT` the row and
  commit the transaction.
- `write_ref`: verify the referenced file exists (`is_file()`) and hash it
  *before* inserting the row — a reference to nothing never gets recorded.

This ordering is what makes `fsck` meaningful: a crash between the two
steps leaves an orphan file (payload with no row) or nothing at all, never
a row pointing at a payload that isn't there. A missing payload with a row
is the one state payload-then-row is designed to make unreachable except by
row insertion racing something else — and that's exactly what `fsck`'s
`missing_payloads` list would catch if it ever did happen.

Both write paths also implement dedupe (RT-15/RT-17): if the same
`(source, doc_id, sha256)` already has a row, the write is a `last_seen`
bump (`WriteResult("dedupe", sha, None)`, no filesystem write, no new row).
A `(source, doc_id)` seeing new content inserts a new row (`"new_version"`
if a prior row for that `doc_id` exists, `"new"` otherwise) — never
overwrites or deletes the old one. Raw is a forever archive (RT-11): old
content versions are retained, not pruned. ⚠️ That is the guarantee for **rows
in this manifest**; a **state** mirror narrows it at row grain (below), and
nothing else does.

## `sealed` — the third storage mode

Added 2026-08-11 as an **amendment** to the frozen contract (ai-lab
`specs/2026-08-11-sealed-storage.md`), not a fix. Three shapes of raw
**payload** arrive, and until this amendment only two modes existed for them:

| Shape | Example | Mode |
|---|---|---|
| bytes already in hand | an email, a transaction | `copy` |
| a file on disk, **mutable at a stable path** | `imessage/chat.db` | `ref` |
| a file on disk, **immutable at a unique path** | 19,712 iMessage attachments (measured 2026-08-12), Drive revisions | `sealed` |

⭐ A **fourth** shape was identified 2026-08-12 and is not a payload at all: a
live **container**, whose archival unit is the **row**, not the file. `ref`
below is what `chat.db` is registered as today, and the measurement that mode
produced is what the mirror section reports.

`write_ref` calls `read_bytes()` on every poll, because re-hashing is the
only way to notice that a mutable file changed. For the third shape that
re-reads **52.9 GB every hour to recompute a constant** (measured on the
tower, 2026-08-11), and five of six Sources produce that shape.

⚠️ The live `notes` rows are **`copy`**, not `ref`: raw-tier wrote those
payloads itself, so there is nothing to re-read and nothing external to
promise. An earlier version of this table called them "Notes media" and
listed them as `sealed`'s to claim; `write_sealed` now refuses them.

`write_sealed(source, doc_id, ref_path, *, now=None)` hashes on first
sight — byte for byte identical to `write_ref` — and **stats** on every
call after that: same size plus an existing sealed row means `"dedupe"`
and a `last_seen` bump, with no read at all.

**The cost is not the main argument; correctness is.** Under `ref`, an
"immutable" blob that *did* change is recorded as a perfectly plausible
`new_version`, because nothing ever declared that it could not change.
Declaring immutability is what makes its violation detectable. A sealed
referent whose size changed raises **`SealBroken`** instead — no row is
written, and `last_seen` is deliberately *not* bumped, since `last_seen`
means "the origin last confirmed *these bytes*" (RT-15) and a changed
referent confirms nothing. The stalled timestamp is itself part of the
signal.

It raises rather than returning an action because a caller may
legitimately discard a `WriteResult` (this repo's own tests do), so a
returned finding is one that can be ignored by accident. It deliberately
does **not** subclass `ValueError` or `OSError`, so an existing
`except OSError` around registration cannot swallow it.

### Adoption — what first sight does with the row already there

⛔ **The amendment shipped a `write_sealed` that was a no-op against the only
manifest it was written for**, found 2026-08-12. The lookup below filters
`storage='sealed'`; every row the mode exists for is still `ref`, so it
missed, fell through to the full read, and `_bump_if_known` — which matches on
`(source, doc_id, sha256)` with no storage and no path filter — bumped the
`ref` row and returned `"dedupe"`. No `sealed` row was ever written, so the
next poll did the same. ⚠️ **Every observable was identical to the working
fast path**: no exception, no differing action, nothing in `raw-fsck`.

The primary key is `(source, doc_id, sha256)`, so a `sealed` row **cannot** be
inserted beside a `ref` row of identical content — the key collides. First
sight therefore **adopts**: `UPDATE ... SET storage='sealed'`, `last_seen`
bumped, `fetched_at` untouched (it is when *these bytes* first appeared, and
adoption changes what is promised about them, not when they arrived). The
action returned is **`"adopted"`**, its own string, because the defect's whole
cost was that a caller logging actions could not see it.

It is the bulk migration's own `UPDATE`, applied lazily — one row per first
poll — and it is **refused, before any read**, where the manifest contradicts
the promise (`SealRefused`):

| what the manifest already holds | what happens |
|---|---|
| nothing | hash, insert — `"new"` / `"new_version"` |
| one `ref` row at this path, same bytes | **adopt** — `"adopted"` |
| one `ref` row at this path, other bytes | hash, insert — `"new_version"` |
| **more than one content version at this path** | ⛔ `SealRefused` — mutable by evidence (`chat.db`) |
| a **`copy`** row at this path | ⛔ `SealRefused` — raw-tier wrote those bytes |
| this document's bytes at a *different* path | `"dedupe"`, as before (fsck reports the unregistered path as an orphan) |

**What identifies "an existing row"** is `(source, doc_id, path,
storage='sealed')` — the sha256 that `write_ref` keys on is exactly what is
no longer computed, so the key becomes the referent's identity instead.
Each component is load-bearing and separately pinned by tests: `source` and
`doc_id` because two documents may legitimately share one path; `path`
because the promise is about the bytes at *that* path; `storage` because
only a row that made the promise can break it — a `ref` row is still
allowed to change, and that is `chat.db`. Where a document has several
sealed rows at one path (reachable only through the migration of an old
stable-path document), the seal is measured against the newest.

First sight still passes through the sha dedupe, so identical bytes at a
second path bump rather than colliding with the `(source, doc_id, sha256)`
primary key. `bytes` records `len(payload)` — the length of what was
actually hashed — so `bytes` and `sha256` always describe the same read.

⚠️ `stat` cannot see a byte flipped in place. That is the price of not
reading 52.9 GB an hour, and `raw-fsck --verify` weekly is the answer, not
a read here. The blind spot is pinned by a test so it stays a stated
limitation rather than an assumed one.

## `mirror` — the third component of the raw tier

⭐ **Decided 2026-08-12**, ai-lab `specs/2026-08-12-relational-mirror.md` —
the authority; this is the summary, not a restatement. ⛔ **Spec written, NOT
BUILT.** Nothing described here exists in this package: no mirror code, no
mirror schema, and `storage`'s CHECK still admits exactly `copy` | `ref` |
`sealed`. It is documented here because it adds a **third component** to the
raw tier and amends what the raw tier promises, and both bind anything written
against this library.

The raw tier has held two things: the payload tree and `manifest.db`. The
third is **relational mirrors** — one mirror database per container source,
peer to those two.

### What measurement found — 2026-08-12, live

| container | mode today | what that mode actually achieves |
|---|---|---|
| `imessage/chat.db` | `ref` | ⛔ **not archived — overwritten hourly.** The manifest claims **4,633,550,848 bytes** across six versions; **one 773,386,240-byte file exists.** ⭐ **3,860,164,608 recorded bytes are not on disk** |
| `addressbook` | `copy` | ⛔ **172 GB/yr.** Across six hours only `ACHANGE` (+10) and `ATRANSACTION` (+5) changed; the other **32 tables were identical** — ⭐ **~13,000× write amplification** |

Both modes are doing exactly what they specify. What is wrong is the **unit**:

> ⭐⭐ **`sha256` asks "are these bytes identical?" — the right question for a
> payload, the **wrong** one for a container.** A live SQLite file rewrites its
> own bytes as a side effect of being read. Nothing about the answer is untrue;
> it is an answer to a question the data cannot be asked.

### The decision — one mechanism, two policies

| | ⭐ **EVENT** | ⭐ **STATE** |
|---|---|---|
| sources | `imessage` | `addressbook` · `notes` · `reminders` · `calendar` |
| means | ⭐ **it happened** | ⭐ **it is true now** |
| the mirror keeps | ⭐ **every row, forever** | ⭐ **the latest version + a tombstone on delete** |
| size | 740 MB + **250 MB/yr** | ⭐ **~3,346 rows, near-fixed** |

⭐ **One mechanism with a per-source policy flag, not two systems.** A state
mirror exists for one reason that nothing else can supply: **you cannot detect
deletion from a snapshot of current state** — absence is indistinguishable from
never-existed unless something remembers seeing it, and a tombstone is the only
thing that can say which.

### ⭐ The mirror is not a payload — the load-bearing point here

A mirror registered as a *payload* is a file that changes hourly, so it needs
`ref`, so it ⛔ **re-hashes 740 MB every hour** — the exact problem above,
rebuilt one level up. The container itself becomes **transport**: it lands in
staging, is mirrored, and is overwritten next run. ⛔ **It never becomes a raw
object.**

⭐⭐ **The mirror is its own manifest, at row grain:**

| the mirror records | `raw_objects` records |
|---|---|
| `(table, pk, row_sha, first_seen, last_seen)` | `(source, doc_id, sha256, fetched_at, last_seen)` |

⭐ **The same semantics and the same guarantees, one grain down.** Dedupe keys
on `(table, pk, row_sha)` — the direct analogue of the RT-17 key — and ⛔
**never on `pk` alone**, which would collapse every version of a row into one.

### Four shapes, and which unit each archives

| mode | the archival unit | example | status |
|---|---|---|---|
| `copy` | **the payload** | a transaction | built |
| `ref` | **a mutable file at a stable path** | `chat.db` today | built |
| `sealed` | ⭐ **an immutable file** | 19,712 attachments | built |
| ⭐ **`mirror`** | ⭐⭐ **the ROW** | `chat.db`, `AddressBook` | ⛔ **decided, not built** |

⚠️ Whether the manifest names a mirror with a `storage='mirror'` value, and
what a mirror's manifest row says so `raw-fsck` can report its coverage, is
**open** (spec §9). Today no such value exists and none is accepted.

### ⭐ `sealed` and `mirror` are one insight on two shapes

Both say: **identify the true unit of archive, and stop treating the wrapper as
the unit.** The failure both close is **a container hiding many items behind
one hash** — 515,290 messages behind one `sha256` means one changed message
invalidates all of them.

⚠️ **The mirror does not supersede `sealed`, and does not touch it.** They
cover different shapes. An attachment is one file, one row, one immutable blob
and **no container** — already at the right grain. Everything this document
says about `sealed`, the 19,712 attachment rows, adoption, `SealBroken`,
`SealRefused` and `seal_conflicts` stands unchanged.

### ⚠️ What this amends about what raw promises

⭐ **For an EVENT container:** raw holds **every row the origin ever showed
us** — not every byte the container ever had.
⭐ **For a STATE container:** raw holds **what is true now, plus a tombstone
for what was deleted** — ⛔ **not the intermediate versions of a state
entity.**

⚠️⚠️ **The amendment, stated plainly:** *"the substrate is rebuildable from
raw"* ⭐ **holds fully for events.** For **state**, raw rebuilds the
**current** claims; the **temporal history** of a state entity lives in the
claim store and is **accumulated, not rebuildable.** ⛔ **The unqualified form
must not be asserted anywhere in this repo.**

⭐ This narrows RT-11 for one component only. The payload tree and the manifest
keep "never mutated, never pruned" unqualified, event mirrors keep it too, and
there is still no delete API (below): a tombstone **records** that the origin
deleted something — it does not erase anything raw holds.

## Reads

- `get_current(source, doc_id)`: the one row an engine should treat as "the
  current version" — most recent `fetched_at`, tie-broken by `last_seen`
  DESC. `versions(source, doc_id)` returns the full history, oldest first.
- `iter_current(source=None)`: what engines actually read (§4.4) — the
  current version of *every* document, computed with a window function
  (`ROW_NUMBER() OVER (PARTITION BY source, doc_id ORDER BY fetched_at DESC,
  last_seen DESC, rowid DESC)`), so each document appears exactly once even
  when `fetched_at` and `last_seen` are both tied (the `rowid DESC`
  tie-break makes the ordering deterministic instead of falling back on
  SQLite's unspecified tie behavior).

## fsck — both ways, with coverage [RT-6]

`fsck(store, *, verify=False)` walks the manifest and the filesystem tree
and cross-checks both directions, returning an `FsckReport` namedtuple:

```
checked_rows checked_files orphan_files missing_payloads dangling_subjects
unreadable verified_payloads hash_mismatches
deep_verify manifest_paths verified_rows superseded_rows unpromised_rows
ref_drifted seal_conflicts
```

- **orphan_files**: files on disk with no manifest row (manifest.db and its
  WAL/SHM sidecars are excluded from the walk).
- **missing_payloads**: manifest rows whose `path` does not resolve to a
  file on disk, deduped by path.
- **dangling_subjects**: `raw_subjects` rows whose `(source, doc_id)` has no
  matching `raw_objects` row.
- **unreadable**: directories the walk could not enter (`os.walk(...,
  onerror=...)` catching `PermissionError`, path recorded relative to the
  root). This field was added after the rest of the report shape was fixed
  — a directory the walk can't see into is exactly the kind of blind spot
  RT-6 ("report coverage, not just violations") exists to surface, since an
  unreadable directory could be silently hiding orphans or missing payloads
  that would never appear in either list.

- **verified_payloads / hash_mismatches**: the deep verify, below. Empty by
  default because nothing was checked, not because everything was fine.
- **deep_verify**: whether the deep half ran at all. Every count below it
  reads `0` when nothing was hashed *and* when everything was clean; this
  flag is the only thing that tells those two apart, and the CLI prints
  `ON`/`OFF` from it rather than from `argv`.
- **manifest_paths**: distinct paths the manifest names — the denominator
  `verified_payloads` is the numerator of. Fewer paths than rows is normal:
  a `ref` path carries one row per content version.
- **verified_rows / superseded_rows / unpromised_rows / ref_drifted**: the
  version-aware half of the deep verify, below.
- **seal_conflicts**: paths whose `sealed` rows promise different sha256 —
  read from the manifest, so it is populated by the cheap walk too.

`FsckReport.clean` is `True` only when all violation collections *and*
`unreadable` are empty — an unreadable directory makes the report not-clean
even with zero orphans/missing/dangling, because coverage that can't be
confirmed isn't coverage. `seal_conflicts` counts against it too;
`ref_drifted` deliberately does not.

### The deep verify — `verify=True`, weekly

The default walk is presence-only (does a file exist at `path`), and stays
that way: it is what runs hourly, and it costs **0.9 s over the tower's
20,891 rows and 51 GB** (54,741,443,413 bytes, measured 2026-08-12; it grows
every hour both Sources run). ⚠️ That byte figure is the manifest's own sum
over **recorded content versions**, which is not the same as bytes on disk —
`imessage` alone accounts for 3,860,164,608 bytes that no longer exist (see
the mirror section).

`fsck(store, verify=True)` additionally **hashes each distinct path exactly
once** and asks what promised those bytes [SS-1]. It streams with
`hashlib.file_digest` rather than reading whole files, since a sealed
attachment may be a video. It **reports and never repairs**: a verify that
"fixed" the sha would erase the only evidence anything went wrong.

| mode | promised | compared |
|---|---|---|
| `copy` | raw-tier wrote the bytes; `write_raw` refuses to reuse a path for different bytes [C1] | **per row**, exact sha |
| `sealed` | the Source promised immutability, which is what makes a violation detectable | **per row**, exact sha |
| `ref` | **nothing** — `ref` exists FOR files that are mutable at a stable path | **per path**, against every version recorded for it |

A `ref` path that matches one of its versions is verified and the rest are
**`superseded_rows`** — their bytes are gone by design, since a version is a
row, not a copy. A `ref` path that matches none is a **`RefDrifted`**, a
class of its own: `chat.db` is re-shipped from the Mac on its own schedule,
so between an rsync and the next registration it legitimately matches
nothing on record. Drift is printed, by name, on every run, and deliberately
does **not** make the report unclean — a check that fails on healthy data is
one its reader learns to ignore. It is also stateless: drift that *persists*
across consecutive runs is the suspicious signal, and only the scheduler can
see that.

`unpromised_rows` is the honest gap this leaves: every `ref` row, matched or
not, is a row whose changed bytes cannot be told from the origin doing
exactly what `ref` exists for. It reads **19,717 as of 2026-08-12** — the
19,712 attachments plus `chat.db`'s 5 versions — and drops to **5** once Task
4 migrates the attachments, and only the attachments.

⚠️ **The first cut of this compared `ref` and `sealed` ROW BY ROW** and was
wrong in production the day it ran, invisibly to 178 green tests: the live
manifest holds 5 `imessage` rows at 1 path, so 4 of them named bytes that no
longer exist and reported as mismatches on **every healthy run**, growing
~20/day, while the same 772 MB was hashed once per row (5.6 TB/year). Both
halves of that — the false finding and the O(rows) read — came from the same
assumption: that a path holds one row. `copy` was excluded on the theory
that raw-tier wrote those bytes; ext4 does not checksum them for raw-tier
either.

### `seal_conflicts` — a promise the manifest contradicts

`sealed` rows at one path that record **different sha256** cannot all be
true: `sealed` says the bytes at that path never change, so at most one of
them can ever verify and the rest are a permanent `hash_mismatch` on every
healthy run. ⚠️ That is exactly what an **unscoped**
`UPDATE raw_objects SET storage='sealed'` makes of `chat.db`'s five rows —
[SS-1] arriving from the other side, and this time no scope fix could clear
it. **Task 4 must be scoped to `source='imessage-attachments'`.**

It is computed from the manifest, so the **cheap hourly walk** reports it and
a bad migration is caught within the hour rather than at the next weekly deep
verify — and it **does** make the report unclean: unlike drift it cannot come
right on its own, and unlike a mismatch it says the *manifest* is wrong rather
than the disk. Two documents sealing one path with the *same* sha256 is not a
conflict: that is two names for one blob, which `write_sealed`'s key exists
for.

`hash_mismatches`, `ref_drifted`, `seal_conflicts`, `missing_payloads` and
`unreadable` are five distinct finding kinds on purpose: corruption,
expected change, a contradiction between rows, absence and could-not-check
must not collapse into one.

`verify` is **keyword-only** so `fsck(store, True)` cannot silently put 48
GB of reads back on the hourly run, and the CLI prints its verify line on
*every* run, including the cheap one:

```
Deep verify: OFF — 0 payloads re-hashed, 0 mismatches
```

— because "0 mismatches" with no statement of whether anything was hashed
reads exactly like a clean deep check. When the deep verify *did* run, four
further lines state coverage and health separately (paths hashed of paths
named, rows verified and superseded, rows carrying no promise, paths
drifted); when it did not, those lines are **absent rather than zero**, for
the same reason.

⚠️ Why it has to exist at all: **ext4 does not checksum file data**, only
metadata, so a rotted byte is returned without complaint and the manifest's
`sha256` is the only thing that would ever notice. Once `sealed` stops
re-reading hourly, this is the only thing that reads at all. The check has
an expiry — ZFS checksums and scrubs continuously, so if the raw tier ever
lives on a ZFS pool the filesystem does this job.

## CLI

`raw_tier/cli.py` is a thin wrapper: `raw-fsck [ROOT] [--verify]` (default
root `$RAW_ROOT` else `/data/fast/state/raw`) opens a `RawStore` at that
root, runs `fsck`, prints the coverage line —

```
Checked {rows} rows / {files} files — {n} orphans, {m} missing payloads,
{k} dangling subjects, {j} unreadable dirs, {s} seal conflicts
Deep verify: {ON|OFF} — {v} payloads re-hashed, {h} mismatches
  coverage: {v} of {p} manifest paths hashed, each exactly once      | only
  rows: {a} verified, {b} superseded (…)                             | when
  not covered: {c} rows carry no immutability promise (…)            |  ON
  ref drift: {d} paths match no recorded version (…)                 |
```

— followed by one detail line per violation (`ORPHAN`, `MISSING`,
`DANGLING`, `UNREADABLE`, `MISMATCH`, `SEAL-CONFLICT`) and one per
`REF-DRIFT` (which is not a violation and does not affect the exit code),
and exits 0 when clean, 1 otherwise. ⭐ The seal-conflict **count** is on the
first line, so the cheap hourly run states it as a number every time — it is
read from the manifest, not from the disk.
`--verify` is the weekly deep check; the hourly timer runs without it. Opening a
`RawStore` against a nonexistent root creates it (`root.mkdir(parents=True,
exist_ok=True)`), so running against an empty/new root is a legitimate,
zero-violation clean run rather than an error. ⚠️ **Only without
`--run-record`** — see below.

## ⭐⭐ `--run-record PATH` — the only channel a finding can travel down

`source_alerter.detect._scan` iterates its registry and reads each entry's
`state/<name>/last-run.json` for an `exit_class`. ⚠️ **It never reads a
systemd exit code**, by design: [MD-153] has Sources exit 0 for origin
failures, so run records are the only channel that exists. `raw-fsck` wrote
none — so `raw-fsck-verify.service`'s `OnSuccess=`/`OnFailure=` triggered the
alerter and handed it nothing, and a `hash_mismatch` was a log line nobody
was watching.

⛔ **The flag is opt-in and nothing changes without it.** Two Sources' venvs
run the cheap walk hourly; the CLI's output and exit code were compared
byte-for-byte against a `main` worktree, with and without `--verify`.

**The mapping — `raw_tier/runrecord.FINDINGS`, one table, severity-ordered:**

| finding | class | why |
|---|---|---|
| `hash_mismatches` | `integrity-error` | bytes changed under a promise. **The alarm** |
| `seal_conflicts` | `integrity-error` | one sealed path, two contents — already broken |
| `missing_payloads` | `integrity-error` | the manifest indexes something absent |
| `dangling_subjects` | `integrity-error` | the same, one table over |
| aged `orphan_files` | `local-error` | a payload landed and never earned a row |
| `unreadable` | `local-error` | a coverage gap on this machine, never corruption |
| in-flight `orphan_files` | — | the registrar is hourly; this is a healthy machine |
| `ref_drifted` | — | `ref` promised nothing; drift is what it is FOR |
| `superseded_rows` · `unpromised_rows` | — | coverage figures, not findings |

⭐⭐ **Two classes, because the store re-alerts on a class CHANGE.** An open
fault is keyed `source/condition`; with one class for both halves, an
unregistered payload opening the fault in week 1 would make a hash mismatch
in week 2 produce no transition at all. The escalation has to BE a class
change. ⚠️ `integrity-error` was added to `source-alerter`'s vocabulary first
[NT-6] — a class the watcher has not learned is reported as `unknown-class`,
whose message is *"update the watcher, the Source is probably fine"*.

**The orphan window.** `fsck` now partitions `orphan_files` into
`orphan_files_in_flight` and `orphan_files_aged` at
`DEFAULT_ORPHAN_GRACE_SECONDS` (6 h), judged on **`st_ctime`**.

- ⛔⛔ **Not `st_mtime`.** `mac_agents.ship.rsync_argv` passes `-a`, hence
  `-t`: rsync preserves the ORIGIN's mtime, which on a Mac attachment is
  routinely years old. Age by mtime would mark every fresh shipment long
  overdue — the cry-wolf failure the window exists to prevent, reintroduced
  by the field used to implement it. `st_ctime` cannot be set by the origin;
  the `utimes()` rsync uses to restore the mtime moves it to now.
- ⭐ Six hours covers a missed registrar hour, a `Persistent=true` catch-up
  and a backfill-length registrar run, and is 1/28th of the weekly interval —
  so an orphan that survives to the next run is 168 h old and **is** a fault.
  Evidence, not suppression: suppressing orphans outright would hide a
  genuinely unregistered payload forever.
- ⚠️ **`clean` is untouched**, so the exit code still counts every orphan.
  The record and the exit code answer different questions and are allowed to
  disagree.

**Three refusals, all gated on the flag:**

- a `--run-record` path **inside the raw root** → exit 2. The walk skips only
  `manifest.db*`, so the record would be an orphan of the check that wrote
  it, aging into a weekly `local-error` about itself;
- an **absent root** → a `local-error` record, exit 1, and ⛔ nothing created.
  Otherwise an unmounted `/data/fast/state` would have the check invent a
  tier under the mountpoint, verify the empty tree it just made, and report
  perfect health — into a record somebody now trusts;
- a **crash** → a `local-error` record carrying the exception TYPE only (an
  OSError's message is the path that raised it), then **re-raised** so the
  traceback still reaches the journal.

**The record carries counts, never paths.** Alerts carry a source name and a
fault class only; the record is one `cat` from that. Paths stay on stdout,
i.e. in the journal. And `warnings[]`/`errors[]` are an alerting channel —
either one non-empty on an `ok` run fires `partially-blind` at threshold 1 —
so `errors[]` is non-empty **iff** the class is a fault, and `warnings[]` is
always empty.

## No delete API

There is deliberately no delete/erase entrypoint in this package (spec §3):
erasure is a Source-side or program-level concern, not something the
shared manifest exposes. Raw-tier's whole contract is "nothing here
deletes."

## Migrating a live manifest — `scripts/migrate_sealed.py`

The `sealed` amendment widened `CHECK (storage IN ('copy','ref'))` by one
value. SQLite cannot `ALTER` a CHECK, so an existing manifest needs a table
rebuild — create, copy, drop, rename, re-index — and on the tower that
happens to a ~14 MB file that is the only index to 51 GB of payloads.

The script is stdlib-only and imports nothing from `raw_tier`: the DDL for
the rebuilt table is **derived from the live database's own `sqlite_master`
text**, with exactly two edits (the CHECK clause and the table name), so
column order, types, the primary key and even the comments cannot drift from
the table being replaced. Six things make it safe to attempt:

1. **The writer guard.** `systemctl is-active` for both timers *and* both
   `Type=oneshot` services — a stopped timer does not stop the run already in
   flight, and a `oneshot` mid-run reports `activating`, not `active`.
   `LoadState` is read separately because `is-active` prints `inactive` for a
   unit that does not exist, which otherwise reads exactly like a stopped
   timer. A `BEGIN IMMEDIATE` probe catches the writer systemd does not know
   about. ⭐ The `--i-stopped-the-timers` flag is an acknowledgement, never a
   bypass; there is no command-line flag that skips the check.
2. **`VACUUM INTO` a timestamped backup** before the first write — atomic and
   consistent, which `cp` on a live SQLite file is not, and refused if the
   target exists.
3. **One transaction.** SQLite's DDL is transactional, so a failure at any of
   create/copy/drop/rename/re-index leaves the file byte-identical. Proved by
   fault injection at each step, not argued.
4. **Per-row identity, not aggregates — twice.** Equal counts and equal
   byte totals are both satisfied by a copy that swapped two rows' paths. The
   comparison is a grouped `EXCEPT` in both directions on every column, and
   separately on `(source, doc_id, path)` — the key `write_sealed` uses, so
   rewriting it would force a re-hash of all 19,712 attachments — and on
   `(source, doc_id, fetched_at)`, which is when the bytes were *first* seen.
   It runs **inside the transaction**, against the table being copied from,
   which is what makes a bad copy impossible to commit; and **after the
   commit** against the backup, ATTACHed as a second database, which is what
   makes the file that landed provably the same rows. The run prints how many
   rows the second pass covered — *no problems* and *did not look* read
   identically otherwise. (Runs made before 2026-08-12 had the
   in-transaction half only; they were verified, not unverified.)
5. **Read the schema back.** The committed DDL is re-read from
   `sqlite_master`, the index SQL is compared against the text captured
   before, and a `sealed` probe row is inserted and rolled back: the DDL
   saying `sealed` and the engine accepting it are two different claims.
6. **Restore, read back.** If anything after the commit disagrees, the
   backup goes back — including removing the `-wal`/`-shm` sidecars, since a
   stale WAL is replayed into whatever file it sits beside. This is the only
   code here that overwrites the live manifest outside a transaction, so it
   is the last place to treat a returning `copy2` as evidence: the restored
   file is re-opened, `integrity_check`ed and recounted against the backup's
   own count, and a disagreement is `RestoreUnverified` — exit 5, *do not
   start the timers*, not a printed `Restored.`

Exit codes separate the outcomes a human needs to tell apart: `1` refused
(nothing written), `3` rolled back (nothing changed), `4` restored from the
backup, `5` the restore itself failed. `RUNBOOK.md` gives the sequence with
the expected output at each step.

⭐ It changes the **schema only**. Turning `ref` rows into `sealed` rows is a
separate migration, and the report's `rows now sealed: 0` is the assertion
that this one did not.
