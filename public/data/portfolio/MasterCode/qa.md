# Project Q&A Knowledge Base

## Overview

MasterCode is a free, browser-based learning platform for mastering communication code systems. It covers 17 topics — from NATO phonetic alphabet and Morse code to ASL fingerspelling, military acronyms, and maritime signal flags. I built it as a client-side SPA with no backend, using the SM-2 spaced repetition algorithm to schedule reviews and localStorage for persistence. It works offline as a PWA and is deployed on Vercel.

## Key Features

- **Multi-Topic Platform**: 17 code systems with a data-driven architecture — adding a new topic requires only a config object, not new components
- **SM-2 Spaced Repetition**: Quality scoring (0-5) based on correctness, response time, and study mode difficulty. Items are scheduled for review based on easiness factor and interval growth.
- **4 Study Modes**: Flashcards (passive), multiple choice (recognition), typing practice (recall), timed challenge (speed under pressure)
- **Smart Distractor Generation**: 8 distractor strategies tailored to topic types — NATO-style fake words, numerically close Roman numerals, same-category dev codes, acronym-style fake expansions, etc.
- **Visual Renderers**: Custom SVG components for ASL hand signs, maritime signal flags, semaphore positions, and music notation symbols
- **Gamification**: Achievement system (10 achievements), streak tracking, daily goals with completion notifications

## Technical Highlights

### Data-Driven Topic Architecture
The app started as a NATO alphabet trainer. When I expanded it to 17 code systems, I refactored into a `TopicConfig` interface where each topic is a data object specifying its key-value pairs, theme colors, distractor type, render type (text or image), and quiz direction. All four study modes consume topics generically — no topic-specific UI code exists. This means adding a new topic like "Phonetic Russian Alphabet" would require only writing a config object.

### SM-2 Algorithm with Mode-Aware Quality Scoring
I implemented the SuperMemo SM-2 algorithm with a twist: quality scores account for response time and study mode difficulty. Typing practice gets a +0.5 bonus (it's harder), timed challenges get +0.25 (time pressure), and multiple choice gets +0 (easiest). A fast correct answer in typing mode scores 5.0 (perfect recall), while a slow correct multiple choice answer scores 3.0 (recognized but struggled). This makes the scheduling more accurate than binary correct/incorrect.

### Zero-Dependency Routing
Instead of pulling in React Router, I wrote a 100-line hash router hook that handles 5 routes: two landing page variants, learn/{topicId}, about, and privacy. Hash routing eliminates the need for server-side rewrite configuration, which matters for static hosting on Vercel.

## Engineering Decisions

### Spaced repetition algorithm: SM-2 over a custom weight formula
- **Constraint**: An earlier weighted-error formula (`errorRate × 10 + daysSinceLastSeen`) scheduled reviews crudely and ignored response time and mode difficulty.
- **Options**: Keep the weighted formula, design a fresh heuristic, or adopt SM-2 (SuperMemo).
- **Choice**: SM-2 with mode-aware quality scoring (+0.5 for typing, +0.25 for timed, +0 for multiple choice).
- **Why**: SM-2 is well-researched and produces exponentially growing intervals tied to an easiness factor, which gives more accurate scheduling than error rate alone. Mode-aware scoring captures the reality that recalling "Quebec" by typing is harder than picking it from four options.

### Data-driven topics over per-topic components
- **Constraint**: Started as a NATO trainer; needed to scale to 17 distinct code systems with very different render needs (text, SVG hand signs, flag glyphs, music notation).
- **Options**: Build a separate component per topic, or unify behind one `TopicConfig` interface.
- **Choice**: One `TopicConfig` interface consumed by all four study modes.
- **Why**: Each topic is now a config object specifying data, theme, distractor strategy, and render type. Adding a topic requires no new components — only a config entry and (optionally) SVG assets.

### Hash routing instead of React Router
- **Constraint**: Needed client-side routing across landing variants, per-topic learn pages, and info pages, deployed as a static site.
- **Options**: React Router with HTML5 history API, a hash router, or no routing at all.
- **Choice**: A 100-line `useHashRouter` hook.
- **Why**: Hash routing avoids server-side rewrite configuration on static hosts and saves the React Router dependency. The route set is small enough that a hook is easier to reason about than a routing library.

### localStorage over a backend
- **Constraint**: A study tool benefits from instant loads, offline use, and zero sign-up friction.
- **Options**: Backend with accounts and sync, localStorage only, or IndexedDB.
- **Choice**: Per-topic-namespaced localStorage keys (e.g., `nato-trainer-progress-morse`).
- **Why**: Removes auth and network latency entirely, keeps the deploy a single static bundle, and lets users reset one topic without touching others. Trade-off: no cross-device sync, acceptable because most users practice on one device.

## Frequently Asked Questions

### How does the spaced repetition work?
I use the SM-2 algorithm. Each item tracks an easiness factor (1.3-2.5), review interval, and next review date. When you answer, a quality score (0-5) is calculated from correctness, speed, and study mode. Scores below 3 reset the item to "needs relearning." Above 3, the interval grows exponentially based on the easiness factor. Items that are overdue get prioritized.

### Why did you choose React without a state management library?
The state tree is shallow — App.tsx manages ~5 state variables (progress, stats, achievements, session, settings) and passes them one level down to study mode components. Context handles cross-cutting concerns (theme, toast, topic). Adding Redux or Zustand would be over-engineering for this data flow pattern.

### How does the topic system handle such different content types?
Every topic implements the same `TopicConfig` interface with a `data: Record<string, string>` field. A topic can also specify a `renderType` ('text' or 'image'), an `imageFolder`, a `distractorType`, and a `quizMode`. The study components check these properties and render accordingly — text for most topics, SVG images for ASL/maritime/music.

### How are wrong answers generated?
There are 8 distractor strategies. NATO uses fake words starting with the same letter as the correct phonetic. Roman numerals picks numerically close values. Acronym topics generate fake expansions where each word starts with the corresponding letter of the acronym. The `acronymDistractors.ts` file contains 62KB of curated word pools for this.

### Why localStorage instead of a backend?
A learning flashcard app benefits from zero friction — no sign-up, no API latency, works offline. localStorage gives instant persistence per-device. The trade-off is no cross-device sync, but for a study tool, most users practice on one device. The PWA manifest makes it feel like a native app.

### Where does the ASL fingerspelling artwork come from?
ASL hand signs are rendered with custom inline SVGs in `src/components/ASLSign.tsx`, one path set per letter. Same approach for maritime signal flags (`MaritimeFlag.tsx`), semaphore positions, and music notation (`MusicSymbol.tsx`). Rendering as inline SVG keeps the bundle small, scales cleanly on any display, and lets dark mode style strokes/fills via Tailwind classes.

### Does it actually work offline?
The PWA manifest makes the app installable, and because all data lives in localStorage there's no API to fail. A proper service worker for caching the JS/CSS/SVG assets is the missing piece — without it, the very first visit needs network, but subsequent loads benefit from browser HTTP caching. Adding a service worker is the next planned change.

### How is progress isolated per topic if everything is in localStorage?
Every storage key is prefixed with the topic ID — for example, `nato-trainer-progress-morse` versus `nato-trainer-progress-asl`. That isolation lets users reset one topic without touching the others and keeps the SM-2 state for each code system completely independent. The `nato-trainer-` prefix is a legacy artifact from when this was just a NATO alphabet app.
