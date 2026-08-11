# source-alerter — architecture

State: `running` — created 2026-08-10 from
`ai-lab/docs/superpowers/plans/2026-08-10-source-alerter.md`; **event-driven
since 2026-08-11 [NT-9]**. See `CLAUDE.md`.

## What problem this solves

Every Source in the program polls an origin hourly under a `Type=oneshot`
systemd timer and writes bytes into an append-only raw tier. Each writes a run
record at `/data/fast/state/<source>/last-run.json` [NT-1].

⭐ **The load-bearing fact:** the Sources' exit discipline [MD-153] makes every
*origin* failure exit **0** on purpose — unreachable, auth revoked, origin 5xx,
429 — so that systemd never counts a bad network hour as a service failure.

> ⚠️ **A consequence people get wrong:** `OnFailure=` therefore **never fires**
> for a revoked credential. The obvious implementation of "tell me when my bank
> connection breaks" is silently a no-op. This component reads the **run
> record**, not the exit code.

Observed live: 2026-08-10 16:00:58Z, a real transport failure — correctly
classified, exit 0, **and nobody was told** [SF-17].

## ⭐⭐ [NT-9] The trigger is the mirror image of that same quirk

Polling faster was the wrong answer: one check costs 30 ms / 21 MB, so cost was
never the constraint — **the alerter can only see what the Source recorded, and
Sources run hourly.** The Source is the sampling bottleneck.

⭐ **`OnFailure=` is useless here because every origin failure exits 0. That is
exactly what makes `OnSuccess=` carry them.** Both go on every Source unit, in
`tower`, and between them they cover exit 0, exit 1 (`data-error`) and exit 3
(`local-error`). **Detection ~20 min → ~1 s**, and [NT-8]'s overwrite window
closes for free: observing every run as it completes leaves no gap for a fault
to appear and be replaced unseen.

✅ **Verified on the tower, not assumed:** four rapid triggers produced **one**
run — systemd merges pending start jobs for a unit — so six Sources finishing
together cannot race on the state file, with no locking work at all.

⚠️ **The timer survives with a narrowed job (15 minutes):** ⭐ **a Source that
does not run triggers nothing.** Absence cannot announce itself, so staleness
needs a clock that is independent of every Source.

⭐ **And `--check` verifies the wiring itself**, per Source, from the unit
files. A unit missing those lines is *silently* un-triggered — the same shape
as a repo missing from `sync-repos.sh`, a registration step that is invisible
when skipped. See `wiring.py`; the parsing rules (append, space-separated
lists, the empty-assignment **reset**, comments, section scoping, drop-ins) are
each pinned by a test, because a naive grep gets three of them wrong.

## Package layout

```
source_alerter/
  state.py     the registry (which Sources, what period) + a tolerant record read
  detect.py    run records + a clock -> findings (source, condition, class)
  store.py     transition state: what has already been alerted, across runs
  send.py      the transports — the ONLY module that knows ntfy exists
  wiring.py    ⭐ [NT-9] does each Source's unit actually trigger this one?
  __main__.py  the CLI both systemd units run
config/source-alerter.example.toml    the shape; the DEPLOYED copy lives in `tower`
```

## ⭐ Non-`ok` splits three ways [NT-6]

One `exit_class != "ok"` test conflated outcomes that need opposite responses:

| the class is... | condition | what the reader should do |
|---|---|---|
| in `FAULT_EXIT_CLASSES` | `failed` | go look at the Source or its origin |
| in `BENIGN_EXIT_CLASSES` | `benign` | ⭐ nothing. It is the lock working — **not alertable, and not invisible** |
| in neither | `unknown-class` | ⭐⭐ **update the watcher.** The Source is probably fine |

⚠️ `local-error` (the tower is sick — full disk, unwritable state) is a
**fault**; `lock-contended` (a run refused because another holds the lock) is
**benign**. Getting those two the right way round is the whole point.

⭐ The unknown-class alert is the only rule here that catches a change **nobody
remembered to coordinate** — the others depend on someone doing the right
thing; this one fires by itself.

## ⭐⭐ [C1] Narrowing governs the message, never the identity

The dedupe store keys a fault on `source/condition` and re-alerts when the
stored **class** changes. So any narrowing that maps two different
observations onto one label collapses their identity, and the second —
genuinely different — fault reaches a store that already has that identity
open and is **silently dropped**.

> ⚠️ **The spurious alert spends the alert the real fault needed.** A refused
> run at 15:00 followed by a full disk at 16:00 used to produce one useless
> buzz and then nothing at all.

An unrecognised class therefore carries its own value forward: the class name
when it is class-*shaped*, and `unprintable-<8 hex digest>` when it is not —
distinct per value, stable across runs, and readable as neither a balance nor
a name. A digest rather than the raw string because that value is the one
thing here that is not vocabulary, and it must reach neither a lock screen nor
the alerter's own state file.

## Five alertable conditions, not three

The plan names three; the other two are what its "Not done if" clauses require,
and both are invisible to any check that begins by opening a file.

| Condition | Fires when | Why it is separate |
|---|---|---|
| `failed` | `exit_class != "ok"` | the loud case, and the one systemd can never see |
| `partially-blind` | an otherwise-OK run carries `errors[]` **or** `warnings[]` | ⛔ **the dangerous one** — everything green, one account silently absent |
| `stale` | nothing completed in `period × 3` | ⚠️ **a dead Source writes nothing at all**, so the two above can never fire for it |
| `missing` | there is no run record at all | ⭐ a Source that has **never** run is exactly the thing to report |
| `unreadable` | the record cannot be interpreted | a truncated or older-version record is a condition — never a traceback, never "fine" |

⭐ **`partially-blind` watches `errors[]` as well as `warnings[]`**, though the
plan's §3 says only `warnings[]`. The incident that caused this component to be
asked for — *"Connection to Credit First National Association may need
attention. Auth required"* — arrives in the record's **`errors[]`**, on a run
that exits 0 and need carry no warning at all [SF-3]. Watching `warnings[]`
alone would have missed the motivating event.

⭐ **`stale` is why this runs on its own timer**, independent of every Source.
*A checker that only runs when the thing it checks runs cannot report that the
thing stopped running.*

⭐ **Staleness takes the OLDER of `finished_at` and the file's mtime.** The
record is the Source's own statement; the mtime is the filesystem's, and no
Source can misreport it — so a frozen file is caught even while it still claims
a fresh finish. Normally `finished_at ≤ mtime` and the two agree.

## The registry is explicit, never discovered

⚠️ A listing of `state/*/last-run.json` would make the most important condition
undetectable: a Source whose timer was never installed has no directory and no
file. **You cannot see the absence of something you learned about by looking at
what is present.** The registry is what *ought* to be running; the disk is what
*is*. A config that lists no Sources is refused rather than accepted as
"nothing to watch".

## ⭐⭐ [NT-7] Thresholds are per-class, because the classes fail differently

Alerting on the first non-`ok` contradicted the program's own doctrine —
[MD-153] says *"a missed hour is normal, not a failure."* The balances
endpoint timed out twice in eight hours, both transient, both self-healed: at
one alert plus one recovery each, **four buzzes for two non-events.**

| Threshold | Classes | Why |
|---|---|---|
| **1st occurrence** | `auth-error` · `local-error` · `data-error` · `partially-blind` · `missing` · `unknown-class` | ⛔ none of them self-heals — a revoked credential stays revoked, a full disk does not empty itself, and every hour unknown is data lost |
| ⭐ **3 consecutive runs** | `unreachable` · `origin-error` | ✅ usually transient. **Three hours of not reaching your bank is a problem; one is Tuesday** |
| unchanged | `stale` | already `period × 3`, in the unit it belongs in — elapsed time, not run count |

⚠️ A class that never reached its threshold sends **no recovery**: you cannot
recover from something the reader was never told about.

### ⭐⭐ Trap ①: count distinct RUNS, never observations

The alerter fires at `:20`, the Source at `:00`. ⚠️ **If the Source stops
entirely, the alerter re-reads the SAME record every hour** — counting
observations would manufacture three "consecutive failures" out of one, and
would do it *precisely when the true condition is `stale`, not `unreachable`*.
It would name the wrong fault and send someone to check an origin that was
never asked anything.

So the counter is keyed on the run's own identity (`started_at` +
`finished_at`), and a Source whose record has not changed advances **nothing**
— not the threshold, not the weekly tally.

### ⚠️ Trap ②: a consecutive counter cannot see FLAPPING — bounded, not solved

`unreachable, ok, unreachable, ok…` never reaches three, so **an origin that
is half-down forever is silent.** The counter resets on every success.

> ⭐ This is [NT-5]'s mistake in a new place: **a threshold is only safe if
> something else sees what it discards.**

⚠️ **Not solved. Bounded** — the weekly heartbeat carries a per-class run
count, so a flapping origin surfaces as *"14 unreachable runs this week"*
rather than as nothing at all. Measured, not assumed: a test replays seven
days of flapping, asserts that **no alert ever fires**, and asserts the tally
reads 7.

## Transitions, not states

⚠️ An alerter that fires on a *state* sends the same alert every hour until the
fault clears, and the reader mutes it. This fires on **transitions**: a fault
lasting 40 hours is **one** alert, and **recovery is also an alert** — an alert
you never see the end of trains you to ignore the start of it.

That is what `store.py` is for, and its state must survive between runs — this
is `Type=oneshot`, so **every run is a fresh process** [SF-28].

The fault identity is `source/condition` and the stored value is the **class**,
so `unreachable` becoming `auth-error` alerts again: the second needs a
different action from the first. A state file that cannot be read is rebuilt
empty, which re-alerts once rather than going quiet — the safe direction.

## ⭐ When the dedupe state advances, and what that costs

With N transports there are three moments to commit "already alerted", and
none of them is free:

| when | cost |
|---|---|
| before delivering | ⛔ **the alert is lost forever** if the POST fails — the alerter believes it spoke |
| when **every** transport succeeded | one permanently-broken transport makes every *working* one re-alert hourly. ⚠️ Exactly how an alerter gets muted |
| ⭐ **when at least one succeeded** — chosen | the event is **never re-attempted on the transport that missed it**; that channel has a permanent hole for that one alert |

⭐ **Chosen: at least one.** The purpose is *Jacob is told*, and one delivered
notification satisfies it — the redundancy exists so a transport being *down*
does not cost the alert, not to guarantee N copies. ⚠️ You learn that a
transport is down from the unit going red and from the weekly heartbeat failing
on it, **not** from the missing alert. If **no** transport delivered, nothing is
committed and the next hour retries the whole thing.

## Transports are plural [NT-3]

`ntfy` is **permanent**, as the **backup** channel; the iPhone PWA becomes the
primary mobile surface later. So the sender takes a **list** of transports and
delivers to each **independently** — ⚠️ **one failing transport must never
suppress another.**

> ⭐ **Why ntfy specifically survives:** it is the dumbest, most independent path
> available — one outbound POST to a third-party server, depending on **none of
> this program's own code.** ⚠️ **An alerting channel built on your own stack
> fails exactly when your stack fails.** If the thing that broke is the program,
> the alert about it must not travel through the program.

**Nothing above the transport layer** may carry a topic, URL, priority or tag.
*Self-check: could you add a second transport without touching `detect.py`,
`store.py`, or any of their tests?*

## The alert carries no data

Source name and failure class. Never a balance, transaction, account id,
address or name.

Two reasons, both sufficient: a push notification renders as a **lock-screen
preview on a device in public**; and on the public `ntfy.sh` server **the topic
name is the password**, so anyone who learns it can read the feed.

## What lives where

| Repo | What |
|---|---|
| **here** | the package, its tests, `pyproject.toml`, `.portfolio/` |
| **`tower`** | ⭐ **the systemd units only** — this component's two, plus the [NT-9] `OnSuccess=`/`OnFailure=` lines on every Source's unit — installed by `bootstrap.sh` [PL-1/SF-12] |

The same split as `simplefin-intake`: **the unit belongs to the machine, the
code belongs to its own repo.**

## Known limits — stated, not solved

- ⛔ **A tower with no network cannot ntfy — and that is itself worth alerting
  on.** The Mac-native half covers this blind spot and is not built yet.
- ⭐ **Nothing watches the watcher.** If this timer dies, silence looks exactly
  like health. Mitigated by a weekly `all clear` heartbeat so silence becomes
  informative — ⚠️ a *mitigation*, not a solution.
- ⚠️ **[NT-9] nothing PUSHES the wiring state.** `--check` says NOT WIRED
  loudly, but only when somebody runs it (`bootstrap.sh` does, at install
  time). An un-wired Source is therefore found by looking — better than the
  invisibility it replaced, not the same as solved.
- ⚠️ **The wiring check reads disk, not systemd's loaded state.** A unit edited
  without `daemon-reload` reads as wired while the running system has the old
  one. `bootstrap.sh` reloads right after it copies, so the window is a deploy
  rather than a steady state. ⭐ **Deliberate:** asking `systemctl` would make
  the check untestable without an init system and couple a pure reader to
  PID 1.
