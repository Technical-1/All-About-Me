# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Runtime | Electron | ^42.1.0 | Native window, system tray, notifications, file dialogs — all the OS surface area I needed, with web tech for the UI |
| Browser automation | puppeteer-core | ^24.4.0 (24.43.1 locked) | I wanted to bundle a specific Chrome version inside the installer; `puppeteer-core` doesn't try to fetch its own Chromium at install time |
| Packaging | electron-builder | ^26.8.1 | Cross-platform installer producer with first-class `extraResources` (for bundling Chrome) and an `afterSign` hook (for notarization) |
| Mac notarization | @electron/notarize | ^2.5.0 | Apple's notary API client; the hardened-runtime + notarize path is non-negotiable for distributing macOS apps outside the App Store without Gatekeeper warnings |
| Tests | Vitest | ^4.1.6 | Fast test runner with mocks built in; minimal config (`vitest.config.js`) for a small unit suite |

## Application surface

- **Window framework**: Electron `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, and a CSP `<meta>` tag in `index.html` (`default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'`)
- **UI**: Plain HTML/CSS/JS — no framework or bundler. `index.html` holds the markup and styles, `renderer.js` the DOM logic
- **State persistence**: Plain JSON files under `app.getPath('userData')` — `schedules.json`, `results.json`, and a `login-confirmed` marker — plus the `chrome-profile/` directory. Renderer-only preferences (screenshot folder, headless toggle, hide-zero filter) sit in `localStorage`. No database
- **Background behavior**: System tray with a last-result summary and a "Run Now" submenu; the icon is resized to 18×18 for the macOS menu bar. The window hides on close instead of quitting so scheduled runs continue to fire

## Browser layer

- **Engine**: Chrome for Testing 144.0.7559.96 (pinned in `scripts/download-chrome.js`)
- **Process model**: `puppeteer-core.launch()` per run, with `userDataDir` pointing at the app's user-data directory so cookies persist between runs
- **Launch flags**: `--no-sandbox`, `--disable-setuid-sandbox`, `--no-first-run`, `--no-default-browser-check`, plus `--disable-session-crashed-bubble` and `--hide-crash-restore-bubble` because the persistent profile otherwise offers to "restore" a session Puppeteer closed. The runner also patches the profile's `Default/Preferences` to record a clean exit before each launch
- **Headless**: Off by default; toggled per automation in its settings panel
- **Viewport**: Fixed 1280×800 so selectors behave the same on every machine

## Build & distribution

- **Mac targets**: DMG + ZIP for arm64 and x64, code-signed and notarized via `scripts/notarize.js`. Hardened runtime enabled with custom entitlements (`build/entitlements.mac.plist`: JIT + unsigned executable memory). Built locally. `download-chrome.js` fetches Chrome for the build machine's architecture only, so both arch targets bundle that one Chrome build
- **Windows targets**: NSIS installer (allows custom install dir, creates desktop + start menu shortcuts) + portable .exe
- **Linux targets**: AppImage + .deb
- **Windows build fix**: `scripts/fix-wincosign-cache.js` runs in `prebuild`. electron-builder's `winCodeSign` archive contains macOS symlinks that Windows can't extract without Developer Mode, so the script downloads the archive if it isn't cached, extracts it with 7-Zip's `-snl` flag, and writes empty placeholders for the two symlinked `.dylib` files. It is a no-op off Windows
- **CI**: GitHub Actions on Node 20 (`actions/checkout@v6`, `actions/setup-node@v6`, npm cache). `build.yml` builds Windows + Linux on every push/PR to `main` with `--publish never`. `release.yml` runs on `v*.*.*` tags or manual dispatch and attaches `dist/*.exe`, `dist/*.AppImage` and `dist/*.deb` to the GitHub release via `softprops/action-gh-release@v3`

## Development Tools

- **Package Manager**: npm with a committed `package-lock.json` for deterministic CI installs
- **Linting**: none — small enough that the value/maintenance ratio doesn't justify a config file
- **Testing**: Vitest — 12 tests across `automation/helpers.test.js` (the five helpers, against a mocked `page`) and `automation/login-url.test.js` (the sign-in URL classifier)
- **Pre-build**: `scripts/download-chrome.js` downloads the pinned Chrome into `chrome-local/<os>/` (skipped if already present). The `prebuild` npm script runs it plus the Windows fix before `npm run build`; npm does not run `prebuild` for the `build:*` variants, so run `npm run download-chrome` first when using those

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `electron` | Desktop runtime + window/tray/IPC primitives |
| `puppeteer-core` | Drives the bundled Chrome via DevTools Protocol |
| `@puppeteer/browsers` | Used at build-time only, to download Chrome into `chrome-local/` |
| `electron-builder` | Packager for all three OS targets |
| `@electron/notarize` | Wraps the macOS notary submission step |
| `png-to-ico` | Dev-only, for producing the Windows `.ico` from the PNG icon (no checked-in script calls it) |
| `sharp` | Dev-only image processing for icon assets (no checked-in script calls it) |
| `vitest` | Test runner |
