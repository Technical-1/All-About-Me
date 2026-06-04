# Project Q&A

## Overview

Second Brain is a desktop daily planner that consolidates everything competing for my attention — tasks, emails, calendars, Teams messages, and a linked project tracker — into one SQLite-backed backlog, then uses the Anthropic Claude API to turn that backlog into a realistic, time-blocked day. It's built as a Tauri 2 app with a Rust core, a React front end, and a Node sidecar that owns the third-party API surface. The interesting part is the orchestration: a single local app coordinates several external services, an LLM, and a local vector store while keeping all credentials and data on the machine.

## Problem Solved

My work lived in too many places — a couple of inboxes, two calendars, Teams, and a project tracker — and "planning my day" meant manually reconciling all of them. Second Brain ingests those sources into one backlog and then does the part I'm worst at: deciding what actually fits in the hours I have, around the meetings I can't move.

## Target Users

- **People juggling multiple inboxes and calendars** — anyone whose tasks are scattered across Gmail, Outlook, and Teams and who wants a single prioritized list.
- **Planners who want a schedule, not just a to-do list** — the app produces time blocks for the day, not another flat backlog.
- **Privacy-conscious users** — everything is a local desktop app with a local database and encrypted tokens.

## Key Features

### Unified, deduplicated backlog
Tasks, emails, calendar events, Teams messages, and imported work events all flow into one `tasks`/events store, each tagged with its source. Unique indexes on the source identity prevent the same item from being imported twice.

### AI scheduling
Claude scores the open backlog against the active week's objectives and due dates, and a second pass turns objectives plus working hours into day-by-day time blocks that schedule around fixed calendar events. When the day slips, a replan regenerates only the remaining blocks from the current time.

### Email triage with memory
Gmail and Outlook sync with a paginated backfill followed by incremental updates. Claude classifies each email (category, priority, extracted action items), and a separate pass distills a contact/project "memory" summary used as context for future scoring.

### Local semantic file search
I can attach reference files to an organization and search them by meaning. Embeddings are generated through Voyage AI and stored directly in SQLite, with similarity computed locally — no external vector database.

## Technical Highlights

### Embeddings stored in SQLite, searched in Rust
Rather than adding a vector database, document embeddings are serialized as little-endian `f32` BLOBs into a `file_chunks` table and scored with cosine similarity in `commands/embeddings.rs`. The search loads a bounded candidate set (`ORDER BY created_at DESC LIMIT`) so memory and latency stay flat as the corpus grows, and the chunker walks Unicode scalar values rather than byte offsets so multi-byte text can never split mid-character.

### Atomic compound writes on a shared connection
The core runs on one SQLite connection (WAL mode) behind a mutex, with each multi-statement write wrapped in `BEGIN IMMEDIATE`/`COMMIT` and rolled back on any failure — including a failed commit, which would otherwise leave a transaction open on the shared connection. Generating a weekly schedule, for example, persists the schedule row and every time block for a day as one unit, so a mid-write failure never leaves an orphaned, block-less schedule (`commands/ai.rs`, `commands/weekly_plans.rs`).

### Streaming a long subprocess to the UI with a hard timeout
Repository investigation spawns an external analysis process and reads its newline-delimited JSON output line by line, forwarding each event to the front end through Tauri's event system. The whole read loop is bounded by a wall-clock timeout that force-kills and reaps the child, which matters because the external tool can write its result and then fail to exit — without the bound, the task would hang forever (`commands/project_hub.rs`).

### Treating model inputs as untrusted data
Every Claude call that embeds user content (emails, tasks, brain dumps, Shopify emails) carries a system instruction that the tagged content is data to be analyzed, not instructions to follow, and outbound calls set explicit timeouts. This keeps adversarial email content from steering classification or scoring (`sidecar/src/services/claude.ts`).

## Engineering Decisions

### A second process for the API surface
- **Constraint**: The app needs Google, Microsoft, and Anthropic clients, all of which are most mature in JavaScript.
- **Options**: Reimplement OAuth/Graph/Gmail in Rust, or run a JS process alongside the Rust core.
- **Choice**: A small Express sidecar on loopback, authenticated with a shared token.
- **Why**: It avoids a large, fragile reimplementation and keeps the Rust core focused on storage and OS integration; the cost is one extra local process.

### Brute-force vector search instead of an index
- **Constraint**: Semantic file search on a single user's documents, with no infrastructure to manage.
- **Options**: Embed a vector database, or scan embeddings directly.
- **Choice**: Store embeddings in SQLite and scan a capped candidate set.
- **Why**: At desktop scale a bounded linear scan is simpler and fast enough, and it keeps everything in one database file. The candidate cap is the lever that keeps it bounded as data grows.

### Versioned schedules rather than in-place edits
- **Constraint**: Replanning the rest of the day must not destroy the original plan.
- **Options**: Mutate the existing schedule, or write a new version.
- **Choice**: Auto-increment a `version` per date and write a new schedule on replan.
- **Why**: Non-destructive history makes "regenerate from now" safe and reversible.

### Local-first storage with encrypted credentials
- **Constraint**: The app holds OAuth tokens and personal data.
- **Options**: A hosted backend, or keep everything on-device.
- **Choice**: A local SQLite database with AES-256-GCM-encrypted tokens.
- **Why**: There's no reason this data should leave the machine; authenticated encryption protects the tokens at rest.

## Frequently Asked Questions

### How does the daily schedule avoid double-booking meetings?
Calendar events are pulled in as fixed constraints. When generating a schedule, the planner passes those events to the model as immovable and asks it to place task blocks around them with buffers, so meetings are scheduled first and work fills the gaps.

### Does my email and task data leave my machine?
The database is local and tokens are encrypted at rest. Data does leave the machine only when a feature explicitly calls a third party — e.g. content sent to Claude for scoring or to Google/Microsoft for sync — and those calls go out through the local sidecar.

### Why is there a separate Node process running?
The Google, Microsoft, and Anthropic integrations rely on JavaScript SDKs. The sidecar isolates all of that on loopback (`127.0.0.1:3847`) and the Rust core talks to it over HTTP with an auth token, so the front end never touches a third-party API directly.

### How does file search work without a vector database?
Uploaded files are chunked and embedded through Voyage AI; the embeddings are stored as binary blobs in SQLite. A search embeds the query and computes cosine similarity against a bounded set of stored chunks, all locally.

### What happens when I'm behind schedule?
The "replan" action regenerates only the remaining blocks from the current time, writing a new schedule version so the original plan is preserved.

### Which email providers are supported?
Gmail and Outlook, plus Microsoft Teams messages and Google/Microsoft calendars. Work calendars can also be imported from a screenshot or an `.ics` file.

### Can I import a calendar from an image?
Yes — drop in a screenshot and the app uses Claude's vision capability to extract events into structured entries, or import a standard `.ics` file.
