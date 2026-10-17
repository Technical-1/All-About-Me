# messages-engine — QA

State: `live`, deployed on the tower at plan T11. The figures below were read on the Mac; the tower's are the plan's T11 RECORD.

## What holds the engine to its contract

- **`tests/conformance/`** — the frozen shared suite, families E1–E13. It is pinned to its plan by `suite-plan.pin`, and `fidelity.py` proves the copy equals the plan's fences. It is never edited here: a change is an amendment, Jacob's [PE-9].
  - E11 drives the tower's run-record contract. With the stanza landed, at stage `T11`, it drives the whole fleet, so on the Mac it needs current checkouts of every watched repo, each with its venv.
  - E13, run as plain pytest, stays red (its twin's baseline), as in every engine.
- **`tests/spec/`, `tests/spec/amendment/`, `tests/contracts/`, `tests/render/`** — the spec's gate. Each was written failing `NOT BUILT` before the code it judges. `tests/spec/coverage_map.py` checks both directions against the plan.
- **`tests/identity/`** — the code and decoder identity [MP-4].
- **`tests/run/`** — the method's run obligations:
  - the run locks and the registrar's capped wait;
  - the absent-mount guard and the clean-tree refusal;
  - the change gate;
  - `status` and `changes`, with `test_status_rediff_guard.py` holding the 64 MiB bound, in memory and writing no file;
  - the stale exit, and a failing engine going stale;
  - `verify`'s live E4, and its lock-cap line, read only where a registrar is named — a bare verify on a stand-in tower layout opens nothing of the registrar's (`test_verify_lock_cap.py`, beside the T9 pin `test_t9_review_pins.py`);
  - the render step;
  - the claims export;
  - the E14 observer: a row fall held to the rows the diff reports gone (`test_e14_observer.py`), and a trigger a still-running build absorbed named `ABSORBED` and passed over, while a genuinely late gate reading still fails (`test_e14_absorbed.py`);
  - the deployed period (`test_deploy_period.py`: the constant and the drafted alerter stanza are one figure, ten minutes as Jacob ruled).
- **`tests/unit/`** — the decode cache, the rules (date, link, intent, rich link), the typedstream decoder, the spool and the per-phase memory bound, the text pass, the INSIGHT specimens.
- **`tests/tools/`** — the tools' own tests: the judge, the draw, the generator, the fixture loader, the coverage map, the report boundary, the patch points.

## How a mutant is held

Each in-test mutant is one substitution in one engine file, entered in `tests/fixtures/planted-controls.toml` with the code it sabotages. A test whose control has no entry fails `NOT BUILT: planted control`. A mutant is killed only by the test's own assertion; a crash or a refused command is inconclusive and never a kill. The census (E13) runs every family's negative controls in throwaway twins.

## The report boundary

No failure report carries a row. `tests/conftest.py` rewrites every failure report at the report boundary to the node, the exception type and the traceback's committed source lines, never a value. Full reports are refused on the tower.

## The fixture

The fixture is private data and is not in git: the recipe and its digests are. It is drawn and locked, and the gate stops pytest before any test that could read a mismatched fixture. See `CLAUDE.md`.

## Run it

```bash
.venv/bin/python -m pytest -q -p no:cacheprovider                       # the whole suite, siblings from the parent dir
ENGINE_CONFORMANCE_SIBLINGS=<a farm of every repo> .venv/bin/python -m pytest -q -p no:cacheprovider tests/conformance/test_e11_runrecord.py -s
# on the tower: BOTH temp variables on the state volume — the draw refuses otherwise (select_mirror.py's header), and every tests/tools test that runs it fails
ssh jacob@100.92.218.64 'cd /data/fast/repos/messages-engine && TMPDIR=/data/fast/state/messages-engine/fixture/tmp SQLITE_TMPDIR=/data/fast/state/messages-engine/fixture/tmp .venv/bin/python -m pytest -q -p no:cacheprovider'
```
