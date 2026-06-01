# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (ESM) + JSX | ES2020+ | No type-checking overhead needed for a small content site |
| UI library | React | 19.2 | Component model fits the card/page structure; latest stable |
| Routing | React Router | 7.10 | Standard client-side routing for the five-page SPA |
| Animation | Framer Motion | 12.23 | Declarative scroll/enter animations on the Media gallery |
| Build tool | Vite | 7.2 | Fast dev server and lean production builds |

## Frontend

- **Framework**: React 19.2
- **State Management**: Local component state (`useState`/`useRef`) — no global store needed
- **Styling**: Plain CSS, colocated per component, driven by CSS custom properties (design tokens) in `src/styles/global.css`
- **Build Tool**: Vite 7 with `@vitejs/plugin-react`

## Backend

- **None** — the site is fully static. The only dynamic action (the contact form) posts directly to a third-party API (Web3Forms), so there is no server to run.

## Infrastructure

- **Hosting**: Vercel (production deploys on push to `main`)
- **CI/CD**: GitHub Actions — runs `npm run lint` and `npm run build` on every pull request and push to `main`
- **Monitoring**: none (static site)

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9 (flat config) with `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`
- **Formatting**: none enforced (lint covers correctness)
- **Testing**: none — small enough to verify by hand; CI guards lint + build

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI rendering |
| `react-router-dom` | Client-side routing across the five pages |
| `framer-motion` | Scroll-triggered animations in the Media gallery |
| `vite` / `@vitejs/plugin-react` | Dev server and production bundling |
| `eslint-plugin-react` | Enables `jsx-uses-vars` so JSX-only identifiers aren't false-flagged as unused |

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_WEB3FORMS_KEY` | Web3Forms access key for the contact form; set in `.env.local` and in Vercel |
