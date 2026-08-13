# mac-agents — architecture

**State: `building`.** Tasks 1–4 are merged to `main` and the Source is **live
on the tower since 2026-08-11**, hourly at `:17`, **538 tests**. The owning plan
is `ai-lab docs/superpowers/plans/2026-08-10-mac-agents.md`.

⭐⭐ **Two amendments landed 2026-08-12 and BOTH ARE LIVE**, and both changed
what raw holds for this Source: `sealed` storage for immutable blobs [MA-45]
(**19,760 sealed rows / 47 GB**, registrar CPU **43.65 s → 4.414 s**) and the
**relational mirror** — §9 below, the authoritative summary in this repo
(**5 mirrors, 1,214,347 rows**). ⭐ **§9 describes running code.**

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

| origin | shape | how it is archived (tower), as of 2026-08-12 |
|---|---|---|
| `imessage` | one ~774 MB WAL database | ⭐⭐ **MIRRORED, policy EVENT** — the container is transport; `mirrors/imessage.db` holds **1,147,090 rows**. ⚠️ The `imessage/chat.db` payload path is **RETIRED**, and its 20 `ref` rows stay forever |
| `imessage-attachments` | 19,687 files, 50.5 GB, immutable | ⭐ **`write_sealed` per file** [MA-45] — hash on first sight, `stat` thereafter |
| `addressbook` | **2** stores — a 475 KB decoy and the real 20 MB shard | ⭐ **MIRRORED, policy STATE** — one mirror for both containers, **28,062 rows**; hourly `bytes_registered` **20,566,016 → 0** |
| `calendar` | one database | ⭐ **MIRRORED, STATE** — **2,280 rows** |
| `reminders` | **4** sharded stores, its own origin | ⭐ **MIRRORED, STATE** — **23,404 rows** |
| `notes` | a database **plus** a 201 MB media tree | ⭐ the database is **MIRRORED, STATE** (**13,511 rows**); the media tree stays `write_raw` — ⛔ `copy`, **never sealed** [SS-2] |

⭐ **§9 is what changed this column**, and it changed it for the **containers**
only: ⚠️ **all EIGHT of them, not five.** The two file trees — attachments and
Notes media — are **unaffected**, and ⭐ **the Mac half did not change at all.**

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

⭐ **§9 changed this for the containers and not for the trees, and it is live.**
Every store lands in **staging**, is mirrored, and is overwritten;
`<raw>/mirrors/<origin>.db` **is** the artifact. `<raw>/imessage/attachments/`
and the Notes media tree are untouched by it.

## ⭐⭐ 9. LIVE — the container is TRANSPORT; the mirror is raw

**Decided by Jacob 2026-08-12.** Authority, and the only place the reasoning
lives: `ai-lab docs/superpowers/specs/2026-08-12-relational-mirror.md`. It is an
amendment to what the raw tier promises, so — like [MA-45] — a **checkpoint
act** with an implementation plan of its own.

⭐⭐ **DEPLOYED 2026-08-12T17:59Z–23:16Z** — `mac-agents@8186da1` with
`raw-tier@9536e54`. **All EIGHT containers mirror**; **5 mirrors hold 1,214,347
rows** — `imessage` 1,147,090 · `addressbook` 28,062 · `reminders` 23,404 ·
`notes` 13,511 · `calendar` 2,280 — `raw-fsck` is clean with **1 retired
container path**, and `addressbook`'s hourly `bytes_registered` went
**20,566,016 → 0**. ⭐ **Sealed-storage Tasks 3–6 landed first**, because
`tower/register.py` and `mac_agents/ship.py` are edited by both; the ordering
clause was checked in fact rather than dropped. ⭐ **This section describes
running code.**

### What measurement found — 2026-08-12, on live data, ⭐ with the hour

⚠️ **Every figure carries the TIME it was read**, not just the date: `chat.db`
grows ~325 KB/h and this Source writes hourly, so two readings the same day
differ and **neither is wrong**.

| | |
|---|---|
| `chat.db` | ⛔ **not archived — overwritten hourly.** **10 `ref` rows at ONE path at 06:22Z** (⚠️ **+1 every hour**); **one 774,586,368-byte file exists** — **738.7 MiB at 05:29Z**. ⭐ Deleted messages are **already unrecoverable today.** ⚠️ The manifest's byte total sums every version ever recorded; it is **not** disk usage |
| `addressbook` | ⛔ **176.0 GB/yr** for the big container (20,090,880 B/hr × 8,760 = 175,996,108,800 B), ⛔ **180.2 GB/yr counting BOTH** (20,566,016 B/hr). Two snapshots 6 h apart differ in `ACHANGE` (+10) and `ATRANSACTION` (+5); **the other 32 tables are identical.** ⭐ ~1.5 KB of information causes a 20,090,880-byte write — **~13,000× amplification.** ⚠️ *`172 GB/yr` was a unit-mixing error and is withdrawn* |

> ⭐ **`sha256` asks "are these bytes identical?" — right for a payload, wrong
> for a container.** A live SQLite file rewrites its own bytes as a side effect
> of being read, so shipping whole containers buys churn, not history.

### ⭐⭐ The decision — one mechanism, THREE policies, DECLARED PER TABLE

| | ⭐ **EVENT** *(the default)* | ⭐ **STATE** | ⭐ **TRANSIENT** |
|---|---|---|---|
| default for | `imessage` | `addressbook` · `notes` · `reminders` · `calendar` | ⚠️ declared per table — `ACHANGE`, `ATRANSACTION` |
| meaning | ⭐ **it happened** — deleting a text does not un-happen it | ⭐ **it is true now** — deleting means *"no longer true"* | bookkeeping the **origin itself prunes** |
| mirror keeps | ⭐ **every row, forever** | ⭐ **latest version + a tombstone on delete** | the latest, ⛔ **no tombstone** |
| size | ⭐ **~1.3M rows initially, ~630 MB/yr** — ⚠️ **DERIVED from ~2.5 versions/message, ⛔ not measured** (515,387 messages at 06:30Z; 14.8k in 30 days) | ⭐ **~3,346 rows, near-fixed** | negligible — **+10 / +5 rows per 6 h** |

⛔⛔ **The policy grain is the TABLE, not the origin.** `chat.db`'s `message`
must keep every version — **54% of messages acquire a read receipt after
insert**, so a message is an **entity with a lifecycle**, not an event — while
its `persistent_tasks` work queue has burned **12,136,459 rowids** and would
accumulate forever under the same rule. ⭐ **Default EVENT (the safe default
never silently loses data); overrides DECLARED as data this repo ships
(`mac_agents/mirror_policy.py`); versions-per-entity above a declared threshold
is a FINDING**, ⛔ never silent accumulation.

⚠️ **`ACHANGE`/`ATRANSACTION`/⭐ `ATRANSACTIONSTRING` must be `TRANSIENT`, not
`STATE`:** Core Data prunes its own persistent history, and under STATE every
pruned row becomes a tombstone an engine is bound to read as *"stopped being
true"* — ⛔ **thousands of fabricated retirements.**

⭐⭐ **The family has THREE members, read from the live containers rather than
inferred from the name:** `notes` **`ACHANGE` 8,553 · `ATRANSACTION` 949 ·
`ATRANSACTIONSTRING` 23**; `reminders` **18,378 · 517 · 52**.
⚠️ `ATRANSACTIONSTRING` is pruned **with** the transactions it names, and
⛔⛔ **at 23 and 52 rows the mass-tombstone brake cannot save it** — the brake
needs 25 missing rows **and** 25%, so a prune of ten out of 52 would be written
silently. ⭐ **Declared from measurement, not from the family's name.**

⚠️ **Suspected, ⛔ NOT measured, and left `state` deliberately:** `reminders`
also ships `ZREMCDOPERATIONQUEUEITEM`, `ZREMCDTEMPLATEOPERATIONQUEUEITEM`,
`ZREMCDCHANGETRACKINGSTATE` and `ZREMCKSERVERCHANGETOKEN`, queue-shaped **by
name**. ⛔ **Name-shape is not evidence** — [MA-2]'s decoy opened cleanly and
answered queries too. ⭐ The sweeps make it observable: a `state` table the
ORIGIN prunes shows a non-zero `tombstoned`. **Watched, open.**

⭐⭐ **Why the state mirror survives at all:** you cannot detect deletion from a
snapshot of current state. A deleted contact is simply **absent**, and absence
is **indistinguishable from never-existed** unless something remembers seeing
it. Deletions the mirror could see, measured 2026-08-12: notes **16** ·
reminders **9** · calendar ~0.
⚠️⚠️ **Contacts: none.** *"148 already deleted"* is `Z_PRIMARYKEY.Z_MAX` 1,257 −
`ZABCDRECORD` 1,109 — ⛔ **an allocation gap, NOT an enumerable set, and it will
never become tombstones:** the mirror can only tombstone what it saw alive.
⭐ **That is the point, not a caveat** — those 148 are the measure of what is
**already unknowable**, and the mirror exists so the next ones are not.

### ⭐ The survey — ⭐⭐ EIGHT containers across five origins, ENUMERATED at 06:22Z

⚠️⚠️ **The first survey COUNTED containers instead of enumerating them** and
reported five. ⛔ **The origin list is not the container list**, and a plan
written from the count walks straight past **4.16 GB/yr** of waste.

| origin | container(s) | bytes at 06:22Z |
|---|---|---|
| `imessage` | `chat.db` | 774,586,368 (738.7 MiB @05:29Z) |
| `addressbook` | `Sources_F01D32D4-…_AddressBook-v22.abcddb` | 20,090,880 |
| `addressbook` | ⛔ **`AddressBook-v22.abcddb` — the DECOY** [MA-2] | **475,136** |
| `notes` | `NoteStore.sqlite` (**+ 532 media files, unaffected**) | 9,560,064 |
| `reminders` | 4 stores — ⚠️ **three hold 26 tables and ZERO reminders**, and they are **mirrored, not excluded** (excluding them is interpretation) | 12,664,832 · 856,064 · 856,064 · 737,280 |
| `calendar` | `Calendar.sqlitedb` | 1,970,176 |
| ⭐ **the seven non-`chat.db` containers — the sweep's hourly READ** | | ⭐ **47,210,496 (45.0 MiB)** |

⛔ **The decoy holds 1 contact against the real 1,099**, passes
`integrity_check`, answers queries — and across 19:17Z→06:17Z its sha256 changed
**every hour while not one of its 34 tables changed a row.** ⭐⭐ **Containers
must be DISCOVERED FROM STAGING, never named in code.**

⚠️⚠️ **The rowid-reuse hazard is LIVE, and the claim that it was not is
WITHDRAWN.** It read *"all five allocate primary keys monotonically."* ⛔ **12 of
`chat.db`'s 25 tables** (including `chat_message_join`, 515,245 rows) **and 22 of
`Calendar.sqlitedb`'s 47 lack `AUTOINCREMENT`.** `message` has it; the container
does not. ⭐⭐ **That is THE REASON `(table, pk, row_sha)` keying is
load-bearing** — ⛔ leave the reason beside the key or a later reader simplifies
it away.

⭐⭐ **What forces a periodic sweep is mutation in place**, which keeps the same
key and so is never re-read by a cursor: reminders **678/683 = 99.3%**
(⭐ completing a reminder is an UPDATE), notes 13 (⚠️ **of 203, which is
unsourced — §3 of the spec says 536; MEASURE BEFORE USING**), and ⛔⛔ **iMessage
~8% PER POLL — not ~0.** Without a sweep the mirror records what things were
**created** as, never what they **became** — ⛔ for reminders, a to-do list that
is never done.

⛔⛔ **Those extra iMessage versions are EXPECTED, not a finding.** ~2.5 versions
per message is correct and worth keeping — *when* a message was read is a real
fact — and an alert on it is a permanent false alarm.

### ⭐ Where the mirror lives, and why it is not a payload

⭐⭐ **The container is TRANSPORT, not payload.** It lands in staging, is
mirrored, and is overwritten next run. ⛔ **It never becomes a raw object.**
A mirror registered as a *payload* would be a file that changes hourly, needing
`ref`, re-hashing 738.7 MiB every hour — the same problem one level up. So the
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
                                      (BOTH addressbook containers, one mirror)
         manifest.db                ⭐ raw_mirrors: one row per mirror + the
                                      container path it RETIRES
```

⚠️ **One mirror per ORIGIN, not per container** — so `addressbook`'s two share
one file, and `tbl` is spelled **`<store-id>.<table>`** so their tables cannot
collide. ⭐ **The manifest declaration is a peer table, `raw_mirrors`** —
⛔ **never a `raw_objects` row**, which would force a locally minted `doc_id`
[RT-11] and `NOT NULL` byte columns stale on the next write.

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

⛔⛔ **The dependency this creates on every engine — and it INVERTS between the
two policies** [spec **§3.3**]. ⚠️ **This Source ships both kinds, so the
unqualified rule is wrong here in particular:**

| tombstone on a… | means | the engine must |
|---|---|---|
| **STATE** (`addressbook` · `notes` · `reminders` · `calendar`) | ⭐ *"this stopped being true"* | ✅ **CLOSE the claim's interval**, ⛔ never merely drop the row — dropping it leaks deleted contacts back as current, the outcome the decision exists to prevent |
| ⭐ **EVENT** (`imessage`) | ⭐ *"the ORIGIN no longer retains this"* | ⛔⛔ **CLOSE NOTHING.** ⭐ **An event that happened cannot stop having happened** — deleting a text does not un-send it, and closing an interval here would assert **833 deleted messages never happened** |
| **TRANSIENT** (`ACHANGE` · `ATRANSACTION` · `ATRANSACTIONSTRING`) | — | ⛔ **no tombstone is written at all** — the origin prunes these itself |

⭐ **A STATE interval closes at the tombstone's `last_seen`** — the last pass that
saw the row **alive** — ⛔ **never the run that noticed it missing**, which is an
hour to a day later. That is exactly what `last_seen`'s bump-on-every-pass rule
[RT-15] exists to make readable, one grain down from where this repo already
obeys it.

⭐⭐ **And the mechanism, so the obligation is neither unimplementable nor
guessable: `MirrorStore.iter_tombstoned(tbl, *, since=None)`** →
`Tombstoned(pk, row_sha, payload, tombstoned_at, last_seen, policy)` —
⭐ **six fields, ⛔ not four.** ⭐⭐ **`policy` is the field that tells a
RETIREMENT from a REMOVAL**, and it is **frozen at write time**, ⛔ never joined
from `mirror_tables`: a table that moved between policies afterwards would
silently re-interpret every retirement already recorded, in both directions.
⚠️⚠️ **`policy=None` is a THIRD reading** — *the mirror cannot state what this
marker means* — and ⛔ **an engine must not pick a side.** ⚠️ **`iter_current`
filters tombstones BY DEFAULT** — opt-**out** filtering leaks on the first caller
who forgets — so ⛔ **an engine given only `iter_current` and `coverage()` can do
nothing except the forbidden thing.** ⭐ **A tombstone MARKS; it never deletes.**

⭐⭐ **[A4]'s receipt address for a mirrored row is
`(source, mirror_path, tbl, pk, row_sha)`.** A mirrored row has ⛔ **no
`(source, doc_id)`**, so `claim_provenance` cannot cite one as it stands;
`row_sha` **pins which version** the claim was made from. ⛔⛔ **`raw_subjects`
does not apply to mirrored rows** — minting a `doc_id` for one makes
`dangling_subjects` red and **`raw-fsck` unclean on a perfectly healthy run.**
⭐ The mirror's `(tbl, pk)` **is** the index. ⬜ **Decided, ⛔ not implemented** —
the claim store does not exist, and ⚠️ **1,214,347 mirrored rows are already on
disk with no way to be cited.**

✅ **And `fsck` learned mirrors exist BEFORE this repo wrote one** — the only
order that works.
Confirmed by execution 2026-08-12: `orphan_files=4 clean=False` on the **cheap
hourly walk**, so `raw-fsck` would be red every hour from day one and drag
`source-alerter` with it. ⭐ **Sidecars are EXEMPTED, never DECLARED**, and the
mirror runs **`journal_mode=DELETE`** — ⛔ never WAL, which would manufacture two
permanent sidecars under the raw root.
