# Technology Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (CommonJS), type-checked with `checkJs` | ES2020 target | One language across UI, IPC, and scraper; JSDoc types catch mistakes without a build step |
| Runtime | Node.js | 20 (CI) | Matches the Node bundled with Electron and the Puppeteer ecosystem |
| Desktop shell | Electron | ^35.0.1 (35.7.5 locked) | Shares a process model with Puppeteer and gives a drag-and-drop GUI on three OSes |
| Browser automation | puppeteer-core | ^24.4.0 (24.36.1 locked) | Drives a bundled Chrome; `-core` avoids a second Chromium download at install time |
| Browser | Chrome for Testing | 149.0.7827.54 | Pinned so the real browser version matches the advertised user agents |
| Cache | sql.js | ^1.14.1 | SQLite compiled to WASM, so no native module rebuilds per platform |

## Frontend

- **Framework**: None; vanilla DOM in `renderer.js`
- **State Management**: Module-level variables (row mask, duplicate mask, preview total) in the renderer
- **Styling**: CSS embedded in `index.html`
- **Security model**: `contextIsolation: true`, `nodeIntegration: false`, a `contextBridge` API in `preload.js`, and DOM built with `textContent` for CSV-derived values

## Backend (Electron main process)

- **Runtime**: Node.js inside Electron
- **API Style**: Electron IPC (`ipcMain.handle` / `ipcRenderer.invoke` for requests, `webContents.send` for progress, log, and pacing events)
- **Data access**: Redfin JSON endpoints fetched from inside the Chrome page; page scraping as fallback
- **Auth**: None; the app keeps a normal browser session on redfin.com

## Infrastructure

- **Hosting**: Desktop application, no server
- **CI/CD**: GitHub Actions; `build.yml` tests and builds on Windows, Linux, and macOS for pushes and PRs to `main`; `release.yml` builds and attaches binaries on `v*.*.*` tags
- **Distribution**: electron-builder producing DMG and ZIP (macOS x64 and arm64), NSIS and portable EXE (Windows x64), AppImage and DEB (Linux)
- **Code signing**: macOS Developer ID signing and notarization in the release workflow when Apple secrets are present; unsigned otherwise
- **Monitoring**: None; each run writes a timestamped log file next to its output

## Development Tools

- **Package Manager**: npm (`package-lock.json`)
- **Linting**: None configured
- **Formatting**: None configured
- **Type checking**: `jsconfig.json` with `checkJs: true` for editor-level checking
- **Testing**: Vitest (`npm test`), 29 test files covering the pure modules, the orchestrator with stubbed browser and API, IPC handler contracts, and the Chrome-version / user-agent coupling

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `electron` | Desktop shell (Chromium renderer + Node main process) |
| `puppeteer-core` | Controls the bundled Chrome for session setup, in-page fetch, and fallback scraping |
| `puppeteer-extra` + `puppeteer-extra-plugin-stealth` | Makes headless Chrome present like a standard desktop browser so pages render consistently |
| `sql.js` | WASM SQLite backing the persistent property cache |
| `exceljs` | Typed `.xlsx` export with currency and number formats |
| `csv-parse` / `csv-stringify` | Input parsing, partial-file appends, and CSV export |
| `@puppeteer/browsers` (dev) | Downloads the pinned Chrome for Testing build in `scripts/download-chrome.js` |
| `electron-builder` (dev) | Cross-platform packaging, bundling Chrome and `sql-wasm.wasm` via `extraResources` |
| `@electron/notarize` (dev) | macOS notarization support |
| `vitest` (dev) | Unit and integration tests |

## Build Targets

| Platform | Formats | Architecture |
|----------|---------|--------------|
| macOS | DMG, ZIP | x64, arm64 (separate builds) |
| Windows | NSIS installer, portable EXE | x64 |
| Linux | AppImage, DEB | x64 |
