# shopify-engine — stack

State: `live`.

- **Python 3.12** (`requires-python = ">=3.12,<3.13"`: the tower's interpreter minor). Standard library only at run time: `sqlite3`, `json`, `decimal`, `hashlib`, `argparse`. `dependencies = []`.
- **raw-tier**, installed editable into the engine's venv from its own checkout. It is private and on no index, so it is not a declared dependency; the conformance suite proves the install by execution (E12). The engine uses one thing of it: `raw_tier.snapshot` (the snapshot reader).
- **SQLite** for the store, one file. The manifest it reads is raw-tier's, WAL, opened read-only.
- **Money** is `decimal.Decimal` over the origin's decimal strings; a JSON number with a fraction is kept as its text (`parse_float=str`). No float.
- **No network and no model**: `shopify_engine/guard.py` installs an audit hook that refuses any `socket.*` event, and the repo holds no model client.
- **Tests**: `pytest` and `setuptools` in the venv. `tests/conformance/` is the frozen shared suite (E1–E13); `tests/spec/`, `tests/run/`, `tests/identity/` and `tests/unit/` are this engine's.
- **Deploy**: systemd on the tower — a `Type=oneshot` service and a timer, in `Technical-1/tower`. No container, no CI: local and tower execution are the evidence.
- **Packaging**: `setuptools`, six packages named in `pyproject.toml`; the console script is `shopify-engine`.
