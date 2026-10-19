# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Python | 3.10+ | Easy to install on every target OS, and it is where the ML tooling lives |
| Inference (all platforms) | Ollama | any recent | One HTTP API on Windows, macOS and Linux, with the GPU backends handled for you |
| Inference (Apple Silicon) | MLX via `mlx-lm` | 0.20+ | The fastest way to run models on Apple GPUs, and it lets the scorecard compare two runtimes on the same model |
| HTTP client | httpx | 0.27+ | Clear timeouts and a simple synchronous API for long generations |

## Backend

- **Runtime**: CPython, as a command-line tool (the `llm-bench` script)
- **Interfaces**: Ollama REST (`/api/generate`, `/api/tags`, `/api/ps`) and `mlx_lm.stream_generate`
- **Storage**: JSON files (`results.json`, `hardware.json`) and a Markdown report. No database is needed. `results.json` is versioned (`schema_version`) and checked by `llm-bench validate`.

## Infrastructure

- **Hosting**: none, it runs locally
- **CI/CD**: GitHub Actions, testing on Windows, macOS and Ubuntu with Python 3.10 and 3.13. Each job also runs a real `llm-bench check`, `check --json` and `doctor` on the runner's own hardware.
- **Monitoring**: none

## Development Tools

- **Package build**: hatchling, with a PEP 621 `pyproject.toml` and a `src/` layout
- **Linting**: Ruff (`E`, `F`, `I`, `UP`, `B`)
- **Formatting**: Ruff formatter
- **Testing**: pytest, fully offline. Every task has a right and a wrong reference answer. Hardware the CI machines don't have (NVIDIA and AMD cards, Intel Arc, Ryzen AI Max, multi-GPU, the Windows registry, a 4 GB WMI reading) is tested against recorded tool output.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `httpx` | Talks to the local Ollama server |
| `mlx-lm` (optional, Apple Silicon) | Loads and streams MLX models, and reports peak GPU memory |
| `ctypes` / `winreg` (standard library) | Windows RAM (`GlobalMemoryStatusEx`) and the real VRAM size from the display-driver registry |
| `scripts/model_metadata.py` (stdlib + Hugging Face) | Reads each model's `config.json` to fill in the KV-cache columns of the registry |
| `pytest` (dev) | Test suite |
| `ruff` (dev) | Linting and formatting |
