# model-router — qa

**State: `building`.** ⛔ **The suite size is deliberately not written here**
[RA-42] — a figure that changes whenever someone does the work belongs in a
command: `PATH="$PWD/.venv/bin:$PATH" pytest tests/ -q | tail -1`.

## What is under test, and how each guard was validated

Every guard below was run **with its threat present** [GS-16] — the
implementation was broken deliberately and the test was confirmed RED before it
was believed green.

| file | pins |
|---|---|
| `tests/test_config.py` | frozen by the plan. Profile→class resolution; unknown profile → `None`, ⛔ never a default; a profile pointing at an undefined class; a **retired** class (`text-small`, `asr`); `fallback: cloud` refused **naming §10.5**; an unknown `constraint`; the **orphan** rule; and two controls that must keep passing. **Plus one addition + its control:** an **unknown class name** is refused naming the vocabulary, and a known-but-unused class (`vision`) still loads |
| `tests/test_route.py` | frozen by the plan: the 200 key set, unknown profile → **400 not 503**, missing `task` → 400. **Plus one addition:** two classes, two profiles, each resolving to **its own** class |
| `tests/test_unservable.py` | frozen by the plan: 503 carries a non-empty `fallback`; `/profiles` answers with nothing servable. **Plus two additions:** `probe` is called with the **class** name, and `/profiles` covers **every** configured profile with exactly `{class, constraint, fallback}` |
| `tests/test_bind.py` | **added 2026-08-21** — every `--listen` this repo ships (the code default **and** every unit file, globbed and scanned) resolves to loopback only, decided by `ipaddress` **independently of the production guard**; the unit and the default may not drift; `parse_listen` refuses the wildcard, a LAN address, the tower's own tailnet address, an empty host and a bare port, **naming the ruling**; four loopback spellings it was never told about are accepted (the control); and `main()` refuses an exposed bind **without constructing a server** |
| `tests/test_probe.py` | **added 2026-08-21** — `probe.py` and `__main__`'s probe closure had **zero** coverage. The capability query is one **GET** of `/models` and nothing else (an [A6] check on the wire, beside the AST one); True and False are both reachable from one live upstream; refused / 500 / not-JSON / wrong-shape are all `False` and never an exception; `make_probe` queries **each class at its own endpoint** (proved by the recordings on **two** upstreams, not by the return value); a non-class name returns False **querying nothing**; and one end-to-end run of `main()` routes both a 200 and a 503 through the real closure |
| `tests/test_startup_config.py` | **added 2026-08-21** — a config that routes nothing is refused at load; a truncated file, a non-mapping top level and a non-mapping section are `ConfigError`s; **every** key of the shipped class and profile bodies is covered by deletion, parametrised from the file itself; a typo names **both** halves; and `main()` turns each of them into **one** `FATAL: <path>: …` line, exit 1, **no server constructed** — with the shipped config as the control that must still start |
| `tests/test_a6_conformance.py` | **added** — the defining invariant had no gate. The only URL built from an endpoint is `/models`; no hardcoded `http(s)://`; no model id in the package; the deployed example config **equals** the tested fixture. The scan is **recursive** (`rglob`) and labels every hit **package-relative**, so `clients/gen.py:5` cannot read as a top-level `gen.py:5` |

## The holes the plan's own tests could not see, and why

⭐ **The fixture declares exactly ONE class**, so nothing frozen can tell
*"resolves the profile's class"* from *"returns the only class there is"*.
Replacing `cls = cfg.klass(prof.klass)` with `cls = next(iter(cfg.classes.values()))`
left the whole suite **green**. Hence the two-class test.

⭐ **Every injected `probe` is `lambda _: True/False` and ignores its argument**,
so nothing asserted what `probe` is called *with*. Replacing `probe(prof.klass)`
with `probe(prof.name)` also left the suite **green** — while the real closure
returns `False` for every profile name, i.e. **a deployed service that 503s 100%
of requests with a fully green suite behind it.** Hence the recording probe.

⭐ **`KNOWN_CLASSES` had no test at all.** The frozen suite has a case for a
**retired** class and a case for a profile pointing at an **undefined** class,
and neither one exercises the vocabulary check sitting between them: replacing
`if name not in KNOWN_CLASSES:` with `if False:` left the whole suite **green**,
so an invented class name loaded silently and carried its `base_url` and `model`
straight into the routing table. Hence the unknown-class test — with a control
(`vision`, known and used nowhere else) that fails if the vocabulary is ever
hand-shrunk to whatever the fixture happens to declare.

⭐⭐ **The two files the tower actually runs had no tests at all** — found
2026-08-21. `__main__.py` (bind, startup, the probe closure) and `probe.py` (the
one outbound request this repo makes) were reachable by no test in the suite; a
grep for `probe_llama_swap` under `tests/` returned a **comment**. Three
consequences, each measured on the pre-fix tree rather than argued:

⛔⛔ **The auth exemption rested on a literal nothing read.** Flipping
`--listen`'s default **and** the unit's `ExecStart` to `0.0.0.0` — an
unauthenticated service published on every interface — left the suite green.

⛔⛔ **An empty config started the service.** Run with an empty file, the process
stayed up (so `systemctl is-active` prints `active`, which is Task 5's gate) and
answered `400 unknown task profile 'extract', known: []` to every caller and
`200 {"profiles": {}}` to every cache — a caller-side typo and a healthy empty
table, which is what the two failures look like from outside. Four *other* ways
to break the file raised `TypeError`, `KeyError`, `yaml.parser.ParserError` and
`AttributeError`: none is caught by `except (ConfigError, OSError)`, so the
operator got a traceback where the Interfaces contract implies `FATAL: <path>`.

⭐ **The irony in the probe.** `test_probe_is_called_with_the_CLASS_name…` exists
*because* a `probe(prof.name)` mix-up is a service that 503s every request
behind a green suite — and it guards `server.py`'s **call site** while the
closure that actually ships was the untested half. Planting **both** halves of
that failure at once (`__main__`'s closure ignoring the class it was asked
about, and `probe_llama_swap` reporting everything servable) left the pre-fix
suite at **green**; it now fails on the recordings, which is the only evidence
that separates *asked and was told no* from *asked the wrong box*.

⛔ All three were fixed by **adding** tests. A frozen test is a specification
[PE-9]; editing one to make code pass is an amendment, never a fix.

## ⛔⛔ Two of these guards were themselves vacuous — found 2026-08-20, fixed

⭐ **An expectation must not be produced by the code under test.** The two-class
test above first read its expected values through `want = cfg.klass(klass)` —
**the very accessor the handler calls** — so mutating
`Config.klass` to `return next(iter(self.classes.values()), None)` moved *both
sides of every assertion together* and the full suite stayed **green**. Run
against a real two-class config, that mutation answers `/route?task=describe`
(class `vision`) with the **text** class's model and endpoint: a silently wrong
route, this program's signature failure. ⭐ The one-class blind spot the test
exists to close, **reintroduced one layer down inside the fix for it.** The
expectations now come from an independent `yaml.safe_load` of the same fixture
text — derived, ⛔ not hand-listed [RA-1…RA-9].

⭐ **A non-recursive scan reports "clean" for a package it never opened.**
`test_a6_conformance.py`'s `_sources()` used `PKG.glob("*.py")`, so all three
[A6] scans were blind to any subpackage. Demonstrated: a
`model_router/clients/gen.py` carrying `httpx.post(f"{base_url}/chat/completions", …)`,
a hardcoded `https://api.openai.com/v1` **and** a named model id — all at once —
left the suite **green**, while the identical leak in a top-level file went RED.
That is [GS-16] inside the guard written to close [GS-14] on the one property
this component exists to have. `rglob` is the fix.

⚠️ **Both were live only because no second class and no subpackage exist today.**
Neither was a defect in shipped behaviour — every production file is
byte-identical to the plan's fence — and that is precisely why a green suite
proved nothing about them.

## What is NOT tested, stated so it is not read as covered

- ⛔⛔ ~~**Nothing here has been deployed.** Task 5 Steps 3–4 and Task 6 are
  unrun, so there is no `systemctl is-active` reading~~ — **WRONG since
  2026-08-24T12:31:04Z**, when the unit first started. `systemctl is-active
  model-router` reads `active` and `is-enabled` reads `enabled`, from
  `/etc/systemd/system/model-router.service`. ⚠️ **The rest of this bullet
  STANDS:** the *router-stopped* path — the one [MS-3] calls the common case and
  no unit test can reach — is **still unverified against a genuinely stopped
  service**, because stopping the unit is a change to the machine and was not
  made.
- **The bind guard checks what this repo ships, not what the tower runs.** A
  systemd drop-in overriding `ExecStart`, or an operator typing `--listen` by
  hand, is caught by `require_loopback()` at startup — the process refuses to
  run — but ⛔ **nothing here reads the effective state of a deployed unit**,
  which is exactly what Task 5's `Not done if` and [MD-126] warn about.
  ✅ ⛔ ~~The post-deploy reading (`ss -tlnp`, `systemctl show`) is still owed.~~
  — **TAKEN 2026-08-25**, now that there is a deployed unit to read: `ss -tlnp`
  shows `LISTEN 127.0.0.1:8185`; `systemctl show model-router -p DropInPaths` is
  **empty**; and the effective `ExecStart` from `systemctl show` carries the same
  loopback bind flag `deploy/model-router.service` ships. So the running
  process's bind matches the repo and nothing has overridden it.
  ⚠️ **The bullet's POINT survives its own reading, which is why the sentence
  above it is NOT struck:** this is a **reading, not a guard** — nothing in this
  repo re-checks the effective state on a schedule, so it is evidence about one
  date and about nothing after it [GS-16]. The standing protection is still
  `require_loopback()` refusing at startup.
- ⭐ **`probe.py` HAS now met the real `llama-swap` — on the happy path only.**
  ⛔ ~~exercised against a stub, never against `llama-swap` … whether the real
  server's document matches that shape is a Task 6 question~~ — answered by
  execution 2026-08-25: `curl -s "http://127.0.0.1:8185/route?task=synthesize"`
  returns **200**, and `/route` only does that after `probe(prof.klass)` returns
  true (`server.py:32`), which runs `httpx.get(f"{base_url}/models")` against the
  real server. The real document is `{"data":[{"id":…}]}` — the stub's shape.
  ⭐⭐ **And it confirmed the deliberate part:** llama-swap reported
  `gemma4-26b-a4b` with `"status":{"value":"unloaded"}` and the probe still said
  yes, which is `probe.py:7-8`'s stated intent — *"Deliberately does NOT force a
  load"*. **Known, not resident.** ⚠️ **Only the TRUE branch is covered against
  the real server.** The false branch — llama-swap up but not serving the class,
  which is what produces the 503 — was **not** exercised here, because forcing it
  means changing what the tower serves.
- `tests/test_integration_tower.py` is named in the plan's Task 6 file list and
  **no step authors it**. It does not exist.
- The A6 URL scan reads the code, not the wire: a URL assembled at run time from
  values held across statements is outside it. The residual error is
  **directional** — it over-reports and prints every hit with `file:line`.
