# google-source — qa

**150 tests · 19 mutants, 0 survivors, 0 vacuous** (2026-08-13).

## Fixtures are the MEASURED roster, not a convenient one

⚠️ **[RM-L]**: two blocking defects once hid behind 100-row fixtures while the
real median was 14 rows. ⭐ *A fixture chosen for readability silently selects
which bugs the suite can see.*

⭐ `conftest.SKEWED_ROSTER` is the real 2026-08-13 distribution: **two accounts
hold 76%, six are under 610 messages.** ⛔ Three equal accounts would test a
distribution that does not exist — and it was exactly the small-roster case that
found [GS-19].

## The tests that exist because something broke

| test | what it catches |
|---|---|
| `test_stops_at_the_header_block` | ⭐ a forwarded message quotes the ORIGINAL's `Message-Id` in its body — a whole-message scan gives this message another's identity, and it fires **only on forwarded mail** |
| `test_history_id_is_captured_before_the_walk` | ⛔ capture it after and every message arriving during a multi-hour backfill is **skipped forever**, with no error |
| `test_a_plain_sync_refuses_to_backfill` | ⛔⛔ [GS-14] — four documents said hand-run and the code did it anyway |
| `test_total_failure_of_a_single_account_run_is_a_fault` | ⭐ the floor meant *"a few of many is weather"*, not *"all of few is fine"* |
| `test_removing_packages_breaks_the_wheel` | ⭐ [SF-11], **with the `config/` directory present** — without it the guard passes for the wrong reason |
| `test_a_cursor_is_never_stored_without_a_timestamp` | ⚠️ `now=None` stored NULL; status went blind while reporting `ok` |
| `test_rate_limit_403_is_retried_not_an_auth_error` | ⛔ Google overloads 403 — misreading it sends a person to re-consent ten accounts for a one-second problem |

## Running

```bash
.venv/bin/python -m pytest -q          # ⚠️ run it on the TOWER too [SF-28]
```

⚠️ **The packaging tests passed on the Mac and failed on the tower.** [SF-28]:
test across the process boundary the unit actually has — and the tower is the
only machine that runs this Source.

## Verifying the mutation sweep

⭐ [MA-19]: *a RED result is not evidence of a kill.* Re-check by naming the
failing test — ⚠️ **and strip ANSI escapes first**, or the checker reports zero
failures for every mutant and looks like the sweep is broken [GS-18].
