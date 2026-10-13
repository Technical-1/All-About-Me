# Tech Stack

Versions are the ranges declared in `package.json`; the lockfile currently resolves them as shown in parentheses where it differs materially.

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (ES modules, JSX) | — | Small codebase with no shared API contracts to type; ESLint covers the hook-rule and accessibility classes of bugs |
| UI framework | React | ^18.2.0 (18.3.1) | Hooks plus `lazy`/`Suspense` for route and 3D code splitting; the R3F and Recharts ecosystems target it |
| Routing | React Router DOM | ^6.20.0 (6.30.2) | Nested routes under one `Layout` outlet |
| Server state | TanStack Query | ^5.90.12 | Per-query polling intervals, visibility-aware `refetchInterval`, dedupe, `initialData` seeding from cache |
| Build tool | Vite | ^5.0.0 (5.4.21) | Fast dev server, a dev proxy for `/api/mstr`, Rollup `manualChunks` for vendor splitting |
| Styling | Tailwind CSS | ^3.3.6 (3.4.18) | Custom `btc` and `void` palettes and font families in `tailwind.config.js` |
| Database | None | — | All data is fetched live or bundled in `src/lib/bitcoinData.js` |

## Frontend

- **Framework**: React 18 with React Router 6; all eight routed pages are `React.lazy` imports in `src/App.jsx`
- **State management**: TanStack Query for server state; local `useState`/`useRef` for UI state; a TTL localStorage layer (`getCached`/`setCached` in `src/lib/useBlockchain.js`)
- **Styling**: Tailwind CSS 3 with PostCSS and Autoprefixer; Sora, Oxanium and IBM Plex Mono from Google Fonts
- **Charts**: Recharts ^2.10.0 (2.15.4), with log-scale Y axes on the price-history and power-law charts and a dual-axis `ComposedChart` for halvings
- **3D**: Three.js ^0.160.0, @react-three/fiber ^8.15.0 (8.18.0), @react-three/drei ^9.88.0 (9.122.0)
- **Motion and icons**: Framer Motion ^10.16.0 (10.18.0), Lucide React ^0.294.0
- **Build tool**: Vite 5 with `@vitejs/plugin-react` ^4.2.0

## Backend

- **Runtime**: Vercel serverless function (`api/mstr.js`, default-export `handler(req, res)`), using the built-in `fetch` and `AbortSignal.timeout`
- **Framework**: none
- **API style**: one REST GET endpoint, `/api/mstr` → `{ price, changePct }`
- **Auth**: none; all upstream APIs are keyless
- **Edge proxies**: two Cloudflare Workers (treasury data and CoinGecko/MSTR), maintained in a separate repository and configured through `VITE_TREASURY_PROXY_URL` and `VITE_COINGECKO_PROXY_URL`

## Infrastructure

- **Hosting**: Vercel. `vercel.json` sets a permanent www → apex redirect and a catch-all rewrite to `/` for client-side routing.
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) on Node 24. Job 1 runs `npm ci`, lint, tests, coverage and build. Job 2 builds and runs `treosh/lighthouse-ci-action@v12` against `dist/` using `.lighthouserc.json`: accessibility below 0.8 fails the run; performance (0.6), best practices (0.8) and SEO (0.8) warn.
- **Monitoring**: none
- **Production build**: sourcemaps on; `console` and `debugger` stripped by esbuild; vendor chunks `three`, `charts`, `framer` and `vendor` (lucide)

## Development Tools

- **Package manager**: npm (`package-lock.json`)
- **Linting**: ESLint ^9.39.1 flat config with `eslint-plugin-react`, `react-hooks` (rules-of-hooks as error), `jsx-a11y` recommended, `react-refresh`
- **Formatting**: none configured
- **Testing**: Vitest ^3.2.4 in jsdom ^25.0.1, React Testing Library ^16.3.2, `@testing-library/jest-dom`, `@vitest/coverage-v8`. 34 test cases across 11 co-located test files cover the data fetchers, the WebSocket lifecycle, `ErrorBoundary`, the halving-chart structure, and shared constants.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@tanstack/react-query` | Polling, caching and dedupe for every REST data source |
| `react-router-dom` | Routes and nav with active-link styling |
| `recharts` | Price history, power law, halving, adoption and treasury charts |
| `three` | WebGL engine behind the hero and transaction-flow scenes |
| `@react-three/fiber` | Declarative React renderer for the Three.js scenes |
| `@react-three/drei` | `OrbitControls`, `Float` and `useTexture` helpers |
| `framer-motion` | Entry animations and `AnimatePresence` on the live transaction list |
| `lucide-react` | Icon set |
| `vitest` + `@testing-library/react` | Unit and component tests |
| `eslint-plugin-jsx-a11y` | Accessibility linting; paired with the Lighthouse accessibility gate in CI |
