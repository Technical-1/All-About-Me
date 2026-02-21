# Project Q&A Knowledge Base

## Overview

Kid Talk Translator Pro is a web application that helps adults decode Gen Alpha and Gen Z slang. It combines a curated local dictionary of 90+ slang terms with Claude AI-powered contextual analysis and live Urban Dictionary integration, offering smart decoding, a browsable dictionary, and community-submitted terms with real-time voting.

## Key Features

- **Smart Decode**: Detects whether input is a single term, sentence, or multi-line conversation, then highlights slang inline with clickable definitions — all powered by both a curated dictionary and Claude AI running in parallel
- **Live Urban Dictionary Integration**: Real-time lookups for terms not in the curated dictionary, plus trending word feeds
- **Community Submissions**: Users sign in with Google or Apple, submit new slang terms, and upvote/downvote submissions with real-time Firestore sync
- **Dark Mode**: Toggle between light and dark themes, persisted to localStorage and respecting OS preference
- **PWA**: Installable progressive web app for mobile/desktop use with offline access to the local dictionary
- **Rich Metadata**: Every local term includes definition, example usage, wrong usage warnings, era, origin platform, type classification, and pronunciation guide

## Technical Highlights

### Dual Translation Engine
I built a system that runs two translation engines in parallel for every decode request. The local dictionary provides instant, curated results (sorted by term length to catch multi-word phrases first), while Claude AI analyzes the same input to provide cultural context, nuances, and deeper explanations. Dictionary results appear immediately; AI insights follow shortly after. This gives users both speed and depth.

### Feature-Scoped Architecture
The app started as a single `App.jsx` file but evolved into a clean feature-scoped architecture with 19 components organized into Decode/, Browse/, Community/, and Layout/ directories. Business logic lives in 4 custom hooks (`useTranslation`, `useAiTranslation`, `useDictionary`, `useCommunity`), keeping components focused on rendering. App.jsx is now a thin ~40-line shell.

### Community Voting with Firestore Transactions
I implemented a voting system using Firestore transactions to ensure atomicity. Each vote updates both the individual vote document and the submission's aggregate counters (upvotes, downvotes, netScore) in a single transaction, preventing race conditions. The system also enforces a daily submission limit of 5 per user and deduplicates terms case-insensitively.

### Multi-tier Caching Strategy
I implemented a four-layer caching system to handle API rate limits and costs. Vercel KV provides server-side caching in production. On the client, an in-memory Map caches lookups for the session, localStorage persists popular words for 7 days and AI translations in a 20-entry LRU cache. This means the app stays responsive even if APIs are slow or unavailable.

### Shared Dictionary Architecture
I created a single `shared/slangDictionary.js` file that serves as the canonical source of truth for all 90+ slang terms. This makes adding new terms trivial — edit one file and the web app picks it up automatically.

## Development Story

- **Hardest Part**: Building the dual translation engine — getting dictionary lookup and Claude AI to work in parallel with graceful fallbacks, while handling the different response shapes and caching strategies for each
- **Lessons Learned**: Feature-scoped component architecture with custom hooks scales much better than a monolithic file. The refactor from single-file to 19 components was well worth it — each feature is now independently testable and maintainable
- **Future Plans**: The dictionary now grows automatically via two daily GitHub Actions pipelines — one ingests trending Urban Dictionary terms (70%+ approval, 100+ votes) and the other merges community-approved submissions (25+ net upvotes). Both open PRs for human review before merging

## Frequently Asked Questions

### How does the smart decode feature work?
The decoder first classifies your input using `detectInputType` — is it a single term, a sentence, or a multi-line conversation? For conversations, it processes each line separately, wrapping detected slang in brackets for inline annotation. For terms/sentences, it checks the local dictionary (90+ curated terms sorted by length to catch multi-word phrases) and then Urban Dictionary. Simultaneously, it sends the input to Claude AI for contextual analysis. Results appear in a two-column layout: highlighted text with definitions on the left, AI insight on the right.

### Why use both a local dictionary and Claude AI?
The local dictionary provides high-quality, curated definitions with proper context (examples, wrong usage warnings, pronunciation). Claude AI extends this with cultural nuance, tone analysis, and explanations that a static dictionary can't provide. Running both in parallel gives users instant results plus deeper understanding.

### How does the community submission system work?
Users authenticate with Google or Apple via Firebase. They can submit up to 5 new slang terms per day, which are checked for duplicates (case-insensitive) and filtered through a blacklist. Other users can upvote or downvote submissions, with votes processed as Firestore transactions to keep counters consistent. The submission feed updates in real-time via Firestore's `onSnapshot`.

### How is the app deployed?
The web app deploys to Vercel with the root directory set to `webapp/`. Vite builds to `dist/`, and Vercel handles both static hosting and serverless functions for the API proxies (Urban Dictionary and Claude AI). Security headers (XSS protection, frame denial, content-type sniffing prevention) are configured in `vercel.json`. GitHub Actions runs lint, test, and build on every push/PR.

### How does dark mode work?
Dark mode uses Tailwind's `darkMode: 'class'` strategy. A `ThemeContext` provider manages the state — on first visit it respects the user's OS `prefers-color-scheme` setting; after that, the preference is persisted to localStorage. The toggle adds/removes the `dark` class on the `<html>` element, and all components use Tailwind's `dark:` variant for their styles.

### Does the app work offline?
Partially. The PWA service worker (via vite-plugin-pwa) caches the app shell and assets, so the local dictionary with 90+ terms works fully offline. Urban Dictionary features (trending words, API lookups), Claude AI insights, and community features require an internet connection.

### How does the automated dictionary growth work?
Two daily GitHub Actions workflows keep the dictionary growing. The **UD trending ingestion** pipeline fetches autocomplete suggestions from 30 prefix seeds, looks up definitions, filters for quality (70%+ thumbs-up ratio AND 100+ total votes), deduplicates against existing terms, and opens a PR. The **community merge** pipeline pulls Firestore submissions with 25+ net upvotes and does the same. Both use `JSON.stringify()` for all external content to prevent code injection, atomic writes to prevent file corruption, and `--body-file` to prevent shell injection in PR bodies.

### How do I add a new slang term manually?
Edit `shared/slangDictionary.js` and add an entry with definition, example, wrongUsage, era, origin, type, and pronunciation. The web app picks up changes automatically on next build.

### What testing is in place?
The project has 57 tests across 12 test files using Vitest and React Testing Library. Tests cover components (Header, TabBar, FilterBar, TermCard), hooks (useAiTranslation), services (dictionaryService), contexts (ThemeContext, AuthContext), utilities (speak, blacklist, detectInputType), and data validation (slangDictionary). GitHub Actions runs the full suite on every push and PR.
