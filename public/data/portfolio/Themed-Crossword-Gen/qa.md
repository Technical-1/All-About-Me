# Project Q&A Knowledge Base

## Overview

Themed Crossword Generator is a full-stack web app that creates custom crossword puzzles on any topic using AI. I enter a theme like "Space Exploration" or "Italian Cuisine," and Claude AI generates themed words with clever clues, which are then arranged into a playable crossword grid. The app includes a complete solving experience with checker mode, hints, statistics tracking, and social sharing — all wrapped in a PWA that works offline.

## Key Features

- **AI-Powered Puzzle Generation**: Claude API generates themed word lists with clues, then a layout algorithm arranges them into valid crossword grids with up to 3 retry attempts
- **Interactive Crossword Grid**: SVG-based grid with full keyboard navigation, auto-advance to next clue, and mobile-optimized clue bar
- **Checker Mode**: Real-time answer validation that tracks SVG text elements using a greedy distance-based algorithm to color-code correct (blue) and incorrect (red) answers
- **Statistics & Streaks**: Tracks completion streaks (daily), best/average times per difficulty, and puzzle history (up to 50 puzzles, 500 completion records)
- **Puzzle Sharing**: Compresses puzzle data with lz-string and encodes it in the URL — recipients can play the exact same puzzle without an API call
- **Offline PWA**: 75 pre-generated puzzles (5 per theme across 15 themes) cached by a service worker for fully offline play
- **Accessibility**: High contrast themes, reduced motion support, adjustable text sizes, screen reader announcements, and full keyboard navigation

## Technical Highlights

### SVG DOM Manipulation for Checker Mode
The crossword library (`@jaredreisinger/react-crossword`) doesn't expose an API for styling individual cells. I had to scan the SVG DOM to find text elements, then match them to logical grid positions using a greedy distance-based algorithm that ensures one-to-one element-to-cell mapping. Correct answers are locked in place and colored blue; incorrect ones turn red. This was the most complex frontend challenge — working around a third-party library's rendering without forking it.

### Prompt Engineering for Consistent Output
Getting Claude to reliably produce valid JSON word lists required careful prompt design. I use XML tag sandboxing (`<theme>...</theme>`) to prevent prompt injection through user-supplied themes, strip non-printable characters, and extract JSON from the response using regex since Claude sometimes wraps output in markdown code blocks. The system requests extra words (wordCount + 5) to account for layout failures.

### Resilient API Architecture
The generation pipeline has multiple resilience layers: exponential backoff retry (1s → 2s → 4s), error categorization (network/verification/generation/generic), AbortController for cancelling stale requests, and automatic fallback to offline puzzles after max retries. Turnstile verification uses a "fail open" strategy so Cloudflare outages don't block all users.

### URL-Based Puzzle Sharing Without a Database
Instead of storing shared puzzles in a database, I compress the entire puzzle data (grid, clues, answers) with lz-string and encode it as a URL query parameter. This means shared puzzles require zero backend storage, work indefinitely, and load instantly. The trade-off is longer URLs, but they stay well within browser limits.

## Development Story

- **Hardest Part**: The checker mode implementation — mapping SVG DOM elements to logical grid positions required understanding how `@jaredreisinger/react-crossword` renders internally, and building a distance-based matching algorithm that handles edge cases like overlapping cells
- **Lessons Learned**: React state is async, so using local variables alongside setState is necessary when you need synchronous reads in finally blocks. Also, `hash & hash` is a no-op in JS — you need `hash |= 0` for 32-bit coercion.
- **Future Plans**: Multiplayer mode for competitive solving, custom puzzle editor, and daily puzzle challenges

## Frequently Asked Questions

### How does the AI generate puzzles?
The app sends a structured prompt to Claude Sonnet 4 with the user's theme, difficulty level, and word count. Claude returns a JSON array of word/clue pairs. These are then fed into the `crossword-layout-generator` algorithm, which arranges them into a valid grid. If the layout fails (not enough intersections), it retries up to 3 times.

### Why did you choose React + Vite over Next.js?
The app is fundamentally a client-side SPA — all state is in the browser (localStorage), there's no SEO requirement for puzzle pages, and the only server-side logic is a single API endpoint. Vite + React gives faster dev builds and simpler deployment. The API runs as a Vercel serverless function, which doesn't need a full framework.

### How does the app work offline?
A service worker (`sw.js`) caches all static assets on install and 75 pre-generated puzzles spanning 15 themes. When the network is unavailable, the app detects this via `useOfflineDetection` and falls back to serving cached puzzles. The generation flow also automatically falls back to offline puzzles after exhausting retries.

### How does puzzle sharing work without a backend database?
The entire puzzle (grid layout, clues, answers) is serialized to JSON, compressed with lz-string, and appended as a `?p=` query parameter. When someone opens the link, the app detects the parameter, decompresses the data, and renders the puzzle directly — no API call needed. This keeps the architecture simple and means shared links never expire.

### What prevents abuse of the AI API?
Cloudflare Turnstile provides invisible bot protection. The frontend gets a token from Turnstile's widget, sends it with the generation request, and the serverless function verifies it with Cloudflare before calling Claude. The dev server skips this for faster iteration. If Cloudflare is unreachable, the system fails open (allows the request) to avoid blocking legitimate users during outages.

### How does checker mode know which cells are correct?
When checker mode is activated, the component scans the crossword SVG for text elements and maps each to a grid position using a greedy distance algorithm. It then compares each cell's current value against the known answer. Correct cells turn blue and become locked (can't be erased). Incorrect cells turn red. The algorithm ensures a strict one-to-one mapping between SVG elements and grid cells.

### What accessibility features are included?
The app supports 4 theme variants (light, dark, high contrast light, high contrast dark), adjustable text sizes (normal/large/larger), reduced motion mode that respects both manual toggle and `prefers-reduced-motion`, screen reader announcements for checker mode results and clue changes, keyboard navigation throughout, and ARIA attributes on all interactive elements.

### How is the theme system implemented?
All colors are defined as CSS custom properties (`--color-*`) in `src/index.css`. Themes are activated by toggling CSS classes and data attributes on `document.documentElement`. This approach means theme switching is instant (no re-render), works with Tailwind's utility classes, and is easily extensible.
