# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | ~5.9.3 | One language across the SPA, Vercel functions, Edge Middleware and scripts, with browser-safe `lib/` modules shared by both sides |
| UI framework | React | ^19.2.0 | Hook-based state is enough for a solver, an admin panel and a grid editor without adding a store |
| Build tool | Vite | ^7.2.4 | Fast HMR, a simple `/api` proxy to the dev server, and a static build that Vercel serves directly |
| Styling | Tailwind CSS | ^4.1.18 | Utility classes over CSS custom properties, so tenant branding is just a set of runtime variables |
| LLM | Anthropic SDK (`@anthropic-ai/sdk`) | ^0.71.2 | Claude Sonnet 5 by default, selectable per call site (word pool vs clues) in `lib/ai/models.ts` |
| Data store | Upstash Redis (`@upstash/redis`) | ^1.38.0 | Serverless-friendly REST Redis. Atomic `INCR`/`DECRBY`/`SET NX` are exactly the primitives the metering needs |
| Payments | Stripe (`stripe`) | ^22.4.0 | Hosted Checkout keeps card data off the app. Signed webhooks drive fulfillment |
| Hosting | Vercel | - | Static SPA, Node functions and Edge Middleware from one repo |

## Frontend

- **Framework**: React 19 with `@vitejs/plugin-react` ^5.1.1
- **State management**: React hooks plus a `TenantContext` provider. Solver state, history (50 puzzles) and statistics (500 completions) persist to localStorage with shape validation on read
- **Routing**: none. `resolveAppView` in `lib/tenants.ts` picks the tenant site or the legacy app, and each app switches views with state and Framer Motion `AnimatePresence`
- **Styling**: Tailwind 4 via `@tailwindcss/vite`, with four colour themes and tenant colours as CSS variables. WCAG contrast guards on tenant colours live in `src/tenant/contrast.ts`
- **Crossword grid**: `@jaredreisinger/react-crossword` ^5.2.0, extended with checker colouring and hint styling
- **Animation**: `framer-motion` ^12.23.26, `canvas-confetti` ^1.9.4
- **PWA**: hand-written `public/sw.js` with versioned static, runtime and puzzle caches

## Backend

- **Runtime**: Node.js on Vercel functions (`api/**/*.ts`, 120s `maxDuration`). Requires Node 20.11+ locally for `import.meta.dirname`
- **Edge**: `middleware.ts` via `@vercel/edge`, a pre-release password gate using Web Crypto HMAC cookies
- **Local API**: Express 5 (`server.dev.ts`) with an in-memory Redis stand-in that implements the same interfaces
- **API style**: REST. `POST /api/generate-crossword`, `GET|POST /api/tenant` (action-dispatched), `POST /api/tenant-auth`, `POST /api/stripe-webhook`
- **Auth**: PBKDF2-HMAC-SHA256 (600k iterations) tenant credentials, slug-bound HMAC session cookies, and a separate platform-operator cookie
- **Abuse controls**: Upstash fixed-window per-IP limiter with an in-memory fallback, Cloudflare Turnstile as a trust tier, and an optional daily public generation cap

## Infrastructure

- **Hosting**: Vercel. `vercel.json` sets rewrites for `/t/*` and `/legacy`, bundles `data/**` into the functions, and adds HSTS, CSP, `X-Frame-Options` and `Permissions-Policy`
- **CI/CD**: Vercel Git integration. No separate CI workflow in the repo
- **Monitoring**: none beyond structured `console` warnings in the function logs (for example `PUBLIC_DAILY_CAP_REACHED`)

## Development Tools

- **Package manager**: npm (`.npmrc` sets `legacy-peer-deps`)
- **Linting**: ESLint ^9.39.1 with `typescript-eslint`, `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`
- **Type checking**: `tsc -b` project references for the app, plus `tsconfig.api.json` for `api/` and `lib/`
- **Testing**: Vitest ^4.1.7 split into two projects. `node` covers `lib/`, `api/` and `scripts/`, and `ui` runs `src/` under jsdom ^26.1.0 with Testing Library. The repo has 71 test files
- **Benchmarks and studies**: `tsx` scripts. These include the offline filler benchmark, the quality study and a corpus re-score diff, and only the studies spend API budget

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Word pool, clue writing and fact-check calls, behind a narrow injectable `AnthropicLike` interface |
| `@upstash/redis` | Tenant store, token ledger, draft jobs, purchase records and rate limits |
| `stripe` | Checkout Session creation and webhook signature verification (pinned API version) |
| `@jaredreisinger/react-crossword` | Interactive SVG crossword grid and clue lists |
| `lz-string` | Compressing puzzles into shareable `?p=` URLs |
| `framer-motion` | View transitions and modal animation |
| `@vercel/node` / `@vercel/edge` | Function types and the Edge Middleware `next()` helper |
| `express` / `cors` / `dotenv` | Local API server only, never deployed |
| `vitest` / `@testing-library/*` / `jsdom` | Unit and component tests |

The crossword dictionary is not an npm dependency. It is a vendored, MIT-licensed Crossword Nexus list (`data/wordlist.txt`, 229,488 entries) rebuilt by `scripts/build-wordlist.ts` with a content blocklist and a curated supplement.
