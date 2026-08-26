# github-connector — qa

**State: `built` and running hourly on the tower.**

⛔⛔ This file read *"State: `planned`. No tests yet"* until 2026-08-25, over a
Source that had been live for days. `architecture.md` beside it was correct the
whole time, which is exactly why nobody noticed — ⭐ **a stale file next to a
current one is harder to see than a stale directory.**

⛔ **The suite size is deliberately not stated here** — it moves whenever anyone
does the work. Measure:

```bash
cd ~/CodeRepos/github-connector && .venv/bin/python -m pytest -q | tail -1
```

⚠️ **Use this repo's own `.venv`.** Running it under a sibling's venv reports a
false failure: the packaging guard finds no `setuptools` and **deliberately
refuses to skip**.

## What the tests are actually for

- **Exit discipline.** The run record's `exit_class` is the only fault signal
  that reaches `source-alerter`; `systemd` exits 0 for every fault class and can
  never see it. Tests pin which conditions produce which class.
- **The roster is discovered, never hand-listed.** `affiliation=owner` once hid
  24% of the roster; it now sends
  `owner,collaborator,organization_member`.
- **Objects are archived whole.** The narrowing bug class — a projection that
  keeps a hand-listed set of fields — is what a count can never detect, because
  a count cannot see inside an object.

## ⚠️ What the tests do not cover

CI is **red fleet-wide** on a billing failure, by decision, so the only green
that means anything right now is a local or tower run. ⭐ A green that has never
left the machine it was written on has not been tested, it has been rehearsed.
