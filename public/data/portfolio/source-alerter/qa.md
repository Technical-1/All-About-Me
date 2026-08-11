# source-alerter — QA

**State: `running`.** All five tasks done, plus [NT-9]. **368 tests, all green;
125 mutations run against them, 0 survivors** — ⚠️ **and that "0 survivors" was
itself false once**; see below.

⭐ **Task 5 is closed by evidence a suite cannot produce: a phone buzzed.**
2026-08-10, on the tower, against a scratch tree (never the live run record):
onset → **one** notification · re-run → **silence** · recovery → **one**
notification · re-run → silence. Jacob confirmed receiving both.

⭐ **And the leak test held in the wild, not just in CI:** the scratch record
carried `"account_ids": ["ACT-SECRET-123"]` and a transaction count. The
notification said **`demo-source` / `run failed: auth-error`** and nothing else.

| File | Tests | Pins |
|---|---:|---|
| `test_detect.py` | 74 | the five conditions from real record shapes, including the [SF-17] one; the closed vocabulary; that a `Finding` has exactly three fields; that nothing but `last-run.json` is opened and nothing is written |
| `test_state.py` | 33 | the registry's refusals (no sources, no transports, a bad period); the opaque transport table; every timestamp shape six Sources might write |
| `test_store.py` | 85 | ⭐ transitions across the process boundary — a fresh store per run, a moving clock, and once across real subprocesses; the commit point; the advisory lock |
| `test_send.py` | 122 | the request shape; the message table; the credential's refusals and its redaction; plural transports delivered independently; ⭐ the stuffed-record leak test, end to end |
| `test_wiring.py` | 51 | ⭐ [NT-9] every systemd list shape (append, space-separated, the empty-assignment **reset**, continuations, comments, section scoping, drop-in order); missing/unreadable units as findings; that NOT WIRED does **not** move the exit code |
| `test_package_build.py` | 3 | that a real wheel contains the package, declares the console script, and requires nothing [SF-11] |

## Three false measurements the mutation run caught

Two were tests that passed against a **broken** implementation:

- ⭐ `match="empty"` on a `pytest.raises` — satisfied by `tmp_path`, which
  contains the test's own name (`..._refused0/`), quoted back inside the error
  message. **The assertion was matching the fixture, not the behaviour.**
- ⭐ The topic-redaction test used an `HTTPError`, whose message never carried
  the topic in the first place. Redaction was never exercised. `URLError.reason`
  is the one that does carry the URL.

The third was in the mutation harness itself, and is the worst of the three:

- ⭐ **A sweep reported 0 survivors while running MUTATED bytecode.** Python
  invalidates a `.pyc` by `(mtime, size)`, both at **one-second granularity**. A
  mutation that swaps two lines changes neither, and the harness restores the
  file within the same second — so the interpreter kept executing the mutated
  compile against the restored source, and every later result in the sweep was
  measuring something other than the tree. ⚠️ **The first honest run, with the
  caches dropped around every step, found two survivors the "clean" run had
  reported as killed.**

⚠️ None of the three was visible by reading anything. All three took running
the mutation and then distrusting the green.

## ⭐ Two more vacuous tests the [NT-7] round caught

Both **passed against a broken implementation**, and neither was visible by
reading it:

- `test_conditions_without_a_run_cannot_be_thresholded` looped over a set —
  so **emptying the set passed the test**. It now asserts the set's contents
  first. ⚠️ Any test shaped `for x in COLLECTION: assert ...` is vacuous when
  the collection is empty, and emptying it is exactly how a guard gets removed
  by someone who thinks it is unused.
- `test_the_cli_heartbeat_never_consumes_a_pending_threshold` asserted the
  pending counters were empty after running only heartbeats — against a store
  that had never counted anything. It now counts first, and drives the
  ordering that actually happens: **a heartbeat between two runs, with the
  Source having run in between.** That is the only ordering in which the bug
  is observable, and the original test missed it.

## ⭐⭐ Three more the [NT-9] round caught — and one had gone silent in the tree

26 mutations were run against the new code. **Three came back wrong on the
first pass**, and none of the three was visible by reading anything:

- ⭐⭐ **A guard that had stopped being a check.**
  `test_detect_opens_no_source_state_beyond_the_run_record` spied on
  `builtins.open` — and on **Python 3.14 `Path.read_text` no longer routes
  through it**, so `opened` was `[]` and `all(...)` over an empty list passed
  against *any* implementation. ⚠️ **The interpreter moved and the test went
  quiet without going red.** It now spies on `Path.read_text` and asserts the
  spy caught something *before* asserting what it caught. Verified by mutating
  `detect` to read a second file per Source: silent before, killed now.
- ⭐ **A test that passed for the wrong reason.**
  `test_a_commented_out_directive_is_not_wiring` passed even with comment
  handling deleted, because `# OnSuccess` simply is not the key `OnSuccess`.
  Comment stripping is only load-bearing **inside a continuation**, so that is
  now the case the suite pins.
- ⭐ **A fixture that hid the bug it was written for.**
  `test_a_dropin_without_a_section_header_assigns_nothing` used a main unit
  ending in `[Service]`, so an implementation that concatenates every file and
  leaks the section across them still passed — the leaked section happened to
  be the wrong one anyway. The main unit now **ends inside `[Unit]`**, which is
  the only shape in which the defect is observable.

⚠️ Each of these was a **green result that had stopped corresponding to a
check** — the same class as the stale-bytecode sweep above, and the reason the
sweep is re-run rather than trusted.

## ⭐ What the [NT-6] / [C1] round added

| Guard | Why a test must pin it |
|---|---|
| **The declared vocabulary** | `test_the_declared_vocabulary_matches_the_sources_own` holds a hand-written copy of `simplefin-intake`'s classes. When a Source gains one and nobody updates the watcher, the first thing that happens is a **failing test**, not a phone buzz at 3am — [PE-9] applied to a vocabulary instead of a behaviour |
| ⭐⭐ **Fault identity across the seam** | the two-hour sequence — a refused run, then a sick tower — driven through `detect` -> `alertable` -> a **fresh store per run with a moving clock**. Before the fix hour 2 was silent: *the spurious alert spent the alert the real fault needed* |
| **Two unreadable classes are two faults** | the residue a bare `unprintable` label would have left. Narrowing may govern the message; it must never govern identity |
| **The same unreadable class is one fault** | the other half — an unstable identity trades a missed alert for a muted phone |
| ⛔ **Nothing raises** | a crash here means every Source silently goes unwatched, and silence is what a *healthy* alerter produces. 15 record shapes and 8 damaged files through all four CLI modes, plus a fresh-interpreter import of every module by name |

⚠️ The last one is not hypothetical: an earlier draft raised `NameError: name
're' is not defined` at import. Verified by deleting the import again — the
suite fails at collection with that exact error.

## What a test must prove here

This component's failure mode is **silence that looks like health**, so the
suite is aimed at the ways it could go quiet.

| Property | Why a test must pin it |
|---|---|
| **A dead Source is reported** | ⚠️ a Source that stopped writing produces **no** record to inspect — **absence is the signal**, and a detector that iterates only over existing records will never fire |
| **A Source that never ran is reported** | same trap one step earlier: no file at all is not "fine" |
| **A malformed record is a condition, not a crash** | other Sources are unbuilt and will add keys; a crash here is silence |
| **A fault alerts once** | an alerter that repeats every hour gets muted, and a muted alerter is worse than none |
| **Recovery alerts** | an alert you never see the end of trains you to ignore the start |
| ⭐ **No data leaks** | feed a record stuffed with balances, account ids and transaction descriptions; assert **none** appear in the request body |
| **One failing transport does not suppress another** | [NT-3] — transports are plural |

## ⭐ [SF-28] Test at the process boundary this actually has

This is `Type=oneshot`: **every real run is a fresh process, a fresh store, and
a moved clock.**

> ⚠️ Any test of *"did it remember it already alerted?"* **constructs and closes
> the store inside the loop** and advances the clock. A test that shares one
> store object across simulated runs **cannot see whether state was committed** —
> a shared connection never finalizes, so a missing `commit()` costs nothing in
> tests and discards everything in production.

That exact blind spot let **two data-loss mutations pass all 167 tests** on
`simplefin-intake`. It was found by simulation, not by review.

## [PE-9] The suite is a specification

Every test must **fail against a mutated implementation**, and the mutation must
have been **run** — not asserted. On the previous component, **seven times a
green result had stopped corresponding to a check**, including a mutation sweep
that reported anchors as *"not applied"*, which prints green while proving
nothing. ⭐ **A mutation reported as "not applied" is a missing measurement, not
a pass.**
