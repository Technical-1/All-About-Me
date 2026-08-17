# kb-substrate — stack

State: `building`. ⚠️ This file read *"No stack yet"* until 2026-08-16.

**Python** [A9], stdlib-first. The claim store's entire storage layer is
`sqlite3` from the standard library — no ORM, no migration framework.

| piece | choice | why |
|---|---|---|
| storage | **SQLite**, WAL | one file, no server, and the whole program is single-machine |
| schema | one `schema.sql`, applied whole | the reasoning lives inline as comments, next to the constraint it explains |
| migrations | ⛔ **none yet, and `connect()` refuses rather than guesses** | it runs against the only store that cannot be rebuilt, so the first one gets its own plan |
| vectors | `sqlite-vector` (KB half) | see `benchmarks/scorecard-vector-store.md` |
| tests | `pytest` | run via `.venv/bin/python -m pytest` |

## Why no ORM

Every temporal predicate in this store is a range condition on two axes, and the
indexes exist to serve exactly those shapes (`idx_claim_asof`,
`idx_claim_astold`). ⭐ An ORM would hide the one thing that has to stay
visible — **which of `valid_*` and `recorded_*` a query is filtering on** — and
that confusion is the source of every serious bug this store has had.

## The SQLite behaviours this schema is built around

- ⛔ **SQLite cannot `ALTER` a `CHECK` constraint.** Changing one means rebuilding
  the table — over the one dataset that cannot be regenerated. So value
  *vocabularies* are enforced in Python, and only structural invariants that
  will never grow are pinned in DDL [RA-28/RA-69].
- ⛔ **FK parents resolve LAZILY.** `CREATE TABLE` succeeds against a foreign key
  that can never be satisfied; only an `INSERT` reveals it. This cost three
  document reviews once.
- ⛔ **`AFTER INSERT` triggers fire IMMEDIATELY, not at COMMIT.** So
  `claim_requires_provenance` forces provenance to be written **before** the
  claim — the write order in `add_claim` is load-bearing. ⚠️ `defer_foreign_keys`
  defers FK checks; it does **not** defer triggers.
- ⚠️ **`ATTACH` is not atomic across files in WAL mode** — the accepted cost of
  splitting `claims.db` from `kb.db` [RA-45].

## Layout

```
claimstore/    db · schema.sql · write · query · rederive · predicates · identity
scripts/       liveness checks against the tower's real mirror
tests/         pytest; contract tests are specifications [PE-9]
```

⬜ `kbengine` (embed · chunk · hybrid · rerank · generate) has **not** moved here
yet — that is the extraction plan's work.
