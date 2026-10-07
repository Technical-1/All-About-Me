# email-engine — QA

State: `live` — deployed on the tower (plan T11). The fixture figures were read on the Mac and on the tower; the archive figures are in `architecture.md`.

## What holds the engine to its contract

- **`tests/conformance/`** — the frozen shared suite (families E1–E13), byte-identical in every engine repo and pinned to its plan in ai-lab. Never edited here: a change is an amendment, Jacob's [PE-9].
- **`tests/spec/`**, **`tests/spec/amend/`**, **`tests/contracts/`** — the spec's gate: one test per named item of the plan's coverage map (`tests/spec/coverage_map.py` checks both directions), each first asserting that the CLI answers the verb it exercises. `tests/contracts/` holds the pinned byte copies of ai-lab's shared shapes (`link-shape.json`, `date-mention-shape.json`).
- **`tests/identity/`**, **`tests/run/`**, **`tests/unit/`** — the code and decoder identities, the clean-tree refusal, `status`, `changes`, the stale exit, the receipt scale rule, the recompute declarations, the fixture gate, the decode-failure controls, and the tracked-tree check that no real identifier is in git.
- **Planted controls** — `tests/fixtures/planted-controls.toml`: each a substitution in one engine file that plants the defect a test must catch, built in a throwaway twin of the checkout.

## The fixture and the expectations

Real mail, out of git [ai-lab TD-163]. The recipe, the generator and `FIXTURE.lock` are committed; the selection outputs, the payload tree, the manifest and the seven expectation files are git-ignored.

**Where the expectation files live** [ai-lab TD-181 (3)]: `~/.cache/email-engine/fixture-store/files/<sha256>` on the Mac, each under the sha256 `FIXTURE.lock` commits for it.

**On the tower, on the encrypted volume only** [ai-lab TD-190] (2): a fixture that holds personal content — this one is real mail — never sits on a plaintext partition. The store, the built fixture and the suite's scratch live in `/data/fast/state/email-engine/fixture/` (`store/`, `built/`, `tmp/`), made once by the tower's bootstrap (`--only email-engine-fixture`), never by the loader; the checkout's `tests/fixtures/<name>` are links into `built/`. `tests/fixture.py` refuses (`FIXTURE REFUSED`, apart from `NOT BUILT`) an unmounted volume, a home not yet made, a plaintext copy in the checkout or the store, and a plaintext `TMPDIR`; `tests/unit/test_fixture_home.py` shows each refusal firing. Engines 3–8 whose fixtures hold message, note or file content inherit the rule; shopify's fixture stays where it is. The census runs on the Mac and, since suite amendment 2 [ai-lab TD-206], on the tower under the fixture home (CLAUDE.md, "Running it"). The selection outputs sit beside them as `files/selection-<digest>`, the payloads under `archive/`. `tests/fixture.py build` installs them from there and accepts nothing whose digest is not the lock's.

The expectations are worked by an independent reader that imports nothing of the engine (`READERS.lock` holds its scripts' digests), before the code they hold to account.

## What is verified where

On the Mac: the whole suite and the census. On the tower, before the deploy (plan T11): the suite at the deploy commit with `TMPDIR` under the fixture home, the census, three builds over a frozen copy of the whole archive at one `--as-of` (one `build_id`, cold, warm and cold again; `architecture.md`), and the run-record driver. After the deploy: E14 over two timer ticks (`scripts/e14-observe.py`), E11 at stage T11, and the alerter's `--check`.
