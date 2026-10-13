# Architecture

## System Diagram

```mermaid
flowchart TD
    User([User])

    subgraph Electron["Electron App"]
        subgraph MainProcess["Main Process — main.js"]
            IPC[IPC Handlers]
            Tray[Tray Menu]
            Sched[Scheduler]
            FileStore[(schedules.json<br/>results.json<br/>login-confirmed)]
        end

        subgraph Renderer["Renderer — index.html + renderer.js"]
            UI[UI: Cards · Logs · Settings]
        end

        Preload[Preload Bridge<br/>preload.js]

        subgraph Automation["Automation Layer"]
            Runner[runner.js<br/>automationId dispatcher]
            Login[runLoginFlow<br/>classifyLoginUrl]
            Helpers[helpers.js<br/>safeClick, safeType, ...]
            ChromePath[chrome-path.js]
        end
    end

    subgraph Chrome["Bundled Chrome"]
        Browser[puppeteer-core<br/>userDataDir profile]
    end

    Site([Target Web App])

    User -->|click Run| UI
    UI <-->|contextBridge| Preload
    Preload <-->|ipcMain| IPC
    Tray -->|Run Now| IPC
    Sched -.->|setTimeout fires| IPC
    IPC --> Runner
    IPC -->|start-login-flow| Login
    Login --> ChromePath
    Runner --> Helpers
    Runner --> ChromePath
    ChromePath --> Browser
    Browser <-->|HTTPS + saved cookies| Site
    IPC --> FileStore
    Sched --> FileStore
```

## Component Descriptions

### Main process (`main.js`)
- **Purpose**: Owns the OS-level surface — windows, tray icon, notifications, scheduling, and persistence
- **Location**: `main.js`
- **Key responsibilities**:
  - Creates the `BrowserWindow` with `contextIsolation: true` and `nodeIntegration: false`
  - Builds the tray menu showing each automation's next-run time and last result; resizes the 512 px source icon to 18×18 on macOS/Linux so it renders in the menu bar (Windows uses the multi-resolution `.ico`)
  - Hides the window on close instead of quitting, so the scheduler keeps running
  - Holds the `setTimeout` handles for all scheduled runs (rebuilt at startup from `schedules.json`)
  - Implements all `ipcMain.handle` endpoints (run, schedule save/load, headless toggle, last result, login flow, login status, screenshot dir picker, login data clearing)
  - Guards each automation with a `running` flag so a manual run and a scheduled run can't overlap

### Renderer (`renderer.js` + `index.html`)
- **Purpose**: UI layer — talks to the main process exclusively through the preload bridge. Only cosmetic preferences (screenshot folder, headless toggle, hide-zero-hours filter) live in `localStorage`; schedules and results are owned by the main process
- **Location**: `renderer.js`, `index.html`
- **Key responsibilities**:
  - Renders the onboarding (log-in) screen or the three automation rows, depending on `check-login-status`
  - Builds a per-automation settings panel (headless toggle, start date, time, recurrence) and shows the computed next run
  - Renders three result card formats (status badge, count badges, weekly time-grid) depending on the automation's result shape
  - Subscribes to `automation-log` and `auth-required` IPC events for streaming logs and auth state changes

### Preload bridge (`preload.js`)
- **Purpose**: Whitelisted API exposed to the renderer via `contextBridge`
- **Location**: `preload.js`
- **Key responsibilities**: Hides `ipcRenderer` from the renderer's window scope; exposes one explicit function per IPC channel so the renderer never sees raw Node APIs

### Runner (`automation/runner.js`)
- **Purpose**: Dispatcher and Puppeteer lifecycle owner for the three automations
- **Location**: `automation/runner.js`
- **Key responsibilities**:
  - Looks up the automation by id in a `{ [automationId]: fn }` map
  - Launches `puppeteer-core` against the bundled Chrome binary with a persistent `userDataDir` so cookies survive between runs
  - Before launch, rewrites the profile's `Default/Preferences` to mark the last exit as clean (`disableSessionRestore`), then closes any extra restored pages, leaving exactly one fresh tab
  - `checkAuthRedirect` throws a sentinel `AUTH_REQUIRED` error when the sign-in field is on the page; the main process catches it, deletes the login marker, and tells the renderer to drop back to the login screen
  - Owns the interactive login flow (`runLoginFlow`) and the pure `classifyLoginUrl` helper it relies on

### Helpers (`automation/helpers.js`)
- **Purpose**: A small site-agnostic Puppeteer toolkit so each automation reads as a sequence of intent-named steps
- **Location**: `automation/helpers.js`
- **Key responsibilities**: Five primitives — `safeClick`, `safeType`, `waitAndGet`, `screenshot`, `scroll` — each of which waits for the selector first and throws a useful error if it's missing. This is the API a new automation is meant to be written against.

### Chrome path resolver (`modules/chrome-path.js`)
- **Purpose**: Finds the correct Chrome binary in either dev or packaged mode without making the runner aware of where the app is installed
- **Location**: `modules/chrome-path.js`
- **Key responsibilities**:
  - In a packaged build, walks `process.resourcesPath/chrome/` looking for the platform-specific executable name (including macOS `.app` bundle traversal)
  - In dev mode, checks `chrome-local/` first then falls back to the Puppeteer cache dir
  - In a packaged build, throws an explicit "Bundled Chrome not found … run `npm run download-chrome`" error; in dev, returns `undefined` so the runner reports "Chrome not found" instead of silently launching the wrong browser

## Data Flow

A scheduled run, step by step:

1. App starts → `scheduleAllRuns()` reads `schedules.json` and creates a `setTimeout` per enabled automation, computing `next - now` ms from each schedule's `startDate`, `time`, and `recurrence`
2. The timer fires → `triggerRun(automationId, manual=false)` is called from the main process; it skips the run if that automation is already in progress
3. `runner.run()` resolves the bundled Chrome path, calls `puppeteer.launch()` (headless only if the schedule's `headless` flag is set) with `userDataDir` pointing at the app's user-data directory + `chrome-profile` subfolder
4. The dispatcher invokes the site-specific function which navigates, waits for selectors, scrapes the DOM, and either confirms an action or returns structured data
5. The result is written to `results.json` keyed by `automationId`, and the schedule's `lastRun` is updated
6. A native `Notification` fires (success or failure), the next `setTimeout` is armed, and the tray menu rebuilds with the new status

The tray's **Run Now** items go through the same `triggerRun` path with `manual=true`. A run started from the app window instead goes through the `run-automation` IPC handler: same runner and same `results.json` write, but the result is returned to the renderer to draw its card, and no notification fires.

The login flow (`runLoginFlow`) is a separate path. It launches Chrome **non-headless** at the target app and runs in two phases:

1. **Already signed in?** For up to 25 s it classifies the current URL with `classifyLoginUrl`. If the browser settles on the app's hostname, stays there for 2 s, and no sign-in field is present, the existing session is accepted and the window closes.
2. **Wait for sign-in to finish.** Otherwise it polls every 2 s for up to 5 minutes until the browser is back on the app hostname with no Microsoft email/password field visible — i.e. after email, password, MFA and the "stay signed in?" prompt are all done. Closing the window aborts with a clear message.

It then waits for network idle so Chrome flushes cookies to disk, and the main process writes the `login-confirmed` marker file.

## External Integrations

| Service | Purpose | Notes |
|---------|---------|-------|
| Chrome for Testing | Browser to drive | Pinned version downloaded by `scripts/download-chrome.js` and bundled into the installer via `electron-builder`'s `extraResources` |
| Apple notary service | macOS code-signing + notarization | Hooked into electron-builder's `afterSign` via `scripts/notarize.js`; credentials read from env (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) |
| Microsoft sign-in (SSO) | The target app's identity provider | Never automated — the user signs in by hand in a visible window. The app only recognises its hostnames (`login.microsoftonline.com`, `login.live.com`, ADFS/federation hosts) and its `#i0116` / `#i0118` fields |
| GitHub Actions + Releases | CI and distribution | `build.yml` builds Windows + Linux on push/PR to `main`; `release.yml` builds on `v*.*.*` tags and attaches installers with `softprops/action-gh-release` |

## Key Architectural Decisions

### Bundling Chrome inside the installer instead of using system Chrome
- **Context**: The automations need a known browser version with deterministic DOM behavior. End users shouldn't have to install Chrome separately, and version drift between Puppeteer's expected build and whatever the user has installed produces silent breakage
- **Decision**: Ship a pinned Chrome for Testing build inside the app via `electron-builder`'s `extraResources`. `scripts/download-chrome.js` runs as a prebuild step and populates `chrome-local/<platform>/`
- **Rationale**: Carries a full Chrome build in every installer (the macOS `chrome-local/` download is ~330 MB unpacked) but eliminates an entire class of "works on my machine" support burden. The alternative — depending on `puppeteer` proper, which downloads its own Chromium at install time — wouldn't work because that download isn't bundled by electron-builder, only the JS deps

### Single persistent `userDataDir` across all runs
- **Context**: Re-authenticating before every automation is a non-starter — half the value is that runs are fully unattended on a schedule. Cookies need to survive between Chrome launches
- **Decision**: Point Puppeteer's `userDataDir` at `app.getPath('userData')/chrome-profile`. All automations share this profile; the login flow writes a `login-confirmed` marker file separate from the cookies themselves
- **Rationale**: Chrome handles cookie persistence; we just have to give it a stable place to write. The marker file lets the UI distinguish "never logged in" from "session expired" — they look the same to Puppeteer (both land on the auth page) but only the latter needs the inline error path

### `setTimeout`-based scheduler instead of cron / OS task scheduler
- **Context**: We want recurring runs without asking the user to install crontab entries or learn launchd plists
- **Decision**: Schedule next run with `setTimeout` from the main process. `getNextRun` walks forward in `recurrence`-ms steps from `startDate` until it's in the future. Schedules persist to `schedules.json` so the timers are recreated at every startup
- **Rationale**: Trade-off accepted: this only fires when the app is running. The tray icon keeps the app resident so this is acceptable for the use case, and it avoids the much larger blast radius of installing OS-level scheduled tasks (which need elevated permissions on Windows and survive uninstall). Future versions could add an OS-scheduler escape hatch behind a flag if needed

### Detect expired sessions via a sentinel error from the runner
- **Context**: A scheduled headless run can't show a sign-in dialog. When cookies expire we need to bail cleanly and prompt re-login on the user's next interactive visit, not freeze on the sign-in page forever
- **Decision**: `runner.js` probes for the auth provider's sign-in field selector right after the initial page load. If present, it throws `Error('AUTH_REQUIRED: …')`. Main process catches the prefix, deletes the `login-confirmed` marker, emits an `auth-required` IPC event, and surfaces the window
- **Rationale**: A clean sentinel-error pattern beats trying to model auth state across IPC. The runner stays stateless; the only thing the main process has to know is "did the error message start with AUTH_REQUIRED?"

### Detect sign-in completion by hostname, not by a disappearing field
- **Context**: The login window has to close itself once the user is fully signed in. The obvious signal — "the email field is gone" — fires after the *first* step of a Microsoft sign-in, which would close the browser before the password and MFA screens
- **Decision**: `classifyLoginUrl` in `automation/runner.js` parses the URL with `new URL()` and classifies its **hostname** as `login`, `app`, or `unknown`. The flow completes only when the hostname is the app's and no sign-in field is on screen
- **Rationale**: A substring check like `url.includes(appHost)` would be wrong, because the Microsoft sign-in URL carries the app URL in its `redirect_uri` query parameter. Hostname parsing handles that case, and because the function is pure it is covered by `automation/login-url.test.js` without launching a browser

### Site-agnostic helper layer between Puppeteer and the automations
- **Context**: Each automation needs to wait-for-then-click, wait-for-then-type, take screenshots, etc. Inlining `page.waitForSelector` + `page.click` + try/catch into every step turns the automations into noise
- **Decision**: `automation/helpers.js` exposes five primitives that each (a) wait for the selector with a default 15s timeout, (b) re-throw a clear "selector not found: X" error, (c) accept an opts bag for overrides. The automations read as a list of named intent steps with no try/catch
- **Rationale**: Honest scope — these aren't a "framework," they're the obvious refactor of the five operations that show up in every automation. Anything more exotic is straight Puppeteer because the `page` is passed through to the automation function

### Two-process Electron with a context-bridge whitelist
- **Context**: The renderer displays text scraped from third-party pages (log lines, timesheet rows) and triggers disk writes indirectly through IPC. A misstep here is a remote-code-execution vector
- **Decision**: `contextIsolation: true`, `nodeIntegration: false`, and `preload.js` exposes exactly the IPC channels the renderer needs as named methods on a `window.api` object. A CSP `<meta>` tag in `index.html` sets `default-src 'self'; script-src 'self'` (inline styles allowed), so scraped markup that reaches the DOM can't execute script
- **Rationale**: Standard Electron hardening, but it constrained the design in useful ways — every renderer→main interaction is an explicit IPC channel that I'd had to think about
