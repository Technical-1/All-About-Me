# Project Q&A

## Overview

Supernatural Speed Typer is a Node.js browser-automation tool that completes the typing-speed test at thetypingcat.com. It launches a stealth-patched Chromium, scrapes the prompt the site asks you to type, and replays it as real keyboard input at a configurable speed. The interesting part is less the trick itself and more the engineering around it: the scrape-and-type logic is decomposed into pure, unit-tested modules, and an offline HTML fixture lets the full pipeline be tested deterministically without ever touching the live site.

## Problem Solved

It's a hands-on study of end-to-end browser automation — reading dynamic, framework-rendered page content and producing human-like keyboard input — packaged as a tool that does something concrete and observable (a number on a screen) so the automation is easy to verify.

## Target Users

- **Engineers learning Puppeteer** — a compact, readable example of the launch → scrape → interact → teardown lifecycle with stealth and isolated browser contexts.
- **Myself, as a sandbox** — a place to practice making browser-dependent code testable and resilient to UI changes.

## Key Features

### Automated typing at a tunable speed
The tool reads the test passage and types it character by character. `TYPING_DELAY_MS` controls the gap between keystrokes: at 0 ms it types in a burst that the live readout clocks in the thousands of WPM, while ~80 ms paces it down to a believably human ~130 WPM.

### Stealth, isolated browsing
It runs through `puppeteer-extra` with the stealth plugin to avoid the obvious automation fingerprints, and opens its page inside a fresh browser context so each run is clean and cookieless.

### Resilient scraping
It targets a semantic class path (`.screen-display .text`) rather than generated style hashes and strips the page's stats bar dynamically, so routine site changes don't silently break the scrape.

### Reports the peak live speed
The site caps superhuman runs at the end of the test, so a burst-typed passage that briefly shows thousands of WPM in the live stats gets reported as a low final number. To get the honest figure, the tool samples the live stats readout while typing (and for a short settle window afterward), keeps the highest WPM/CPM it sees, and prints that peak — so a run is self-verifying rather than something you have to eyeball.

## Technical Highlights

### Making a browser-dependent loop unit-testable
The typing loop, `typePassage(keyboard, text, { delayMs })` in `src/typer.js`, takes the keyboard as an injected dependency instead of reaching for Puppeteer's. That single seam lets unit tests pass a fake keyboard that records calls and assert the exact sequence — including that the `⏎` marker becomes an `Enter` press and that the configured delay is forwarded — with no browser involved.

### A numeric-gated regex that won't eat real text
The scraped display text is the stats bar glued to the passage. `stripStatsPrefix` in `src/text.js` first tries to slice an exact, live-read stats string; when that's unavailable it falls back to a regex. The subtle bit is that the regex only strips a leading run of stat tokens if it contains a numeric value, so a passage that genuinely starts with a word like "Time" or "Accuracy" is left intact rather than truncated.

### Deterministic end-to-end testing with a local fixture
`test/integration/integration.test.js` drives real Chromium against a local HTML fixture served over `file://`. One test runs the full `runTyper` lifecycle and asserts it completes and tears down cleanly; another walks the scrape → strip → type pipeline and asserts the exact typed output, newline included. Because it uses a fixture instead of the live page, it's reproducible and offline.

### Teardown that survives every failure path
`runTyper` in `FlashTyper.js` wraps the run in `try/catch/finally` with the browser handles hoisted, so the context and browser close whether the run succeeds, throws, or times out — no orphaned Chromium left behind.

### Beating the end-of-test cap by sampling the live readout
The site re-averages and caps superhuman runs, so the final screen understates a burst-typed run. The fix is in `src/stats.js` and a concurrent poll loop in `FlashTyper.js`: while the passage is being typed, the loop reads the live `.indicators` stats every `livePollMs`, `parseLiveStats` pulls the current WPM/CPM out of each sample, and `mergePeak` keeps the element-wise maximum. Sampling runs for `liveSettleMs` past the last keystroke to catch the spike that lands just after typing, then `formatPeak` renders the peak. The real figure only ever surfaces in the live readout mid-test, so capturing it requires watching that readout as the burst happens rather than reading anything at the end.

## Engineering Decisions

### Decompose the script into pure modules
- **Constraint**: The original was one inline async function — impossible to test without launching a browser.
- **Options**: Keep it monolithic and test only through Puppeteer; or extract the logic into pure units.
- **Choice**: Extract configuration, stats stripping, and the typing loop into separate modules with an injectable keyboard.
- **Why**: The logic worth testing has nothing to do with a browser, so it shouldn't need one to test. Fast unit tests now cover it; the orchestrator stays a thin layer of glue.

### Test against a fixture, not the live site
- **Constraint**: I wanted real end-to-end coverage of the scrape-and-type path without flaky, network-dependent tests.
- **Options**: Hit thetypingcat.com directly in tests; mock Puppeteer entirely; or use a local fixture with a real browser.
- **Choice**: A local HTML fixture driven by a real Chromium.
- **Why**: It exercises the genuine browser keyboard and DOM-scrape code while staying deterministic and offline. Mocking the browser would test less; hitting the live site would be unreliable.

### Default to bundled Chromium, override by env
- **Constraint**: The original hardcoded a macOS Chrome path, so it ran on exactly one machine.
- **Options**: Hardcode per platform; require an env var; or default to the bundled browser.
- **Choice**: Use Puppeteer's bundled Chromium by default and let `CHROME_PATH` override.
- **Why**: It runs anywhere with zero configuration, while still allowing a system Chrome when wanted.

## Frequently Asked Questions

### How does the tool know what to type?
It waits — via `waitForFunction` — for the passage node (`.screen-display .text`) to actually contain non-empty text, reads its text content along with the stats bar text, and runs `stripStatsPrefix` to remove the stats prefix and leave just the passage.

### How is the typing speed controlled?
Through `TYPING_DELAY_MS`, the per-keystroke delay passed into `keyboard.type`. At 0 ms the burst is fast enough that the live readout spikes into the thousands of WPM (and the site caps the final score); around 80 ms produces roughly 130 WPM, which reads as a believable human result the site accepts as-is.

### Why does it press a key before typing the passage?
The site starts the timed test on the first keystroke, so the tool types one throwaway character to begin the run, then types the actual passage.

### Why scrape `.screen-display .text` instead of a hash-based selector?
The site is built with styled-components, whose generated class names change on every rebuild. Semantic classes like `.screen-display .text` are stable, so the scrape doesn't break when the build hashes change. Scoping to the inner `.text` node also keeps the sibling stats table (`.indicators`) out of the scrape entirely.

### How does it report the result?
It doesn't read the end-of-test screen — the site caps superhuman runs there. Instead, a poll loop samples the live stats readout every `LIVE_POLL_MS` while typing and keeps the highest WPM/CPM seen; it keeps sampling for `LIVE_SETTLE_MS` after the last keystroke to catch the post-burst spike, then logs a line like `Peak live speed — 10788 WPM, 53940 CPM`. A visible window stays up only until the site redirects to its results screen, then closes automatically (`HOLD_OPEN_MS` caps that wait so it never hangs).

### Why is the stats stripping done with a regex fallback at all?
The preferred path slices an exact, live-read stats string. The regex exists only for when that text isn't available, and it's deliberately conservative — it requires a numeric token before stripping, so it can't accidentally remove real passage words.

### Does it leave browser processes running?
No. The run is wrapped in `try/catch/finally`, and both the browser context and the browser are closed in the `finally` block on every exit path.

### How do I run it without a visible window?
Set `HEADLESS=true` (for example, `HEADLESS=true npm start`). The default is a visible window.
