# google-source — stack

**State: `building`** — live 2026-08-13.

- **Python ≥3.11** · `httpx` · `raw-tier` (the frozen contract)
- ⛔ **No Google SDK.** The REST endpoints are simple, and
  `google-api-python-client` is a large dependency to audit for a component
  holding **write scopes on ten mailboxes**. The whole HTTP layer is ~140 lines.
- **`[tool.setuptools] packages = [...]` is explicit** [SF-11], and a test
  proves the line is load-bearing rather than decorative — ⚠️ **by recreating
  the `config/` directory that defeats flat-layout discovery**, which the first
  version of that test forgot to do [GS-16].
- ⚠️ **`setuptools` must be installed in the venv**: Python 3.12+ does not ship
  it, and without it the packaging guard cannot run at all — ⛔ which is an
  assertion, never a skip [GS-17].

## State on the tower

| path | what |
|---|---|
| `/data/fast/state/google-source/tokens/<addr>.json` | ⭐ ten refresh tokens, mode 600, inside LUKS. **The account roster IS this directory** [GS-13] |
| `…/cursors.db` | per (account, datatype, scope) — ⛔ never `manifest.db`, which is SHARED [SF-24] |
| `…/last-run.json` · `runs.jsonl` | the run record; ⭐ **the only channel that reaches a person** |
| `…/client.json` | the OAuth client id/secret |

⭐ **Scopes held: the [GS-10] WRITE set** — `gmail.modify · gmail.compose ·
calendar · drive · tasks`, deliberately excluding `https://mail.google.com/`,
the only scope granting permanent delete. ⛔ **The authority is HELD, NOT
EXERCISED**: this code never issues a write verb.
