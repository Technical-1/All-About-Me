# model-router — architecture

**State: `building`.** A read-only HTTP **lookup** in front of `llama-swap`. A
caller asks for a **task profile** (`extract`, `classify`, `verify`,
`synthesize`, `draft`); it answers with the endpoint, the model id, the output
constraint and the fallback policy. **It is not a proxy and makes zero model
calls** — it is out of the data path entirely, so it can never be a latency tax
or a single point of failure for inference. Its whole state is one YAML file.

## The split that makes the table fillable later

`memory-architecture.yaml` has two tables, and keeping them apart is the design:

- **`classes:` are weights** — `model`, `residency`, `base_url`, `max_ctx`.
- **`profiles:` are prompts-and-constraints** — `class`, `constraint`,
  `fallback` — and a profile *points at* a class.

§E.3's schema predates [MD-68] and carries a `model:` per task, which is exactly
the conflation MD-68 removed. **Which model fills a class is unknown until Stage
4** [MD-64]; because it lives in the class row, filling it is an edit to **data**,
never a change to code.

## Three answers, and the caller must tell them apart

| | meaning | what the caller does |
|---|---|---|
| `200` | here are your coordinates | call the endpoint it was handed [A6] |
| `400` | **you asked wrong** | a bug to fix — ⛔ never a fallback path |
| `503` | cannot serve it now — **and here is your `fallback`** | degrade per policy |
| *unreachable* | **the common case, by design** | treat exactly as 503, **from the cached `/profiles`** |

⭐ The load-bearing consequence [MS-3]: **a fallback policy obtainable only from
the router is unavailable in exactly the situation it exists for.** When the
tower boots into Windows the router is off with everything else and a caller gets
connection-refused, not a 503. So `/profiles` is served **from config alone**,
is small, holds no secrets, and every client caches it at startup.

## Where the boundaries are

- **Residency is REPORTED, never enforced.** `llama-swap` owns loading and
  unloading; there are no `groups:` and no `swap_strategy:` in its config, so it
  serves one model at a time and a request for another class evicts the
  incumbent **regardless of `ttl`**. `residency: hot` is a value this service
  hands out, ⛔ not a state it can promise.
- **`swap_strategy` is `llama-swap`'s**, and so is [MD-75]'s thrash hazard
  (swapping in a small model can evict a large one, and in a loop that is slower
  than never swapping). The fix is a grouping decision in that config.
- **`fallback: cloud` is REFUSED at load, naming target-architecture §10.5.**
  Local-vs-cloud routing is deferred; a config value may not make an **egress**
  decision on its own, and "reviewable egress" is a headline property of the
  architecture. `fallback` and `constraint` are both closed vocabularies.
- **No auth, deliberately — and the condition that buys the exemption is now
  ENFORCED** [MS-8c]. §3.1 says every tower API takes a bearer token; this one
  binds `127.0.0.1:8185`, is not tailnet-exposed, and returns no secrets —
  endpoints, model ids and fallback policy, all of which its callers already
  need. ⚠️ *"If it is ever exposed beyond loopback it takes the token like
  everything else."* ⛔⛔ **That sentence was the whole security model and
  nothing evaluated it**: the bind was a literal in two files, and flipping both
  to `0.0.0.0` left the suite green (measured 2026-08-21). `require_loopback()`
  now refuses any `--listen` host that resolves to an address reachable off the
  machine — **before a socket is opened** — naming the ruling in the FATAL line,
  and `tests/test_bind.py` derives every `--listen` the repo ships (the code
  default **and** every unit file) and fails on a flipped literal independently.
  ⛔ Enforcing the condition is **not** adding auth: exposing the service is the
  plan's decision to make, and it now has to be made deliberately.
- **Single-host, deliberately** [MS-7]. Multi-host adds a *dimension* to the
  lookup; it does not rewrite the schema. Do not design cross-host placement
  before a second machine exists.
