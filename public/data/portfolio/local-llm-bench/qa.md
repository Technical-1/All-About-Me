# Project Q&A

## Overview

`llm-bench` answers two questions people have before running AI models on
their own computer: which models will my hardware run, and which of those is
best? It reads the machine's GPU and memory on Windows, macOS or Linux, sorts
a list of open-weight models into "fits", "runs slowly" and "too big", and
then benchmarks the downloaded ones on quality, speed and memory. Quality is
scored entirely by code (tests, exact matches and format checks), so results
repeat exactly and cost nothing to grade.

## Problem Solved

Picking a local model usually involves guesswork. Parameter counts don't map
obviously to memory, an "8B" model and an "8B with 1B active" model behave
very differently, and leaderboard scores come from someone else's hardware and
settings. People download a 20 GB model and only then find that it spills onto
the CPU and crawls. This tool answers the fit question first, then measures the
candidates on the machine they will actually run on.

## Target Users

- **Developers choosing a local model**: a ranked shortlist for their exact machine, with real speeds.
- **Windows users with a gaming GPU**: a clear answer on what their VRAM can hold, and which runs will be slow.
- **Mac users**: MLX and Ollama compared on the same model.

## Key Features

### Hardware fit check
`llm-bench check` prints the CPU, RAM, GPU and usable memory it found
(free as well as total), then every model with its estimated memory need and
speed, a verdict, the longest context that still fits, and the `ollama pull`
command for each one worth downloading. `--ctx` grades at a different context,
`--vram` and `--ram` grade hardware you are thinking of buying, and `--json`
gives the same answer to scripts.

### Repeatable quality scoring
Thirteen tasks covering coding, math, reasoning, long-context recall and
instruction-following. Generated code is run against hidden asserts, and
answers are matched exactly or checked against the required format.

### Performance on your own machine
A dedicated speed pass per model (a warmup, then three timed runs with a fixed
output length, reported as a median and range), time to first token, measured
peak memory, and for Ollama how much of the model actually ran on the GPU.
Every number is labelled as an estimate or a measurement.

### Hardware bug reports
`llm-bench doctor` prints the raw output of every hardware probe and Ollama
endpoint next to what the tool concluded from them, ready to paste into an
issue. Odd hardware can then be fixed from a report instead of guessed at.

### Readable scorecard and portable results
A Markdown report with an overall ranking, quality per category, the best model
on each measure and, on a Mac, MLX and Ollama side by side. `results.json` is
versioned and carries the class of machine with every row, and
`llm-bench validate` checks it.

## Technical Highlights

### Accurate VRAM on Windows with no extra packages
The standard WMI field for GPU memory (`AdapterRAM`) is 32-bit and never
reports more than 4 GB, so it is wrong for almost every modern card.
`hwprobe._windows_registry_gpus` reads the 64-bit
`HardwareInformation.qwMemorySize` value from the display-adapter registry key
through `winreg`, falling back to the binary value older drivers write. It is
tried after `nvidia-smi` and before WMI, and the output includes a note
whenever only the capped WMI value was available. Tests replay recorded
registry keys on every OS, including adapters with no size and the non-adapter
subkeys Windows keeps alongside them.

### Memory that depends on the context, and on the architecture
A model's memory need is its weights plus a KV cache that grows with every
token of context. Newer hybrid models (Qwen3.5, Gemma 4, Granite 4, Nemotron 3)
keep that growing cache on only a few layers, so a flat per-parameter rule
gets them badly wrong. `Model.need_gb` uses each model's real cache shape,
pulled from its `config.json` by `scripts/model_metadata.py`, and
`max_ctx_within` inverts it to report the longest context a budget allows.

### Knowing what the GPU can really use
Total memory is not the budget. On Apple Silicon, `apple_gpu_limit` reads
Metal's recommended working set (about 74% of RAM on a 24 GB M4 Pro, where the
common two-thirds rule says 66%) or a limit the user raised with `sysctl`.
Identical graphics cards are pooled because Ollama splits layers across them,
Intel's integrated graphics are ignored because the standard Ollama build
doesn't accelerate them, and Ryzen AI Max APUs are budgeted as shared memory
at the larger of the BIOS carve-out and half of RAM.

### Grading the answer, not the working
Reasoning models write their working inside a `<think>` block (Gemma 4 marks it
differently), and that working often includes wrong intermediate numbers that
would fool an exact-match check. `runners.strip_thinking` keeps only the text
after the last known marker. The Ollama adapter also falls back to the
`thinking` field when a model uses its whole token budget reasoning. The tests
confirm that every scorer still gives full marks when a misleading reasoning
block is added in front of a correct answer.

### Scorers tested in both directions
A scorer that can't give full marks to a correct answer would quietly cap every
model's quality score. `tests/conftest.py` holds a correct and a wrong answer
for every task, and `tests/test_tasks.py` checks that they score 1.0 and 0.0.
An end-to-end test drives the CLI with a fake model that answers everything
correctly, and requires the whole pipeline to report 100%.

### Running generated code safely enough
`tasks.run_python` writes the model's code to a private temporary folder, runs
it with `python -I` (no user packages, no `PYTHON*` environment variables, no
imports from the code's own folder) under a time limit, and deletes the folder
afterwards.

## Engineering Decisions

### Code-scored tasks instead of a judge model
- **Constraint**: Scores have to be comparable across machines and runs, and grading should be free.
- **Options**: A judge model scoring open-ended answers, human rating, or checks written in code.
- **Choice**: Checks written in code only.
- **Why**: A judge model adds its own randomness and tends to prefer longer answers. The cost is a narrower set of tasks, with no essay-quality scoring, which is fine for a tool that ranks candidates rather than certifying them.

### Estimate first, always measure
- **Constraint**: The fit check has to answer before anything is downloaded.
- **Options**: Look up each model's file size online, estimate from the parameter count, or download and measure.
- **Choice**: Estimate weights at the runtime's real quantization plus the KV cache at the chosen context, and speed from memory bandwidth, then record the real peak and speed during every run.
- **Why**: It works offline with no API. The scorecard shows each measurement next to its estimate, so a bad estimate is easy to spot. On the sample runs every memory estimate was within 0.5 GB of the measured peak. Where there is no sound basis for a speed estimate (a laptop GPU, an unknown card, CPU offload), the tool shows none.

### One context window per model, and nothing else in memory
- **Constraint**: Ollama reloads a model whenever the context window changes, and a model left loaded from earlier holds memory the next one needs.
- **Options**: Size each request to its prompt, use Ollama's small default window, or fix one window per model.
- **Choice**: One window sized to the longest task for every request to a model. Models Ollama already holds are unloaded before a run, and each model is unloaded after its own.
- **Why**: Load time, peak memory and GPU share then describe a single configuration, the long-context task is never silently cut short, and no measurement is skewed by another model sitting in memory. A prompt the runtime still truncates is flagged rather than scored as a wrong answer.

### Three verdicts instead of yes or no
- **Constraint**: Ollama can split a model between VRAM and system RAM. That works, but much more slowly.
- **Options**: A single VRAM threshold, VRAM plus RAM, or two separate budgets.
- **Choice**: `fast` (fits on the GPU), `slow` (fits with CPU offload) and `no`.
- **Why**: A single threshold either hides usable models or recommends painful ones. Macs with unified memory get one effective budget, because there is nothing slower to spill into.

### Ollama as the cross-platform runtime
- **Constraint**: The tool must work on Windows with NVIDIA and AMD GPUs, where MLX doesn't exist.
- **Options**: llama.cpp bindings, vLLM, or Ollama.
- **Choice**: Ollama's HTTP API, plus MLX on Apple Silicon.
- **Why**: Ollama handles GPU backends, downloads and quantised formats on every OS with a one-click installer, and its API reports precise timings. Keeping the model runtime out of the Python process also keeps the install small.

## Frequently Asked Questions

### How accurate is the "fits" verdict?
It is an estimate of 4-bit weights plus the KV cache at the context you grade at (8k by default, or whatever `--ctx` says). On the sample runs it landed within 0.5 GB of the measured peak, on the high side. Each run records the real peak, and `check` shows the measurement once a model has been run.

### Why does a 30B "A3B" model need as much memory as a regular 30B model?
Mixture-of-experts models only use a few experts for each token (3B active), which makes them fast, but every expert still has to be loaded into memory. That is why the registry stores the total parameter count.

### My GPU shows 4 GB, but it has more. Why?
The tool had to fall back to WMI, which can't report more than 4 GB, and it prints a note when that happens. Updating the GPU driver usually brings back the registry value it prefers.

### Can I check a machine I don't own yet?
Yes. `llm-bench check --vram 24` grades a 24 GB graphics card, and `--ram 64` grades 64 GB of RAM (unified memory on a Mac), using the same rules as detected hardware.

### Does a shared results file reveal anything about my machine?
Each row records the GPU model, the memory sizes and their nearest marketed tier, the CPU model and the OS family. It never stores a hostname, user name or file path, and `llm-bench validate` rejects a file that contains one.

### Can I add my own models or tasks?
Yes. A model is one row in `src/llm_bench/registry.py`, and `scripts/model_metadata.py` prints its KV-cache numbers from Hugging Face. A task is a prompt and a function that returns a score from 0 to 1, in `src/llm_bench/tasks.py`.

### Does it download models for me?
No. It prints the exact `ollama pull` or `huggingface-cli download` command. Downloads are often tens of gigabytes, so that stays your decision.

### Is it safe to let the models' code run?
The code runs in a throwaway folder, in Python's isolated mode, with a time limit. That prevents accidents but would not stop a deliberate attack, so stick to well-known open-weight models or use a VM for anything you don't trust.

### Why is quality worth 70% and speed 30%?
Once a model writes faster than you can read, more speed matters less than correct answers, so speed stops counting above 80 tokens per second. The weights are at the top of `src/llm_bench/report.py` if you want to rank differently.
