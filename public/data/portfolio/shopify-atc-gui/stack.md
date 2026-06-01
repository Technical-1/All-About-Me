# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | 5.x | End-to-end types from the Shopify JSON shape through filtering to export catch mismatches at compile time |
| Framework | Next.js (App Router) | 16.2.6 | Co-locates the serverless catalog route and the React UI in one deploy, with file-based metadata for OG/favicons |
| UI library | React | 19.2.4 | Component model for the filter/grid/card hierarchy |
| Testing | Vitest | 4.x | Fast, ESM-native; runs the pure catalog logic offline with `fetch` mocked |

## Frontend

- **Framework**: React 19 via Next.js App Router (the page is a client component; the catalog route is server-only)
- **State Management**: Local React state in `app/page.tsx` — no external store needed; the in-memory catalog plus filter state is the entire model
- **Styling**: CSS Modules with a CSS-variable design system (`app/globals.css`); `next/font` self-hosts Bricolage Grotesque (display), Hanken Grotesk (UI), and JetBrains Mono (data)
- **Build Tool**: Next.js / Turbopack

## Backend

- **Runtime**: Node.js serverless function (`export const runtime = "nodejs"`), required for DNS resolution in the SSRF guard
- **API Style**: A single `POST /api/catalog` route handler — request/response, no persistence
- **Auth**: None — the app consumes only public storefront data; abuse is bounded by a per-IP rate limiter

## Infrastructure

- **Hosting**: Vercel
- **CI/CD**: Git push to `main` triggers a Vercel production deploy; preview deploys per branch
- **Monitoring**: None (personal project)

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint (`eslint-config-next`)
- **Testing**: Vitest + Testing Library (jsdom), `fetch` mocked so the suite runs fully offline
- **Type Checking**: `tsc` via the Next.js build

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` | App Router, serverless route handler, font + metadata file conventions, build/deploy |
| `react` / `react-dom` | UI components and client state |
| `vitest` | Test runner for the pure catalog logic (filtering, facets, export, cache, pagination) |
| `@testing-library/react` | Component tests (variant row link behavior) |
| `typescript` | Static typing across the data pipeline |

The runtime dependency tree is intentionally tiny: no UI kit, no state library, no HTTP client, no database driver. The product is mostly typed application logic over the platform's `fetch` and `localStorage`.
