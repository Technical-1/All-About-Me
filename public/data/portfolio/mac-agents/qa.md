# mac-agents — qa

**State: `building`.** Tasks 1–4 merged and live, ⭐ **and both raw-tier
amendments (`sealed`, the relational `mirror`) shipped 2026-08-12.**
⛔ **The count is not stated here** [RA-42] — it read **538** until 2026-08-30,
when it was **593**. `.venv/bin/python -m pytest -q`. ⚠️ Under the Mac's
3.9 `tests/test_register.py` is **skipped whole** — there is no `raw_tier` on
3.9 — so ⚠️⚠️ **a skipped module reports green: read the skip line, not the pass
count.** A contract test is a
**specification** — editing one is an amendment and a checkpoint decision, never
a fix [PE-9].

## What is verified, and how

| suite | covers |
|---|---|
| `test_stores.py` | discovery: the shards, the six statuses, the symlink refusals, the case semantics, and the repo-wide rule that **no Apple path may appear outside `stores.py`** |
| `test_collect.py` | `.backup` vs `cp`, read-only sourcing, the snapshot artifact, whole-store catch-up, the attachment walk |
| `test_heartbeat.py` | per-collector status, the two timestamps, the carry-forward, the wrong-shaped-JSON wedge |
| `test_runlock.py` | ⭐ every case at the **process boundary** — real subprocesses, a real `SIGKILL` |
| `test_ship.py` | the missing `--append-verify`, resumption **observed**, the exit-code taxonomy |
| `test_cli.py` | the seams: a denied collector still ships, a refused run ships only the heartbeat, an unreachable tower exits 0 |
| `test_package_build.py` | a real wheel, and that the modules are **inside** it [SF-11] |
| `test_install.py` | ⭐ the ad-hoc trap, the plist that runs the wrong program, and the claim the report must never make |
| `test_build_launcher.py` | ⭐ the build script **driven with stubbed `security`/`codesign`/`cc`**, so its refusal to sign ad-hoc is exercised rather than asserted |
| ⭐ `test_mirror_policy.py` | **the per-table policy declaration, as data** — that a table name and never a container is named here, that `ACHANGE`/`ATRANSACTION`/`ATRANSACTIONSTRING` are `transient`, and that the four default-transient tables are adopted **explicitly** rather than by a default that applies itself |
| `test_register.py` | ⭐ **the tower half, including the mirror**: containers are discovered from staging, staged → run-private → mirrored → unlinked, ⛔ **no `raw_objects` payload row for a container**, and a full day of hourly registrations over sealed attachments performing **zero** payload reads |

## The tests that would have caught a real defect

- **`.backup`, never `cp`** — a live-writer WAL fixture where the main file
  alone is 40 rows and the snapshot is 100. A byte copy passes
  `integrity_check` while being silently short, which is this program's
  signature failure.
- **The snapshot opens read-only with nothing beside it** — as produced by
  `.backup` it does not, because it inherits a WAL header with no sidecars.
  Raw is immutable, so read-only is the only correct way to open it.
- **A run after a simulated 30-day gap equals an hourly one** — byte-for-byte.
  A future "optimisation" to a since-last-run delta silently breaks multi-day
  catch-up, and the damage is invisible until somebody asks about a message
  from a week the Mac was shut. ⚠️ **The mirror's row cursor is not that
  optimisation** and must not be allowed to erode this test: the *snapshot*
  stays whole-store, and the cursor runs on the tower over a container that
  already arrived complete.
- **A denied collector still produces a *shipped* heartbeat** — a denial that
  reaches local disk and not the tower is the same silence as no denial.
- **A crashed lock holder does not wedge every future run** — proved with a
  real `SIGKILL`, and a live holder whose lock file is backdated a month
  proves nothing reaps it.
- **`--append-verify` is never passed** on a machine whose rsync rejects it.
- **rsync exit 24 is benign** — a file that vanished mid-run is what a Mac
  with "Optimize Storage" does all day. Exit 23 is one digit away, means the
  opposite, and does not share a branch.
- **No filename reaches any record** — attachment names, note titles and
  rsync's stdout are all excluded, and asserted absent from the serialized
  heartbeat.

### ⭐⭐ `sealed` storage [MA-45] — what the suite pins

- **A day of hourly runs over sealed attachments reads none of them**, proved
  by **patching and counting `Path.read_bytes` per path** — ⛔ never by timing.
  A stopwatch would report this working on a fast disk and broken on a busy
  one, and would report it working while the reads still landed in the page
  cache, which is how 52.9 GB an hour went unnoticed in the first place.
  ⚠️ The same test asserts `last_seen` still advances: a registrar that skipped
  the tree entirely would satisfy the read count alone.
- ⛔ **`chat.db` is still read in full on every run**, asserted separately. The
  cheap path reaching it would stop the message archive growing while every
  other check stayed green.
- ⛔ **`--ignore-existing` reaches the attachment tree and nothing else** —
  asked of `plan()`'s whole output rather than of the one destination that
  should carry it, and confirmed against the REAL `rsync` in both directions:
  an existing immutable destination is left alone, a mutable one is replaced.
  ⚠️ Its cost is measured too, not assumed: the interrupted file loses its
  resume basis, while the tree keeps its own.
- **A `sealed` write never reaches `chat.db` or a staged snapshot** — asserted
  at the CALL, through a recording store, because [SS-1] and [SS-8] were both
  *a mode reaching the wrong rows* rather than a mode implemented wrongly.
- **A broken seal is a finding, not a version** — no row written, `last_seen`
  deliberately frozen, `exit_class: data-error`, one bounded error string
  however many files broke, and the rest of the tree still registers.
- **A fifth raw-tier action word fails a test** — the counted vocabulary is
  **derived from `raw_tier`'s own source by AST**, so `"adopted"` arriving as a
  silent `dedupe` cannot happen a second time.

## Mutation sweep [PE-9]

`tools/mutation_sweep.py`, committed so the result is reproducible rather
than a claim only one session could re-execute. Each mutation is applied to
the real file, the real suite runs, the file is restored.

⚠️ Run with `PYTHONDONTWRITEBYTECODE=1` and `__pycache__` dropped around
**every** step, baseline included [SF-30] — a sweep in this program once
reported "0 survivors" while executing stale bytecode. ⚠️ A mutant that fails
to compile, or that breaks collection so that **no test discriminated**, is
counted `INVALID`, never a kill: that is the standard way a hand-rolled sweep
inflates its number.

⭐ `--only <substring>` re-measures one group by name, so a targeted sweep is a
committed, re-runnable command instead of a hand-hack of the file. ⚠️ It prints
`PARTIAL SWEEP` loudly: a filtered run reported like a full one is a coverage
claim with an invisible hole. **`SEALED_MUTATIONS` (12) attacks the
origin → storage-mode dispatch specifically** — the attachments back to
`write_ref`, `chat.db` sealed, `--ignore-existing` on nothing, on everything,
`adopted` folded into `dedupe`, an unknown action absorbed by its neighbour.

## Real-machine verification

Run against the live Mac under `/usr/bin/python3`, into scratch directories —
**never** into `~/Library`, and **never** copying the 50 GB tree.

Measured 2026-08-11: `collect --no-ship` in **2.8 s**; nine snapshots,
817.6 MB, 9/9 `integrity_check: ok`, all nine openable **read-only with no
sidecars**; the attachment tree walked at 19,687 files / 50.5 GB; the origin
stores **byte-identical afterwards** (sha256, all nine); a live concurrent
run exits 0 as `lock-contended`, creates no scratch directory, and carries
the previous statuses forward with `written_at` bumped and
`collectors_observed_at` unchanged.

### ⭐⭐ And then macOS revoked Full Disk Access, unprompted, mid-session

On the final verification run — no `chmod` anywhere, every file still
`-rw-r--r--` — every collector reported `denied`, **zero bytes collected**,
**exit 0**, and a heartbeat naming all six.

⛔ That is precisely the run [MA-9] was written about. Without the record it
would have been an empty shipment and a green run, and the tower would have
reported healthy forever.

⭐ It also caught an imprecision no test had: `reminders` said `error` rather
than `denied`, because its whole *container* could not be listed — an
`unsearchable` row, not a `denied` file. The same refusal, one directory
higher. With everything revoked at once the five `denied` drown it out; **in
isolation the only signal would have been the wrong one**, sending an operator
to hunt a broken database instead of to System Settings. Fixed with a
machine-readable `denied` flag set from the exception type, so nothing has to
parse `detail` prose to learn the cause.

⚠️ **Still not verified here**: whether a **launchd** agent holds the grant.
Interactively it belongs to Terminal.app and is inherited by children, so a
successful interactive run proves nothing about a background one.

⭐ **Settled since, by experiment** [MA-22]: the launchd target is a Developer
ID-signed app bundle (`com.technical1.mac-agents.collector`, team
`M7SN262HK4`) that `exec`s the Python, because macOS attributes access to the
**responsible process** and children inherit it. Its designated requirement
carries **no code hash**, so the grant survives rebuilds — ad-hoc signing does
not, and a revoked ad-hoc grant does not return even when the byte-identical
binary is restored. One manual act (the first grant, in System Settings)
cannot be scripted.

## Task 4 — built, and what it actually proved

⭐ **The bundle was built and signed against the real Developer ID
certificate** (2026-08-11), and the requirement it printed is pinned verbatim
in `tests/test_install.py`:

```
identifier "com.technical1.mac-agents.collector" and anchor apple generic
and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */
and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */
and certificate leaf[subject.OU] = M7SN262HK4
```

⭐ Two `exists` clauses the plan's summary omits, an **unquoted** OU beside a
**quoted** identifier, and — the point — **no hash anywhere**. Two consecutive
builds moved the cdhash `64fc3ca1… → eb3ff7a3…`, which is why the build prints
the before/after: [MA-23] nearly recorded ad-hoc signing as safe on a rebuild
whose cdhash had not changed.

### ⭐ A defect the new check found in its own inputs

`plutil -lint` reported **OK** on both shipped plists while Python's
`plistlib` refused them: XML forbids `--` inside a comment, and both files had
one, from writing `--install` in an install recipe. ⚠️ **The lenient validator
you reach for is not the parser your code uses** — and `mac-agents check`
reads the installed plist with `plistlib`, so a file `plutil` blesses and
`plistlib` rejects is a verification command that fails on a correct
deployment. Fixed, and pinned by two tests.

### ⭐ And a test gap the sweep found in the new tests

`test_the_report_states_what_it_did_not_verify` asserted `"NOT VERIFIED" in
out`. The trailing caveat paragraph satisfies that on its own, so the mutation
that relabelled the summary's own count **survived**: the test passed while
watching a different string than the one it was written for [MA-20]. Now
anchored on the count line.

### ⚠️ What Task 4 could NOT verify, and why

| not verified | why |
|---|---|
| **that the launchd agent holds Full Disk Access** | needs the agent loaded and one real run; the coordinator deploys |
| **that launchd coalesces missed `StartInterval` firings** | needs a real sleep/wake cycle spanning a tick, watched |
| **the tower's systemd units** | written in the `tower` repo, never installed from here; no ssh to the tower |
| **`source-alerter --check` reporting `mac-agents` as `wired`** | happens at deploy, after `bootstrap.sh --only mac-agents` |
| **that the agent's `rsync` reaches the tower under launchd** | ssh under launchd has no agent socket; the key must be passphrase-free or the transfer fails and exits 0 [MD-153] |

## Where the defects were: the seam, not the units

Both Criticals from the Task 2 review lived in the **shipping seam**, and were
invisible to 211 green tests because Task 2 never ships to a raw tier and
Task 3 never runs an interrupted rsync [SF-22]:

- `--partial` leaves an incomplete file **at its final name**, which the
  registrar would `write_ref` as a complete immutable attachment. ⭐ The bytes
  self-heal on the next run; **the manifest row does not.** Closed with
  `--partial-dir` pointed outside the raw tree, and **proved by interrupting
  real transfers** rather than by reading the flag.
- rsync's **stderr** is one line per file *with the full path*, and its
  highest-volume case (exit 24 — files vanishing as macOS offloads them) is
  the one this design calls normal. Closed by never copying any slice of
  stderr into the record: only a line count and this module's own vocabulary.

⭐ Both now have end-to-end tests **through the shipped heartbeat**, which is
exactly where the earlier privacy tests stopped short.

## ⭐⭐ The defect no test caught — nobody compared the manifest to the disk

Measured 2026-08-12 against the live tower: `raw_objects` claimed
**4,633,550,848 bytes across 6 versions** of `chat.db`; ⛔ **one
773,386,240-byte file existed.** `chat.db` was never being archived — each run
**overwrote** it, so deleted messages were already unrecoverable while the
manifest read as six retained versions.

⚠️ **Both halves of that reading move, so it carries its hour.** By **06:22Z**
the same path held **10 `ref` rows** — ⭐ **+1 every hour** — and the file was
**774,586,368 B** (**738.7 MiB at 05:29Z**, growing ~325 KB/h on average).
⛔ **Never quote the byte total against a row count it was not read at**, and
⛔ never treat `~325 KB/h` as continuous: the tower's copy is **stepwise**,
changing only when the `:17` snapshot lands.

⚠️ **Every test in this repo passed throughout, and `raw-fsck` reported clean —
and both were right.** ⭐ `SUM(bytes)` is the sum of every version ever *seen*,
not disk usage, and `raw-fsck` checks that each row's file exists, not that a
superseded `ref` version's bytes still do. ⭐⭐ **The house bug class in its
purest form: a green result is not evidence the thing happened.** The check that
would have found it was arithmetic nobody had run — compute every stated total
from its parts.

The same pass measured `addressbook` at ⛔ **176.0 GB/yr** for its big container
(20,090,880 B/hr × 8,760 = 175,996,108,800 B), ⛔ **180.2 GB/yr counting BOTH**
of them (20,566,016 B/hr), to record roughly 1.5 KB per run of real information:
two snapshots 6 h apart differ in `ACHANGE` (+10) and `ATRANSACTION` (+5),
⭐ **the other 32 tables identical**, for a 20,090,880-byte write —
**~13,000× amplification.** ⭐ Because `sha256` asks *"are these bytes
identical?"*, which is the wrong question to ask of a live SQLite file that
rewrites its own bytes as a side effect of being read.

> ⚠️⚠️ **`172 GB/yr` is withdrawn, and how it survived is the QA lesson.** It was
> **19.6 MiB/hr divided by 1000** — a MiB-derived figure carried into a decimal
> total — and it was quoted in three documents all session ⛔ **without once
> being re-derived**, in a repo whose own rule is *compute every stated total
> from its parts.* ⭐ **The error is small; the habit is not.**
>
> ⚠️ **And a second miss in the same pass:** the survey said **five containers,
> 44,285,952 B**. ⛔ **There are eight, 47,210,496 B (45.0 MiB at 06:22Z)** — the
> survey **counted** the container each origin is *named* for instead of
> **enumerating** them, and so walked straight past a **decoy** `addressbook`
> store rewriting **475,136 B/hr = 4.16 GB/yr** while ⛔ **not one of its 34
> tables changed a row.** ⭐ **Enumerate; never count.**

### ⭐ What the relational mirror had to prove — ⭐⭐ BUILT, and proved on the machine

⭐ **These exist now.** The mechanism lives in `raw-tier` (`mirror.py`,
`mirrorstore.py`, `fsck.py` — **206 cases across 15 new test files**, suite
400 → **606**) and its Source half here (`mirror_policy.py`, `tower/register.py`
— suite 469 → **538**). ⭐⭐ **0 mutation survivors across every sweep**, and
⛔ **seven cry-wolf arrivals were caught before shipping.** Design:
`ai-lab docs/superpowers/specs/2026-08-12-relational-mirror.md`; summary in
`.portfolio/architecture.md` §9.

⚠️ **Kept as written, because the table below is what the mechanism was sized
against** — and because ⭐ **what a check was built to catch is the thing to read
when it fires**, not a list of files.

| mechanism | cadence | catches |
|---|---|---|
| per-table row counts, source vs mirror | **hourly** | a mirror that stopped, or that skipped a table. ⚠️ **A table that was not swept reports `source_count=None`**, ⛔ **never `0`** |
| ⭐ full completeness sweep | every run for the **seven** non-`chat.db` containers; **daily** for `chat.db` | a row silently never captured — and ⭐ **a row that MUTATED IN PLACE**, which a cursor never re-reads |
| ⭐ **one genesis snapshot of `chat.db`**, once | never repeats | a known-good original while the mechanism is young. ⛔ **Do not state its size in advance** — record the actual bytes and sha256 at capture |
| ⛔⛔ **a tombstone requires a COMPLETED sweep** | per sweep | a **partial read** producing a fabricated deletion. A set-difference is a valid deletion test **only if the whole source table was read**, so an interrupted run leaves `completed_at` NULL and writes **zero** tombstones |
| ⛔⛔ **the renumbering brake** | per sweep | a **restore from backup**, which renumbers the origin's key space. A *complete* sweep then reads ~1,109 contacts deleted at once, so a **completed-sweep guard does not catch it**: a table whose live `pk` set is **disjoint** from the previous run's is a renumbering, ⛔ **refuse every tombstone and emit a finding** |

⚠️ **A written tombstone is the one thing here that cannot be rolled back** —
there is no delete API, and engines are bound to act on it. ⭐ **That is why the
completed-sweep rule and the renumbering brake are part of the mechanism, not a
later hardening pass.**

⚠️⚠️ **The two checks are reported separately and neither stands in for the
other.** ⭐ Completeness cannot be checked incrementally, and a count check
cannot detect a row mis-hashed or written to the wrong table. **Absence, zero
and error must stay distinguishable.**

⭐ **A snapshot of the mirror cannot do this job** — a backup of a buggy mirror
is buggy. Only the **original bytes** answer *"was it ever captured
correctly?"*; disk loss is `restic`'s problem [BK-1], not the raw tier's.

⚠️ **And the mutation shapes are opposite** — reminders **678 of 683 = 99.3%**
mutate after creation (⭐ **completing a reminder is an UPDATE**) against notes'
13 (⚠️ **of 203, which is unsourced and unreproducible — the spec's §3 says 536;
MEASURE BEFORE USING**) and ⛔⛔ **iMessage's ~8% PER POLL — not ~0**, all
measured 2026-08-12. ⭐ **Which is why a single blanket cadence is the wrong
instinct**, and why the reminders test has to assert on a *completed* reminder
rather than a created one: without the sweep the mirror records what things were
created as, never what they became — ⛔ a to-do list that is never done.

> ⛔⛔⛔ **The `~0 — immutable` cell for iMessage is the worst defect this pass
> found, and it is a TEST-DESIGN defect, not a typo.** It licensed the criterion
> *"a second version of a message is a finding"*, which is **false twice over**:
> **277,729 messages (54%) acquire `date_read` after insert**, 41,795 of them
> **more than an hour later** — i.e. after the poll saw v1 — and **819** carry
> `date_edited`. ⭐ **~2.5 versions per message is CORRECT and worth keeping**;
> *when* a message was read is a real fact, and filtering it by column would be
> interpretation. ⛔ **An alert on it would be a permanent false alarm**, and an
> implementer seeing three versions of every message **must be told this is
> right** or they will "fix" it.

⭐ **Deletion is a test target too, and only the mirror can produce the
evidence:** a deleted contact is simply **absent**, and absence is
indistinguishable from never-existed. Deletions the mirror can see, measured
2026-08-12 — notes **16** · reminders **9** · calendar ~0.

⚠️⚠️ **Contacts: none, and a test asserting otherwise would be wrong.** *"148
already deleted"* is `Z_PRIMARYKEY.Z_MAX` 1,257 − `ZABCDRECORD` 1,109 — ⛔ **an
allocation gap, NOT an enumerable set.** They were deleted **before the mirror
existed**, so ⛔ **inventing tombstones for them is fabricating observations we
never made.** ⭐ **The proof that tombstoning works is a contact Jacob deletes at
a recorded time**, observed after a real act on the Mac — ⛔ **never inferred from
a fixture.** The same applies to a completed reminder and a deleted calendar
event; `calendar` has **no `Z_MAX`**, so its tombstone comes **only** from a
completed sweep's set-difference.

⛔ **Out of scope, and must stay out:** iMessage attachments and Notes media.
One file, one row, one immutable blob, no container — `sealed` [MA-45] is right
for them, and the tests that cover them do not change.

### ⭐⭐ What the first live runs proved — observed, ⛔ not inferred from a suite

| | observed |
|---|---|
| ⭐ **the 148 already-released keys did NOT become tombstones** | and it is **structural**, not a special case: a tombstone is `iter_current − seen`, and a key released before the mirror existed was never in `mirror_rows` |
| ⭐ `tombstoned=0`, ⛔ **not `None`** | the sweep **completed** *and* found nothing deleted. Two different facts, kept apart |
| ⭐ first contact with Apple's real 34-table schema | **succeeded** — every fixture had been built from the documented schema, because the implementer had no Full Disk Access. ⚠️ **That is exactly why `addressbook` went first** |
| ⭐⭐ `addressbook` `bytes_registered` | **20,566,016 → 0** — 167.8 GiB/yr of rewriting an unchanged address book, stopped |
| ⭐ `chat.db` | **archived** rather than overwritten: **515,555 message rows at 1.0 versions/entity** on the first sweep, accruing toward the measured ~2.5 as receipts land |

⛔⛔ **Two defects the suite could not see, both caught by execution, both worth
remembering as test-design lessons:**

- **[RM-L] the mass-tombstone brake was SINGLE-SHOT.** It refused on run 2 and
  wrote **all 20 tombstones on run 3**, because on re-evaluation the key sets are
  no longer disjoint. ⭐⭐ **The measured median table is 14 rows and 65 of 121
  non-empty tables are under 20** — so the majority of real tables fell straight
  through the floor, and ⛔ **both guard tests used 100-row fixtures, above it,
  so the suite was green.** ⭐ **Test at the sizes measurement found, not the
  sizes that are convenient to write** — a fixture chosen for readability
  silently selects which bugs the suite can see. The brake now **latches**.
- **[RM-N] the deploy hour would have fired 34 false alarms.** `raw_tier`
  suppresses *"table is new"* when the mirror is empty — ⚠️ **but one mirror
  holds an origin's containerS**, so on run 1 every table of the **second**
  container reads as newly added. **8 on the fixture, 34 on the real decoy.**
  ⭐ Invisible to anyone still holding *"one origin = one container"* —
  ⛔ **the correction had reached the container COUNT and not the suppression
  RULE that depended on it.**

### ⚠️ Still open here — carried, not closed

- **[SS-7] `chat.db`'s rot hole** — **mitigated, ⛔ not closed** [SS-23]. Rot can
  no longer **destroy** an archived row, only add a bogus one beside it, and
  ⛔ *"a second version is itself a finding"* is **false** (~8% mutate per poll).
- **`runs.jsonl` has no logrotate** — **~85 KB/run → ~742 MB/yr** with all eight
  containers mirroring.
- **`reminders`' four queue-shaped tables** are declared `state` and **watched**
  — ⛔ name-shape is not evidence.
- ⚠️ **A pre-existing flaky test in `test_ship.py`** aborted two of three
  mutation sweeps on a red baseline. ⭐ Recorded rather than rounded away: a
  sweep that cannot establish a green baseline has measured nothing.
