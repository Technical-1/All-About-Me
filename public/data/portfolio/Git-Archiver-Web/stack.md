# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Frontend | Vanilla JavaScript | ES2020+ | No build step, no framework overhead for a small app |
| Hosting (frontend) | GitHub Pages | — | Free static hosting, integrates with the repo |
| Archive engine | GitHub Actions | — | Free compute, native GitHub integration |
| Storage | GitHub Releases | — | Free, durable, CDN-backed |
| API proxy | Cloudflare Worker | — | Lives in [Git-Archiver-Worker](https://github.com/Technical-1/Git-Archiver-Worker); keeps the GitHub token server-side |

## Frontend

- **Framework**: None (vanilla JS, no build step)
- **State Management**: Module-level state in `app.js`
- **Styling**: Hand-written CSS (`css/styles.css`)
- **Markdown rendering**: `marked` + `DOMPurify` (loaded from CDN, used only in the archive detail modal)

## Archive Engine

- **Runtime**: GitHub Actions (bash + `jq`)
- **Trigger**: issue opened with the `archive-request` label
- **Output**: a GitHub Release per archive plus a master `index.json`

## Infrastructure

- **Hosting**: GitHub Pages (frontend)
- **CI/CD**: GitHub Actions — `pages.yml` (deploy), `archive.yml` (archive engine), `update-archives.yml` (daily refresh), `e2e.yml` (frontend tests)
- **Monitoring**: none

## Development Tools

- **Package Manager**: npm
- **Testing**: Vitest (unit, node environment) + Playwright (browser smoke tests) + a bash test asserting the archive workflow is injection-safe
- **Test command**: `npm test` (unit + CI-injection check), `npm run test:e2e` (Playwright)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `vitest` | Unit test runner for the pure JS helpers |
| `@playwright/test` | Browser smoke tests that load the real page against a stubbed backend |
| `marked` / `dompurify` | Safe markdown rendering for archived READMEs (CDN, runtime-only) |
