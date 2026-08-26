# ai-lab — architecture

**State: `live`.** ⛔ **`ai-lab` is not a layer** — not a Source, engine, domain
or substrate. It sits beside the program the way a test harness sits beside a
system.

**It is the model lab**: benchmarks, the eval harness, `turboquant-mlx`, server
configs, `models.md`, scorecards. It is the **measurement workspace that decides
which models the pipeline uses**, and its output fills `model-router`'s config.

## What it is not

⛔ **`ai-lab` is not "the KB".** The two get conflated constantly. Say *the KB*
or `kbengine` when that is what you mean.

The knowledge-base **engine left for `kb-substrate`**. ⭐ The **data did not
move** — the index is still `knowledge-base/`, and `KB_ROOT` needed no edit on
either machine — which is the property that made the extraction safe. Only the
code and the commands moved.

ai-lab now **depends on `kb-substrate` as an installed package**
(`requirements.txt`, `-e ../kb-substrate`). ⭐ That dependency is the point, and
it is proven rather than asserted: uninstalling the package makes ai-lab's suite
**fail to collect**, so a passing run is not coming from a leftover directory.

## What still lives here

- `benchmarks/` + `scorecard.md` · `models.md`
- `eval/` — it imports `kbengine`, which is correct: it **measures** it
- `eval/asr.py` — Mac-side ASR, deliberately **not** substrate work
- its own CLIs: `eval.py` · `answer_eval.py` · `fidelity_eval.py` · `wrapgrep.py`
- `.venv` (the MLX stack). Models live in `~/.cache/huggingface`, shared.

⭐ The `kb` launcher **split** rather than being deleted: ai-lab's keeps `eval`,
`answer-eval`, `fidelity-eval` and `servers`; every KB command is
`kb-substrate/kb`. ⛔ The retired commands **exit 2 and print where the command
went** — they do not fail silently, and they do not delegate, because silent
delegation would recreate the cross-repo path coupling the split removed.

## Ports

ai-lab owns **8180–8189** plus **8090** on the Mac: `8180` text chat models,
`8181` vision (vision work happens only there), `8090` the kb-api launcher.

## The invariant this repo exists to serve

⭐ **The model never computes a number; it selects what to compute over.** Any
figure in prose arrives verbatim from the deterministic layer with its receipt.
The compute/synthesis **repo split makes that a dependency graph rather than a
rule**: the repo that computes numbers cannot call a model, and the repo that
calls models cannot see raw.
