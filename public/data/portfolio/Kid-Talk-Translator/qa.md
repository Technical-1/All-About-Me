# Project Q&A Knowledge Base

## Overview

Kid Talk Translator Pro is a web application that helps adults decode Gen Alpha and Gen Z slang. It combines a curated local dictionary of 70+ slang terms with live Urban Dictionary integration, offering translation, reverse translation, quizzes, flashcards, a chat annotator, and community submissions.

## Key Features

- **Multi-directional Translation**: Kid-to-adult and adult-to-kid translation, plus full conversation annotation
- **Interactive Quiz System**: Three modes (multiple choice, real-or-fake, flashcards) pulling from both local and Urban Dictionary term pools
- **Live Urban Dictionary Integration**: Real-time lookups for terms not in the curated dictionary, plus trending and random word feeds
- **PWA**: Installable progressive web app for mobile/desktop use
- **Rich Metadata**: Every local term includes definition, example usage, wrong usage warnings, era, origin platform, type classification, and pronunciation guide

## Technical Highlights

### Multi-tier Caching Strategy
I implemented a three-layer caching system to handle Urban Dictionary's rate limits gracefully. In production, Vercel KV provides server-side caching. On the client, an in-memory Map caches lookups for the session (24-hour TTL), and localStorage persists popular/trending words for 7 days. This means the app stays responsive even if the API is slow or unavailable, and the local dictionary always works offline.

### Shared Dictionary Architecture
I created a single `shared/slangDictionary.js` file that serves as the canonical source of truth for all slang data. This makes adding new terms trivial — edit one file and the web app picks it up automatically.

### Intelligent Term Matching
The translation engine sorts terms by length (longest first) before scanning input text. This ensures multi-word phrases like "ate and left no crumbs" are matched as a single term rather than matching "ate" separately. The same approach is used in the chat annotator, which wraps detected terms in bracket notation for inline definitions.

## Development Story

- **Hardest Part**: Getting the Urban Dictionary API integration to work smoothly across both development (Vite proxy) and production (Vercel serverless) environments, while handling rate limits gracefully with the multi-tier cache
- **Lessons Learned**: A shared data layer pays dividends immediately. The component-based architecture with custom hooks keeps the codebase manageable
- **Future Plans**: Grow the community submissions feature, add more terms to the dictionary

## Frequently Asked Questions

### How does the translation work?
The translator checks input text against the local dictionary first (70+ curated terms), sorted by term length to catch multi-word phrases. If no local matches are found, it queries the Urban Dictionary API - first trying the full phrase, then individual words. Results show the source (Local vs Urban Dictionary) so users know which definitions are curated vs community-sourced.

### Why use both a local dictionary and Urban Dictionary?
The local dictionary provides high-quality, curated definitions with proper context (examples, wrong usage warnings, pronunciation). Urban Dictionary extends coverage to thousands of additional terms but with less structured data. Combining both gives breadth and depth.

### How does the quiz pull from Urban Dictionary?
The quiz system combines local dictionary terms with any popular/trending words already loaded from Urban Dictionary. This means the quiz pool grows dynamically - on first load it's ~70 terms, but after trending words load it can be 90+. The Real or Fake mode uses a separate hand-curated list of fake terms mixed with real ones.

### How is the app deployed?
The web app deploys to Vercel with the root directory set to `webapp/`. Vite builds to `dist/`, and Vercel handles both static hosting and serverless functions for the API proxy. Security headers (XSS protection, frame denial, content-type sniffing prevention) are configured in `vercel.json`.

### Why is it a single App.jsx file instead of separate components?
With 6 tabs sharing state (popular words are used in translate, quiz, and dictionary tabs), extracting each tab into its own component would require lifting state up or adding a state management library. For this project size, a single well-organized file with clear tab sections is simpler and easier to maintain.

### Does the app work offline?
Partially. The PWA service worker (via vite-plugin-pwa) caches the app shell and assets, so the local dictionary with 70+ terms works fully offline. Urban Dictionary features (trending words, API lookups, random words) require an internet connection.

### How do I add a new slang term?
Edit `shared/slangDictionary.js` and add an entry with definition, example, wrongUsage, era, origin, type, and pronunciation. The web app picks up changes automatically on next build.
