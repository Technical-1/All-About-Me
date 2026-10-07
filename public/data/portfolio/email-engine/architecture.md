# email-engine — architecture

State: `live`. Written against the shipped code, deployed on the tower at T11. The fixture figures were read on the Mac; the archive figures on the tower. It is rewritten against the shipped code at deploy (plan T11).

## Shape

One process, one run, four stages — read → normalize → derive → verbs — and no model client and no network anywhere (`email_engine/guard.py` refuses every socket event).

| stage | where | what it does |
|---|---|---|
| read | `inputs.py`, `select.py`, `partition.py` | one read-only read transaction over the raw tier's manifest, through `raw_tier.snapshot` only; every version of the two mail sources; the version rule at both grains; the snapshot identity and the change gate; the total partition by class; the payloads the decode cache lacks, read through the reader and appended to a spool file in the state dir, never held |
| normalize | `normalize/` | each payload decoded once, one at a time from the spool, and cached by its full sha256 under the decoder identity; the declared charset read by `declared_charset` (a MIME type or a leaked `=3D` is UTF-8 mislabelled): the MIME walk (`mail.py`), the date finder (`date_rules.py`), the calendar-part reader (`invite_rules.py`), the link scan executing the pinned shape's rules (`link_rules.py`) |
| derive | `derive/` | every table, in full, into a fresh store file swapped in atomically; classification (`rules.py`), date resolution against each message's own sent date (`date_resolve.py`), address relations (`relations.py`) |
| verbs | `verbs/` | read verbs over the store, one JSON envelope, declared limits and `meta.freshness` on every one |

Beside the store the run writes `gate-reading.json` and `freshness.json` (every tick), `last-run.json` and `runs.jsonl` (the run record, before the report is printed).

## Build time — the fixture only

Read 2026-10-05T19:54Z on the Mac (Apple silicon, Python 3.12), three runs each, **with d_link in the build**:

| | time | what was built |
|---|---|---|
| cold (empty decode cache) | 0.45–0.49 s | 310 manifest rows read; 92 messages; 293 d_link rows; 208 d_invite_party rows |
| warm (full decode cache) | 0.22–0.24 s | the same; every payload a cache hit |

The decode cache for the fixture is 1.6 MB.

⚠️ **The fixture figures are not what the cadence rests on** — the archive's are below.

## Build time and memory — the whole archive, on the tower

Read 2026-10-06T13:11Z–14:07Z on the tower (Python 3.12.13), on a frozen copy of the manifest made with `raw-snapshot freeze --payloads live` (the manifest copied, every payload read in place from the live root; 102,059 manifest rows), three builds per code at one `--as-of` (`2026-10-06T13:11:51Z`): cold (empty decode cache), warm (the same cache), cold again (a second empty cache). The copy, state, store, cache and spool were in RAM-backed scratch, as the first measurement's were, so the write side is faster than the encrypted volume will be. Peak memory is `/usr/bin/time`'s maximum resident set; each read phase ran clear of the email Sources' timer ticks. Logs: `~/drill-logs/ee-mem-2026-10-06/` on the tower.

| code | cold | warm | cold again | build_id |
|---|---|---|---|---|
| memory work only (`ee29d7d`) | 6.53 GB, 539 s | 6.53 GB, 171 s | 6.53 GB | `72840e5828e59901…`, all three |
| this branch, with the charset rule (`c99bc43`) | 6.53 GB, 561 s | 6.53 GB, 175 s | 6.53 GB | `81df871f59b3527b…`, all three |

The charset rule moves the decoder identity, so every payload re-decodes once and the content moves: the ten `decode-failure` findings are gone and two coverages remain below their floors (`findings[]`: 2, was 13). The first measurement (2026-10-05, at `3ed6f54`, before the memory work) peaked at 14.2 GB cold and 9.3 GB warm; on a frozen copy of 2026-10-06T01:01:49Z the code before and after the memory work gave one `build_id` (`f4d0a7d19a542e81…`) cold, warm and cold again — the change moves no derived row.

**What bounds memory now** (a one-second RSS series of each build): the read phase and normalize stay near 0.3 GB, because the payloads the decode cache lacks go to a spool file in the state dir (5.67 GB for the whole archive) and are decoded one at a time; derive holds every derived table until the store is written (about 4.2 GB, the peak's main term); the change counts read the stores back one table at a time after the tables are released. So the peak no longer grows with the uncached archive; it grows with the derived content (rows, links, body text). `status --changes full` with a `store.db.prev` reads both stores whole (6.8 GB, measured 2026-10-06 on the earlier copy); the build never does that.

⚠️ **What these figures mean for the cadence.** A warm build still takes about three minutes; an idle tick costs nothing (the change gate skips it), and every tick in which mail arrived is a full warm build. A cold build — after any decoder or dependency change — is about nine minutes, and writes the uncached archive to the spool on the encrypted volume first.

## Deployed

`email-engine.timer` at :01 :13 :33 :47, each after a `google-source` tick's run window; `email-engine.service` runs `email-engine build` with every default (the raw root, the state dir, the decode cache beside the store), `RequiresMountsFor=/data/fast/state`, temp files and crash dumps on the state volume, `OnSuccess=`/`OnFailure=` to the alerter, which watches the run record with `period_seconds = 900`. The units and the stanza are `Technical-1/tower`'s. E14 is `scripts/e14-observe.py`.
