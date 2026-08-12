# mac-agents — architecture

**State: `building`.** Tasks 1–4 are merged to `main` and the Source is **live
on the tower since 2026-08-11**. The owning plan is
`ai-lab docs/superpowers/plans/2026-08-10-mac-agents.md`.

⚠️ **Two amendments are DECIDED and NOT BUILT**, and both change what raw holds
for this Source: `sealed` storage for immutable blobs [MA-45], and the
**relational mirror** — §9 below, which is the authoritative summary in this
repo. ⛔ Nothing in §9 describes running code.

## The layer, in one line

A **Source**: it gets the Mac's OS-gated data onto the tower and computes
nothing else. No normalization, no model call, no manifest write. The Mac
ships files; the tower writes rows [MA-1].

## Two halves, split where the OS draws the line

| | Mac half | Tower half |
|---|---|---|
| runs as | one launchd agent, hourly while awake | one systemd timer, `Persistent=true` |
| produces | bytes on disk, shipped by `rsync` over the tailnet | `raw_objects` rows via `write_ref`/`write_raw` |
| never does | open `manifest.db`, decide dedupe | touch the Mac, hold a TCC grant |

The split is forced, not chosen: `raw_tier.RawStore` opens a SQLite file that
exists only on the tower.

## The modules

| file | owns |
|---|---|
| `stores.py` | **where** things are — the only file in the repo allowed to contain an Apple path, enforced by a test that scans every other one |
| `collect.py` | **what to do with them** — `sqlite3.Connection.backup()` per store, and the directory walks |
| `heartbeat.py` | **saying what happened**, every run, per collector |
| `runlock.py` | one run at a time; a refused run is benign |
| `ship.py` | `rsync` over the tailnet, and where each thing lands |
| `install.py` | ⭐ **is the agent installed, and does it still hold the grant?** — the only failure in this repo that is silent by construction |
| `cli.py` | `mac-agents collect` · `discover` · `check` |
| `launcher/` | the C stub + `Info.plist` of `MacAgentsCollector.app`, the launchd target |
| `scripts/build-launcher.sh` | compiles, signs with the Developer ID, and **refuses to sign ad-hoc** |
| `launchd/…collect.plist` | one agent, `RunAtLoad` + `StartInterval=3600` |

## Six origins, three collection shapes

| origin | shape | storage mode (tower) |
|---|---|---|
| `imessage` | one 770 MB WAL database | ⛔ `write_ref`, stable path — **mutable, and re-hashing it is the point** |
| `imessage-attachments` | 19,687 files, 50.5 GB, immutable | ⭐ **`write_sealed` per file** [MA-45] — hash on first sight, `stat` thereafter |
| `addressbook` | **2** stores — a 475 KB decoy and the real 20 MB shard | `write_raw`, dated paths |
| `calendar` | one database | `write_raw` |
| `reminders` | **4** sharded stores, its own origin | `write_raw` |
| `notes` | a database **plus** a 201 MB media tree | `write_raw` for both — ⛔ the media are `copy`, **never sealed** [SS-2] |

⚠️ **The `storage mode` column describes today and is superseded by §9.** The
five *containers* stop becoming raw objects at all; ⭐ the two file trees —
attachments and Notes media — are **unaffected**.

### ⭐⭐ `sealed` [MA-45] — one decision, two halves, neither sufficient alone

- **on the tower** — `write_sealed` replaces `write_ref` for the attachment
  tree. `write_ref` re-read all 50.5 GB every poll to recompute a sha it then
  discarded as a `dedupe`: **52.9 GB an hour, 1.27 TB a day**, to confirm that
  files the origin promises never change had not changed. ⭐ A size change is a
  raised **finding** (`SealBroken`), never a `new_version` — a second row would
  launder corruption into a plausible update, and by the time anyone notices,
  the original bytes are already gone.
- **on the Mac** — `rsync --ignore-existing`, on that tree **only**. Reading
  less is only safe because replacing is now impossible: rsync's default
  quick-check is size+mtime, so an attachment changed at the origin would
  otherwise be re-sent **over the only copy the archive holds**.

⛔ **Neither half touches `chat.db`.** It is mutable at a stable path;
`--ignore-existing` would freeze the message archive at its first snapshot, and
`write_sealed` refuses it anyway (five recorded content versions at one path).

⚠️ **The flag's measured cost, 2026-08-12:** the partial-dir fragment stops
being used as a resume basis, so an interrupted file restarts — 8,389,783 B
re-sent against 5,284,767 B without it. ⭐ Accepted, because [MA-21]'s
requirement is about the **tree** (*"an interruption at 30 GB must not restart
from zero"*): every completed file is skipped outright, and what restarts is
the single file that was in flight.

⭐ **The saving is proved by COUNTING READS, never by timing** — a day of
hourly runs over sealed attachments performs zero payload reads while
`last_seen` still advances. *"Read nothing"* and *"did nothing"* are the two
facts this Source refuses to let collapse.

## The decisions that shape the code

**1. `.backup`, never `cp`.** Every store is WAL-mode with a live writer.
`chat.db` carries a 1.2 MB `-wal` beside it, so a byte copy of the main file
yields the last checkpointed state: a database that opens cleanly, passes
`integrity_check`, and is silently missing everything since. The source is
opened `mode=ro`, so the Source cannot mutate its origin — verified by
hashing all nine real stores across a collection.

**2. The snapshot is converted to `journal_mode=DELETE`.** `.backup` copies
page 1, so the snapshot inherits a WAL header while having no sidecars, and
SQLite refuses to open that read-only. Raw is immutable by contract, which
makes read-only the only correct way for an engine to open a raw artifact.
The sidecars the conversion leaves behind are removed so they cannot rsync to
the tower as `raw-fsck` orphans.

**3. Whole-store snapshots, never a delta.** A snapshot taken after five days
off contains those five days, which is why multi-day catch-up needs no logic.
The interface enforces it: there is nowhere to pass "since when". ⚠️ **§9's row
cursor is not this delta**: the Mac's snapshot stays whole-store, and the cursor
lives on the tower, at row grain, over a container that arrived complete.

**4. A denial is a recorded status, never an empty shipment.** If the Mac
stops shipping, the tower sees empty staging, registers nothing, exits `ok`,
and reports healthy forever. The heartbeat carries a per-collector status
because Full Disk Access can be revoked for Messages while Contacts still
works. Two timestamps: `written_at` says this run happened, and
`collectors_observed_at` says when the statuses were measured — a run refused
by the lock bumps the first and carries the second.

**5. A refused run is benign.** The first sync ships 50 GB over hours while
the hourly agent keeps firing; the run being turned away is the *scheduled*
one, and its exit code is what a failure counter reads. `flock` is dropped by
the kernel when a holder dies, so there is no stale-lock detection and there
must never be any — an age-based reaper would break the lock the long run is
holding.

**6. Nothing incomplete may ever sit at a name the registrar reads.**
`--partial` does not mean "resume from a scratch area" — it leaves the fragment
**under the destination name**, which the registrar would `write_ref` as a
complete, immutable attachment. ⭐ The bytes self-heal on the next run; the
manifest row does not. `--partial-dir`, absolute and outside the raw tree, puts
fragments where the walk cannot see them, and it is the only option that also
preserves resumption — `--temp-dir` costs it entirely (measured). What an
uncatchable kill can still strand is an rsync temporary, a hidden name that can
never be a `doc_id`, and `ship.is_in_flight()` is the predicate the tower half
imports to skip it.

**7. rsync's stderr is PII by construction.** It is one line per file, with the
full path, and its highest-volume case is the one this design calls normal.
No slice of it is ever copied into a record: the heartbeat carries a line count
and a set of kinds that are literals defined in `ship.py`.

## ⭐⭐ 8. The launchd target is a signed app bundle, and the SIGNATURE is the design

A launchd agent gets Full Disk Access **only** through a Developer ID-signed
app bundle [MA-22, settled by experiment]. macOS attributes an access to the
**responsible process** — for a launchd job, the job's own executable — and
children inherit it, so twenty lines of C that `exec` the Python is the thing
TCC grants, and the Python inherits it.

⚠️ **Ad-hoc signing makes that worthless**, and this is the measured part:

| signing | binary | grant |
|---|---|---|
| ad-hoc | changed | ⛔ denied — every rebuild silently revokes |
| ad-hoc | ⭐ restored **byte-identical** | ⛔ **still denied** — TCC invalidates the entry |
| ⭐ **Developer ID** | changed | ✅ **survives** |

because the requirement each produces is `cdhash` in the first case and, in
the second, `identifier + anchor apple generic + leaf[subject.OU]` — ⭐ **no
hash**, so rebuilds keep the grant. ⚠️ Therefore `CFBundleIdentifier` and the
signing identity are load-bearing strings, written in three files, compared by
a test.

⚠️ **Not `/usr/bin/python3`**: it is not a binary but the `xcrun` shim (78 hard
links) redirecting to whatever `xcode-select -p` points at, and granting there
would grant every Python script on the Mac.

⭐ **`mac-agents check` verifies the chain that carries the grant** — bundle,
requirement, plist, launchd — and ⚠️ **never claims the grant itself**: no
process can ask TCC about another's, and a local read would report the grant
of whoever ran the command.

## Where each thing lands on the tower

    <state>/partial/                    fragments of interrupted transfers — created
                                        first each run, and never inside the raw tree
    <raw>/imessage/chat.db              chat.db, directly (write_ref, stable path,
                                        re-hashed every run — and it must be)
    <raw>/imessage/attachments/         the 50 GB tree (write_sealed per file, and
                                        rsync'd with --ignore-existing)
    <state>/incoming/<origin>/          every other snapshot; the tower dates the paths
    <state>/last-collect.json           the heartbeat — beside staging, never inside it,
                                        because the register drains staging on success

⚠️ **§9 changes this for the containers and not for the trees.** Every store
lands in **staging**, is mirrored, and is overwritten; `<raw>/mirrors/<origin>.db`
becomes the artifact. `<raw>/imessage/attachments/` and the Notes media tree are
untouched by it.

## ⭐⭐ 9. DECIDED, NOT BUILT — the container is TRANSPORT; the mirror is raw

**Decided by Jacob 2026-08-12.** Authority, and the only place the reasoning
lives: `ai-lab docs/superpowers/specs/2026-08-12-relational-mirror.md`. It is an
amendment to what the raw tier promises, so — like [MA-45] — a **checkpoint
act** with an implementation plan of its own.

⚠️ **NOT BUILT.** Sealed-storage Tasks 3–6 land first, because
`tower/register.py` and `mac_agents/ship.py` are edited by both. Everything
above this section describes running code; ⛔ nothing in this section does.

### What measurement found — 2026-08-12, on live data

| | |
|---|---|
| `chat.db` | ⛔ **not archived — overwritten hourly.** The manifest claims 4,633,550,848 bytes across 6 versions; **one 773,386,240-byte file exists.** ⭐ Deleted messages are **already unrecoverable today** |
| `addressbook` | ⛔ **172 GB/yr.** Two snapshots 6 h apart differ in `ACHANGE` (+10) and `ATRANSACTION` (+5); **the other 32 tables are identical.** ⭐ ~1.5 KB of information causes a 20,090,880-byte write — **~13,000× amplification** |

> ⭐ **`sha256` asks "are these bytes identical?" — right for a payload, wrong
> for a container.** A live SQLite file rewrites its own bytes as a side effect
> of being read, so shipping whole containers buys churn, not history.

### ⭐⭐ The decision — one mechanism, two policies, split by what the data MEANS

| | ⭐ **EVENT** | ⭐ **STATE** |
|---|---|---|
| origins | `imessage` | `addressbook` · `notes` · `reminders` · `calendar` |
| meaning | ⭐ **it happened** — deleting a text does not un-happen it | ⭐ **it is true now** — deleting means *"no longer true"* |
| mirror keeps | ⭐ **every row, forever** | ⭐ **latest version + a tombstone on delete** |
| size | 740 MB + **250 MB/yr** (515,290 messages; 14,842 in 30 days) | ⭐ **~3,346 rows, near-fixed** |

⭐ **It is one mechanism with a per-source policy flag, not two systems.**

⭐⭐ **Why the state mirror survives at all:** you cannot detect deletion from a
snapshot of current state. A deleted contact is simply **absent**, and absence
is **indistinguishable from never-existed** unless something remembers seeing
it. Tombstones already owed, measured 2026-08-12: contacts **148** · notes
**16** · reminders **9** · calendar ~0. Without the mirror those 148 are not
archived elsewhere — ⛔ **they are unknowable.**

### ⭐ The survey — all five containers, measured 2026-08-12

| origin | container | engine | PK reused? |
|---|---|---|---|
| `imessage` | 773.8 MB | native SQLite, `AUTOINCREMENT` | ⭐ no |
| `addressbook` | 20.1 MB | Core Data | ⭐ no (`Z_PRIMARYKEY.Z_MAX`) |
| `notes` | 9.6 MB **+ 532 media files** | Core Data | ⭐ no |
| `reminders` | 12.7 MB | Core Data | ⭐ no |
| `calendar` | 2.0 MB | native SQLite, `AUTOINCREMENT` | ⭐ no |

⭐ **All five allocate primary keys monotonically**, so an incremental cursor is
safe *for new rows*. ⭐⭐ **What forces a periodic sweep is mutation in place**,
which keeps the same key and so is never re-read by a cursor: reminders
**678/683 = 99.3%** (⭐ completing a reminder is an UPDATE), notes 13/203,
iMessage ~0. Without a sweep the mirror records what things were **created** as,
never what they **became** — ⛔ for reminders, a to-do list that is never done.

### ⭐ Where the mirror lives, and why it is not a payload

⭐⭐ **The container is TRANSPORT, not payload.** It lands in staging, is
mirrored, and is overwritten next run. ⛔ **It never becomes a raw object.**
A mirror registered as a *payload* would be a file that changes hourly, needing
`ref`, re-hashing 740 MB every hour — the same problem one level up. So the
mirror is a **third component of the raw tier**, peer to the payload tree and
the manifest, and it **is** a manifest, one grain down:
`(table, pk, row_sha, first_seen, last_seen)` is
`(source, doc_id, sha256, fetched_at, last_seen)`. ⛔ Dedupe on
`(table, pk, row_sha)`, **never on `pk` alone**.

⭐ **It lives on the TOWER, not the Mac** — that is where LUKS, `restic` and the
raw tier's guarantees are. ⭐ **Replication is COMPLETE, never selective**: read
`sqlite_master` at run time and mirror every table, every column. Selective
extraction is interpretation, and it breaks on a macOS schema change.

```
Mac      chat.db                    Apple's, live
  │ rsync
tower    staging/imessage/chat.db   ⭐ transport — overwritten hourly, NOT raw
  │ mirror: read sqlite_master, replicate every table
raw      mirrors/imessage.db        ⭐⭐ the raw artifact — append-only
         mirrors/addressbook.db     ⭐ state: latest + tombstones
         manifest.db                one row per mirror + its coverage
```

⭐ A cursor is explicitly a Source concern — Sources own fetch, OAuth and
**cursors** — so pulling rows since the last run is what this layer is supposed
to do.

### ⛔ What does NOT change — the parts most likely to be over-generalised

- ⭐⭐ **iMessage attachments and Notes media are UNAFFECTED.** One file, one
  row, one immutable blob, **no container**. `sealed` [MA-45] is right for them,
  and ⭐ **they are the shape everything else aspires to.**
- ⭐ **`notes` is already two shapes**: 532 individual media files, already at
  the right grain, plus **one** NoteStore container. ⛔ **Only the container is
  in scope.**
- ⭐ **The Mac half still `.backup`s whole stores and rsyncs them.** Decisions
  1–8 above stand. What the amendment redefines is what the **tower** does with
  a container once it arrives.

### ⚠️ What this changes about what raw promises

⭐ For an **EVENT** container, raw holds every row the origin ever showed us —
not every byte the container ever had. ⭐ For a **STATE** container, raw holds
what is true now plus what was deleted — **not every intermediate version.**

⚠️⚠️ **So *"the substrate is rebuildable from raw"* holds fully for events
only.** For state, raw rebuilds the **current** claims; the temporal history of
a state entity lives in the claim store and is **accumulated, not rebuildable.**
⛔ Do not let a later document assert the unqualified form.

⚠️ **The dependency this creates on every engine reading a state mirror:** on
seeing a tombstone it **MUST close the claim's interval**, not merely drop the
row. ⛔ If it drops it, deleted contacts leak back as current — which is the
outcome the decision exists to prevent.
