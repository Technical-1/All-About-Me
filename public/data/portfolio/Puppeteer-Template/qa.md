# Project Q&A

## Overview

Puppeteer Templates is a starter repo for browser automation. Pick one of two templates, run a single scaffold command, and you get a real, runnable project that already composes the published `@technical-1` Puppeteer suite — launch, navigate, extract, stealth, fingerprints, screenshots, and structured logging wired together for you. The interesting part is the on-ramp: a zero-dependency scaffolder and two very different front ends (a headless CLI and a secure Electron desktop app) that share the same automation core.

## Problem Solved

Standing up a browser-automation project usually means gluing together a launcher, a navigation layer, screenshot handling, stealth, logging, and a pinned Chrome before you write a single line of your own logic. This repo does that glue once, in two shapes, so you can skip straight to the part that's actually yours — the automation.

## Target Users

- **Developers who need a scraper or bot fast** — scaffold the CLI, edit one block, ship it in a script or CI job.
- **People who prefer a UI over flags** — scaffold PptrKit GUI, type a URL, flip toggles, and watch logs stream in a window.
- **Teams building on the `@technical-1` suite** — a reference for how the packages compose in real projects, with a path to dev-link a local suite checkout.

## Key Features

### Scaffold in seconds
`node scripts/new.js <template> <target-dir>` copies a template into a fresh folder and prints exactly what to run next. The scaffolder has no dependencies of its own — nothing to install before you start.

### Two ready-to-run starting points
A headless `pptr-cli` command with `--stealth`, `--fingerprint`, `--screenshot <dir>`, and `--no-headless` flags and clean exit codes, or **PptrKit GUI**, an Electron desktop app with live streaming logs and toggle switches for the same capabilities.

### One file to customize
Both templates funnel your logic into a single marked `your automation here` block. The browser lifecycle, logging, and screenshots are already handled.

### Cross-platform desktop installers
The GUI template builds signed-ready installers for macOS, Windows, and Linux via `electron-builder`, with a pinned Chrome bundled in.

## Technical Highlights

### Zero-dependency scaffolder
`scripts/new.js` is built entirely on Node's `fs` and `path`. It uses `fs.cpSync` with a filter that skips `node_modules`, `dist`, `chrome-local`, and `.git`, refuses to write into a non-empty target, and gives a helpful error listing the available templates when you mistype one. Because it has no dependencies, there's no install step between cloning the repo and scaffolding your first project.

### Secure Electron bridge
The GUI runs Chrome automation, which makes renderer security matter. `main.js` sets `contextIsolation: true` and `nodeIntegration: false`, and `preload.js` exposes only a small `window.api` — `runAutomation`, `pickScreenshotDir`, and an `onLog` subscription — over named IPC channels. The renderer can't touch Node directly; it can only ask the main process to do the two things it's allowed to.

### Testable runners via an injected dependency seam
Both runners (`templates/cli-app/src/run.js` and `templates/electron-gui-app/automation/runner.js`) are CommonJS so they load in both plain Node and Electron's main process. Since Vitest's mocking operates on the ESM loader and can't intercept CJS `require()`, each runner accepts an optional `_deps` object — real packages in production, mocks in tests — so the automation logic stays unit-testable without converting to ESM.

### Notarization that never blocks a build
`scripts/notarize.js` runs after signing but returns early when `APPLE_ID` isn't set, logging "Skipping notarization" instead of throwing. Combined with `mac.identity: null`, any contributor can produce a working macOS build with no Apple credentials, while a real signed-and-notarized release is just a matter of supplying the environment variables.

## Engineering Decisions

### File-copy scaffolder over a generator framework
- **Constraint**: The value proposition is speed — a start that itself needs installing undermines it.
- **Options**: A CLI framework (Yeoman-style), a template engine with variable substitution, or a plain recursive copy.
- **Choice**: A plain recursive copy using Node built-ins.
- **Why**: Templates are already complete, runnable projects — they don't need placeholder substitution. A dependency-free copy is instant, trivial to read, and has nothing to keep patched.

### Depend on published packages instead of vendoring the suite
- **Constraint**: Templates need the automation building blocks, which evolve on their own schedule.
- **Options**: Copy the suite's source into each template, or install the packages from npm.
- **Choice**: Install `@technical-1/*` from npm with `puppeteer-core` as a peer.
- **Why**: Scaffolded projects get versioned, updatable dependencies; a `pnpm update` picks up suite improvements. `docs/using-the-suite.md` covers `link:`-ing a local checkout when you want to work on both at once.

### Two templates over one configurable mega-template
- **Constraint**: A CLI and a desktop GUI have genuinely different structures and dependencies.
- **Options**: One template with a mode flag, or two focused templates.
- **Choice**: Two templates that share the automation-runner pattern but nothing else.
- **Why**: Each stays minimal and readable, and you install only what that shape needs — the CLI never pulls Electron, the GUI never carries CLI-only plumbing.

## Frequently Asked Questions

### What's the difference between the CLI and the GUI template?
The `cli-app` template is a headless command-line tool (`pptr-cli <url> [flags]`) meant for scripts, cron, and CI. The `electron-gui-app` template (PptrKit GUI) is a desktop app where you enter a URL, toggle Stealth / Fingerprint / Screenshot, click Launch, and watch logs stream live. Both share the same automation-runner pattern, so logic ports easily between them.

### Does the scaffolder pull dependencies?
No. `scripts/new.js` only copies files — it uses Node built-ins and installs nothing. Your dependencies come later, when you `pnpm install` inside the new project.

### How do I run the CLI after scaffolding?
`pnpm install`, then `pnpm start <url> [flags]` — for example `pnpm start https://example.com --stealth --screenshot ./shots`. Note there's no leading `--` before the URL. It exits `0` on success and `1` on failure.

### Where does Chrome come from?
The CLI downloads a pinned Chrome-for-Testing build (~150–200 MB) on first run if none is cached. The GUI fetches it explicitly with `pnpm run download-chrome` and bundles it into the installer so the packaged app is self-contained.

### Do I need to sign the macOS build?
No. Builds are unsigned by default (`mac.identity: null`), so `electron-builder` skips code-signing and `scripts/notarize.js` skips notarization when Apple credentials aren't present. To distribute a signed, notarized app, supply a Developer ID certificate and set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.

### Which platforms can the GUI build for?
macOS (dmg and zip, x64 + arm64), Windows (nsis installer and portable), and Linux (AppImage and deb), all from `electron-builder` config in the template's `package.json`.

### How do I add my own automation?
Open the runner (`src/run.js` for the CLI, `automation/runner.js` for the GUI) and edit the marked `your automation here` block. Add more suite packages by installing and `require`-ing them the same way the existing ones are used.

### Can I develop against a local copy of the suite?
Yes. Point a package at a local build with a pnpm `overrides` `link:` entry in the template's `package.json`, as described in `docs/using-the-suite.md`. Remove the override to go back to the published version.
