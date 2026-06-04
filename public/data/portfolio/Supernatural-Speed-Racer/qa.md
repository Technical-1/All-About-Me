# Project Q&A

## Overview

Supernatural Speed Racer is a browser typing game where you race a fixed passage head-to-head against a themed "ghost" opponent on a split-screen track. The interesting technical angle is that the entire race — the typing rules, the scoring, and the computer opponent — is implemented as pure, DOM-free JavaScript that runs identically in the browser and under Node, so the rules are fully unit-tested without a headless browser.

## Problem Solved

Most typing tests measure you in isolation. This turns practice into a race: a concrete, beatable opponent moving at a known speed gives every run a clear win/lose stake and immediate, visible feedback on where you're losing time.

## Target Users

- **People practicing typing speed** — a more motivating loop than a bare WPM counter, with five difficulty tiers (40–160 WPM) plus a custom speed.
- **Engineers browsing the code** — a compact, dependency-free example of separating pure game logic from the DOM and testing it under Node.

## Key Features

### Type-ahead typing with live feedback
Every keystroke registers and shows immediately: correct characters glow green, mistakes turn red (a mistyped space gets a red underline so it's never invisible), and a caret marks your position. Backspace fixes mistakes.

### Skill-based race progress
Your racer advances by how many characters are *correct*, not by how many keys you've pressed — so uncorrected mistakes stall you just short of the finish until you fix them. You can't win by mashing.

### Deterministic themed opponents
Five ghost tiers (Poltergeist 40 · Phantom 70 · Specter 100 · Wraith 130 · Banshee 160 WPM), plus a custom WPM. The opponent's position is a pure function of elapsed time, so a given tier always behaves identically.

### Live WPM / CPM
Your words- and characters-per-minute update in real time during the race, and freeze alongside accuracy and time on the results screen.

## Technical Highlights

### Pure, DOM-free game logic
The race rules live in `src/engine.js`, `src/opponent.js`, `src/difficulty.js`, and `src/corpus.js` with zero DOM access. Because they're plain ES modules, they import directly into `node:test` and the full rule set is covered by unit tests with no browser — the browser only ever runs the thin rendering and wiring layers.

### A single source of truth for progress and winning
Both "how far along is the racer" and "is the race over" derive from one helper, `correctCount(state)`: `playerProgress` is `correctCount / totalChars` and the race is done exactly when `correctCount` equals the passage length. The "stall until you fix your mistakes" behavior falls out of that one definition with no separate bookkeeping to keep in sync.

### Reproducible opponent via a time-based model
`botProgress(elapsedMs, wpm, totalChars)` computes position from `wpmToCps(wpm) * elapsed`, clamped to 0–1. Passing elapsed time as an argument (rather than reading a clock inside the model) is what makes the opponent unit-testable — a test can assert "0.5 at half the finish time" with no timing flakiness.

### Injectable randomness in passage selection
`pickPassage(rng = Math.random)` takes the random source as a parameter, so production uses `Math.random` while tests pass a fixed function to assert exactly which passage is chosen.

## Engineering Decisions

### Type-ahead vs. block-until-corrected
- **Constraint**: Players need clear feedback on mistakes without the game being unwinnable by spamming keys.
- **Options**: Reject wrong keys outright (block-until-corrected); let wrong keys through and score on accuracy; let wrong keys through but gate progress on correctness.
- **Choice**: Wrong keys register and show in red, but the racer only advances on correct characters.
- **Why**: The first option hid mistakes (a rejected space looked like nothing happened); a pure accuracy score let sloppy runs still win a race. Gating progress on correctness keeps the feedback visible *and* the race honest.

### No build step
- **Constraint**: A small game that should be trivial to run and deploy.
- **Options**: A bundler/framework (Vite, etc.) or hand-written native ES modules.
- **Choice**: Native ES modules loaded directly by the browser.
- **Why**: Nothing to configure or break, the same files run under Node for tests, and any static host serves the repo root as-is.

### Deterministic opponent over a simulated typist
- **Constraint**: The computer racer must feel fair and consistent.
- **Options**: Simulate keystrokes with jitter, or model progress as a closed-form function of time.
- **Choice**: A pure time-based progress function.
- **Why**: It's reproducible, easy to test, and lets the displayed WPM map exactly to a finish time.

## Frequently Asked Questions

### How is the computer opponent's speed kept fair?
Its position is `wpmToCps(wpm) * elapsedTime`, clamped to 0–1 (1 word = 5 characters). There's no randomness or rubber-banding — a 100 WPM opponent always covers the passage in the same amount of time.

### How is my WPM and CPM calculated?
From the count of *correct* characters and the elapsed time: WPM is correct-characters ÷ 5 per minute, CPM is correct-characters per minute. Both update every animation frame during the race.

### What happens if I type the wrong key?
It's shown in red at that position and the cursor moves on, but it doesn't count toward your progress. Press Backspace to go back and correct it — you must clear your mistakes to reach the finish line.

### Can I race at a speed that isn't one of the tiers?
Yes — there's a custom WPM input on the difficulty screen, clamped to a sensible range (20–250).

### How do I add my own passages?
Add strings to the array in `data/passages.js`; `pickPassage` chooses from the corpus at the start of each race.

### Why does the game logic run under Node if it's a browser game?
The rule modules are deliberately DOM-free, so they import into Node's built-in test runner. That lets the typing, scoring, and opponent behavior be unit-tested quickly and reliably, leaving only thin glue to verify in the browser.

### Where is it hosted?
It's a static site deployed on Vercel — no server or backend is involved.
