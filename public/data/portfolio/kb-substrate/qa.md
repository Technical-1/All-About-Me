# kb-substrate — qa

State: `building`. ⚠️ This file read *"No tests yet"* until 2026-08-16, against a
suite that had been green and merged for a day.

```bash
.venv/bin/python -m pytest
```

⛔⛔ **Use the venv.** System `python3` reports a smaller number because one
module-level skip hides ten tests — absence and skip reading alike is the exact
bug class this repo cares about.

⛔ **The suite size is deliberately not stated here.** It read 78, then 102, then
113 within three days, each stale inside the session that measured it. ⭐ *A
figure that changes whenever someone does the work belongs in a command, not a
document* [RA-42/RA-76].

## What the suite is for

⭐ **A contract test is a SPECIFICATION** — editing one is an amendment, a
checkpoint decision, never a fix [PE-9].

Every task carries **`Done when`** (machine-checkable) and **`Not done if`** (how
the check passes wrongly). The second is the load-bearing one:

- **[GS-16]** a guard tested without its threat present passes for the wrong
  reason. Several tests here exist only as the healthy-path control — e.g.
  `test_a_MULTI_pass_row_still_closes_normally` and
  `test_a_SUPERSEDED_parent_version_does_NOT_poison_its_children`, which fails
  if the poison seed is too eager.
- **[GS-23]** ask of every check: *what does this print on a perfectly healthy
  machine?*

## Defects this suite found that three readings did not

- ⭐⭐ **The amended schema accepted ZERO rows.** `CREATE TABLE` succeeded the
  whole time — SQLite resolves FK parents lazily — so the DDL ran clean and only
  an `INSERT` revealed that three FKs referenced a column that was no longer a
  PK. **Three document reviews called the schema correct; one execution found
  it.** `test_every_foreign_key_actually_resolves` exists so it cannot recur.
- ⭐ **`retract()`'s first draft used the tombstone's `tombstoned_at`**, which is
  earlier than `recorded_at` whenever the engine ran after the sweep. The
  docstring asserting otherwise had been written a minute earlier; the test
  caught it, a reading would not have.
- ⭐ **A test that hand-rolled a retraction in raw SQL** had been passing no
  matter what `retract()` did. [RA-69]'s new `CHECK` failed it immediately.
- ⚠️ **`test_the_refusal_is_not_a_sqlite_error` also passed if the call silently
  SUCCEEDED** — it only ever asserted *"not an IntegrityError"*. A silent
  success is the same leak wearing a quieter failure mode.

## Liveness, not just unit tests

`scripts/tombstone_obligation_liveness.py` runs the real obligation against the
tower's live mirror. ⭐ **It exits 77 rather than 0 when there is nothing to
verify** — a pass and an empty run must not look alike.

⛔ **Still unexercised: the EVENT branch.** 22 EVENT tables, 0 EVENT tombstones.
*"An event tombstone closes nothing"* holds **by absence, not by a guard
firing** — synthetic cover only.
