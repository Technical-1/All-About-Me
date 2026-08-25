# model-router — stack

**State: `building`.** Python, stdlib `http.server` (matching `kb-api-contract`
and `kb-api-service`), `PyYAML` for config, `httpx` for the upstream probe,
`pytest`. No framework, no database, no client library — the contract is an
HTTP `GET`, which is the whole reason this is a service and not a file
[MS-6]: consumers are polyglot (`orbit-engine` ports from TypeScript, the
SecondBrain lineage is Rust + TypeScript, `kbengine` is Python), and **with a
file every language writes its own loader and they drift.**

```
model_router/config.py    load_config -> Config; the validator, and the park
model_router/server.py    make_handler(cfg, probe) -> BaseHTTPRequestHandler
model_router/probe.py     probe_llama_swap(base_url, model) -> bool
model_router/__main__.py  argparse + ThreadingHTTPServer; validates at STARTUP
deploy/model-router.service          127.0.0.1:8185, User=jacob
config/memory-architecture.example.yaml   deployed to /etc/model-router/
```

⚠️ **The tower's system Python has no `PyYAML`.** This service needs its own
venv, which the unit's `ExecStart` already assumes — and the unit sets **no
`WorkingDirectory`**, so `-m model_router` runs from systemd's cwd (`/`) and only
resolves if the package is **installed** in that venv (`pip install -e .`).
`pyproject.toml` therefore declares `[tool.setuptools] packages = ["model_router"]`:
without it, flat-layout auto-discovery ERRORS the moment `config/` and `deploy/`
exist beside the package.

**Port `8185`** — inside ai-lab's `8180–8189` block, free on both machines,
adjacent to nothing that `pkill`s by pattern, and loopback-only. `llama-swap`
holds `8080` on the tower.

`probe` is **injected** into `make_handler`, so tests never touch the network and
the real closure (`cfg.klass(name)` + one `GET {base_url}/models`) exists in
exactly one place, `__main__.py`.
