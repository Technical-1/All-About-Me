# Project Q&A

## Overview

Themed Crossword Generator is a full-stack web app that creates custom crossword puzzles on any topic. The user enters a theme like "Space Exploration" or "Italian Cuisine," an LLM generates themed words with clever clues, and a layout algorithm arranges them into a playable grid. The app includes a complete solving experience with checker mode, hints, statistics tracking, and social sharing — all wrapped in a PWA that works offline.

## Problem Solved

Mass-market crosswords cycle through a narrow set of editor-approved themes. Players who want puzzles about niche topics — a favourite show, a hobby, a sport — usually can't find them. This app turns any topic into a playable puzzle in seconds, with the difficulty and grid size the player wants.

## Target Users

- **Casual crossword solvers** — Get a fresh themed puzzle without waiting for a daily release
- **Educators and parents** — Generate puzzles on a subject the student is studying
- **Trivia enthusiasts** — Build puzzles around their favourite domain knowledge

## Key Features

### Themed Puzzle Generation
Anthropic Claude (Sonnet 4) produces a JSON list of `{answer, clue}` pairs for the requested theme. A layout algorithm then arranges them into a valid grid, retrying up to 3 times if it can't find enough intersections.

### Interactive Crossword Grid
SVG-based grid with full keyboard navigation, auto-advance to the next clue, and a mobile-optimised clue bar.

### Checker Mode
Real-time answer validation that tracks SVG text elements using a greedy distance-based algorithm to colour-code correct (blue) and incorrect (red) cells.

### Statistics and Streaks
Tracks completion streaks (daily), best and average times per difficulty, and the last 50 puzzles (up to 500 completion records).

### URL-Encoded Puzzle Sharing
The entire puzzle is compressed with `lz-string` and encoded into a `?p=` query parameter. Recipients can play the exact same puzzle without an API call.

### Offline PWA
75 pre-generated puzzles (5 per theme across 15 themes) are bundled and cached by a service worker for fully offline play.

### Accessibility
High-contrast themes, reduced-motion support, adjustable text sizes, screen-reader announcements, and full keyboard navigation.

## Technical Highlights

### SVG DOM tracking for the checker
`@jaredreisinger/react-crossword` does not expose an API for styling individual cells. To paint correct/incorrect colours, the component scans the rendered SVG for `<text>` elements and matches each to a logical grid position with a greedy nearest-neighbour algorithm. Correct cells are locked (cannot be erased) and turn blue; incorrect cells turn red. This avoids forking the third-party library while still giving cell-level feedback. See `src/components/CrosswordGame.tsx`.

### Sandboxed LLM prompt with JSON extraction
User-supplied themes are wrapped in XML tags (`<theme>...</theme>`) and stripped of non-printable characters before being sent to the model. The response is parsed with a regex that tolerates the model occasionally wrapping the JSON in a Markdown code block. The request asks for `wordCount + 5` words so the layout engine has extra options when the first arrangement fails. See `lib/crossword-generator.ts`.

### Resilient generation pipeline
The end-to-end generation path has multiple resilience layers: exponential backoff retry (1s → 2s → 4s, max 3 attempts), error categorisation (`network` / `verification` / `generation` / `generic`), `AbortController` for cancelling stale requests, and automatic fallback to a pre-generated offline puzzle when retries are exhausted. On the server side, the rate limiter degrades from the shared Upstash counter to a per-instance in-memory limiter if Redis is unreachable, so abuse protection survives a backing-store outage without ever blocking legitimate users.

### Database-free puzzle sharing
Completed puzzles are serialised to JSON, compressed with `lz-string`, and appended as a `?p=` query parameter. The recipient's app detects the parameter on mount and renders the puzzle directly. No backend storage, no expiring links, no API call.

## Engineering Decisions

### State-based routing instead of React Router
- **Constraint**: Only three views (selector, game, history); no need for deep linking beyond the share URL
- **Options**: `react-router`, TanStack Router, or a simple state variable
- **Choice**: A single `currentView` state plus conditional rendering with Framer Motion `AnimatePresence`
- **Why**: Pulling in a router would have added a dependency, bundle size, and configuration for no real benefit at this scale.

### localStorage for all persistence
- **Constraint**: Puzzle history, stats, settings, and in-progress game state all need to survive reloads
- **Options**: A hosted database (Supabase, Firebase), IndexedDB, or localStorage
- **Choice**: localStorage, with capped record counts (50 puzzles, 500 completions)
- **Why**: Zero infrastructure cost, synchronous reads, works offline. The trade-off — data is device-local and capped near 5 MB — is acceptable for a solo solving experience.

### Shared generator library between dev server and serverless function
- **Constraint**: The same generation logic has to run inside an Express dev server and a Vercel serverless function
- **Options**: Duplicate the code, share a JS file, or build a small internal package
- **Choice**: Extract to `lib/crossword-generator.ts` and import it from both entry points
- **Why**: Keeps dev/prod behaviour identical without the overhead of publishing a package. The serverless function is a thin wrapper around the shared module.

### Trust-based rate limiting instead of a captcha gate
- **Constraint**: The asset worth protecting is the paid LLM endpoint, but a hard Turnstile gate produced false-positives — it blocked users behind content blockers and would lock everyone out during a Cloudflare outage
- **Options**: Reject any request without a valid token, fail-open on verification errors only, or stop gating on the token entirely
- **Choice**: Treat the token as a trust signal that only selects the rate-limit tier — verified IPs get 10 requests/min, unverified (or token-blocked) IPs get 3/min, and nobody is hard-rejected for a missing token. The Upstash-backed per-IP counter, keyed on the unspoofable `x-real-ip`, is the only gate
- **Why**: It bounds abuse of the expensive endpoint without punishing real users, and tokenless requests skip the `siteverify` round-trip so they can't be turned into a Cloudflare-spamming amplifier.

## Frequently Asked Questions

### How are the words and clues generated?
The serverless function sends a structured request to Anthropic Claude (Sonnet 4) with the user's theme, difficulty, and word count. The model returns a JSON array of `{answer, clue}` pairs, which `crossword-layout-generator` then arranges into a valid grid. If the layout fails (not enough intersections), the pipeline retries up to 3 times before falling back to an offline puzzle.

### Why React + Vite instead of Next.js?
The app is fundamentally a client-side SPA — all state lives in the browser, there is no SEO requirement for puzzle pages, and the only server-side code is a single API endpoint. Vite gives faster dev builds and simpler deployment, and the one API route runs perfectly well as a standalone Vercel function.

### How does the app work offline?
A service worker (`public/sw.js`) caches the static assets and 75 pre-generated puzzles on install. When the network is unavailable, `useOfflineDetection` triggers the offline path and the app serves cached puzzles. The generation flow also auto-falls back to offline puzzles after exhausting retries.

### How does puzzle sharing work without a database?
The entire puzzle (grid layout, clues, answers) is serialised to JSON, compressed with `lz-string`, and appended as a `?p=` query parameter. On open, the app detects the parameter, decompresses it, and renders the puzzle directly. Shared links never expire and never hit the API.

### What stops people from abusing the LLM endpoint?
A per-IP rate limiter, not a captcha wall. Each IP gets a fixed-window quota — 10 requests/min if a valid Cloudflare Turnstile token is present, 3/min if not — enforced by a shared Upstash Redis counter (with an in-memory fallback if Redis is down). The limiter keys on the edge-injected `x-real-ip`, which clients can't spoof, rather than `x-forwarded-for`. The Anthropic API key is only ever read server-side, so the client never sees it. Turnstile is a trust signal that picks the quota tier — it never hard-blocks a request on its own.

### How does checker mode decide which cells are correct?
When checker mode activates, the component walks the crossword SVG, maps each `<text>` element to a grid position with a greedy distance algorithm, and compares the cell's current value against the known answer. Correct cells turn blue and lock; incorrect cells turn red. The mapping is strict one-to-one to avoid double-colouring overlapping cells.

### What accessibility features are included?
Four theme variants (light, dark, high-contrast light, high-contrast dark); text-size options (normal/large/larger); reduced-motion mode that honours both the manual toggle and `prefers-reduced-motion`; screen-reader announcements for checker results and clue changes; full keyboard navigation; and ARIA attributes on every interactive element.

### How is the theme system implemented?
All colours are CSS custom properties (`--color-*`) in `src/index.css`. Themes toggle by setting classes and data attributes on `document.documentElement`. Switching is instant (no re-render), composes cleanly with Tailwind utility classes, and is trivial to extend.
