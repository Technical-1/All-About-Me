# kb-substrate — architecture

State: `building`. ⭐ **The claim store is BUILT and merged**; the KB half
(`kbengine`) has not moved here yet — that is the extraction plan's work.

⚠️ This file read *"State: `planned`. This component is scaffolded"* until
2026-08-16, long after the store was built and running. It is what
`github-connector` extracts into the KB, so the KB's own map article for the
foundation described it as not existing.

## What this repo is

**THE substrate** — the shared data layer every engine writes to and reads from.
Two SQLite files, one service, one contract shape [RA-45]:

| file | holds | rebuildable? |
|---|---|---|
| `claims/claims.db` | bitemporal claims + their provenance + identity links | ⛔ **NO** |
| `kb/kb.db` | documents, chunks, vectors | ✅ yes, from raw |

⭐ **They are separate files on DURABILITY grounds, not churn.** The claim store
is the program's only non-rebuildable artifact: a state entity's temporal
history is *accumulated*, not derived. Sharing a file would put the one
irreplaceable dataset inside the blast radius of every re-chunk, re-embed and
restore. ⚠️ The cost is accepted knowingly — `ATTACH` is not atomic across files
in WAL mode — and is judged fine because claims and documents are written by
different producers at different times.

## `claimstore/` — the modules

| module | owns |
|---|---|
| `db.py` | the only place a connection is opened; `SENTINEL`; schema version + migration refusal |
| `schema.sql` | the whole schema, and the reasoning for each constraint inline |
| `write.py` | `add_claim` · `supersede` · `close_interval` · `retract` |
| `query.py` | `as_of` · `receipts` · `contradictions` |
| `rederive.py` | `purge_stale` — producer-scoped retirement with poison semantics |
| `predicates.py` | the predicate registry and its `cardinality` |
| `identity.py` | `identity_link` — human/probabilistic "same entity" decisions |

⭐ **The temporal model is the load-bearing part and has its own article:**
[`claim-store-temporal-model.md`](claim-store-temporal-model.md).

## The invariants worth knowing before touching it

- **[A4] the model never computes a number; it selects what to compute over.**
  Every claim carries provenance, trigger-enforced — there is no claim without a
  `claim_provenance` row.
- **Provenance has THREE kinds** [RA-18]: `raw` `(source, doc_id)` ·
  `mirror` `(source, mirror_path, tbl, pk, row_sha)` · `claim` `(parent_claim,
  parent_recorded_at)`. ⭐ **The mirror form is the majority address** — without
  it a claim over any of ~1.2M mirrored rows was uninsertable.
- **Subjects are RAW IDENTIFIERS**, never `person:` — resolution happens on read,
  in Rolodex. Rewriting a subject would destroy the evidence that two
  identifiers were ever distinct.
- **Open intervals use a sentinel, never NULL** — NULL forces
  `(x IS NULL OR x > ?)` into every temporal predicate, defeating index range
  scans and inviting a correctness bug in each one written.
- **Contradiction is a property of a QUERY, never of storage.** A stored
  `is_contradicted` flag goes stale the moment a claim is retracted.
