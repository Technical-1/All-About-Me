# Project Q&A

## Overview

The `@technical-1` Puppeteer Suite is a family of 29 small npm packages for automating Chrome with `puppeteer-core`. Instead of one big framework you either adopt whole or not at all, each capability — launching a pooled browser, navigating with retries, extracting data, applying stealth, orchestrating a login flow, capturing screenshots, PDFs, coverage, or performance traces, solving captchas, coordinating tabs — is its own tree-shakeable package. They compose through a tiny shared `core` of types, a typed error hierarchy, and a dependency-injected `Logger`, so the pieces you install fit together without you wiring them by hand.

## What problem does it solve?

Puppeteer scripts tend to rot into copy-pasted helper files — a `safeClick` here, a retry wrapper there, a Chrome-path resolver in every project. This suite turns those one-off helpers into versioned, tested packages you install à la carte, with consistent error handling and logging across all of them. Your next automation project starts from a real library instead of a blank file.

## Who is it for?

- **Developers building scrapers and automation** who want reliable navigation, extraction, and output helpers without rebuilding them every time.
- **Teams that need anti-detection primitives** — stealth wiring, realistic fingerprints, human-like timing, device emulation, and proxy support as composable pieces rather than a monolith.
- **Anyone embedding Puppeteer in a larger app** — the injected `Logger` streams structured progress into a console, an event emitter, or a GUI without coupling the automation to the UI.

## What can it do?

### Install à la carte, compose freely
Install `@technical-1/launcher` and `@technical-1/navigation` without dragging in captcha or PDF code. Capability packages don't depend on each other — they only share the `core` contract — so you take exactly what you need.

### Typed, retry-aware errors
Every failure is a `PptrKitError` subclass with a `retryable` flag and structured `context`. The retry helper reads that flag, so transient failures back off and retry while deterministic ones fail fast — and you branch on `err.name`/`err.retryable` instead of parsing message strings.

### Anti-detection that stays honest
Fingerprints whose user-agent is rewritten to match the *actual* running Chrome, geographically-coherent locale/timezone combinations, in-page `navigator.language` overrides, human-like delays, device/viewport emulation, and stealth-plugin wiring — all opt-in.

### Output, state, and coordination helpers
Full-page and element screenshots, PDF rendering with sensible per-side margin defaults, a CDP-based download awaiter, cookie/storage session capture and restore for multi-account workflows, and popup/new-tab coordination.

### Login flows, isolation, and diagnostics
`auth-flow` orchestrates a full login — fill credentials, submit, optional MFA/OTP step, wait for the authenticated state — as one call instead of a hand-rolled sequence. `contexts` gives you isolated, incognito `BrowserContext`s with guaranteed cleanup, per-context proxy, and permission overrides, so parallel jobs never bleed cookies or storage into each other. On the diagnostics side, `a11y` snapshots the accessibility tree and queries by role/name, `coverage` brackets an interaction with JS/CSS coverage and rolls up used/unused bytes, and `tracing` runs a DevTools performance trace around your function and always stops it, even on error.

### Escape hatches for anything the suite doesn't wrap yet
`cdp` opens a typed `CDPSession` from a `Page` or `Target`, lets you send raw commands and subscribe to events, and detaches safely — a scoped `withCdpSession` handles the common bracket pattern. `workers` enumerates Web/Service Workers on a page, evaluates code inside them, and observes their lifecycle with typed events, for the cases where the real work is happening off the main thread.

## Under the hood

### Dual ESM + CJS with correct per-condition types
Each package ships `index.js` (ESM), `index.cjs` (CJS), and *both* `index.d.ts` and `index.d.cts`, wired through a per-condition `exports` map. A flat top-level `types` field silently breaks CJS consumers under `verbatimModuleSyntax`; the per-condition map (plus a build check that asserts `index.d.cts` exists) prevents that. See `tsup.config.base.ts` and any package's `package.json` `exports`.

### Cross-realm-safe error detection
Because a consumer can mix ESM and CJS builds across packages, `instanceof` checks fail across the boundary. The suite branches on `err.name` and `err.retryable` instead, and re-wraps external errors (`fs`, network, `@puppeteer/browsers`) into `core` errors with an explicit `retryable` flag at every boundary (`packages/core/README.md` documents the convention; `chrome-setup` and `navigation` apply it).

### Race-free browser pool
`BrowserPool` reserves a slot synchronously before its first `await`, so concurrent `acquire()` calls can't blow past the size bound (the classic check-then-await race). It rolls the reservation back on launch failure and rejects queued waiters on `drain()` rather than leaving them pending. A test fires three concurrent acquisitions and asserts exactly one launch (`packages/launcher/src/pool.ts`).

### The fingerprint tracks the live browser
A user-agent claiming one Chrome version while the machine runs another is itself a detection signal. `applyFingerprint` reads the real `page.browser().version()` and rewrites the UA to match, so the spoof stays self-consistent with reality and never drifts stale.

## Design choices worth calling out

### Peer-dependency Puppeteer, injected by parameter
- **Constraint**: many packages drive a browser, but bundling `puppeteer-core` into each would cause version conflicts and duplicate installs.
- **Choice**: a bounded `peerDependency`, imported as `import type` only, with the `Browser`/`Page` passed in as a function argument.
- **Payoff**: you own the single version, packages stay tiny, and unit tests run against plain object mocks — no real Chrome, no module mocking.

### Latest-stable Chrome by default, with an explicit pin
- **Constraint**: a pinned Chrome goes stale (and an old browser is a detection signal), but fully floating installs aren't reproducible.
- **Choice**: `ensureChrome` resolves the latest stable build by default, accepts an explicit `buildId` to pin, and falls back to a known-good build if resolution fails offline.
- **Payoff**: fresh installs stay current automatically, while anyone who needs byte-for-byte reproducibility can pin — and nothing breaks without a network.

### A coverage gate, not just a coverage badge
- **Constraint**: "we have tests" means nothing if coverage quietly erodes.
- **Choice**: a 90% line/branch/function threshold enforced in CI, with in-browser callback bodies (which only run inside Chromium) covered by the integration tier and annotated rather than faked.
- **Payoff**: the bar can't silently regress, and the annotations keep honest what a unit test genuinely can't reach.

## Frequently asked questions

### Do I have to install all 29 packages?
No — that's the whole point. Install just the ones you need plus the `puppeteer-core` peer, e.g. `npm install @technical-1/extract puppeteer-core`. Capability packages only depend on `core` (and `navigation` on `retry`), so you never drag in the rest of the suite.

### Does it bundle Chrome, or Puppeteer?
Neither is bundled. `puppeteer-core` is a peer dependency your project installs, so *you* control the single version. Chrome itself is handled by `@technical-1/chrome-setup`, which resolves an existing install or downloads a Chrome-for-Testing build on demand.

### How do I tell one kind of error apart from another?
Every failure is a `PptrKitError` subclass — `NavigationError`, `TimeoutError`, `SelectorNotFoundError`, `DownloadError`, and so on. Branch on `err.name` to distinguish them and `err.retryable` to decide whether to retry. These properties are safe across ESM/CJS boundaries, unlike `instanceof`.

### How does retry decide what to re-attempt?
`withRetry` reads the error's `retryable` flag (via a pluggable `isRetryable`). Suite functions tag transient failures (network, I/O) as `retryable: true` and deterministic ones (bad selector, parse error) as `retryable: false`, so only the right failures back off and retry.

### Can I send automation logs to my own UI?
Yes. Pass any `Logger` — the `EventEmitter` implementation from `@technical-1/logger`, or your own — and subscribe to its events. Packages emit structured `log(message, level)` calls and never assume where the output goes. Pass nothing and they stay silent.

### Will the stealth and fingerprint packages beat bot detection?
Not on their own — anti-detection is an arms race. The suite gives you the building blocks (stealth plugin wiring, realistic and self-consistent fingerprints, human-like timing, proxies, emulation); how well they work depends on the target you're up against.

### Do the integration tests hit the real internet?
No. The integration tier (`PPTR_IT=1`) launches real Chrome against a local fixture HTTP server only. The default `pnpm test` doesn't launch Chrome at all, which keeps it fast.

### What does `chrome-setup` install, and where?
By default the latest stable Chrome-for-Testing build, into the standard Puppeteer cache; it checks for an already-resolved local Chrome first. Pass an explicit `buildId` for a reproducible, pinned install.

### If I need something the suite doesn't wrap, am I stuck?
No — `cdp` gives you a typed, scoped `CDPSession` (open, send, subscribe, detach) for anything Puppeteer's own API doesn't expose, so you're never blocked waiting on a new package. It follows the same `PptrKitError`/`retryable` conventions as everything else, so it doesn't feel like a different library bolted on.

### Does the suite handle logins with MFA?
Yes — `auth-flow` fills credentials, submits, and can pause for an optional MFA/OTP step (you supply the code, e.g. from a TOTP generator or inbox) before waiting for whatever signal means "authenticated" on the target site. It's built on the same `interaction-helpers` and `navigation` primitives, not a separate parsing layer.
</content>
