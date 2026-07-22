# Tech Stack

Everything here is chosen to keep the start fast and the templates honest: plain Node for the scaffolder, real npm packages for the automation, and standard tooling for tests, builds, and releases.

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (CommonJS) | Node `>=18` | Runs everywhere, no build step to read the source; CJS loads cleanly in both Node scripts and Electron's main process |
| Runtime | Node.js | 18+ (CI on 24) | Baseline for the suite and Electron; the scaffolder uses only built-ins |
| Browser driver | `puppeteer-core` | ^24.4.0 | Drives Chrome without bundling its own; the templates supply a pinned Chrome for Testing |
| Desktop shell | Electron | ^35.0.1 | Cross-platform desktop UI for the GUI template with a secure main/preload/renderer split |
| Packaging | electron-builder | ^25.1.8 | One config, installers for macOS (dmg/zip), Windows (nsis/portable), and Linux (AppImage/deb) |

## The @technical-1 suite

The templates don't reinvent browser automation — they compose a suite of small, single-purpose packages published to npm. Each does one job and shares a typed error model and an injectable logger.

| Package | What it does |
|---------|--------------|
| `@technical-1/chrome-setup` | Ensures / resolves a Chrome-for-Testing executable |
| `@technical-1/launcher` | `withBrowser` — launches Chrome and manages its lifecycle |
| `@technical-1/navigation` | `goto` — robust page navigation |
| `@technical-1/extract` | Pull text and data out of the page |
| `@technical-1/stealth` | Apply the stealth plugin to evade bot detection |
| `@technical-1/fingerprint` | Generate and apply a randomized browser fingerprint |
| `@technical-1/screenshots` | Full-page capture with timestamped filenames |
| `@technical-1/logger` | Console logger (CLI) and EventEmitter logger (GUI live panel) |
| `@technical-1/interaction-helpers` | Higher-level page interaction helpers (GUI template) |

The suite has since grown well past what the templates wire up by default. Packages for isolated browser contexts, login/auth flows, accessibility checks, code coverage, performance tracing, raw CDP access, and worker awareness are all published and ready to `pnpm add` into a runner when your automation needs them.

## GUI template

- **Framework**: Electron ^35.0.1
- **Process model**: `main.js` (main) ↔ `preload.js` (allow-listed bridge) ↔ `renderer.js` + `index.html` (UI)
- **Security**: `contextIsolation: true`, `nodeIntegration: false`, IPC-only privileged calls
- **Bundled browser**: a pinned Chrome for Testing fetched by `scripts/download-chrome.js` and shipped in the installer

## Infrastructure

- **Hosting**: none — this is a starter repo, not a deployed service; the GUI ships as downloadable installers via GitHub Releases
- **CI/CD**: GitHub Actions — a `scaffolder` job plus a per-template matrix (`ci.yml`) with an Electron packaging smoke test, and a tag-driven `release.yml` that builds and uploads Windows and Linux installers
- **Code signing**: unsigned by default (`mac.identity: null`); `scripts/notarize.js` skips notarization gracefully when Apple credentials aren't set

## Development Tools

- **Package Manager**: pnpm 10.34.1 (pinned via `packageManager`)
- **Testing**: Vitest — `^2.1.4` at the repo root and in `cli-app`, `^1.6.0` in the Electron template
- **Formatting / Linting**: none imposed — the templates stay minimal so your project can choose its own

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `commander` (^12.1.0) | Argument parsing for the `pptr-cli` command |
| `puppeteer-core` (^24.4.0) | The Chrome automation driver both templates build on |
| `electron` (^35.0.1) | Desktop shell for PptrKit GUI |
| `electron-builder` (^25.1.8) | Builds the cross-platform installers |
| `@electron/notarize` (^2.5.0) | Optional macOS notarization when signing credentials are supplied |
| `vitest` | Unit tests for the scaffolder and both runners |
