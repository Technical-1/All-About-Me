# Project Q&A

## Overview

Orbit is a personal relationship knowledge graph built from my own iMessage history. It reads `chat.db` and the macOS AddressBook, stores each contact as a Person entity with tagged observations (frequency, topics, tone, biography, sentiment) in an MCP memory server, and renders the result as a Next.js app with 27 page routes: a network graph, per-person deep dives, a ranked insights feed, drift views, a year-in-review, and a chat panel. The interesting part is the fully local build path: a loopback-only daemon runs a 4-bit Gemma model through MLX on my Mac, and every fact the model proposes has to survive a verifier that quotes the supporting message and an attribution check that confirms the fact is about the right person.

## Problem Solved

iMessage holds years of relationship signal — who I actually talk to, who I've drifted from, when conversations turned warm or cold — but the Messages app only shows the latest thread. Orbit turns that history into a graph and a set of dashboards. Because the input is someone's entire private message history, it does this without sending a single message to a cloud model.

## Target Users

- **Me, primarily** — a single-user tool that runs on my Mac against my own message store.
- **Other Mac users** — the per-user config, owner auto-detection, and first-run onboarding mean it no longer assumes my handles, my contacts, or my machine.
- **Engineers interested in small local models** — the pipeline is a worked example of getting reliable structured output from a 4-bit model through verification, constrained decoding, and deterministic guards.

## Key Features

### Always-on local intake
`orbit-intaked` watches `chat.db`, waits out a 15-minute debounce after activity, and refreshes changed contacts one at a time. It starts the model only when there is work, stops it after five idle minutes, waits for AC power by default, and streams per-contact progress to the app's Refresh button and status chip.

### Grounded biography and topics
Every topic and bio claim is checked against the message window it came from. Claims without a quoted receipt are stripped, wrong-person facts are stripped or rewritten as relation-scoped facts, and the kept claims and receipts are appended to an audit log.

### Insights feed
`/insights` combines signals that no single page shows: a relationship well below last year's volume, a message from them waiting on you, conversations you almost always start, a falling sentiment trend, a contact rising fast, a friend group going quiet. Each item gets a calibrated severity and priority score.

### Circles
Communities come from weighted Louvain over knowledge-graph relations plus shared group-chat membership. Each circle opens to `/cluster/[anchor]` with its density, its quiet members, and the group chats that bind it.

### Per-person deep dive (`/person/[name]`)
Lifetime totals and year-over-year network rank from SQL, TF-IDF topic chips and a topic timeline, sentiment arc, rhythm fingerprint, p50/p95 reply times, tapback affect and reciprocity, attachments, and a message timeline, with rule-based noticings alongside.

### Local chat
`/chat` lets me ask questions about my relationships. The daemon answers with the local model and may call only read-only graph and message tools; it has no access to the send tool.

### Onboarding and privacy controls
The Electron app detects the owner's handles from `chat.account_login`, asks "is this you?", writes `user-config.json`, and seeds the graph. The same config can turn off extraction dimensions, exclude handles or names, and redact patterns from transcripts before the model sees them.

## Technical Highlights

### Verify, then check who the receipt is about
A verified receipt is not enough: in one real case a sibling's graduation and employer were attributed to the contact, because a genuine supporting quote existed in the same conversation window. The pipeline therefore runs two passes after extraction. `scripts/lib/verify.mjs` asks "is there a quote that supports this?" and returns KEEP/STRIP with a receipt. `scripts/lib/attribution.mjs` then asks "who does that quote identify?" as a three-way decision (CONTACT, OWNER, THIRD_PARTY), so a third-party fact can be rewritten as "brother works at …" instead of being lost. Both use static JSON schemas with the reasoning field ordered before the verdict, so the model reasons before it commits.

### Deterministic guards where model judgment fails
Some bad claims always have a receipt: the contact's own name or phone number written as a bio fact, a first-person message pasted verbatim, or a four-word fragment. `scripts/lib/lint.mjs` strips those by rule after verification. The validation gate (`scripts/lib/validate.mjs`) rejects duplicate tag lines, and the write guard replaces tagged lines in code. The model also never does arithmetic: `[freq]` comes from SQL, and `[sent]` averages and 90-day trends are computed from the monthly rows the model appends.

### Reading the whole history inside a small context
Long relationships do not fit in one prompt, and a recent-only sample misses facts established years ago. `messagesTextChunks` in `scripts/lib/chats.mjs` samples densely from the earliest and latest messages plus a stratified middle, decodes `attributedBody` blobs for messages that have no plain `text`, and packs the result into up to three windows of about 12,000 characters. Each later window is told what earlier ones established, and each claim is verified against the window it came from.

### A memory-safe model lifecycle
`scripts/lib/mlx.mjs` refuses to start the server below 55% free memory, kills any stray server so only one model process exists, health-probes before trusting an "up" state, and stops the server when idle. A headroom refusal pauses the batch with the contact still queued rather than marking it failed; three real failures quarantine a contact so one bad thread cannot block a sweep.

## Engineering Decisions

### Small local model with verification over a larger model
- **Constraint**: Private input, a 24 GB Mac, and a model that has to share the machine.
- **Options**: A cloud model; a 26B local model; a 4-bit E4B model with grounding checks.
- **Choice**: Gemma 4 E4B (4-bit QAT, MLX), pinned in `docs/local-llm-benchmark.md`.
- **Why**: The 26B model passed tool-call qualification but was disqualified on memory during the golden-set evals. The small model's real failures were invented or misattributed facts, which verification addresses directly and at lower cost than a bigger model.

### Loopback guard enforced in code
- **Constraint**: "Nothing leaves the machine" should be checkable, not a promise.
- **Options**: Trust the code paths; firewall rules; a process-wide guard.
- **Choice**: `installLoopbackGuard()` wraps the global `fetch` before any other daemon code runs and throws for any host other than loopback. The API binds to `127.0.0.1` and only sends CORS headers to `localhost` origins.
- **Why**: Any future dependency or code path that tries to call out fails loudly instead of leaking.

### Reproducible serving over prompt-cache speed
- **Constraint**: Comparing pipeline changes needs the same input to give the same output.
- **Options**: Accept run-to-run variance and average many runs; make serving deterministic.
- **Choice**: Disable the MLX prompt cache (`--prompt-cache-size 0`), keep temperature 0, and use static, unbounded schemas so guided decoding compiles once and stays small.
- **Why**: With the cache enabled, identical temperature-0 runs diverged. Chunks share no prefix, so the cache was not buying speed anyway. N-run score distributions (`scripts/gate-nruns.mjs`) still guard against reading noise as signal.

### SQL-only coverage before any model run
- **Constraint**: A rationed model can only enrich so many contacts per sweep, but every page needs every meaningful contact.
- **Options**: Wait for the model to reach everyone; create nodes deterministically.
- **Choice**: `scripts/coverage.mjs` creates a Person for every 1:1 contact named in Contacts or with 50+ messages, with real `[freq]` stats and `unknown` judgment fields.
- **Why**: The graph is complete on day one, and model enrichment is a replace-by-tag upgrade instead of a prerequisite.

### Two build paths sharing one store
- **Constraint**: Prompt-driven runs with a cloud client were the original workflow; the local daemon replaced them for routine use.
- **Options**: Drop the prompt path; maintain two stores; share one.
- **Choice**: Both write through the same `memory` MCP server defined in `.mcp.json`. The Electron Refresh button picks the path from `ORBIT_LLM` or `data/settings.json`.
- **Why**: The schema convention, frontend, and backups stay identical whichever path built the graph.

## Frequently Asked Questions

### How is the graph built now?
In local mode, `node scripts/setup.mjs all` seeds coverage, and the launchd daemon (`scripts/install-daemon.mjs`) keeps it current: activity on `chat.db` triggers a sweep, and each changed contact goes through SQL stats, sampled transcript windows, extraction, verification, recall, attribution, lints, and a single replace-by-tag write. In prompt mode, you paste `prompts/bootstrap.md` and then `prompts/update.md` into an MCP-capable client.

### Which model does it use, and can I change it?
`mlx-community/gemma-4-e4b-it-qat-OptiQ-4bit`, read from the `CHOSEN_MODEL:` line in `docs/local-llm-benchmark.md`. Set `ORBIT_LOCAL_MODEL` to try another MLX model; it has to emit well-formed OpenAI-style tool calls, which `scripts/qualify-model.mjs` checks.

### How do you know the extraction is any good?
`scripts/score-graph.mjs` scores the graph against a frozen gold set: answers extracted by a larger frontier model from byte-identical transcripts, so a score gap reflects the local model rather than different input. Scoring uses lexical matching and an optional local-embedding tier, and `scripts/gate-nruns.mjs` runs each contact several times to compare score distributions rather than single draws. Every kept claim's receipt is in `viz/data/receipts.jsonl`, and groundedness totals (proposed, verified, stripped) are reported on the daemon's `/health` endpoint.

### Does anything leave my Mac?
Not in local mode. The model, both MCP servers, and the daemon run locally, the daemon's `fetch` is restricted to loopback, and its API listens on `127.0.0.1`. Prompt mode is different: it sends message text to whichever LLM client you choose to run.

### How does sentiment scoring work?
For each contact the model scores months from −1 to +1 with a short rationale and appends one row per month to `viz/data/sentiment.jsonl`; a rescored month replaces its earlier row. Code computes `avg`, `latest`, and `trend_90d` (over calendar-month windows) into the `[sent]` line. A lint flags a `[tone]` that contradicts the sentiment. `/sentiment` shows diverging bars, and the person page shows the arc.

### What happens to group chats?
Group threads have their own `/groups` and `/groups/[id]` pages with member distribution and group-specific noticings (your share of the conversation, silent members, newest member). Shared group membership also feeds the co-occurrence weights that shape the network's communities.

### Why does Contacts access matter?
It is optional. With it, unmapped handles resolve to real names, the coverage pass can include named contacts below the 50-message threshold, and owner detection can find a display name. Without it, everything falls back to raw phone numbers and emails.
