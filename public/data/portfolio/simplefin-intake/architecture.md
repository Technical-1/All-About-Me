# simplefin-intake — architecture

**State: `running`.** Tasks 1–5 built, tested, merged, and running hourly on
the tower under a systemd timer. ⚠️ The tree described here is *ahead* of
the deployed build, which was verified live at 303 tests — the `local-error`
exit class and the run lock are newer than it. See `CLAUDE.md` for the
invariants; this file is the map article `github-connector` carries into the
knowledge base.

## What this Source is

A **Source** in the four-layer program: it gets bank and card data onto the
machine and writes it into the raw tier. Acquisition only — it computes
nothing, normalizes nothing, and makes no model calls of any kind [A3/A5].
The split of one `/accounts` response into per-transaction and per-balance
payloads is a mechanical ingest derivation [SF-1], not normalization.

One credential covers many institutions. SimpleFIN's consent is a single-use
setup-token claim — decode, POST, and the response body *is* the access URL —
so unlike `google-source` there is no OAuth dance and no "which machine holds
the browser" question. It runs directly on the tower.

## The one protocol fact everything else follows from

⭐ **`GET /accounts` returns every connected account, with its own
`transactions` array, under one shared request window** [PF-53]. There is no
per-account request. That single fact explains most of the design:

- every cursor here is **global**, because a per-account request window
  cannot exist;
- the roster is whatever one response names, so "we have seen the roster" is
  a meaningful signal;
- a truncation is judged per window *and* per account, because one response
  carries sixteen accounts' worth of data.

⚠️ **A future Source author must not copy this assumption.** Gmail, Drive,
GitHub and Outlook all have paginated or window-filtered listing endpoints,
where "the first page" is not the roster and a per-entity cursor is both
possible and correct.

## Package layout

```
simplefin_intake/
  bridge.py          the protocol: claim, credential file, Basic auth, GET /accounts
  fetch_accounts.py  the sync state machine: backfill, incremental, split, write
  cursors.py         resumable state (SQLite): poll cursor, backfill frontier,
                     per-account backfill completion
  runrecord.py       last-run.json — the operator's artifact [NT-1]
  runhistory.py      runs.jsonl — one appended line per launch [SF-32], and
                     the query over it (classes, minute of the hour)
  sync.py            one run: transactions + balances, and the exit classifier
  faults.py          is this fault the ORIGIN's, or THIS MACHINE's?
  runlock.py         the whole-run flock: one sync at a time on this machine
  reconcile.py       the count-vs-count check against the Bridge's own counts
  paths.py           where state lives
  cli.py             claim | probe | sync | status | runs | reconcile | backfill
```

## How a sync works

`sync_transactions` is one entry point with two phases, both driven by
`cursors`:

- **Backfill** walks a global frontier backward from `now`, one window per
  run, persisting after each step so a killed process resumes mid-history. It
  ends on a **confirmed** empty window — one that named a roster, carried no
  errors, showed no truncation, and returned nothing.
- **Incremental** requests from `last_successful_poll` minus a fixed 5-day
  overlap, so a transaction still pending at the last poll is re-covered once
  it settles. A gap wider than one window is walked forward in the same capped
  windows rather than sent as one over-wide request.

`sync_balances` is deliberately separate and shares no cursor state: a
balance is a current snapshot, not a series with history to walk. It issues
its own narrow call, and **every** account object gets a snapshot whether or
not it had transactions — an account with no activity still has a balance,
and skipping it silently would be the absence-vs-zero failure this program
exists to catch.

## The invariants that cost the most to learn

**[SF-9] The governed quantity is the effective span as SENT.** Every dated
request goes through `fetch_accounts.fetch_window`, which **raises** on a span
wider than the Bridge's 45-day cap. `end-date` is always explicit: omitting it
hands the range's end to the Bridge's clock, so the span on the wire exceeds
anything we computed. That deadlocked the live Source for six consecutive runs
— every step individually correct, the effective span ungoverned.

**A window's coverage is CONFIRMED only when the response was trustworthy,
readable, and named somebody.** Three separate cross-task defects lived behind
that one boolean: an empty response used to end a backfill walk (and the
migration hatch then marked every account complete without walking it); a
window nothing could be read from used to advance the poll cursor; and a
truncation heuristic measured on the 40-day backfill window fired on the
~5-day incremental one and froze the cursor for ~70 runs.

**A leading gap never marks an account "not backfilled".** Both truncation
rules fire on exactly the shape the *end of available history* produces, and a
backward walk must cross that boundary — so latching on them marked the whole
roster permanently incomplete at the ordinary, successful end of a backfill.
They are warnings. Only unambiguous evidence latches: the Bridge's own range
warning, absence from an errored response, and an account a window failed to
finish reading.

**Absence, zero and error stay distinguishable everywhere.** An account
enumerated with no transactions gets a count of `0`; one the response never
named has no key. `reconcile` has four outcomes, not two. `last_seen` is
bumped on every poll [RT-15] so *deleted* and *unchanged* stay distinct.

**Nothing deletes.** No delete API exists here [RT-16].

## Per-account backfill completion

The walk is global; the **answer** is per account. A single global "backfill
complete" flag marked an account done whose institution had been erroring
throughout the walk — and nothing ever asked for that history again, which
with a ~90-day origin memory is permanent loss.

⚠️ **`gap_cursor` is the other piece of state worth knowing about.** The poll
cursor may only advance on confirmed coverage, so a persistent failure freezes
it — and a per-run bound on the catch-up loop then meant the walk restarted
from the same frozen point every hour and never reached `now`. `gap_cursor`
records how far the sweep has *requested*, so consecutive runs continue where
the last stopped; it is anchored to the poll-cursor value it was computed
against, and cleared on reaching `now` so the next sweep re-walks from the
cursor. `status` prints it.

`account_backfill` carries, per account: `complete`, `walk_ok` (every window
of the current pass covered it), `from_top` (the pass had it from its first
window), `present`, `armed`, and `truncation_seen`. An account that comes back
after an absence arms a fresh walk from the top. ⚠️ An account nobody can
*see* does not hold the Source in backfill mode — it waits, visibly
incomplete, so the rest of the roster keeps its hourly poll. And one walked
from the top that still came out uncovered is reported rather than chased, so
a shallow institution cannot spend every run on backfill.

`simplefin-intake backfill --rearm | --force-complete` is the operator way
into stuck state. `--force-complete` asserts a completion the walk never
demonstrated — exactly what the old global flag did wrongly — so nothing
automatic can reach it.

## Exit discipline [MD-153/SF-10]

⭐ **Exit codes are for the machine; warnings are for the person.** The exit
code drives systemd's failure counter, which must only fire for something
Jacob can fix.

| condition | exit | `exit_class` |
|---|---|---|
| unreachable — DNS, refused, timeout, reset, truncated read | 0 | `unreachable` |
| Bridge 5xx / 408 / 429 | 0 | `origin-error` |
| 401/403 — revoked or bad credential | 0 | `auth-error` |
| another `sync` already holds the run lock | 0 | `lock-contended` |
| ⭐ a database this run needed is held by another WRITER (`SQLITE_BUSY`/`SQLITE_LOCKED`) | 0 | `lock-contended` |
| 400/404/422 or any other unrecognized status | 1 | `data-error` |
| unparseable response, a vanished field, a per-account data-shape surprise | 1 | `data-error` |
| ⭐ a fault on **this machine** — full disk, unwritable state dir, corrupt db | **3** | `local-error` |

`urllib.error.HTTPError` subclasses `URLError`, so clause **ordering** in
`sync.run_sync` is load-bearing, and `_TRANSPORT_ERRORS` (a tuple of named
transport types, never a bare `OSError`) catches the failures `urllib` never
wraps — those fire during the body read, after `urlopen` returned. That
Critical fired in production 46 minutes after its fix shipped.

A Bridge `errors[]` entry (one member bank down) is none of the above: it is
carried into `last-run.json` verbatim and never fails the run.

### ⭐ `local-error` — the class the table could not say

Four classes described the origin and none described the machine the Source
runs *on*, so a full disk had to be forced into one of them — and **both
available answers are lies**: `unreachable` sends the operator to check the
bank's connection, `data-error` blames the origin for a fault under our own
feet.

Exit **3**. Not 0 (a local fault is not an origin problem, so [MD-153]'s
log-and-exit-0 does not apply and nobody would ever look); a strike is
*correct*, because the rule is that the counter fires for what Jacob can fix
and a full disk is exactly that; not 1, because sharing `data-error`'s code
makes "the origin's data changed shape" and "this machine is out of disk"
indistinguishable to anything reading only `$?`, and they send a person to
two different systems; not 2, which argparse and `reconcile` already spend.

⚠️ **`faults.is_local_error` matches on the ERRNO, never on the exception
class.** Almost everything it must refuse is an `OSError` too —
`bridge.ModeError` is a `PermissionError`, the missing access URL is a
`FileNotFoundError`, and every transport failure `_TRANSPORT_ERRORS` catches
is an `OSError`. A class-based predicate would swallow `unreachable` and
start burning strikes for outages nobody can fix. `ENOENT` is deliberately
absent: a missing path is far more often a wrong path than a broken disk.

⚠️ **…and the errno match alone was not enough, because `.errno` is not
always an `<errno.h>` code.** `ssl.SSLError` carries the OpenSSL code
(`SSL_ERROR_SSL` = 1 = `EPERM`, `SSL_ERROR_SYSCALL` = 5 = `EIO`) and
`socket.gaierror` a `getaddrinfo` code (`EAI_FAMILY` = 5 on macOS), so a
Bridge certificate rotation answered "this machine is broken". It never
misfired — the transport clause runs first — but that safety was
**positional**, in a repo that has got except-clause ordering wrong three
times. Both types are refused before any errno is read. Pinned with a
**real** OpenSSL error (a TLS client against a loopback socket answering in
plain TCP) and with a test that empties `_TRANSPORT_ERRORS` to prove the
generic clause still cannot answer `local-error`.

### ⭐ Contention is not a fault

`sqlite3.OperationalError` is SQLite's catch-all — "disk is full", "database
is locked" and "no such table" all arrive through it. `raw_tier`'s
`manifest.db` is **one file shared by every Source** (5 s default busy
timeout) while the run lock is **per-Source**, so from Source #2 onward a
busy timeout is an ordinary hour, and `local-error` made it exit 3, a
systemd strike and a page saying *this machine is sick*. Split on
`sqlite_errorcode` (3.11+), masked to the primary code so the extended busy
codes land with their primary: `SQLITE_BUSY`/`SQLITE_LOCKED` →
`lock-contended` exit 0; `SQLITE_ERROR` (`no such table` — a bug in this
repo) → `data-error`; everything else unchanged at `local-error`. One class
rather than an eighth word, because every new word is one `source-alerter`
must learn before it stops reading it as `unknown` [SF-22].

⚠️ Residual, stated rather than closed: the alerter declares
`lock-contended` benign, so a *permanently* contended database would go
unalerted — its own documented "permanently benign Source" gap, covered by
the weekly heartbeat rather than by `stale`.

### ⚠️ `warnings[]` is an interface [NT-6]

It means *this run did its work but could not see everything*, and
`source-alerter` raises `partially-blind` on any otherwise-benign run
carrying one. A `lock-contended` run made no observation, so it writes
**none**; the explanation is in the record's `skipped_reason`. Enforced in
`runrecord.build_record` rather than in each of the three callers that can
build such a record. `errors[]` is not suppressed with it — the Bridge's own
words about an account are a fact recorded nowhere else.

⚠️ **A local fault escapes the per-account handler.** [I-4]'s isolation
exists so one malformed account cannot cost the other fifteen their
payloads; a full disk fails every remaining write identically, so isolating
it turns one machine fault into sixteen per-account "data-shape surprises" —
and `sync.run_sync` re-asserts a `data-error` strike from exactly that list.
It re-raises instead, and outranks the per-account strike when both
happened. Payloads already committed stay committed [RT-15].

## The run lock — one `sync` at a time on this machine

A hand-typed `sync` overlapping the timer's could produce a spurious
failure: **a systemd failure strike caused by a human typing a command.**
`cli._sync` takes an exclusive `fcntl.flock` before opening any state — the
raw manifest and `cursors.db` are what a collision lands on.

**Non-blocking, refused immediately.** Waiting is the wrong answer under a
timer: a blocked run is still a live process at the top of the next hour,
and systemd will not start a second instance of a unit that is still active,
so a queue of waiting runs does not drain — it **suppresses the schedule**.
The refused run exits **0** (`lock-contended`), because when a human's
manual run is the one in flight it is the **timer's** run that gets turned
away, and its exit code is what feeds the failure counter.

Two orderings are load-bearing, and both are tested:

- the lock is released **after** the [NT-1] record is written, so the whole
  run — record write included — is inside it. Release it earlier and a
  second run can *start* while the first is still writing: two syncs on the
  same state, which is the thing the lock exists to prevent. It is also what
  keeps a refused run's "did nothing" record from landing on top of a real
  result. ⚠️ Not a total order: a refusal in the window between the holder's
  write and its release still lands last. Microseconds against a run
  measured in seconds, costing one benign self-describing record until the
  next hour and no state — stated rather than closed, because closing it
  needs a second lock over the record file;
- a lock file that cannot be **opened** raises `OSError`, not
  `AlreadyRunning`, so an unwritable state directory is `local-error` rather
  than a benign-looking exit 0 repeating every hour.

⚠️ **No stale-lock detection, ever.** The kernel drops an `flock` when the
holder dies, so there is nothing to clean up — while every scheme for
breaking a "stale" lock (a pid file, an age check, a timeout) can break one
a live run is holding. ⚠️ **The lock file is never unlinked**: that leaves
the holder locking a deleted inode and the next process locking a fresh one,
both believing they hold it.

⚠️ **That reasoning covers `flock` semantics, not lock-file OWNERSHIP.** A
root-owned `sync.lock` (one `sudo … sync`) wedges every future run and
nothing clears it. `acquire()` cannot prevent it, so it fails honestly: the
`os.open` failure is re-raised with the errno preserved and the path spelled
out, landing as `local-error` exit 3 naming the file to `chown` — never
`AlreadyRunning`, which would be a benign exit 0 about a process that does
not exist. Three smaller rules with it: `EACCES` is **not** in the held-set
(`flock(2)` never returns it, and a dead entry in a translation table lies
if it fires); `ENOLCK`/`EOPNOTSUPP` are `local-error`, not a `data-error`
strike; and `release()` never raises, because it runs in the `finally` that
wraps the record write and a failing `os.close` would replace the run's real
result with a traceback after the record already said otherwise.

## The run record — a cross-repo interface

`last-run.json` is written on **every** run, including the ones that fail
[NT-1]: the run that fails is the run someone needs to read. `mac-control-app`
reads this file, not a log, so its field contract is an interface, not an
implementation detail (the table is in `runrecord.py`).

Two kinds of field, deliberately: `account_ids`/`account_latest_txn` are the
**last known roster**, carried forward across a run that learned nothing;
`accounts_seen`/`account_txn_counts` are strictly **this run's** observation,
never carried, because a carried-forward count is last hour's number wearing
this hour's label.

⭐ **Three channels, three different questions**, and mixing them is what
made a benign collision page a human:

| field | the question it answers | who reads it |
|---|---|---|
| `failure_reason` | why the run **failed** | a person; `source-alerter` does not read it |
| ⭐ `skipped_reason` | why the run did **nothing** (which lock, whose) — set only with `lock-contended` | a person |
| `warnings[]` | what the run **could not see** although it worked | ⚠️ `source-alerter` → `partially-blind` |
| `errors[]` | what went wrong, and to which account — the Bridge's own words | ⚠️ `source-alerter` → `partially-blind` |

## ⭐ The run history — every launch, not just the last one [SF-32]

`last-run.json` holds **exactly one run**, so *"what has this Source actually
been doing?"* was not answerable from its own artifacts at all. [SF-31] — 43%
of timer runs failing because `OnCalendar=hourly` put them at `:00`, where the
whole internet's default cron lands — had to be mined out of `journald`, which
rotates, is unstructured, and is not queryable.

Every path that writes the record now also appends **one JSON line** to
`runs.jsonl` beside it, carrying the same fields. ⚠️ **Every** path:
`unreachable`, `auth-error`, `local-error`, `lock-contended` and the crash
path included — *a history that recorded only successes would make a Source
failing every hour look **idle** rather than **broken***. `tests/
test_runhistory.py` walks the AST of `sync.py` and `cli.py` so a fourth
record-writing path cannot be added without one.

| decision | why |
|---|---|
| `open(…, "a")`, one `write()`, one line | `O_APPEND` makes each `write(2)` land at the end of file, so two overlapping runs interleave at line boundaries, never inside one. Nothing is ever rewritten — a rewrite loses an earlier launch to any crash mid-write |
| **rotate by SIZE, one generation** — 32 MiB → `runs.jsonl.1`, ceiling 64 MiB | ~3 KB/line × 8,800 runs/year ≈ 26 MB/year: small, but not bounded. Size is the only bound answerable from `os.stat`; an age or count bound must read the file it is about to append to, which is a read-modify-write in all but name |
| ⭐ rotation **never deletes the newest** | it renames the *current* file aside and the new line starts the fresh one, so what is dropped is the generation *before* last — by construction older than a full 32 MiB. The floor on readable history is one whole generation |
| a failed rotation still appends | exceeding a housekeeping bound is a smaller fault than losing the record of a launch |
| the reader tolerates **absence** [NT-6] | it ships before the writer: no Source has a `runs.jsonl` until this deploys, and five will not for months |
| the reader tolerates a **truncated final line** | power loss mid-append is this file's ordinary end state. Earlier runs are returned, the bad line is *named*, nothing raises — and a final fragment is never parsed even if it happens to look like JSON, because the newline is written in the same `write()` |
| a failed append does **not** change the exit code | the exit code drives systemd's failure counter [MD-153]; a `runs.jsonl` this user cannot open (the `sudo sync` ownership wedge) must not turn every healthy hour into a strike. It is logged at ERROR and shows up as a gap in the query |

`simplefin-intake runs` is the query surface, and reads **nothing but that
file** — no raw tier, no cursor state, no Bridge:

```
run history: /data/fast/state/simplefin-intake/runs.jsonl
  32 run(s) recorded, 32 in the last 168h
  exit_class: ok=22 unreachable=10
  minute of the hour:
    :00  23 run(s)  ok=13 unreachable=10
    :34  9 run(s)  ok=9
```

⭐ That last block is [SF-31]'s table — the one that took an evening of
`journald` — as one command. ⚠️ Counts and classes only: no figure derived
from the financial data is printed here, ever [A4].

## `reconcile` — the count-vs-count check

⭐ **"Everything landed" is never inferred from the absence of errors.** It
walks the reconcilable span in disjoint capped windows, accumulates the
Bridge's own per-account counts, and asks the raw tier how many of *those
exact transactions* it holds. Four outcomes: `match`, `mismatch`, `unchecked`,
`closed` — each reported for every account, so the report says what was
**examined**, not only what failed [RT-6]. Exit 0 / 1 / 2 carry the same three
answers to a caller reading nothing else.

It **refuses rather than inventing**: no raw tier → exit 2, unreadable poll
cursor → exit 2, unset poll cursor → `incomplete`. `RawStore`'s constructor
would create the tier, so a typo'd `--raw-root` once built an empty one and
then reported every transaction as lost.

## Known limits — stated because a detector's blind spots belong with it

- ⚠️ **Heuristic truncation detection is inert at the deployed window
  width.** Both leading-gap rules require a window ≥20 days, and the tower is
  in the steady state (walk terminated, all sixteen accounts complete), where
  the window is ~5 days. That is deliberate — at 5 days the 0.25 threshold
  demanded a transaction older than 3.78 days in every hourly window, which an
  ordinary quiet weekend fails, and the resulting unconfirmed window froze the
  poll cursor. The live truncation signals are the Bridge's own range warning
  (ungated at any width) and `reconcile`.
- ⚠️ **The density rule cannot fire below 5 transactions in a window**, so a
  low-activity account truncated to its last few days is invisible — and
  `reconcile` does not cover for it, because it compares over the ids the
  Bridge named and a truncated institution names the same shape on both sides.
  The holes line up. The principled hardening is a density prior from the raw
  archive rather than from the window.
- ⚠️ **`reconcile`'s span clamp bounds by transaction date; the race is about
  publication time.** A swipe published to SimpleFIN after the last confirmed
  poll is inside the span, named by the Bridge, absent from raw, and reports
  `MISMATCH`. Check the missing ids' `transacted_at` against the trailing
  5 days before calling an exit 1 data loss [SF-21].
- ⚠️ **A persistent per-account data-shape failure freezes the poll cursor**
  — correctly: a window whose reads failed is not confirmed coverage. It is
  loud (exit 1 hourly) and it captures every window, because the gap walk's
  *position* is persisted separately from the cursor, so a bounded per-run
  request count still reaches `now` across runs. ⚠️ Bounding the loop alone
  did **not** have that property: four windows reach 155 days from a frozen
  anchor, and past that the newest windows were never requested at all. The
  Bridge-`errors[]` variant of the same freeze exits **0**, so nothing pages —
  read `warnings[]` in `last-run.json`.
- ⚠️ **A backfill pass cannot terminate while any institution is erroring**,
  and the hourly incremental poll does not run while a pass is outstanding.
  Check `status` before arming one.
- ⚠️ **Reading the poll cursor creates `-shm`/`-wal` sidecars** (SQLite WAL),
  so `reconcile` needs a writable state directory and must run as the timer's
  user. When it cannot, it exits 2 with the path — never a false `MISMATCH`.
- `BACKFILL_FLOOR_SECONDS = 0` makes the floor branch unreachable in practice;
  the confirmed-empty window ends every real walk.
- Nothing prevents a hand-typed `sync` overlapping the timer's, which can
  produce a systemd failure strike caused by a human typing a command.

## What is reusable, and what is not

**Copy:** the exit classifier and its clause ordering; `runrecord`'s shape;
`bridge.store_access_url`/`load_access_url`'s `O_CREAT|0600` + `ModeError`
discipline; `_write_versioned` and its `[C1]` retry; the *pattern* of one
choke point for outbound requests; and the per-account `try` — ⚠️ **together
with `run_sync`'s re-assertion of the strike afterwards**, or you get exit 0
over known-lost data.

**Re-derive, do not copy:** every constant (`MAX_REQUEST_SPAN_SECONDS`,
`OVERLAP_SECONDS`, the truncation thresholds, `DEFAULT_RECONCILE_DAYS`); the
whole backfill state machine, which rests on [PF-53]; `roster_observed`, which
silently encodes "one response *is* the complete roster"; the global cursors;
and `reconcile`'s roster floor, which works only because `sync_balances`
writes a per-account heartbeat every poll.
