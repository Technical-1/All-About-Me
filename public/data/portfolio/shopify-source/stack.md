# shopify-source — stack

**State: `live`.** Python, `requires-python >=3.11`, with exactly **one declared
runtime dependency: `httpx`**. Talks to the Shopify **Admin GraphQL API
`2026-07`** (pinned in `client.py`). Tests are pytest; packaging is setuptools
with an **explicit** package list [SF-11].

> ⛔ **CORRECTED 2026-08-19.** This file read *"No stack yet. Likely Python (the
> program default) — but note A9's Python rule binds engines only; Sources may
> differ."* That was speculation about an unbuilt repo, left standing over a
> built one for five days. ⭐ It is Python, and the question is settled by the
> code, not by A9's scope.

⛔⛔ **`raw-tier` is a REAL dependency and is deliberately NOT listed in
`pyproject.toml`** [SP-32] — ⛔ do not "fix" it back. It is a private sibling
published to **no index**, so a bare `"raw-tier"` requirement is a name pip can
only look for on PyPI, where it **404s** (measured 2026-08-18) and is therefore
**claimable by a stranger** — one unchanged line would install someone else's
code into the process that writes the forever archive.

⭐ Instead it is installed by **co-resolution** (`bootstrap.sh` installs this
repo and `raw-tier` in one `pip install -e … -e …`) and enforced by a test that
**imports** it. ⚠️ The incantation lives in a *different repo* and nothing here
states it — which is why the test exists.

**API version is a pinned fact, not a default.** `2026-07` matches the app's
webhook version. ⚠️ Bumping it invalidates any recorded API semantics pinned
below it.
