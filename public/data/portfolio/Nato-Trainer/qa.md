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

## Development Story

- **Timeline**: Started as a simple NATO alphabet flashcard app, evolved into a 17-topic platform over several months
- **Hardest Part**: Designing the distractor generation system to produce plausible wrong answers across very different topic types. Acronym distractors needed a 62KB file of manually curated fake expansions that match the letter patterns of real acronyms.
- **Lessons Learned**: Starting with a generic `TopicConfig` interface from day one would have saved refactoring time. The SM-2 migration was worth it — users noticeably learn faster with proper spaced repetition versus random selection.
- **Future Plans**: Service worker for true offline caching, more topics (phonetic alphabets for other languages, aviation weather codes), multiplayer quiz mode

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

### What was the most challenging part?
Building distractor generation that produces *plausible* wrong answers across 17 very different topics. Generic random distractors don't work — if you're learning NATO and the correct answer is "Alpha," showing "Golf," "Hotel," and "Xylophone" (not a NATO word) as options would be too easy. Each topic type needed its own strategy.

### What would you improve?
I'd add a service worker for proper offline caching of SVG assets, implement cross-device sync with an optional account system, and add audio playback for Morse code (actual dot/dash sounds). The bundle could also benefit from lazy-loading the Recharts chunk since stats is an infrequently visited page.
