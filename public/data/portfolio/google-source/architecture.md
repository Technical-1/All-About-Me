# google-source — architecture

**State: `building` → live 2026-08-13.** Source #4, and the first to carry five
data types.

## What it is

⭐ A **Source** [A1]: acquisition only. It fetches Google's bytes and writes them
through `raw_tier`'s frozen contract. ⛔ **It computes nothing, normalizes
nothing, and calls no model, ever** [A3/A5]. Turning any of it into text,
claims or findings belongs to `email-engine`, `calendar-engine` and
`files-engine` — none of which exists yet.

| data type | what lands | doc_id [RT-11] |
|---|---|---|
| **Gmail** | ⭐ **two objects**: the `.eml` at `format=RAW` and a `.meta.json` envelope | RFC Message-ID · `<id>:meta` |
| **Calendar** | the event resource verbatim, series not instances | `iCalUID` |
| **Drive** | metadata always · export + comments for native types · bytes for the rest | `fileId` · `:export` · `:comments` · `:content` |
| **Tasks** | every task and its list | `<listId>:<taskId>` |
| **Meet** | ⭐ nothing of its own — Meet artifacts are Drive files [GS-3] | (via Drive) |

## Measured, 2026-08-13

**Ten accounts** — ⚠️ not eight, which is what [GS-6] documented, and not
because a document said ten: **the token directory said ten.**

| | |
|---|---|
| messages | **40,623** |
| threads | 37,443 |
| calendars | 18 |
| tasks | 108 |
| ⭐ distribution | `jacobrk2001` **49%** · `jacobkanfer` **27%** · `jacobkanfer8` 12% — **three accounts hold 88%** |
| incremental run | **34.1 s**, all ten accounts, all four types |

## The five decisions that differ from the plan

⭐ Each was changed because measurement or a live run contradicted the plan,
and each is recorded in `CORRECTIONS.md`.

### 1. ⭐ Accounts are DISCOVERED, never listed

The plan made `accounts.json` the registry. ⛔ A hand-maintained list fails
**silently in the direction that loses data**: consent an account, forget the
file, and it is never synced with nothing to say so.

⚠️ **Not hypothetical.** The tower held ten token files while the plan said
eight and the build order said ten — ⭐ *three documents, two wrong,* and only
`ls` was right. `accounts.json` survives as an **override that can disable but
never add**, so it cannot omit.

⭐ Same lesson as [SS-15]/[MA-2]: *containers are discovered from staging, never
named in code.*

### 2. ⭐ Every path is content-addressed

⛔ [C1] refuses to reuse a `copy` path for different bytes, and **four of five
data types mutate** — `labelIds` on every archive or star, calendar events on
every edit, Drive metadata on every rename, tasks on every status change. Only
the `.eml` never changes. ⭐ One rule that cannot fail, rather than a scheme per
type.

### 3. ⭐⭐ `historyId` is captured BEFORE the backfill, stored AFTER

⚠️ A 19,979-message account takes hours. Mail arriving *during* those hours
carries a **higher** `historyId` than the last page saw — ⛔ capture the cursor
at the end and every mid-backfill message is **skipped forever**, with no error
and no gap. ⭐ Capturing first means the overlap is re-walked and deduped.

### 4. ⭐⭐ The timer is STRUCTURALLY unable to backfill

⛔ **Caught live**: a plain `sync` fell through to the backfill whenever a cursor
was missing, and started an unbounded ten-account walk that held the **shared**
`manifest.db` [SF-24] for as long as it ran.

> ⭐⭐ **Jacob decided the backfill is hand-run. That decision lived in a comment
> and a unit file, and neither is enforcement — the code has to refuse.**

⭐ `--backfill` is the only door. An account without one is counted as
`awaiting_backfill`, **printed but never faulted** — a pair waiting during
rollout is an expected state, and alerting on it is the cry-wolf class again.

### 5. ⭐ The partial-failure rule is NOT `github-connector`'s

| failure | rule | why |
|---|---|---|
| ⭐ **auth** | ⛔ **any one is a fault** | a revoked grant NEVER self-heals; the account just goes quiet, which [MA-9] says is indistinguishable from *nothing new* |
| transport | fraction **and** floor, both | a dropped connection is weather; the next hour resumes from the cursor |
| ⭐ **total** | ⛔ **always a fault** | `--account X` makes the roster ONE, and *"a few of many is weather"* never meant *"all of few is fine"* |

⚠️ 167 repos and 10 accounts are different populations. Borrowing that Source's
floor of 3 would let **30% of this corpus fail silently.**

## Layout

```
google_source/
  auth.py         # token load + refresh. ⛔ NEVER interactive — consent is [SE-9]'s ssh -L flow
  accounts.py     # ⭐ discovery from tokens/, overrides from accounts.json
  cursors.py      # per (account, datatype, scope) — the backfill/incremental seam
  client.py       # ⭐ resolves Google's OVERLOADED 403: rate limit vs real auth failure
  raw.py          # identity + content-addressed paths
  fetch_gmail.py  fetch_gcal.py  fetch_drive.py  fetch_gtasks.py
  fetch_common.py # canonical JSON (sort_keys is load-bearing — it is hashed)
  sync.py         # exit discipline, per-account isolation, classification
  runrecord.py    # last-run.json + rotated runs.jsonl
  cli.py          # sync · status · accounts
```

## Operations

```bash
google-source sync                                    # what the timer runs
google-source sync --backfill --account <addr> --type gmail   # ⭐ BY HAND
google-source status                                  # cursor state + AGE
```

⭐ **Read the run record, never the exit code** — [MD-153] deliberately empties
the exit-code channel:

```bash
python3 -m json.tool /data/fast/state/google-source/last-run.json
```
