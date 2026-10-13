# Project Q&A

## Overview

Kanfer D-Toolkit is a cross-platform Electron desktop app that runs hand-written Puppeteer scripts against authenticated web tools on a recurring schedule. The interesting engineering isn't the scripts themselves — it's the surrounding infrastructure: a bundled Chrome inside the installer, a persistent browser profile that survives unattended scheduled runs, a tray-resident scheduler, a sign-in detector that copes with multi-step SSO redirects, and installers for all three desktop platforms (signed and notarized on macOS, CI-built on Windows and Linux).

## Problem Solved

Browser-based corporate web apps tend to have a handful of weekly tasks that take 30 seconds each but are easy to forget and tedious to do — confirm a schedule, scan a to-do list for new items, check a timesheet. Manually clicking through them every Monday is the kind of work that should be a script, but a raw Puppeteer script doesn't deal well with the realities: sessions expire, the user needs to occasionally re-authenticate, and the script needs a UI surface someone non-technical could trigger.

This app is the wrapper that makes hand-written browser automation actually usable on an unattended schedule.

## Target Users

- **My future self** — the original user. I wrote it for the three weekly tasks I was clicking through by hand
- **Engineers who want a starting point** — the `automation/` directory and helper API are a usable skeleton for anyone wanting to package their own site automations as a desktop app

## Key Features

### Persistent browser session
The first launch opens a visible Chrome window so the user can sign in to the target web app, including MFA. The app notices on its own when sign-in is finished and closes the window. All subsequent runs reuse the cookies via Puppeteer's `userDataDir`, so background runs (visible or, if toggled, headless) work without prompting until the session genuinely expires.

### Tray-resident scheduler
The app lives in the menu bar / system tray. The tray menu shows each automation's next-run time and last result; closing the window doesn't quit the app, which keeps the in-process `setTimeout` scheduler alive for unattended runs.

### Bundled Chrome
The installer ships its own pinned Chrome for Testing build, so the app works on machines where the user doesn't have Chrome (or has the wrong version). The runner picks it up via `modules/chrome-path.js`, which knows how to walk `process.resourcesPath` in packaged mode and `chrome-local/` in dev mode.

### Signed + notarized macOS distribution
`scripts/notarize.js` hooks into electron-builder's `afterSign` and submits the signed `.app` to Apple's notary service so users don't see Gatekeeper warnings. Signing and notarization run automatically on a local macOS build once three env vars are set; Windows and Linux installers are built by GitHub Actions when a release is tagged.

### Re-usable helper API
`automation/helpers.js` exposes five Puppeteer primitives — `safeClick`, `safeType`, `waitAndGet`, `screenshot`, `scroll` — each of which waits for visibility, has a default timeout, and throws a clear "selector not found" error. New automations are written against this surface, not raw Puppeteer.

## Technical Highlights

### Knowing when a multi-step SSO sign-in is actually finished
The login window has to close itself, but only after the user has cleared every step — email, password, MFA, and the "stay signed in?" prompt. The tempting signal, "the email field disappeared", fires after step one. `runLoginFlow` in `automation/runner.js` instead waits until the browser is back on the target app's **hostname** with no sign-in field visible. `classifyLoginUrl` parses the URL with `new URL()` rather than doing a substring match, because the Microsoft sign-in URL embeds the app URL in its `redirect_uri` parameter and a naive `includes()` would report "done" mid-login. A first 25-second phase short-circuits when an existing session is still valid; the second phase allows 5 minutes and aborts cleanly if the user closes the window. The classifier is pure, so `automation/login-url.test.js` pins down the `redirect_uri` case without a browser.

### Sentinel-error pattern for expired sessions
A headless scheduled run can't surface a sign-in dialog, but the user does need to be told their session expired the next time they look at the app. The runner probes for the auth provider's sign-in selector immediately after page load; if it's present, it throws `new Error('AUTH_REQUIRED: …')`. The main process catches errors whose message starts with `AUTH_REQUIRED`, deletes the `login-confirmed` marker file, and emits an `auth-required` IPC event that flips the renderer back to the onboarding screen. The runner stays stateless — auth state lives entirely in main-process file IO plus a single error message convention.

### Walking macOS `.app` bundles in the Chrome resolver
On macOS, Chrome ships as `Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`. A naive `find` wouldn't know to step inside the `.app`. `findChromeExecutable` in `modules/chrome-path.js` does a BFS through the directory tree, but when it hits a `.app` directory it pushes the inner `Contents/MacOS` onto the front of the queue rather than the back — so the bundle's binary is found before any extraneous executables that might exist deeper in the tree.

### `setTimeout`-based scheduler that survives app restarts
Schedules live in `schedules.json` under `app.getPath('userData')`. At startup, `scheduleAllRuns()` iterates every saved schedule and calls `setTimeout(triggerRun, next - now)`. `getNextRun()` walks forward in `recurrence`-sized steps (daily / weekly / biweekly) from the saved `startDate + time` until it finds a moment in the future. After every run, `scheduleNextRun()` re-arms the next timer. The whole "scheduler" is ~30 lines that lean on the JS event loop.

## Engineering Decisions

### Bundled Chrome vs. system Chrome vs. puppeteer-bundled Chromium
- **Constraint**: Automations need a known browser. End users probably don't have Puppeteer installed, and the version Puppeteer ships might not match what the bundled scripts were tested against
- **Options**: (a) System Chrome, hope for the best; (b) `puppeteer` proper, which downloads Chromium at install time; (c) Bundle Chrome ourselves in the installer
- **Choice**: (c) — `puppeteer-core` + a pre-build hook that downloads a pinned Chrome version per-platform, then `electron-builder.extraResources` copies it into the installer
- **Why**: Carries a full Chrome build in every installer (~330 MB unpacked on macOS) but eliminates "Chrome not found" / "Chrome version mismatch" as a category of bug. Path (b) doesn't work because `electron-builder` bundles JS deps but not the Chromium binary `puppeteer` downloads — that lives in `~/.cache/puppeteer/` on the build machine and never makes it into the installer

### Persistent userDataDir vs. cookie injection vs. re-login per run
- **Constraint**: Headless scheduled runs must not require user interaction. Cookies from the interactive login flow have to survive between runs
- **Options**: (a) Re-authenticate every run (impossible — most corporate SSO uses MFA); (b) Extract cookies after login and inject them on each run; (c) Hand Puppeteer a `userDataDir` and let Chrome manage the whole profile
- **Choice**: (c)
- **Why**: Cookie injection is brittle — SSO flows often set httpOnly + secure cookies across multiple domains, with refresh logic the application server expects to see executed in a real browser. A persistent profile means Chrome handles all of that the same way it would for a human

### setTimeout scheduler vs. cron / launchd
- **Constraint**: Want recurring runs with no setup beyond clicking a checkbox in the app
- **Options**: (a) Install OS-level scheduled tasks (cron on Linux, launchd plists on macOS, Task Scheduler entries on Windows); (b) Run a long-lived `setTimeout` in the Electron main process while the app sits in the tray
- **Choice**: (b)
- **Why**: OS-level schedulers can run when the app is closed, which is genuinely useful — but installing them needs elevated permissions on Windows, leaves residue if the app is uninstalled imperfectly, and varies per-OS. The tray-resident timer trades "runs when app is closed" for "runs reliably with zero setup permissions"

### JSON files vs. SQLite vs. electron-store for persistence
- **Constraint**: Save schedule + result data across app restarts
- **Options**: (a) SQLite via `better-sqlite3`; (b) `electron-store` (already a common Electron community choice); (c) hand-rolled JSON writes
- **Choice**: (c)
- **Why**: Total state is a few small JSON objects in two files plus a marker file. Adding SQLite or `electron-store` is paying setup cost for a problem we don't have. The trade-off is no schema validation and full-file rewrites on every save — both acceptable at this data size

## Frequently Asked Questions

### Why bundle Chrome instead of using Electron's built-in Chromium?
Electron's Chromium runs the app's UI and is heavily customized. Puppeteer drives an external Chrome via the DevTools Protocol — it's a separate browser process with no relationship to Electron's. Bundling a known Chrome version means the automations don't break when Electron upgrades its embedded Chromium.

### What happens if my session expires while the app is closed?
Nothing fires until the app is open again. The next scheduled run after launch will hit the auth page, the runner throws `AUTH_REQUIRED`, the main process deletes the login marker and surfaces the window, a failure notification fires, and the renderer drops back to the "Log In" screen.

### Do I have to log in again every time I click "Log In"?
No. The login flow first checks whether the saved profile already lands on the app. If it does and stays there for a couple of seconds, it reports "Already authenticated" and closes the window without asking for anything.

### Can I add my own automation?
Yes. Register an entry in `AUTOMATIONS` in `automation/runner.js` keyed by your automation id, write a function that takes `(page, screenshotDir, log)` and returns a result object, then add a row and result card in `index.html`, a render function in `renderer.js`, and a **Run Now** item in `buildTrayMenu()` in `main.js` — the UI and tray list are written out by hand rather than generated from the map. The helper API in `automation/helpers.js` covers the common cases; for anything more specific, the `page` is straight Puppeteer.

### Why store schedules as `setTimeout` instead of using cron?
The scheduler runs in-process, so it only fires when the app is running. That's a deliberate trade — `setTimeout` is zero-setup, has no permission requirements, doesn't leave residue if you uninstall, and the tray icon keeps the app resident anyway.

### Can it run on a headless server?
Not really. The first-run login flow opens a visible browser for the user to sign in interactively. If you have a way to seed cookies into the `chrome-profile` directory ahead of time, the subsequent scheduled runs could run headless on a server — but that's not the target use case.

### Are screenshots saved automatically?
Only when an automation calls `screenshot()` from the helpers. If no folder is set it writes to a `screenshots/` folder under the process's working directory; the App Settings panel lets the user pick a custom directory, which is passed through as `screenshotDir` to the runner (scheduled runs use the folder saved with that automation's schedule).
