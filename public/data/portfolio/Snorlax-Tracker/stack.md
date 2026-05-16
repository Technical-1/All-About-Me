# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | ^5.6 (strict) | Type-safe single-page app and offline scripts |
| UI library | React | ^18.3 | Component model + hooks |
| Build tool | Vite | ^5.4 | Dev server and production bundling |
| Tests | Vitest | ^2.1 | Unit tests for pure logic and hooks |

## Frontend

- **Framework**: React 18.3 (function components + hooks)
- **State management**: Local hooks only — `useState`/`useMemo`; persistence via custom `useOwnedCards` / `useUserCardData` hooks backed by `localStorage`. No Redux/Context store.
- **Styling**: Inline styles throughout (deliberate — no CSS framework); a single injected `@media print` rule for the print view.
- **Build tool**: Vite (ESM, `type: module`)

## Backend

None. The app is fully client-side. The only network calls are read-only fetches to public APIs (pokemontcg.io at runtime for prices; TCGdex only in the offline image-resolver script).

## Infrastructure

- **Hosting**: [Vercel](https://snorlax-tracker.vercel.app) — the static build (`npm run build` → `dist/`) is a self-contained bundle deployable to any static host.
- **CI/CD**: Vercel rebuilds and redeploys on every push to `main`; correctness verification (`typecheck` + `test` + `build`) is run locally — no separate test CI.
- **Monitoring**: None (no server; Vercel default analytics only).
- **Persistence**: Browser `localStorage` (`snorlax_v3` = owned, `snorlax_user_v1` = manual overrides).

## Development Tools

- **Package Manager**: npm
- **Script runner**: tsx (`npm run resolve-images` runs the offline TS resolver)
- **Linting/Formatting**: None configured (TypeScript strict mode is the guardrail)
- **Testing**: Vitest under jsdom (hook tests use `@testing-library/react` `renderHook`)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI rendering |
| `vite` / `@vitejs/plugin-react` | Dev server + bundler |
| `typescript` | Type checking (two project configs: app + node/script) |
| `vitest` | Test runner |
| `jsdom` | DOM environment for hook/localStorage tests |
| `@testing-library/react` / `@testing-library/dom` | `renderHook`/`act` for hook tests |
| `tsx` | Run `scripts/resolve-images.ts` without a build step |

## Notable: zero runtime dependencies beyond React

The CSV codec (RFC-4180), the image resolver, the merge logic, and price/format helpers are all hand-written and unit-tested rather than pulled from libraries — keeping the bundle small and the behavior fully under test.
