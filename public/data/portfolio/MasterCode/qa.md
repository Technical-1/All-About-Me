# Project Q&A

## Overview

MasterCode is a free, browser-based trainer for 19 code systems — the NATO alphabet, Morse, Braille, semaphore, ASL fingerspelling, maritime signal flags, airport and airline codes, military and government acronyms, Greek letters, Roman numerals, musical notation, developer codes, element symbols and country flags. It schedules every item with the SM-2 spaced-repetition algorithm and runs entirely in the browser with no account or server. The interesting engineering is in making each question fair: options you can't eliminate by a trick, typed answers that accept every correct form and nothing else, and audio and screen-reader output that never leaks the answer.

## Problem Solved

Most flashcard tools for things like signal flags or Morse are either static charts or generic decks where the answer gives itself away — the only option starting with the right letter, the only one in the right format, a speaker that reads "Alpha" when the question is the flag for A. MasterCode teaches these systems with real recall practice, and with questions designed so that the only reliable way to answer is to know it.

## Target Users

- **Radio operators, pilots, sailors and service members** — the NATO alphabet, Morse, signal flags, semaphore, airport codes and their branch's acronyms
- **Students** — Greek letters, element symbols, Roman numerals, musical notation
- **People learning accessibility systems** — Braille and ASL fingerspelling
- **Developers** — HTTP status codes, HTML entities, ASCII and regex tokens

## Key Features

### Five study modes, including an adaptive one
Flashcards, multiple choice, typing and a 60-second timed challenge, plus Smart Session: a 15-item run that asks multiple choice for newer items and switches to typing once an item is well learned, then recaps what you confused.

### Both directions
Most topics can be practised either way — "A → Alpha" or "flag → A". A direction is only left out where it would be trivial (every NATO word starts with its letter) or unanswerable.

### Braille you can type and read
A six-dot grid per cell lets you answer Braille by tapping dots or pressing 1–6. Every Braille value is drawn as a framed 2×3 cell with unraised dots shown faintly, so letters that look identical as Unicode glyphs are distinguishable.

### Progress that explains itself
Per-item accuracy, a 30-day accuracy chart, streaks, achievements and daily goals, plus Most Confused Pairs — which wrong answer you keep picking for which item — and focus filters for weak or unpractised items.

### Portable, lossless backups
Export a topic as JSON and import it on another device or in the companion iPhone & iPad app. Imports merge with what's there, so moving back and forth never loses progress.

### Accessible and offline
Keyboard shortcuts, screen-reader announcements for every answer, neutral image descriptions until you answer, reduced-motion support, and an installable PWA that works offline.

## Technical Highlights

### Multiple choice that defeats guessing tricks
The target is that the usual shortcuts — pick the option whose letters match, pick the odd one out by format, pick the middle number — do no better than chance. `src/utils/distractors.ts` scores every candidate by how confusable it is with the answer, in both directions, with per-topic strategies: edit distance for Morse, differing dots for Braille, arm angles for semaphore, curated confusable groups for flags, hand shapes and Greek glyphs, pay-grade distance for military ranks, one-symbol-off numerals for Roman numerals (XIV → XVI, XIX), and generated abbreviations that fit an expansion's letters as well as the real acronym ("Federal Bureau of Investigation" → FBOI, FEBI). Tests assert the invariants for every topic — the answer appears once, no wrong option is also right, near-synonyms such as `0x41` and "ASCII 65–90" never share a question — and check the specific tricks, such as the correct Roman numeral landing at the top, bottom and middle of the range.

### Typed answers: lenient, with a proof of no false positives
`src/utils/answers.ts` normalises word answers (accents, case, curly quotes, every dash variant, "&", punctuation, a leading "the"), accepts the "core" of a long value ("Treble Clef" for "Treble Clef (G Clef) - Most common clef") and curated alternates (Alfa, Juliet, Aluminium). Leniency is only safe if it never accepts another item, so the core is accepted only when unique within the topic, and a collision test runs every typeable topic and direction to prove that no other item's answer is ever accepted. Symbol answers stay exact — Morse, Braille — except where two forms are genuinely equal, such as a semaphore signal entered in either arm order.

### A speaker rule that never reveals the answer
Reading the question aloud sounds harmless until the question is a picture of the flag for "Alpha", a Greek glyph that TTS pronounces as its name, or "Lt Col", which TTS expands into the rank. `src/utils/speech.ts` declares how each side of each topic is read (letter by name, spelled out, dit/dah, as text, or not at all) and hides the speaker whenever the prompt would give the answer away. The same care applies to images, which get neutral alt text until you answer, and to screen-reader announcements, which name the answer exactly as its button showed it.

### Data checked against the primary sources
Maritime flags and numeral pennants follow the International Code of Signals (NGA Pub. 102), Braille digits and punctuation follow Unified English Braille, and the airport topic pairs IATA and ICAO codes for each airport and airline. Tests check the data itself — no topic has two items with the same answer — so a correction can't quietly create an ambiguous question.

### Deterministic local-day semantics
Daily goals and history key by the user's local calendar day, which is easy to get silently wrong: UTC keys pass every test on a UTC machine. The suite pins a non-UTC time zone in `vitest.config.ts` and asserts at setup that it took effect, so a regression to UTC fails everywhere.

## Engineering Decisions

### Rules in one module each, not spread across components
- **Constraint**: Four scoring modes plus Smart Session all ask questions, and each must agree on which modes exist, how options are built, how answers are matched and what can be read aloud.
- **Options**: Let each mode implement its own logic, or centralise each rule.
- **Choice**: One module per rule — `modesAvailable` for modes, `distractors.ts`, `answers.ts`, `speech.ts`, `display.ts`.
- **Why**: A question is generated and judged identically wherever it's asked, and each rule is testable in isolation. It also made the iOS port tractable: it mirrors these modules rule for rule.

### Reverse acronyms are typing-only
- **Constraint**: Shown "Federal Bureau of Investigation", four acronym options can be matched by initials without knowing anything.
- **Options**: Generate letter-fitting decoys and keep multiple choice, or drop multiple choice for that direction.
- **Choice**: Both where they help — letter-fitting decoys in the other direction, and typing plus flashcards only for reverse acronyms, where Smart Session types every item.
- **Why**: Recall of an acronym is what the learner actually needs; a recognition question in that direction measures pattern matching.

### localStorage over a backend
- **Constraint**: A study tool should load instantly, work offline and need no sign-up.
- **Options**: Accounts with server sync, IndexedDB, or localStorage.
- **Choice**: Per-topic `mastercode-*` localStorage keys, validated and clamped on every load, with a schema version and a rename table for corrected item names.
- **Why**: No auth, no latency and a single static deploy. The cost — no automatic sync — is covered by merge-on-import backups that also work with the iOS app.

### Hash routing instead of React Router
- **Constraint**: Shareable per-topic links on a static host.
- **Options**: React Router with history routing and server rewrites, or a hash router.
- **Choice**: A small `useHashRouter` hook, with `#/learn/<topic>` as the source of truth for the open topic.
- **Why**: No dependency, no rewrite rules, and Back/Forward naturally switch topics; the app drops to the menu on every topic change so an answer can't be saved to the wrong topic.

## Frequently Asked Questions

### How are the wrong options chosen?
Per topic, from the items most confusable with the right one: look-alike flags and hand shapes, Morse and Braille patterns a symbol or dot apart, numerals one symbol off, ranks from the same branch near the same pay grade, or made-up abbreviations that fit the same letters. They're sampled from a small pool, so the same question doesn't always show the same options.

### Why won't it accept my answer — or why did it accept a short one?
Case, accents, punctuation, dashes and a leading "The" never matter. A shortened answer is accepted when no other item in the topic shares it, which is why "Treble Clef" works but a Tokyo airport can't be answered with just "Tokyo". Symbol answers such as Morse and Braille must be exact.

### How do I type Braille?
On a Braille question, each answer cell is a grid of six dots in standard numbering. Tap dots, or press 1–6 to toggle them, Space for the next cell, Backspace to clear and Enter to submit.

### Why is the speaker button missing on some questions?
It only reads the question, and it's hidden when hearing the question would give away the answer — a flag, a hand sign, a Greek letter, a rank abbreviation — or when the question can't be read aloud, such as a Braille cell or semaphore arrows.

### Why can't I use multiple choice for reverse acronyms?
Shown an expansion, you could pick the acronym by its initials without knowing it, so that direction is practised by typing (and flashcards) instead.

### How accurate is the content?
Signal flags follow the International Code of Signals (NGA Pub. 102), Braille follows Unified English Braille, and airport and airline codes are listed in both IATA and ICAO forms. Military, government and developer-code entries were checked against official sources and corrected or removed where they didn't hold up.

### Can I move my progress to another device or the iPhone app?
Yes. Export a backup from Settings and import it on the other device or in the iPhone & iPad app. Imports merge — the richer record for each item wins, streaks and totals take the higher value — and a backup from a different topic asks before merging.

### Does it work offline, and does it send my data anywhere?
It works offline after the first visit, via a service worker. Nothing is sent anywhere: progress stays in your browser's storage, there are no analytics or cookies, and speech and reminders use the browser's local APIs.
