# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (native ES modules) | ES2020+ | Runs unchanged in the browser and under Node; no transpile step. |
| Runtime  | Browser + Node | Node ≥ 18 | Browser runs the game; Node runs the pure-logic tests. |
| Testing  | `node:test` | built-in | Zero-dependency test runner already in Node — enough for pure functions. |
| Hosting  | Vercel | — | Free static hosting; serves the repo root with no build. |

## Frontend

- **Framework**: none — hand-written ES modules
- **State Management**: a single in-memory race-state object created per race in `src/engine.js`
- **Styling**: plain CSS (`styles.css`) — a neon theme with a CSS perspective-grid background, glowing racers, and per-character passage states
- **Build Tool**: none; the browser loads `src/main.js` as a module directly

## Rendering / Game Loop

- **Loop**: `requestAnimationFrame` in `src/main.js`
- **Input**: a single `keydown` listener routing printable keys to `pressKey` and `Backspace` to `backspace`
- **Opponent**: deterministic, time-driven progress model in `src/opponent.js`

## Infrastructure

- **Hosting**: Vercel (static, no build step)
- **CI/CD**: none — tests run locally via `npm test`
- **Monitoring**: none (static site)

## Development Tools

- **Package Manager**: npm
- **Linting / Formatting**: none — small, hand-maintained codebase
- **Testing**: `node:test` (`node --test test/unit/*.test.js`)
- **Local server**: `serve` via `npx` for `npm run dev`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| _(none — no runtime or build dependencies)_ | The game ships only its own ES modules; `serve` is invoked on demand via `npx` for local development and is not a tracked dependency. |
