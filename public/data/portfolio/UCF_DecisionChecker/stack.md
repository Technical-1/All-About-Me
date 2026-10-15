# Tech Stack

> Note: this project predates my use of `package.json` — dependencies are imported via `require()` in `Checker.js` and were installed ad-hoc with `npm install` in 2019. Versions below reflect what was current at the time the script was written.

## Core Technologies

| Category | Technology | Version (2019) | Why this choice |
|----------|------------|----------------|-----------------|
| Runtime | Node.js | 10.x / 12.x | The Puppeteer + OpenCV native-addon stack supported it cleanly at the time |
| Language | JavaScript (ES2017+) | — | `async`/`await` made the browser-automation flow readable |
| Browser engine | Chromium (system Chrome) | bundled with macOS Chrome | Stable, real binary — avoided the bundled-Chromium variant for fidelity with the real login flow |

## Browser Automation

- **Driver**: `puppeteer-extra` — wraps `puppeteer` and exposes a plugin system
- **Stealth**: `puppeteer-extra-plugin-stealth` — patches the long list of headless-Chrome fingerprints (UA string, `navigator.webdriver`, plugin array, language, WebGL vendor, etc.)
- **Headless mode**: `true`, with `slowMo: 10` to make element-ready races less likely
- **Context isolation**: each run uses `browser.createIncognitoBrowserContext()` to avoid cookie/cache carry-over between iterations

## Image Pipeline

- **Pre-processing**: `opencv4nodejs` — gaussian blur (5×5, σ≈1.2) followed by `BGR2GRAY` colorspace conversion
- **OCR**: `tesseract.js` with the English language model
- **Intermediate artifact**: `./out.jpg` (the cleaned image Tesseract reads)
- **Source artifact**: `./Decision.jpg` (the raw Puppeteer screenshot, clipped to 700×250)

## Networking

- **HTTP client**: `request` — used only for the TextBelt POST. (`request` was deprecated in 2020; a modern rewrite would use `fetch` or `undici`.)
- **SMS gateway**: TextBelt — HTTP form POST with `phone`, `message`, `key`

## Infrastructure

- **Hosting**: Runs locally on macOS — the script hard-codes `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **CI/CD**: None — single-file script, single-user
- **Monitoring**: None — output is `console.log(JSON.parse(body))` of the TextBelt response

## Development Tools

- **Package manager**: npm (no lockfile checked in)
- **Linting**: None
- **Formatting**: None
- **Testing**: None — verified by hand against the real UCF portal

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `puppeteer-extra` | Pluggable wrapper around Puppeteer that owns the browser lifecycle |
| `puppeteer-extra-plugin-stealth` | Hides headless-Chrome fingerprints from anti-bot checks in UCF's SAML flow |
| `puppeteer` | Underlying browser driver and `DeviceDescriptors` |
| `tesseract.js` | OCR engine that turns the screenshot into matchable text |
| `opencv4nodejs` | Image preprocessing (blur + greyscale) so Tesseract reads the page reliably |
| `request` | One-shot HTTP POST to TextBelt for the SMS |
