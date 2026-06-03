# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (JSX) | ES2020+ modules | No type complexity needed for a presentational site; ships fast. |
| UI framework | React | 19 | Component-per-section model maps cleanly to a long scroll page. |
| Animation | Framer Motion | 12 | Declarative scroll-reveal and presence animations with built-in reduced-motion support. |
| Build tool | Vite | 7 | Fast HMR in dev and a small optimized static bundle for production. |

## Frontend

- **Framework**: React 19
- **State Management**: Local component state via `useState`/`useRef` — there is no shared app state, so no store is needed.
- **Styling**: Plain CSS in a single global `src/index.css`, with section-scoped class names.
- **Build Tool**: Vite 7 with `@vitejs/plugin-react`.
- **Animation**: Framer Motion (`useInView`, `motion`, `AnimatePresence`, `MotionConfig`).

## Backend

- **None.** The site is fully static. The only dynamic action — sending a booking inquiry — is handled by a client-side POST to the Web3Forms API.

## Infrastructure

- **Hosting**: Vercel (static deploy of the Vite `dist/` output).
- **CI/CD**: Vercel's git-push deploy.
- **Monitoring**: None (brochure site).

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9 (flat config) with `eslint-plugin-react`, `react-hooks`, and `react-refresh`
- **Formatting**: None enforced
- **Testing**: None — small enough to verify by hand in the browser

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI rendering. |
| `framer-motion` | Scroll-triggered and presence animations; root-level reduced-motion config. |
| `react-router-dom` | Installed as a dependency; the current single-page build navigates via in-page anchor scrolling. |
| `vite` / `@vitejs/plugin-react` | Dev server and production build. |
| `eslint` + React plugins | Static analysis; the config tunes `no-unused-vars` to ignore JSX-only imports. |
