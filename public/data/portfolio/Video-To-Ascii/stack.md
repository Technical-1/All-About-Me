# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript (ES2022 modules) | — | One language across the whole codebase. |
| Build | Vite | ^5.0.0 | Dev server + production bundler with manual chunk splitting. |
| Hosting | Vercel | — | Static `dist/` deployment. No server code. |

## Frontend

- **Framework**: None — vanilla ES modules.
- **State management**: Plain `settings` object in `src/main.js`, persisted
  to `localStorage`. No external state library.
- **Styling**: Plain CSS in `src/style.css`. No preprocessor, no Tailwind.
- **Build tool**: Vite 5 with `esbuild` minification, source maps on, and
  manual chunk splitting in `vite.config.js`:
  - `ascii-engine` — `asciiConverter` + `frameProcessor`
  - `video-engine` — `videoController` + `renderEngine`
  - `export-utils` — `exportManager` + `helpers`
- **Workers**: `gif.js` worker at `public/gif.worker.js` for off-main-thread
  GIF encoding.

## Backend

None. The deployed artifact is a fully static SPA. No serverless functions,
no databases, no env vars.

## Infrastructure

- **Hosting**: Vercel. Build command `npm run build`, output directory `dist/`.
- **CI/CD**: Vercel auto-deploys on push to `main`. GitHub Actions CI was
  intentionally scoped out (solo project — lint/test are run locally).
- **Monitoring**: Vercel's built-in deployment logs.

## Development Tools

- **Package manager**: npm (with `package-lock.json` committed for
  reproducible installs).
- **Linting**: ESLint 9 (`eslint.config.js` — flat config, correctness rules).
- **Formatting**: None enforced.
- **Testing**: `node:test` (Node's built-in runner) over `test/*.test.js`.
  Current suite: `test/helpers.test.js` — pure-function tests for `src/utils/helpers.js`.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `vite` | Dev server + bundler. |
| `eslint` | Lint rules (correctness only, no style enforcement). |
| `gif.js` | Animated GIF encoder. Runs in `public/gif.worker.js` worker. |
