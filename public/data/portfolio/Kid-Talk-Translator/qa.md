# Project Q&A

## Overview

Kid Talk Translator Pro is a web app that helps adults decode Gen Alpha and Gen Z slang. It pairs a curated local dictionary of 100+ terms with LLM-backed contextual analysis (Anthropic Claude Haiku 4.5) and live Urban Dictionary lookups, exposing smart decoding, a browsable dictionary, and community-submitted terms with real-time voting. The community layer is backed by Firestore security rules that enforce vote integrity and daily-submission caps server-side rather than trusting the client.

## Problem Solved

Modern youth slang turns over fast and is contextual — a single term can flip meaning between TikTok, gaming, and ironic use. A static dictionary goes stale within months; an LLM-only answer is plausible but unverifiable. This app pairs a curated source of truth with on-demand model analysis so parents, teachers, and grandparents get a fast, authoritative read on what a phrase actually means in context.

## Target Users

- **Parents and grandparents** — paste a message from a kid and get an instant, plain-English breakdown
- **Teachers and youth workers** — quick reference for terms that show up in classrooms and DMs
- **Curious adults** — browse by era/origin to keep up with how language is evolving

## Key Features

- **Smart Decode** — Detects whether input is a single term, sentence, or multi-line conversation, then highlights slang inline with clickable definitions, drawing on both the local dictionary and an LLM running in parallel
- **Live Urban Dictionary Integration** — Real-time lookups for terms not in the curated dictionary, plus trending word feeds
- **Community Submissions** — Users sign in with Google or Apple, submit new slang terms, and upvote/downvote submissions with real-time Firestore sync
- **Dark Mode** — Light/dark toggle persisted to localStorage and honouring OS preference
- **PWA** — Installable progressive web app with offline access to the local dictionary
- **Rich Metadata** — Every local term carries definition, example usage, wrong-usage warnings, era, origin platform, type classification, and pronunciation guide

## Technical Highlights

### Dual Translation Engine
Every decode request fans out to two engines in parallel. The local dictionary (sorted by term length so multi-word phrases match before their constituent words) returns instantly with curated entries; an LLM call returns shortly after with cultural context and tone notes. The UI renders dictionary hits immediately and slots the AI commentary in when it arrives, so latency never blocks the primary answer. The shared term-matching helper `webapp/src/utils/findTermsInText.js` powers both the local-dictionary path in `useTranslation` and the Urban Dictionary path in `dictionaryService`, so word-boundary bugs only need to be fixed once.

### Firestore Rules as the Integrity Contract
Voting writes both the per-user vote doc and the submission's aggregate counters (`upvotes`, `downvotes`, `netScore`) inside a Firestore client transaction. But the *real* guarantee lives in `firebase/firestore.rules`: each counter delta is bounded to ±1, `netScore` must equal `upvotes − downvotes` after the write, only the three counter keys may change, and the per-user daily counter doc enforces the 5-submissions-per-UTC-day cap with explicit same-day-increment and new-day-reset shapes. The client transaction's job is to satisfy the rules; the rules are unit-tested against the Firestore emulator and a regression that loosens an invariant fails CI.

### Feature-Scoped Architecture with a Single Listener
`App.jsx` is a ~40-line shell. Each tab (Decode, Browse, Community) lives in its own directory with co-located components, and business logic is pushed into four hooks. `ApprovedTermsContext` owns the only `onSnapshot` subscription for approved community submissions — both `useDictionary` and `useCommunity` consume the same stream, halving the Firestore listener count and eliminating duplicate-result races between the two consumers.

### Four-Layer Caching + Per-IP Rate Limiting
Vercel KV caches LLM and Urban Dictionary responses server-side in production. On the client, an in-memory `Map` covers the current session, a 20-entry LRU in `localStorage` persists AI translations across reloads, and a separate 7-day `localStorage` bucket holds popular-word lookups. The same KV instance also stores per-IP rate-limit counters via `webapp/api/_lib/rate-limit.js`, which falls back to a self-pruning in-memory map when KV is unavailable instead of erroring. Anonymous requests without `x-forwarded-for` share an `unknown` bucket rather than getting a bypass.

### Shared Dictionary as Single Source of Truth
`shared/slangDictionary.js` is the canonical store; the web app reads a copy synced into `webapp/src/data/` at build time. Adding a term means editing one file — no schema migration, no rebuild plumbing. The same parser (`scripts/lib/dict-utils.js`) is used by both ingestion workflows so trending and community merges write identical entry shapes.

## Engineering Decisions

### Dictionary + LLM instead of LLM-only
- **Constraint**: Answers need to be both fast and trustworthy; an LLM-only design is neither (cold latency on every miss, and no way to vouch for the definition)
- **Options**: LLM-only with caching; dictionary-only with crowdsourced updates; hybrid
- **Choice**: Hybrid — curated dictionary fronts the LLM, both run in parallel on decode
- **Why**: The dictionary covers the common case in <50ms with verified definitions; the LLM handles the long tail and adds cultural nuance. Users never wait on the model to see *something*.

### Firestore transactions for voting (vs. Cloud Functions)
- **Constraint**: Vote totals must stay consistent under concurrent writes; a Cloud Functions trigger would add cold-start latency and another moving part
- **Options**: Client-side increments (race-prone); Cloud Functions trigger; client-side Firestore transaction
- **Choice**: Client-side transaction that reads the vote doc, computes the delta, and writes both the vote and the counters atomically
- **Why**: Keeps the deploy surface to one (the web app) and gives strong consistency without a serverless cold-start in the voting path.

### Server-side rules instead of trusting the client (vs. trusting the transaction alone)
- **Constraint**: A client-side transaction protects honest concurrent writers but doesn't stop a hand-crafted Firestore write that sets `upvotes: 10000`. The integrity guarantee can't live only in the client code
- **Options**: Cloud Functions-mediated writes; admin SDK with a thin REST layer; tighten Firestore rules
- **Choice**: Push the invariants — bounded counter deltas, `netScore == upvotes − downvotes`, UTC-day cap, dedup via `activeTermLower` — into `firebase/firestore.rules` and unit-test the rules against the Firestore emulator
- **Why**: No extra deploy target, no cold start, and the rules become the contract that any client (current or future) has to satisfy. Tests run in CI via `npm run test:rules`.

### Vite proxy for dev, Vercel functions for prod
- **Constraint**: Urban Dictionary blocks CORS from localhost, and the Anthropic API key can't ship to the browser
- **Options**: Run a separate Express dev server; lean on Vite's proxy in dev and Vercel functions in prod; deploy to two platforms
- **Choice**: Same fetch URLs (`/api/...`) work in both — Vite's `server.proxy` forwards in dev, Vercel's filesystem-routed functions answer in prod
- **Why**: One client codebase, one set of fetch calls, secrets stay server-side, no extra dev dependencies.

### Automated dictionary growth via PRs (vs. direct writes)
- **Constraint**: The dictionary should grow from two upstream signals (Urban Dictionary trending, community votes) without letting unreviewed content into production
- **Options**: Auto-merge on threshold; admin dashboard for review; PR-based review
- **Choice**: Two daily GitHub Actions ingest, filter (UD: 70%+ thumbs-up AND 100+ votes; community: 25+ net upvotes), and open PRs against `shared/slangDictionary.js`
- **Why**: GitHub already has a great review UI, and PR-based flow forces a human to eyeball new terms. Scripts use `JSON.stringify()` for all external content, atomic temp-file writes, and `--body-file` to keep shell injection out of PR bodies.

## Frequently Asked Questions

### How does smart decode classify a single word vs. a conversation?
`detectInputType` looks for line breaks, sentence-ending punctuation, and word counts. Conversations get processed line-by-line so each utterance's slang is annotated inline with brackets; single terms and short sentences hit the term-matching path that sorts the dictionary by term length (longest first) before scanning, so "no cap" matches before "no" does.

### Why both Urban Dictionary and a curated dictionary?
The curated 90+ entries have vetted definitions, examples, wrong-usage warnings, and pronunciation. Urban Dictionary fills the long tail but ranges from gold to garbage, so it's used as a fallback for unmatched terms and as a feed for the trending row — never as the primary source.

### How are abusive or spammy community submissions handled?
Four layers, with each as a backstop for the one above it: a client-side blacklist in `webapp/src/utils/blacklist.js` rejects profanity, slurs, and Unicode-confusable look-alikes at submit time; the per-IP API rate limiter throttles abusive clients (`webapp/api/_lib/rate-limit.js`); Firestore rules enforce the 5-submissions-per-UTC-day cap server-side via the `users/{uid}` counter doc, so even a bypassed client can't exceed it; and the merge pipeline only promotes submissions with 25+ net upvotes, so unendorsed terms never reach the dictionary.

### What model powers the AI insight panel?
Anthropic Claude Haiku 4.5, called via `@anthropic-ai/sdk` from a Vercel serverless function (`webapp/api/ai-translate.js`). Haiku was chosen for cost and latency — slang explanations don't need a frontier model, and the cached prompts amortise across users.

### Does the app work offline?
Partially. The PWA service worker (`vite-plugin-pwa`) caches the app shell and bundles the local dictionary, so all 90+ curated terms work offline. Urban Dictionary lookups, AI insight, trending feeds, and community features all require connectivity.

### How is dark mode implemented?
Tailwind's `darkMode: 'class'` strategy. `ThemeContext` reads OS `prefers-color-scheme` on first load, persists subsequent toggles to localStorage, and adds/removes the `dark` class on `<html>`. Every component uses `dark:` variants.

### How do I add a slang term manually?
Edit `shared/slangDictionary.js` with `definition`, `example`, `wrongUsage`, `era`, `origin`, `type`, and `pronunciation`. The next build syncs it into `webapp/src/data/` and the web app picks it up.

### What's the test setup?
212 tests across 28 files using Vitest and React Testing Library — covering layout components, the hooks layer (notably `useAiTranslation`), the dictionary service, the auth/theme/approved-terms contexts, the term-matching helper, the API handlers (`ai-translate`, `urban-dictionary`), the shared API helpers (`cors`, `kv`, `rate-limit`), and the ingestion scripts. Firestore security rules have their own emulator-backed test suite under `firebase/__tests__/` driven by `@firebase/rules-unit-testing`. CI (`.github/workflows/ci-v2.yml`) runs lint, unit tests, rules tests against the Firebase emulator (requires JDK 21), and a production build on every push and PR.

### How does the API protect itself from abuse and misconfigured origins?
Every handler under `webapp/api/` routes through `webapp/api/_lib/`. `cors.js` is a single-source allowlist for production and dev origins; `rate-limit.js` enforces per-IP buckets backed by Vercel KV with a self-pruning in-memory fallback so a transient KV outage degrades to memory-limit rather than no-limit; `kv.js` exposes an `isReal` flag so the unit tests can swap in a stub without monkey-patching. Anonymous requests (no `x-forwarded-for`) share an `unknown` bucket so they're still rate-limited rather than getting a bypass.
