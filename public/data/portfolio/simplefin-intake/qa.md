# simplefin-intake — qa

**State: `running`.** ⛔ **The total is not stated here** [RA-42] — it read
**467** until 2026-08-30, when it was **511**. `.venv/bin/python -m pytest -q`.
⭐ The table below still decomposes it, which is the part worth keeping: a total
computed from its parts catches a suite that silently stopped collecting a file. ⚠️ The build verified live on the tower is an
earlier one (303 tests); this tree is ahead of it — it has none of the
`local-error` exit class, the run lock, the contention split,
`skipped_reason` or the [SF-32] run history. See `CLAUDE.md`.

## Suite

| File | Tests | Pins |
|---|---:|---|
| `test_fetch_accounts.py` | 98 | the sync state machine: window widths and the [SF-9] span guard, backfill completion and its terminal conditions, both truncation detectors and their gates, per-account isolation (⭐ including that a **contended shared manifest** escapes it, as a full disk does), coverage confirmation — and ⭐ the gap sweep **in deployment shape**: a fresh store per run, a moving clock, a persistently frozen cursor |
| `test_faults.py` | 62 | where "the origin's fault" ends and "this machine's" begins — including, deliberately, everything the predicate must **refuse**: `bridge.ModeError`, a missing credential, every transport error, the `sqlite3` errors that mean our own code asked wrongly, ⭐ the **real** OpenSSL and `getaddrinfo` errors whose `.errno` collides with `EPERM`/`EIO`, and ⭐ a **real** `SQLITE_BUSY` from two connections contending |
| `test_sync.py` | 53 | the [MD-153] exit classifier, clause ordering, transport errors, ⭐ the whole exit-code table by name (no default), `local-error` outranking a per-account strike, ⭐ that a TLS failure stays `unreachable` **and cannot become `local-error` even with the transport clause emptied**, ⭐ contention → exit 0, and that the record is written on every path |
| `test_cursors.py` | 49 | resumable state: the poll cursor, the backfill frontier and the gap sweep, per-account completion and its arming rules, the legacy-adoption migration, the operator hatches, WAL and the read-only reader |
| `test_cli_sync_status.py` | 56 | `sync`/`status`/`backfill` output and exit codes; that commands which only report refuse to create the state they report on (⚠️ `backfill` too — it writes, but minting state to report changing nothing in it is the same defect); that `status` surfaces the gap sweep; ⭐ the run lock end to end, including the whole command spawned as a second real process; ⭐ that a refused run's record carries **no `warnings[]`** while staying distinguishable as a refusal; and ⭐ [SF-32] that **every** record-writing path appends to `runs.jsonl` — `ok`, `unreachable`, `auth-error`, `data-error`, `local-error`, `lock-contended` and the two paths where the record write itself failed, each asserted separately |
| `test_reconcile.py` | 42 | the count-vs-count check: four outcomes, the roster floor and its expiry, the span clamp, the three exit codes, and that the check writes no data |
| `test_runhistory.py` | 34 | ⭐ [SF-32] the run history: that an append is one line and never a rewrite; the size bound, and that rotation **never drops the newest**; that a failed rotation still appends; ⭐ that the reader survives the file's **absence** [NT-6] and a **truncated final line** (and never parses a final fragment that happens to look like JSON); that absence, zero and error stay three answers; the query — window, classes, ⭐ **minute of the hour** from `started_at`; that no figure from the financial data can reach it; ⭐ an **AST guard** over `sync.py`/`cli.py` so a fourth record-writing path cannot skip the append; and [SF-28] accumulation across `Type=oneshot` runs, both in-process with a moving clock and across **three real processes** |
| `test_runrecord.py` | 37 | the [NT-1] record's field contract, the roster-baseline rules, the shape guard that stops a poisoned file wedging every run, and ⭐ that `lock-contended` can never carry a warning while still carrying the origin's `errors[]` |
| `test_bridge.py` | 13 | the User-Agent every request must carry [SF-4]; the decode-POST-return claim flow [SF-3]; `auth_header`'s userinfo-strip + Basic encode + URL-unquote; the mode-600 credential round trip and its enforcement |
| `test_runlock.py` | 13 | the run lock ⭐ **at the process boundary a `Type=oneshot` unit actually has** — every contention test spawns a real second process, and one **SIGKILLs the holder** to prove the kernel drops the lock rather than wedging every future run; plus the wedge `flock` does *not* cover (a lock file this user cannot open) and that `release()` never raises over the run it is releasing |
| `test_cli.py` | 8 | `claim` never prints the token or URL; `probe`'s counts, its span, and its refusal of a loose credential |
| `test_package_build.py` | 2 | a real wheel contains the package and the console script [SF-11] |

## How this suite is meant to be read

⭐ **A test suite is a specification** [PE-9]. Editing one is an amendment,
never a fix — so every amendment is declared with what changed and why, and
the assertions were checked against the new behaviour rather than adjusted
until they passed.

**The amendment ledger, reconciled against the diff** (an earlier report
claimed three on the `local-error`/run-lock work and only two were
findable — the count was wrong, not the work):

| # | test | change | why it is a re-aiming |
|---|---|---|---|
| 1 | `test_sync_cli_writes_a_record_when_opening_state_itself_fails` | `1 → 3`, `data-error → local-error` | a corrupt `cursors.db` is this machine; the Bridge was never contacted. The property the test exists for — a record exists — is unchanged and still asserted |
| 2 | `test_a_state_open_failure_does_not_wipe_the_roster_baseline` | `1 → 3` | same subject (a directory at the db path); the roster assertion is untouched |
| 3 | `test_a_transport_failure_is_never_a_local_fault[ssl]` | `ssl.SSLError("text")` → `SSLError(1, …)`, `SSLError(5, …)`, `SSLCertVerificationError(1, …)`, `gaierror(EAI_FAMILY, …)` | ⭐ the old case built a **single-argument** `SSLError`, so `errno` was `None` and the assertion could not fail however the predicate was written. OpenSSL never raises that shape. Same claim, a shape that can bite |
| 4 | `test_the_skipped_run_is_recorded_honestly_and_never_as_the_origins_fault` | the refusal text moves from `warnings[]` to `skipped_reason` | `warnings[]` is the partially-blind channel and has a live consumer [NT-6]; a run that did nothing cannot be partially blind. The test still asserts the refusal is readable from the record |

⚠️ **Not counted as an amendment, but declared:** the `_paths`/`_argv`
fixture in `test_cli_sync_status.py` now routes every `sync` test through an
explicit `--lock-path`, and (for the run history) an explicit
`--history-path`. Neither changes an assertion — without them the tests
would take the lock, and append run lines, in the tower's real state
directory. ⚠️ The `--history-path` route is the load-bearing one: left on
the default, every append in that file would have been a no-op against an
unwritable `/data/…` and the suite would still have been green.

⚠️ **The run history added no amendments at all** — it is new behaviour on
new paths, so nothing existing was re-aimed. The one existing test it
touches (`test_status_reports_never_with_no_prior_state`) passes unchanged;
it now also proves the absent-history path does not raise.

⭐ **Every test added here was mutation-verified by actually running the
mutation** — the implementation was broken in the specific way the test
exists to catch, the suite was re-run, and the failure was recorded.
**190 mutations across the build so far, 0 survivors** (105 through the
merge, 28 for `local-error` and the run lock, 25 for the hardening pass,
**32 for the [SF-32] run history**).
That is not ceremony: it caught four tests during the build that a green
suite did not — and four more in the hardening sweep, which is why the
sweep's first run reported four survivors and its second reported none:

- two mutations were **survivors for real** — nothing exercised
  `fetch_accounts`' per-account escape or `cli._sync_setup_failure` with a
  contended database, so both would have silently reverted. Three tests were
  added and the mutations then died;
- two were **broken mutations** rather than surviving code: one added a dead
  variable and one mutated a field the record assembles later. ⚠️ A mutation
  that does not change behaviour is indistinguishable from a surviving one
  in the summary line, and reads as a test gap that is not there. Re-write
  the mutation before writing the test.

⚠️ [SF-30] The sweep runs with `PYTHONDONTWRITEBYTECODE=1` **and** drops
every `__pycache__` before each run. A sweep in this program once reported
"0 survivors" while executing stale bytecode.

⚠️ [MA-19] **A mutation that does not compile or import is `INVALID`, not a
kill.** The run-history sweep produced exactly one on its first pass — an
anchor that matched `except FileNotFoundError: return False` in *two*
functions, so the harness refused it rather than counting a substitution it
could not place. It was re-anchored and re-run; **32 mutations, 0
survivors, 0 invalid**, and every kill was checked to be the test written
for it, not a bystander.

- a "sparse account" test that survived two different mutations because it
  pinned only the *conjunction* of two guards;
- a `closed`-predicate test that could not bite because the predicate was
  computed in two places that could not observably disagree;
- an `M3` test that could not distinguish the two implementations because its
  fixture's account id contained no colon;
- a Bridge-range-warning test whose bite a later fix silently removed, by
  making its terminal window one the walk no longer ends on;
- ⭐ an entire *fixture shape*: every gap test froze `now` and shared one
  `CursorStore`, so none could model a `Type=oneshot` unit — a fresh process,
  a fresh connection, a clock that has moved. Two mutations that reinstated a
  data-loss path in full passed all of them. The defect was not in any single
  test, which is why every one of them looked fine.

⚠️ **A passing suite after a behaviour change is not evidence the tests still
bite.** Re-run the mutations.

## The suite never touches the real Bridge

Every HTTP-shaped test monkeypatches `bridge.get_accounts`, `bridge._request`
or `urlopen`. `raw_tier` stores and `cursors.db` are built in `tmp_path`.
⭐ Including the subprocess tests: the one that runs the whole `sync` command
in a second process reaches the lock and is refused **before** the access URL
is read, and there is no access URL on disk in that fixture — so a run that
somehow got past the lock would fail loudly rather than quietly dial out.
Fixtures stamp `last_seen` explicitly rather than letting `raw_tier`'s clock
supply it — recency is part of what several of them assert, and it does not
get to come from somewhere else.

Verification against the live Bridge happens on the tower, as a separate
manual step: `sync` under the timer, then `reconcile`.

## What the tests cannot verify, and how it is covered

- **Whether SimpleFIN filters `start-date`/`end-date` on `posted` or
  `transacted_at`**, and how pending rows are filtered. This decides how often
  `reconcile`'s trailing-overlap false positive [SF-21] bites, and whether a
  transaction can be named in two supposedly disjoint windows.
- **Whether `/accounts` truly returns the whole roster in every response.**
  The roster guard, the clean-response rule, and the adoption path all rest on
  it. It is an observed protocol fact, not a tested one.
- **The permission variant of the WAL read.** A read-only connection to a WAL
  database must create the `-shm` sidecar, so the state directory must be
  writable. Tested for the happy path; the unwritable-directory case degrades
  to `CursorStateUnreadable` → exit 2, which is asserted, but was not run on
  the tower.
- **Live reconciliation.** Run on the machine, not here.
- **A genuinely full disk.** `local-error` is exercised by injecting the
  errnos a full or read-only volume produces, plus real unopenable and
  corrupt SQLite files and a real unwritable directory — but no test fills a
  filesystem. What ENOSPC does *inside* `raw_tier`'s own write path (payload
  before manifest row [RT-15]) is that repo's contract, not this one's.
- **The lock under systemd rather than under `subprocess`.** The refusal, the
  crash release and the release ordering are all proven across real process
  boundaries; that a timer-fired unit and an interactive shell contend the
  same way has not been run on the tower.
- **The residual write race on `last-run.json`.** A refusal landing in the
  microsecond window between the holder's record write and its lock release
  leaves the skipped run's record on top until the next hour. What *is*
  tested is the property that makes the window that small — the lock is
  still held while the record is written — not the race itself, which no
  deterministic test can produce.
- **A real two-Source collision on `manifest.db`.** `SQLITE_BUSY` is
  produced by two real connections contending in-process, which is the
  exception SQLite actually raises — but no test runs two Sources, because
  there is only one. What a *second* Source's hourly write does to this one
  is a tower fact, and the first thing to watch when `mac-agents` lands.
- **Anything at the consumer.** `source-alerter`'s reading of these records
  was checked by reading its source, not by running its suite. The
  `skipped_reason` field is new vocabulary it does not know; it tolerates
  unknown keys, and the two keys it *does* read (`warnings`, `errors`) are
  what this pass changed on purpose.
- **A real power loss mid-append.** The truncated final line is produced by
  writing a fragment on purpose, which is byte-for-byte what a partial write
  leaves, but no test cuts power to a disk. Nor does one prove that a single
  `write()` of a ~3 KB line is atomic on the tower's filesystem — that is an
  `O_APPEND` property of the kernel, relied on and not measured here.
- **A rotation at the real bound.** Every rotation test uses a bound measured
  from one line, not 32 MiB; what is pinned is the *rule* (rename aside, keep
  one generation, never drop the newest), not the constant.
- **A second Source's `runs.jsonl`.** [SF-32] binds Sources 2–6, and only
  this one has been written.
- **A root-owned lock file.** The ownership wedge is exercised with a
  mode-000 lock file as a non-root user, which produces the same `EACCES`
  from `os.open`; no test runs `sudo`.

## Deliberately not built

- **No retry/backoff.** A transport failure is `unreachable`, exits 0, and the
  next hour's timer is the retry. A missed hour is normal.
- **No gold sets or quality gates.** Phase 1 is "does it run" [PE].
- **No blocking on the run lock, and no stale-lock detection.** Both are
  decisions, not omissions — see `.portfolio/architecture.md`. A waiting run
  under a timer suppresses the schedule, and a stale-lock breaker can break a
  live run's lock, which is the failure the lock exists to prevent.
- **No lock on `backfill` or `reconcile`.** `backfill` writes cursor state
  and could in principle collide with a running `sync`; both are interactive
  operator commands, and the fault being closed here is the *timer's* run
  taking a strike. Recorded as a known limit rather than closed.
