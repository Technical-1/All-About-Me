# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Node.js (CommonJS) | `>=18` | Native Puppeteer support and a built-in test runner, so the project needs no transpiler or test framework |
| Automation | Puppeteer | `^24` | Drives a real Chromium with a high-level API; v24 ships the current `createBrowserContext` API and a bundled browser |
| Stealth | `puppeteer-extra` + stealth plugin | `^3.3` / `^2.11` | Wraps Puppeteer to mask common headless/automation fingerprints |
| Testing | `node:test` | built-in | Zero extra dependencies for a small project; runs unit and integration suites with `node --test` |

## Backend

- **Runtime**: Node.js (CommonJS modules)
- **Entry point**: `FlashTyper.js` (`npm start`)
- **External surface**: none — it's a local CLI script that drives a browser

## Infrastructure

- **Hosting**: none (runs locally)
- **CI/CD**: none
- **Monitoring**: none

## Development Tools

- **Package Manager**: npm
- **Linting**: none
- **Formatting**: none
- **Testing**: `node:test` — unit suites under `test/unit/` (including `test/unit/stats.test.js` for live-stats parsing and peak tracking), an offline Chromium integration test under `test/integration/`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `puppeteer` | Launches and controls Chromium; provides the keyboard and DOM-scraping APIs |
| `puppeteer-extra` | Plugin layer over Puppeteer used to register the stealth plugin |
| `puppeteer-extra-plugin-stealth` | Patches automation fingerprints (webdriver flag, headless markers, etc.) |
