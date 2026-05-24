# Project Q&A Knowledge Base

## Overview

Orbit is a personal relationship knowledge graph built from my own iMessage history. It pairs two MCP servers — one for reading messages, one for the knowledge graph — with a Next.js + Cytoscape frontend. I run prompts in a Claude Code session to seed and update the graph, then browse the results in the browser (or an Electron window). The whole thing is local-only and macOS-only; nothing leaves my machine.

## Key Features

- **Tagged-observation graph schema**: Each Person carries `[freq]`, `[topic]`, `[tone]`, `[bio]`, and optional `[sent]` observations. Updates replace tagged lines instead of appending, so the graph stays clean across many refreshes.
- **Network visualization**: Cytoscape layout with Louvain-detected communities color-coded.
- **Per-person deep dive (`/person/[name]`)**: Frequency, rhythm fingerprint, topic cloud, sentiment arc, response-time stats, attachment gallery, message timeline.
- **Drift detection**: `/ghosts` surfaces people I've lost touch with; `/initiation` shows who chases whom; `/responsiveness` shows reply latency.
- **Wrapped slideshow**: Spotify-Wrapped-style year-in-review of conversations, sentiment, top contacts, busiest day, hour fingerprint.
- **Electron wrapper**: Optional native window with an in-app Refresh button that spawns `claude` to run the update prompts in the background.

## Technical Highlights

### Using MCP servers as the integration layer instead of writing my own
The trickiest thing about this project would normally be the iMessage SQLite parsing and a knowledge-graph store. Both already exist as MCP servers (`mac-messages-mcp` and `@modelcontextprotocol/server-memory`). Wiring them into `.mcp.json` and then encoding the workflow in pasteable Markdown prompts meant I never had to write or maintain integration code — the prompts are the "application logic" for the seeding pipeline.

### Tag-replace semantics for idempotent updates
The hardest part of any incremental ingestion is *not* duplicating data. The convention "each Person has exactly one `[freq]` line, one `[topic]` line, etc., and updates delete-then-add the entire line" makes the update loop trivially safe. The frontend then parses with a one-liner: `obs.find(o => o.startsWith("[topic]"))`. No schema, no migrations, no merge conflicts.

### Reading SQLite from server components
Some views (gallery, per-person message bodies, attachment IDs) need raw data the MCP server doesn't expose. Opening `chat.db` directly with `better-sqlite3` in a server component, marked `server-only`, gives those pages full access without exposing anything to the browser bundle. The Next.js request-memoization layer means each route opens the DB at most once per request.

## Development Story

- **Timeline**: Iterative project — the MCP wiring and bootstrap flow came first, then the frontend pages were added one at a time as I noticed something I wanted to see (e.g., `/ghosts` after realizing I'd lost touch with several friends; `/hygiene` after seeing a lot of unnamed handles in the graph).
- **Hardest part**: Entity disambiguation — the same person can show up under multiple handles (phone, email, iMessage IDs). The `/hygiene` page surfaces unnamed handles with name suggestions from AddressBook so I can merge them by hand rather than guess automatically.
- **Lessons learned**: Pushing the workflow into Markdown prompts (rather than scripts) means the "smart" parts of the pipeline benefit from a real reasoning model every run — e.g., distinguishing transactional threads from relationships, or writing a tone rationale grounded in actual context.
- **Future plans**: Make the AddressBook-source UUID and memory-file path configurable rather than hardcoded; potentially add cross-platform support (Linux/Windows would need a different message source).

## Frequently Asked Questions

### How is the graph actually built?
By a Claude session. I paste `prompts/bootstrap.md` into a Claude Code window opened in this directory. Claude reads messages via the `messages` MCP server, extracts topics/tone/bio per contact, and writes entities + relations via the `memory` MCP server. The memory server appends to `memory.jsonl`, which the Next.js app then re-reads on every page render.

### Why MCP servers instead of just a script?
Two reasons. First, the integrations already existed as MCP servers — no need to re-implement them. Second, the seeding logic involves real judgment (which threads are transactional? what's a good one-line tone rationale?), and putting it in a prompt means Claude does that reasoning every run rather than me trying to encode rules in code.

### Why not use a real database for the graph?
For personal-scale data (~100 contacts), parsing a JSONL file on every page render is fast enough and the operational simplicity is worth it. No migrations, no ORM, easy to inspect by hand, and the MCP server already writes to that format.

### How does sentiment scoring work?
`prompts/sentiment.md` scores each top contact per month (-1 to +1, with a confidence and short rationale), appending JSONL rows to `viz/data/sentiment.jsonl`. The score is also written back to the Person entity as a `[sent]` observation. The `/sentiment` page shows a sortable table; the per-person view renders the time series as an arc.

### What happens to personal data?
Everything stays local. `viz/data/sentiment.jsonl` and `viz/data/entity_handles.json` contain real names and sentiment rationales, so they're gitignored. The published repo has only the source code, prompts, and conventions — no actual messages, contacts, or graph contents.

### Why is the Electron wrapper optional?
The browser flow (`npm run dev`) is the canonical path. Electron adds a heavy dependency and only really earns its weight if you want the in-app Refresh button (which spawns `claude` headless against the update prompts). For most use it's overkill.

### What was the hardest part to get right?
Entity merging across handles for the same person. The `/hygiene` view shows unnamed handles next to candidate names from AddressBook so I can confirm-and-merge by hand. Doing this automatically would either over-merge (two real people with similar names) or under-merge (one person across iMessage email + iMessage phone).

### What would you improve next?
Make the hardcoded paths in `viz/src/lib/sqlite.ts` (AddressBook UUID) and `viz/src/lib/graph.ts` (npx-cache memory.jsonl path) into a config file or env vars. They're brittle and will break the moment the project is cloned to another machine.
