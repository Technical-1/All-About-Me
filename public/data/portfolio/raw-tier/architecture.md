# raw-tier — architecture

State: `building` — the library is built; its suite is the frozen Source
contract [PE-9]. See `CLAUDE.md`.

## Package layout

```
raw_tier/
  __init__.py   re-exports RawStore, WriteResult
  schema.py     SCHEMA — the raw_objects / raw_subjects DDL
  store.py      RawStore: write_raw, write_ref, get_current, versions,
                add_subjects, subjects_for, iter_current
  fsck.py       fsck(store) -> FsckReport
  cli.py        console entry point: raw-fsck [ROOT]
```

Everything hangs off one class, `RawStore`, opened against a root directory
that holds both the payload tree and the manifest database
(`<root>/manifest.db`, SQLite, WAL mode).

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
for multi-account providers per PF-53), `storage` (`copy` | `ref`), `bytes`,
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
content versions are retained, not pruned.

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

`fsck(store)` walks the manifest and the filesystem tree and cross-checks
both directions, returning an `FsckReport` namedtuple:

```
checked_rows checked_files orphan_files missing_payloads dangling_subjects unreadable
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

`FsckReport.clean` is `True` only when all four violation collections
*and* `unreadable` are empty — an unreadable directory makes the report
not-clean even with zero orphans/missing/dangling, because coverage that
can't be confirmed isn't coverage.

fsck is presence-only today (file exists at `path`), not a re-hash against
`sha256` — that's noted in the plan as a future "deep fsck," out of scope
here.

## CLI

`raw_tier/cli.py` is a thin wrapper: `raw-fsck [ROOT]` (default `$RAW_ROOT`
else `/data/fast/state/raw`) opens a `RawStore` at that root, runs `fsck`,
prints the coverage line —

```
Checked {rows} rows / {files} files — {n} orphans, {m} missing payloads,
{k} dangling subjects, {j} unreadable dirs
```

— followed by one detail line per violation (`ORPHAN`, `MISSING`,
`DANGLING`, `UNREADABLE`), and exits 0 when clean, 1 otherwise. Opening a
`RawStore` against a nonexistent root creates it (`root.mkdir(parents=True,
exist_ok=True)`), so running against an empty/new root is a legitimate,
zero-violation clean run rather than an error.

## No delete API

There is deliberately no delete/erase entrypoint in this package (spec §3):
erasure is a Source-side or program-level concern, not something the
shared manifest exposes. Raw-tier's whole contract is "nothing here
deletes."
