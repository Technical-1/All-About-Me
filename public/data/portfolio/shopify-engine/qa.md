# shopify-engine — how it is checked

State: `live`.

## What runs

| | where | what it holds |
|---|---|---|
| the conformance suite, E1–E12 | `tests/conformance/` (frozen; shared by every engine) | the layer rule, the snapshot, identical rebuild, receipts, recomputed figures, the partition, coverages, fixture cases, declared limits, no count literal, the run record, the package boundary |
| E13, the mutation census | `tests/fixture.py census` | every mutant of the catalogue and of `tests/fixtures/census-anchors.toml` is killed by a family; a fatal control dies and an inert one survives |
| the spec's gate | `tests/spec/`, `tests/spec/catalogue/` | one file per table and per named spec item; `tests/spec/coverage_map.py` maps the plan's §2 to them, both ways |
| method obligations | `tests/run/` | `receipts-for`, `status`, the changes diff, the stale exit, the recompute declarations, the ruled exclusions (test, zero-total, comped) |
| identities | `tests/identity/` | the code identity, the decoder identity, the clean-tree refusal, the change gate |
| units | `tests/unit/` | the fixture gate, the Source's widened payloads, `scripts/e14-observe.py`, periods, decode failures |
| E14, liveness | `scripts/e14-observe.py`, on the tower | each timer tick against every clause of E14; it watches and starts nothing |

```bash
.venv/bin/python tests/fixture.py build       # once per machine
.venv/bin/python -m pytest -q --deselect tests/conformance/test_e13_census.py::test_census
.venv/bin/python tests/fixture.py census
```

Two tests fail `NOT LIVE` wherever `SHOPIFY_ENGINE_LIVE_STATE` is unset — `test_payout_reconciliation_all.py` and `test_collection_members_all.py`: their subject is a store built from the whole archive, on the tower.

## The rules the tests follow

- **Expectations are hand-computed** from the fixture's payloads by a reader that imports nothing of this engine, before the code they judge exists; their digests in `tests/fixtures/FIXTURE.lock` are the committed proof. The files themselves live in the loader's store, `~/.cache/shopify-engine/fixture-store/files/<sha256>`, on every machine (ai-lab [TD-181] (3)): outside every checkout and the state mount, and accepted by `tests/fixture.py build` only when the digest is the lock's.
- **Every check is shown failing**: a negative control beside each gate, a `[GS-16]` assertion that the fixture holds the threat a test is about.
- **No count literal** in an assertion of `tests/spec/` or `tests/conformance/` (E10): a count is derived and compared with another derived count.
- **Absent, zero and error stay apart**: a missing fixture is `NOT BUILT`, a missing live store `NOT LIVE`, never a skip.

## The test fixture is real, and is not in git

The fixture the suites build from is real archive data (ai-lab [TD-163]): payload bytes exactly as the raw tier holds them, and expectation files hand-computed from them. Neither is committed. The repository carries the recipe (`tests/fixtures/select.sql`, the pinned version list `select.out`, the generator `make_fixtures.py`), the digests (`tests/fixtures/FIXTURE.lock`) and the loader (`tests/fixture.py`): `tests/fixture.py build` rebuilds the fixture from the archive — in place on the tower, over one ssh connection from the Mac — and refuses any byte that is not the pinned one. No test runs against a fixture the lock does not vouch for: a missing one stops pytest `NOT BUILT: fixture — run <command>`. The mutation census (E13) runs through `tests/fixture.py census`, in a scratch repository where the fixture is committed locally, because it clones HEAD for every mutant.
