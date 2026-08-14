# github-connector — architecture

⭐ **State: LIVE on the tower since 2026-08-13.** Source #3. Hourly at `*:37`,
167 repos, **468 documents**, `exit_class=ok`.

## What it is

⭐ **A Source: acquisition only.** It lists repos, walks each git tree, selects
documentation paths, fetches those blobs, and writes them to the raw tier.
⛔ **It computes nothing and pushes nowhere.**

⚠️ Doc extraction, staleness and the push into the substrate belong to
**`github-engine`** [application-boundaries §284] — a separate repo that does
not exist yet, and `kb-substrate` has no service. ⭐ The original plan
(2026-08-03) carried all three here because it predates the four-layer split;
Tasks 4 and 5 were moved out on 2026-08-13 and their text preserved for that
plan to lift.

## The five modules

| | |
|---|---|
| `client.py` | list repos (paginated), fetch a tree, fetch a blob |
| `paths.py` | ⭐ **pure** — which paths are documents. No network, no token |
| `raw.py` | compose the identity and the path, then **delegate** to `raw_tier` |
| `sync.py` | one run: every repo, its docs, into raw — and the **exit class** |
| `runrecord.py` | `last-run.json` + `runs.jsonl` — ⭐ the only channel reaching a person |

## ⭐ The decisions worth knowing

**Storage is `copy`, one path per VERSION.** ⛔ The plan specified a *stable*
path per document and that cannot work: [C1] refuses to reuse a `copy` path for
different bytes, so the second version of any `CLAUDE.md` would have failed the
run. ⭐ Paths are **content-addressed** (`…/<path>/<sha12>`), so a document
reverted to an earlier version dedupes to the path it already has instead of
writing a third copy of bytes we hold. ⚠️ Caught by this repo's own test, not by
review.

**`doc_id = "<full_name>:<path>"`** — every component GitHub's own [RT-11].
⚠️ The separator is `:` and not `/` because `/` appears in **both** halves
constantly, while `:` is forbidden in a `full_name`. ⭐ [MA-31]'s warning
applies: *"the id is right there in the path" is a claim about UNIQUENESS, not
presence.*

**⚠️⚠️ Exit discipline inverts intuition [MD-153]: an origin failure exits 0.**
GitHub being down is the world being normal, not this Source failing. ⛔ Only a
data-shape surprise exits non-zero. ⭐⭐ That deliberately empties the exit-code
channel, which is *why* the run record exists — `source-alerter` reads records
and never an exit code.

**⭐ An empty repo is not a fault.** GitHub answers **409** for a tree in a repo
with no commits; **2 of 167** repos here are empty. ⛔ Classifying that as
`origin-error` would page hourly, forever, about repos working exactly as
intended. ⚠️ **No fixture found this — only a live run could.**

**Failures classify by KIND, not count.** A status is the origin answering
badly (`origin-error`); a transport error is it not answering at all
(`unreachable`). ⚠️ The first version keyed on count, so one repo returning 500
read as `unreachable` — sending an operator to a network that was fine.

## ⚠️ What is deliberately narrow

`.portfolio/` + `CLAUDE.md`, `.md`/`.mdx`, under 1 MB. ⛔ `README.md` and
`docs/` are excluded: 43 repos have `docs/`, much of it stale drafts.
⭐ **`docs/superpowers/` is a live open question** — 38 files, 33k lines of
specs and findings that `ai-lab` currently contributes **one** file for.
⚠️ Widening is one tuple and one re-run: **GitHub is the origin and is not going
anywhere**, so nothing here is irreversible.

⭐ `EXCLUDED_SEGMENTS` (`node_modules`, `vendor`, …) is **nearly unreachable**
today — `DOC_DIRS` rejects vendored paths one guard earlier, so the only case it
can still catch is a vendored directory *inside* `.portfolio/`. Kept because
widening `DOC_DIRS` makes it reachable again.

## Verification

**37 tests · 13 mutants, 0 survivors** (`tools/mutation_sweep.py`).
⭐ The wheel test is **proved** to fail when `packages` is removed — its first
version *skipped* on a build failure, which is [SF-11]'s own lesson turned on
itself.
