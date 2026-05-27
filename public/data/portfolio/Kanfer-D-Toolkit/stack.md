# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Runtime | Electron | 42.1.0 | Native window, system tray, notifications, file dialogs — all the OS surface area I needed, with web tech for the UI |
| Browser automation | puppeteer-core | 24.4.0 | I wanted to bundle a specific Chrome version inside the installer; `puppeteer-core` doesn't try to fetch its own Chromium at install time |
| Packaging | electron-builder | 26.8.1 | Cross-platform installer producer with first-class `extraResources` (for bundling Chrome) and an `afterSign` hook (for notarization) |
| Mac notarization | @electron/notarize | 2.5.0 | Apple's notary API client; the hardened-runtime + notarize path is non-negotiable for distributing macOS apps outside the App Store without Gatekeeper warnings |
| Tests | Vitest | 4.1.6 | Fast ESM-native test runner; minimal config for the small helper test suite |

## Application surface

- **Window framework**: Electron `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, locked-down CSP (`default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'`)
- **State persistence**: Plain JSON files under `app.getPath('userData')` — `schedules.json`, `results.json`, and a `login-confirmed` marker. No database; the app's entire state fits in a few KB
- **Background behavior**: System tray with last-result summary and a "Run Now" submenu. The window hides on close instead of quitting so scheduled runs continue to fire

## Browser layer

- **Engine**: Chrome for Testing 144.0.7559.96 (pinned in `scripts/download-chrome.js`)
- **Process model**: `puppeteer-core.launch()` per run, with `userDataDir` pointing at the app's user-data directory so cookies persist between runs
- **Launch flags**: `--no-sandbox`, `--disable-setuid-sandbox`, `--no-first-run`, `--no-default-browser-check`, plus `--disable-session-crashed-bubble` and `--hide-crash-restore-bubble` because the persistent profile occasionally tries to "restore" a session that was cleanly killed

## Build & distribution

- **Mac targets**: DMG + ZIP, dual-arch (arm64 + x64), code-signed and notarized via `scripts/notarize.js`. Hardened runtime enabled with custom entitlements (`build/entitlements.mac.plist`)
- **Windows targets**: NSIS installer (allows custom install dir, creates desktop + start menu shortcuts) + portable .exe
- **Linux targets**: AppImage + .deb
- **CI**: `.github/workflows/release.yml` triggers on `v*.*.*` tags. Builds Windows + Linux on hosted runners and uploads to the GitHub release via `GH_TOKEN`

## Development Tools

- **Package Manager**: npm with a committed `package-lock.json` for deterministic CI installs
- **Linting**: none — small enough that the value/maintenance ratio doesn't justify a config file
- **Testing**: Vitest, currently covering the helper API
- **Pre-build**: `scripts/download-chrome.js` downloads the pinned Chrome per-platform into `chrome-local/<platform>/`; runs automatically before every `electron-builder` invocation via the `prebuild` npm script

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `electron` | Desktop runtime + window/tray/IPC primitives |
| `puppeteer-core` | Drives the bundled Chrome via DevTools Protocol |
| `@puppeteer/browsers` | Used at build-time only, to download Chrome into `chrome-local/` |
| `electron-builder` | Packager for all three OS targets |
| `@electron/notarize` | Wraps the macOS notary submission step |
| `png-to-ico` | Converts the source PNG icon to Windows `.ico` |
| `sharp` | Image processing for icon generation |
| `vitest` | Test runner |
