# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Runtime | Node.js | 20+ | Server-side JavaScript execution |
| Framework | Electron | 35.x | Cross-platform desktop app shell |
| Scraping | Puppeteer | 24.x | Headless Chrome browser automation |
| Language | JavaScript (CommonJS) | ES2020+ | Application logic |

## Frontend

- **Framework**: Electron (Chromium-based renderer)
- **State Management**: Vanilla JS DOM manipulation (no framework)
- **Styling**: Embedded CSS in `index.html` with Redfin-inspired red theme (`#a02021`)
- **Build Tool**: electron-builder for packaging

## Backend (Main Process)

- **Runtime**: Node.js via Electron
- **Scraping**: Puppeteer + puppeteer-extra with stealth plugin
- **API Client**: Native `https` module (no axios/fetch library)
- **CSV Processing**: csv-parse/csv-stringify for reading/writing CSV files
- **IPC**: Electron's `ipcMain`/`ipcRenderer` for process communication

## Infrastructure

- **Hosting**: Desktop application (self-contained)
- **CI/CD**: GitHub Actions (build on push, release on tag)
- **Distribution**: electron-builder producing DMG, NSIS, AppImage, DEB
- **Code Signing**: Documented guide for macOS/Windows signing (optional)

## Development Tools

- **Package Manager**: npm
- **Testing**: Vitest (unit tests for utility functions)
- **Build System**: electron-builder with platform-specific configs
- **Version Control**: Git + GitHub

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `puppeteer` | Headless Chrome automation for address search and fallback scraping |
| `puppeteer-extra` | Plugin system wrapper for Puppeteer |
| `puppeteer-extra-plugin-stealth` | Anti-bot detection evasion (patches automation fingerprints) |
| `csv-parse` | Parse input CSV files with flexible column detection |
| `csv-stringify` | Generate enriched output CSV files |
| `electron` | Desktop application framework (Chromium + Node.js) |
| `electron-builder` | Cross-platform packaging (DMG, EXE, AppImage, DEB) |
| `vitest` | Fast unit testing framework |

## Build Targets

| Platform | Formats | Architecture |
|----------|---------|--------------|
| macOS | DMG, ZIP | x64, arm64 (Universal) |
| Windows | NSIS installer, Portable EXE | x64 |
| Linux | AppImage, DEB | x64 |
