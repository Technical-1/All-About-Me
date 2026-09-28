# Project Q&A

## Overview

Kid Talk Translator Pro is a web app that helps adults keep up with Gen Alpha and Gen Z slang. It runs at [kidtalktranslator.app](https://kidtalktranslator.app) and pairs a curated slang dictionary (126 terms in the bundled seed, growing live through Firestore) with LLM-backed translation in both directions (Anthropic Claude Haiku 4.5) — decode slang into plain English, or encode plain English into current slang — plus a browsable dictionary and community-submitted terms with real-time voting. The community layer is backed by Firestore security rules that enforce vote integrity and daily-submission caps server-side rather than trusting the client.

## Problem Solved

Modern youth slang turns over fast and is contextual — a single term can flip meaning between TikTok, gaming, and ironic use. A static dictionary goes stale within months; an LLM-only answer is plausible but unverifiable. This app pairs a curated source of truth with on-demand model analysis so parents, teachers, and grandparents get a fast, authoritative read on what a phrase actually means in context.

## Target Users

- **Parents and grandparents** — paste a message from a kid and get an instant, plain-English breakdown
- **Teachers and youth workers** — quick reference for terms that show up in classrooms and DMs
- **Curious adults** — browse by era/origin to keep up with how language is evolving

## Key Features

- **Smart Decode** — Detects whether input is a single term, sentence, or multi-line conversation, then highlights slang inline with clickable definitions, drawing on both the local dictionary and an LLM running in parallel
- **Encode (Reverse Translation)** — Type a phrase the way an adult would say it and get it rewritten in current kid slang at three intensity levels (lightly seasoned → medium → full Gen Alpha), each copyable, with a glossary of the terms used; the model is steered toward the curated dictionary so most output terms link to vetted definitions
- **Curated-Only Lookups**: Decode and Browse answer from the curated dictionary and approved community terms; a miss says so and makes no network request
- **Community Submissions** — Users sign in with Google or Apple, submit new slang terms, and upvote/downvote submissions with real-time Firestore sync
- **Dark Mode** — Follows the OS appearance until the user toggles; only an explicit toggle is persisted to localStorage
- **PWA** — Installable progressive web app with offline access to the local dictionary
- **Rich Metadata** — Every local term carries definition, example usage, wrong-usage warnings, era, origin platform, type classification, and pronunciation guide

## Technical Highlights

### Dual Translation Engine
Every decode request fans out to two engines in parallel. The local dictionary (sorted by term length so multi-word phrases match before their constituent words) returns instantly with curated entries; an LLM call returns shortly after with cultural context and tone notes. The UI renders dictionary hits immediately and slots the AI commentary in when it arrives, so latency never blocks the primary answer. The shared term-matching helper `webapp/src/utils/findTermsInText.js` powers both decode (`useTranslation`) and the encode glossary (`mergeGlossary`), so word-boundary bugs only need to be fixed once. A dictionary miss renders a "No slang detected" row with no network request; the AI panel still answers.

### Firestore Rules as the Integrity Contract
Voting writes both the per-user vote doc and the submission's aggregate counters (`upvotes`, `downvotes`, `netScore`) inside a Firestore client transaction. But the *real* guarantee lives in `firebase/firestore.rules`: each counter delta is bounded to ±1, `netScore` must equal `upvotes − downvotes` after the write, only the three counter keys may change, and the per-user daily counter doc enforces the 5-submissions-per-UTC-day cap with explicit same-day-increment and new-day-reset shapes. The client transaction's job is to satisfy the rules; the rules are unit-tested against the Firestore emulator and a regression that loosens an invariant fails CI.

### Encode: Dictionary-Anchored Generation with a Trust-Tiered Glossary
The encode direction can't reuse the decode pipeline — the local dictionary is a forward index with no "meaning → slang" lookup. Instead, `webapp/api/ai-encode.js` injects the curated dictionary's terms and definitions into the system prompt so the model *prefers* terms the app can link to vetted definitions, while still allowing other current slang, and returns three intensity-graded rewrites plus a glossary. The response is validated and each variation/glossary entry is reconstructed from only its declared fields before being written to the 30-day KV cache, so a malformed or adversarial model response can't poison it. On the client, `webapp/src/utils/mergeGlossary.js` then re-detects curated terms in the output via the shared `findTermsInText` matcher (those get vetted definitions, listed first) and folds in the model's own glossary for the rest — a trust-tiered list that `EncodeGlossary` caps at six with a "Show all" toggle.

### Feature-Scoped Architecture with a Single Listener
`App.jsx` is a ~40-line shell. Each tab (Decode, Browse, Community) lives in its own directory with co-located components, and business logic is pushed into four hooks. `ApprovedTermsContext` owns the only `onSnapshot` subscription for approved community submissions — both `useDictionary` and `useCommunity` consume the same stream, halving the Firestore listener count and eliminating duplicate-result races between the two consumers.

### Layered Caching + Per-IP Rate Limiting
Vercel KV caches LLM responses server-side in production. On the client, an in-memory `Map` covers the current session and a 20-entry LRU in `localStorage` persists AI translations across reloads. The same KV instance also stores per-IP rate-limit counters via `webapp/api/_lib/rate-limit.js`, which falls back to a self-pruning in-memory map when KV is unavailable instead of erroring. Anonymous requests without `x-forwarded-for` share an `unknown` bucket rather than getting a bypass.

### Firestore-Published Dictionary with a Bundled Seed
The canonical dictionary lives in Firestore, and a Cloud Function collapses every edit burst into one versioned `published/dictionary` document. Clients (web and iOS) ship a bundled seed for first launch, read the published document once per launch, and swap newer versions in live with a strictly-forward version check and shape validation — so content updates reach every platform in one launch with zero deploys, and a malformed publish can never replace a healthy dictionary.

## Engineering Decisions

### Dictionary + LLM instead of LLM-only
- **Constraint**: Answers need to be both fast and trustworthy; an LLM-only design is neither (cold latency on every miss, and no way to vouch for the definition)
- **Options**: LLM-only with caching; dictionary-only with crowdsourced updates; hybrid
- **Choice**: Hybrid — curated dictionary fronts the LLM, both run in parallel on decode
- **Why**: The dictionary covers the common case in <50ms with verified definitions; the LLM handles the long tail and adds cultural nuance. Users never wait on the model to see *something*.

### Keep-mounted tabs instead of conditional rendering (state persistence)
- **Constraint**: Tabs were rendered conditionally and unmounted on switch, so moving between decode and encode wiped whatever you'd typed. But rendering all tabs unconditionally would eagerly bundle every tab and defeat the lazy-loaded code-split chunks
- **Options**: Lift every tab's state into shared context; render all tabs always; mount-on-first-visit then keep hidden
- **Choice**: `TabPanels` mounts a tab the first time it's opened and thereafter keeps it mounted but hidden (`display:none`) rather than unmounting; never-visited tabs aren't rendered
- **Why**: React preserves a hidden subtree's state, so switching away and back is lossless with no re-fetch or flash — while unvisited tabs keep their separate chunks and load on demand. No per-field state-lifting and no bundle-size regression

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

### Serverless proxies for the AI calls
- **Constraint**: The Anthropic API key can't ship to the browser, and the AI endpoints need caching and abuse limits
- **Options**: Call the API from the client with a restricted key; run a separate Express server; Vercel serverless functions next to the static site
- **Choice**: Same-origin `/api/ai-translate` and `/api/ai-encode`, answered by Vercel's filesystem-routed functions that share one set of CORS, KV and rate-limit helpers
- **Why**: One deploy target, secrets stay server-side, and every endpoint gets the same protections.

### Curated dictionary only (vs. a third-party fallback)
- **Constraint**: Unmatched terms used to fall back to Urban Dictionary, but its terms of service allow API access only with express permission, which the project never had
- **Options**: Keep the fallback and hope; ask for permission and wait; answer from the curated and community dictionary alone
- **Choice**: Removed the fallback, its proxy endpoint, content filter and dev proxy. A miss shows "No slang detected" (Decode) or a no-results card (Browse)
- **Why**: Every dictionary result is now vetted, no request leaves the app on a miss, and the AI panel and community submissions still cover the long tail.

### Dictionary updates without deploys (vs. baking terms into the bundle)
- **Constraint**: New terms must reach both the website and the iOS app without a
  rebuild — an App Store release cycle per vocabulary update is a non-starter
- **Options**: Rebuild-and-deploy per change; per-term Firestore reads on every client; one published document synced on launch
- **Choice**: Terms live in a Firestore collection; a debounced Cloud Function publishes ONE versioned document that clients read once per launch, cache locally, and fall back from (cache → bundled seed) when offline
- **Why**: One document read per launch keeps Firestore costs flat regardless of dictionary size, the version check makes rollback-safety explicit (clients refuse stale or malformed payloads), and both platforms share identical sync semantics.

## Frequently Asked Questions

### How does smart decode classify a single word vs. a conversation?
`detectInputType` looks for line breaks, sentence-ending punctuation, and word counts. Conversations get processed line-by-line so each utterance's slang is annotated inline with brackets; single terms and short sentences hit the term-matching path that sorts the dictionary by term length (longest first) before scanning, so "no cap" matches before "no" does.

### How does the Encode tab generate slang?
You type a phrase in plain English and `webapp/api/ai-encode.js` asks Claude Haiku 4.5 for three rewrites along an intensity spectrum — lightly seasoned, medium, and full Gen Alpha — plus a glossary of the slang it used. The system prompt injects the curated dictionary's terms so the model leans on words the app can link to vetted definitions. Each variation is shown on its own card with a copy button and an escalating colour accent, and the glossary alongside re-detects curated terms in the output (vetted definitions first) before falling back to the model's own definitions for anything new.

### Why a separate `/api/ai-encode` endpoint instead of reusing decode?
Encode returns a different shape from decode (intensity-graded variations + glossary vs. a single translation + vibe), and the local dictionary can't run in reverse. Folding both into one handler would mean branching two contracts through the same function. A dedicated endpoint keeps the proven decode path untouched, gives encode its own cache namespace and rate-limit bucket so the two can't collide, and lets its prompt and response validation evolve independently. The shared CORS/KV/rate-limit helpers in `webapp/api/_lib/` are still reused, so the new endpoint is essentially a prompt plus a validator.

### Does switching tabs lose what I typed?
No. Once you've opened a tab it stays mounted (just hidden) rather than being torn down, so its input and results persist when you switch away and come back — decode and encode each remember their own state. Tabs you've never opened still aren't loaded until first use, so this doesn't bloat the initial bundle. The behaviour is covered by unit tests in `webapp/src/components/__tests__/TabPanels.test.jsx`.

### What happens when a term isn't in the dictionary?
Decode shows a "No slang detected" row and Browse shows a no-results card; neither makes a network request. The AI insight panel still explains the input on decode, and anyone signed in can submit the term to the community feed. The app used to fall back to Urban Dictionary here; that was removed because Urban Dictionary's API terms require express permission, which the project never had. The "trending" row in Browse is a random sample of the local dictionary, not an external feed.

### Is there automatic ingestion of new slang?
No. A weekly job that discovered candidates through Urban Dictionary's autocomplete API was built but never enabled, and it was deleted on 2026-09-28 because Urban Dictionary's API terms require express permission. New terms arrive through curation and community approval.

### How are abusive or spammy community submissions handled?
Six layers, each a backstop for the one above it: a client-side blacklist (`webapp/src/utils/blacklist.js`) rejects profanity, slurs, and Unicode-confusable look-alikes at submit time; the per-IP API rate limiter throttles abusive clients; Firestore rules enforce the 5-per-UTC-day cap and bind every vote-counter change to a real per-user vote document written in the same transaction, so counters can't be forged; submissions only graduate after 25+ verified net upvotes with zero open reports (a Cloud Function recounts the actual vote documents before promoting); every submission carries Report and Block actions on both platforms, with reports going straight to a human moderator who works from a claim-gated dashboard; and nothing is ever auto-hidden — removal is always a logged human decision.

### What model powers the AI insight panel?
Anthropic Claude Haiku 4.5, called via `@anthropic-ai/sdk` from a Vercel serverless function (`webapp/api/ai-translate.js`). Haiku was chosen for cost and latency — slang explanations don't need a frontier model, and the cached prompts amortise across users.

### Does the app work offline?
Partially. The PWA service worker (`vite-plugin-pwa`) caches the app shell and bundles the local dictionary, so every curated term in the bundled seed (and the last synced dictionary) works offline. AI insight, encode, and community features require connectivity.

### How is dark mode implemented?
Tailwind's `darkMode: 'class'` strategy. `ThemeContext` follows OS `prefers-color-scheme` (including live changes) until the user toggles, persists only explicit toggles to localStorage, and adds/removes the `dark` class on `<html>`. Every component uses `dark:` variants.

### How do I add a slang term manually?
Add it to the seed file `shared/slangDictionary.js` (with `definition`, `example`, `wrongUsage`, `era`, `origin`, `type`, and `pronunciation`), then run `node scripts/seed-dictionary.mjs` to push it to Firestore. The publisher Cloud Function regenerates the published dictionary document and every client — web and iOS — picks it up on next launch, with no deploy.

### What's the test setup?
240 tests across 33 files using Vitest and React Testing Library — covering layout components (including tab-state persistence in `TabPanels`), the hooks layer (notably `useAiTranslation` and `useEncode`), the decode path (including a test that a dictionary miss makes no network request), the live dictionary store (cache hydration, version regression, poisoning guards), the auth/theme/approved-terms contexts, the term-matching and glossary-merge helpers, the API handlers (`ai-translate`, `ai-encode`), and the shared API helpers (`cors`, `kv`, `rate-limit`). Firestore security rules have their own emulator-backed test suite under `firebase/__tests__/` driven by `@firebase/rules-unit-testing`. CI (`.github/workflows/ci-v2.yml`) runs lint, unit tests, rules tests against the Firebase emulator (requires JDK 21), and a production build on every push and PR.

### How does the API protect itself from abuse and misconfigured origins?
Every handler under `webapp/api/` routes through `webapp/api/_lib/`. `cors.js` is a single-source allowlist for production and dev origins; `rate-limit.js` enforces per-IP buckets backed by Vercel KV with a self-pruning in-memory fallback so a transient KV outage degrades to memory-limit rather than no-limit; `kv.js` exposes an `isReal` flag so the unit tests can swap in a stub without monkey-patching. Anonymous requests (no `x-forwarded-for`) share an `unknown` bucket so they're still rate-limited rather than getting a bypass.
