# messages-engine — architecture

State: `live`. Written against the shipped code, deployed on the tower at plan T11 (ai-lab `plans/2026-09-30-orbit-engine-build-plan.md`). The fixture figures were read on the Mac. The archive figures were read on the tower by the coordinator, on frozen copies of the live archive (ai-lab [TD-298], [TD-306]).

## Shape

One process, one run, four stages: read → normalize → derive → verbs. There is no model client and no network anywhere. `guard.py` installs an audit hook before any command runs, and it raises on any `socket.` event; E1's tripwire holds that no socket is attempted.

| stage | where | what it does |
|---|---|---|
| read | `inputs.py`, `partition.py`, `gate.py`, `freshness.py`, `spool.py` | Takes the registrar's run lock shared, with a capped wait. Then, through `raw_tier.snapshot` only, one read-only transaction per input database: the manifest, and the `imessage`, `addressbook` and `contacts-metadata` mirrors. The snapshot identity and the change gate come first. Then: the total partition of every populated class; the derivation inputs, by each table's declared policy; every tombstone; the payloads the decode cache lacks, fetched inside the snapshot; freshness from the archive. What later stages need is spooled to `<state-dir>/scratch/build-<pid>.db` on the state volume. The lock is dropped once every mirror transaction has closed. |
| normalize | `normalize/` | Each fetched payload is decoded once, after the snapshot closed: the mirror payload decoder; the typedstream decoder for `attributedBody`; the date, link and intent rules; the rich-link record. The result is cached by `row_sha` in one cache file per decoder identity (`cache/`). Three coverages are printed with their floors. A version that cannot be decoded is `undecodable` with its reason, counted, and never a failed build. |
| derive | `derive/` | Every `d_*` table, from the snapshot and the cache alone, with no clock, streamed into the new store (`store.Writer`). Every row is receipted. The derive's coverages, the chat-link tripwire, newest-row age per read mirror and the tombstone findings go to the run record's `findings[]`, never the store. The claims outbox `d_claim_outbox` is one of these tables. |
| swap and after | `store.py`, `changes.py`, `render.py` | Each step runs under the engine's own run lock. The atomic swap keeps `store.db.prev`. The `changes` diff of the two is written to `changes.db`. The render step, which holds no registrar lock, writes upright JPEG renditions of sealed images into `renditions/`, capped per run. |
| verbs | `verbs/`, `outbox.py`, `verify.py` | The store alone, never raw or a mirror; one JSON envelope per call, paged in SQL (`verbs.md`). |

## A run

- **Guards first.** An absent state mount exits 1 `local-error` and writes nothing [D-L](c). A dirty checkout of this repo or raw-tier is refused `local-error` before any read: the code identity is a commit only in a clean tree.
- **Three locks, always in this order:** the engine's own run lock on the state dir (`run.lock`), then the decode cache's, then the registrar's, held shared. None inverts. Any one held past its cap ends the run `lock-contended`, exit 0, and the next tick is the retry.
- **The registrar's lock** (`/data/fast/state/mac-agents/register.lock`) is jacob's, mode 0600. The build opens it read-only and never creates it, so the unit runs as `jacob`. The wait cap is `MIRROR_LOCK_WAIT_CAP_S` = 300 s, above the registrar's longest recorded filing, 278.5 s. `verify --registrar-lock` prints the two figures side by side, read from the rotated `runs.jsonl` beside that lock, and fails when the cap is not the greater (method §10.1 rule 1). A bare `verify` names no registrar and opens nothing under the live state mount: its line reads `UNREAD — no registrar given`. A filing that meets the shared hold exits `lock-contended` and is filed by the next one. That is by design, and every turned-away filing must be followed by a completed one (method §10.1 rule 4, §10.2).
- **The change gate** [D-G] writes `gate-reading.json` every tick. When the identity (less the instant) equals the last build's, the run records `ok` with `unchanged: true` and touches neither the store nor `build_id`.
- **Exit discipline** [D-L]:
  - `ok`, built or unchanged, exits 0;
  - `lock-contended` exits 0;
  - `local-error` and `data-error` exit 1 (a `data-error` is a populated class on neither side of the partition, or a record kind the derive has not seen; a table declared in the mirror and empty is on no side until it takes a row, which is when a gap first shows — why contacts-metadata's CloudKit namespace is out by prefix, [ai-lab TD-311]).

  A non-paging finding goes to `findings[]`, which the alerter does not read [D-M].
- **Memory does not grow with the archive's messages.** The read phase spools what it hands on and the derive streams. What still grows is raw-tier's read log during the read phase; after it, only what the build holds by design — the raw arm's manifest versions, every tombstone, the chat members' first-seen instants — never anything per message (`tests/unit/test_build_memory.py`). Every build prints one stderr line per phase: rows, seconds, resident and peak MiB.

## Deployed

- **Timer:** tower `messages-engine.timer`, **every ten minutes at :08 :18 :28 :38 :48 :58**, as Jacob ruled ([ai-lab TD-309]; [TD-49] B, fast capture being live). The tower's `messages-engine.service` is `Type=oneshot`, `User=jacob`, `RequiresMountsFor=/data/fast/state`, alerting through `OnSuccess=` and `OnFailure=`, with SQLite temp on the state volume and `MemoryMax=8G` (provisional until a week of recorded peaks).
- **The offset `:x8`** is the only one no other timer in the tower repo uses (every other last digit collides with a Source, an engine, the alerter, its watchdog or the registrar). Filings come at any minute with fast capture, so no minute is clear of the registrar; the capped wait is the guarantee (method §10.1–§10.2). The `:18` tick lands a minute after the registrar's `:17` backstop, whose longest recorded filing (278.5 s) ends inside the cap.
- **A long build absorbs the next tick.** A `Type=oneshot` unit still activating takes the next trigger, and the engine's own run lock turns away any second build of the state dir. The result is one tick lost, never two builds; `scripts/e14-observe.py` prints such a trigger `E14 ABSORBED` and judges the next one. This is ruled, not an accident: a cold build (542 s) or a warm one (329 s), plus the 300 s cap, can pass ten minutes. The per-table selective derive [D-B] is the planned efficiency step.
- **Stale:** two periods, **twenty minutes**, after the last run that ended `ok` [MP-7]. It is judged by every verb and by `status` from `config.TIMER_PERIOD_SECONDS`. That constant, the timer and the alerter stanza (`period_seconds = 600`) are one figure, and the tower's bootstrap refuses to install them unequal.
- **Reader latency is minutes.** The Mac ships about every five minutes and the registrar files each ship on arrival, so a message is in raw within minutes. This engine reads every ten. A message therefore reaches the store and the verbs up to ten minutes after it lands in raw, plus the registrar wait and the build; ten more when a long build absorbed a tick. Every verb's `meta.freshness` says how new the archive it read was.

## Costs (measured)

All on frozen copies of the whole live archive, under `MemoryMax=2G` (ai-lab [TD-298], [TD-306]):

| measure | when | result |
|---|---|---|
| cold build (re-decodes every payload: the first, and after any decoder, dependency or interpreter change) | at T5 | 337 s, 351 MiB peak RSS |
| cold build | at T9 | 542 s, a 514 MiB peak |
| warm build | at T9 | 329 s at 542 MiB, its `changes` phase 40.6 s |
| `status` from the build's diff | at T9 | 0.04 s at 23 MB |
| `verify --raw-root` (live E4) | at T9 | 19 s at 219 MiB, the registrar's lock held at most that long |
| the read phase | — | about 40 s cold, 20 s warm |

- **`status` and a moved store pair.** Where the pair moved since its build took the diff (a copy, a restore), `status` re-diffs it in memory, sorts included, writing no file. It does so **only while the two files together hold at most 64 MiB** (`config.STATUS_REDIFF_MAX_BYTES`). Above that it answers `changes: null` with `changes-unknown` naming both sizes. Before the bound, a copied live pair took 39 s at 1.2 GB; a synthetic 128.6 MB pair peaked at 165 MB (counts) and 280 MB (`--changes full`) in about 5 s.

## Receipts and rebuildability

- **Receipts.** Every row is receipted by the mirror arm `(source, mirror_path, tbl, pk, row_sha)`. A mirrored row has no `doc_id`, and none is minted. `d_attachment`'s sealed object is also receipted by the raw arm. `build_meta.receipts_resolved` counts every arm of the new store against the snapshot's own reads before the swap, and `verify --raw-root` re-resolves every arm against the live archive on `(tbl, pk, row_sha)`.
- **Rebuildability, qualified.** EVENT-derived tables are fully rebuildable from raw. STATE-derived claim history accumulates in the claim store and is not rebuildable. From the contact mirrors' switch to EVENT [ai-lab TD-48], contact history is in raw and rebuilds; only pre-switch history stays accumulated-only.
- **Tombstones.** A tombstone closes by its own frozen meaning [TD-49] A:
  - STATE and `retired` tombstones close at `last_seen`;
  - `removed`, iMessage's meaning, closes nothing and is served as *the origin no longer retains this*.

## Claims

The claims outbox is `d_claim_outbox`, derived in every build, so it falls inside `build_id`, the identical rebuild and `changes`. It holds `known_as` and `participates_in`, from mirror rows only, with raw identifiers as subjects. `claims-export --state-dir S` prints it read-only:
- first, a `batch` header carrying the code identity and the claim count;
- then one line per claim, in the claim store's field names, `action` being `assert`, `close` or `retract`.

kb-substrate's ingester takes it into `claims.db` [ai-lab TD-251]. That ingester is not built, so no claim from this engine is in the claim store yet. The engine holds no network code, no listener, no token and no claim-store code.
