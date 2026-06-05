# Project Q&A

## Overview

The `@technical-1` Puppeteer Suite is a monorepo of 19 small npm packages for browser automation with `puppeteer-core`. Instead of one big framework, each capability — launching a pooled browser, navigating with retries, extracting data, applying stealth, capturing screenshots/PDFs, solving captchas — is its own tree-shakeable package, and they compose through a shared `core` of types, a typed error hierarchy, and a dependency-injected `Logger`. The interesting part is the discipline that makes a 19-package dual-format library actually hold together: peer-injected Puppeteer, cross-realm-safe errors, and unit tests that never touch a real browser.

## Problem Solved

Puppeteer scripts rot into copy-pasted helper files — a `safeClick` here, a retry wrapper there, a Chrome-path resolver in every project. This suite turns those helpers into versioned, tested packages you install à la carte, with consistent error handling and logging across all of them, so the next automation project starts from a library instead of a blank file.

## Target Users

- **Developers building scrapers / automation** — who want reliable navigation, extraction, and output helpers without rebuilding them each time.
- **Teams needing anti-detection primitives** — stealth wiring, realistic fingerprints, human-like timing, and proxy support as composable pieces.
- **Anyone embedding Puppeteer in an app** — the injected `Logger` streams structured progress into a console, an event emitter, or a GUI without coupling the automation to the UI.

## Key Features

### À-la-carte, composable packages
Install `@technical-1/launcher` and `@technical-1/navigation` without pulling in captcha or PDF code. Packages interoperate because they all speak the same `core` contract.

### Typed, retry-aware error model
Every failure is a `PptrKitError` subclass with a `retryable` flag and structured `context`. The retry helper reads that flag, so transient failures back off and retry while deterministic ones fail fast.

### Anti-detection that stays honest
Fingerprints whose user-agent is rewritten to match the *actual* running Chrome, locale/timezone combinations that are geographically coherent, in-page `navigator.language` overrides, human-like delays, and stealth-plugin wiring.

### Output + state helpers
Full-page and element screenshots, PDF rendering with sensible per-side margin defaults, a CDP-based download awaiter, plus cookie/storage session capture and restore.

## Technical Highlights

### Dual ESM + CJS with correct per-condition types
Each package ships `index.js` (ESM), `index.cjs` (CJS), and *both* `index.d.ts` and `index.d.cts`, wired through a per-condition `exports` map. A flat top-level `types` field silently breaks CJS consumers under `verbatimModuleSyntax`; the per-condition map (and a build check that asserts `index.d.cts` exists) prevents that. See `tsup.config.base.ts` and any package's `package.json` `exports`.

### Cross-realm-safe error detection
Because a consumer can mix ESM and CJS builds across packages, `instanceof` checks fail across the boundary. The suite branches on `err.name` and `err.retryable` instead, and re-wraps external errors (`fs`, network, `@puppeteer/browsers`) into `core` errors with an explicit `retryable` flag at every package boundary (`packages/core/README.md` documents the convention; `chrome-setup` and `navigation` apply it).

### Private test seams via a `…ForTesting` shim
`downloads.awaitDownload` needs injectable `readdir`/`stat` for unit tests, but those hooks must not appear in the published types. The public function takes a narrow options type; a separate `awaitDownloadForTesting` takes the wider internal type and is imported directly by tests. The barrel exports only the narrow wrapper, so the privacy is enforced by the `.d.ts`, not by convention (`packages/downloads/src/await.ts`).

### Race-free browser pool
`BrowserPool` reserves a slot synchronously before its first `await`, so concurrent `acquire()` calls can't blow past the size bound (the classic check-then-await TOCTOU). It rolls the reservation back on launch failure and rejects queued waiters on `drain()` rather than leaving them pending. A test fires three concurrent acquisitions and asserts exactly one launch (`packages/launcher/src/pool.ts`).

## Engineering Decisions

### Peer-dependency Puppeteer, injected by parameter
- **Constraint**: 14 packages drive a browser, but bundling `puppeteer-core` into each would cause version conflicts and duplicate installs.
- **Options**: bundle it per package; make it a normal dependency; or make it a peer and inject the instance.
- **Choice**: a bounded `peerDependency`, imported as `import type` only, with the `Browser`/`Page` passed in as a function argument.
- **Why**: the consumer owns the single version, packages stay tiny, and unit tests run against plain object mocks — no real Chrome, no module mocking.

### Latest-stable Chrome by default, with an explicit pin
- **Constraint**: a pinned Chrome version goes stale (and an old browser is a detection signal), but fully floating installs aren't reproducible.
- **Options**: hardcode a build; always fetch latest; or default to latest with an opt-in pin.
- **Choice**: `ensureChrome` resolves the latest stable build by default, accepts an explicit `buildId` to pin, and falls back to a known-good pinned build if resolution fails offline.
- **Why**: fresh installs stay current automatically, while anyone who needs byte-for-byte reproducibility can pin — and nothing breaks without a network.

### A coverage gate instead of a coverage badge
- **Constraint**: "we have tests" means nothing if coverage quietly erodes.
- **Options**: measure coverage informally; display a badge; or fail the build below a threshold.
- **Choice**: a 90% line/branch/function threshold enforced in CI, with in-browser callback bodies (which only run inside Chromium) covered by the integration tier and explicitly annotated rather than faked.
- **Why**: the bar can't silently regress, and the annotations make honest what a unit test genuinely can't reach.

## Frequently Asked Questions

### How do I use just one package?
Install it plus the `puppeteer-core` peer, e.g. `npm install @technical-1/extract puppeteer-core`. Packages only depend on `core` (and occasionally another utility), so you don't drag in the whole suite.

### Why is `puppeteer-core` not a normal dependency?
So your project controls the single Puppeteer/Chrome version. The packages import only its types and receive the `Browser`/`Page` you create, which also makes them trivial to unit-test without launching Chrome.

### How does retry decide what to re-attempt?
`withRetry` calls the error's `retryable` flag (via a pluggable `isRetryable`). Suite functions tag transient failures (network, I/O) as `retryable: true` and deterministic ones (bad selector, parse error) as `retryable: false`, so only the right failures back off and retry.

### Do the integration tests hit the real internet?
No. The integration tier (`PPTR_IT=1`) launches real Chrome against a local fixture HTTP server only. The default `pnpm test` doesn't launch Chrome at all, so it stays fast.

### Can I send automation logs to my own UI?
Yes. Pass any `Logger` (the `EventEmitter` implementation from `@technical-1/logger`, or your own) and subscribe to its events. Packages emit structured `log(message, level)` calls and never assume where the output goes.

### Is the stealth/fingerprint support guaranteed to beat bot detection?
No — anti-detection is an arms race. The suite provides the building blocks (stealth plugin wiring, realistic and self-consistent fingerprints, human-like timing, proxies); how well they work depends on the target.

### What does `chrome-setup` install, and where?
By default the latest stable Chrome-for-Testing build, into the standard Puppeteer cache; it first checks for an already-resolved local Chrome. Pass an explicit `buildId` for a reproducible pinned install.
