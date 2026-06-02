# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | 5.9 | Types catch strategy/EV bugs at compile time and document the game model |
| UI | React | 19.2 | Mature component model; hooks fit the per-mode state cleanly |
| Build | Vite | 7.2 | Near-instant dev server and fast production builds for an SPA |
| Styling | Tailwind CSS | 3.4 | Utility-first styling kept the casino-table UI consistent without a CSS sprawl |
| State | Zustand | 5.0 | Minimal global store for the game engine without Redux boilerplate |
| Backend | Firebase | 12.6 | Auth + Firestore + Functions in one platform, generous free tier |

## Frontend

- **Framework**: React 19.2 with function components and hooks
- **State Management**: Zustand stores (`gameStore`, `settingsStore`, `statisticsStore`) plus a `useAuth` context
- **Styling**: Tailwind CSS 3.4 with PostCSS + Autoprefixer
- **Build Tool**: Vite 7 (dev server on port 3000, sourcemapped production build to `dist/`)
- **Performance**: Heavy modes code-split via `React.lazy` + `Suspense`

## Backend

- **Auth**: Firebase Auth (email/password), invite-only signup
- **Database**: Cloud Firestore, access governed by `firestore.rules`
- **Functions**: Firebase Cloud Functions on Node 22 (`firebase-functions` v7, `firebase-admin` v13)
- **Email**: Resend for invite and contact-form delivery
- **Billing**: Stripe subscriptions — hosted Checkout + Customer Portal, entitlements written by a signature-verified webhook
- **API Style**: Firebase callable functions, plus one HTTP function for the Stripe webhook (raw body for signature verification)

## Infrastructure

- **Hosting**: Vercel (static SPA with catch-all rewrite to `index.html`)
- **Backend deploy**: Firebase CLI (`firebase deploy --only functions,firestore:rules`)
- **CI/CD**: Vercel Git integration for the frontend
- **Monitoring**: Custom in-app Firebase usage tracker (reads/writes per user); no external APM

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9 (flat config) with `typescript-eslint` and React hooks plugins
- **Testing**: Vitest 4 with Testing Library and jsdom — 12 unit suites covering the strategy/EV math, entitlement gating, and the game store
- **Formatting**: ESLint-driven (`lint:fix`)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI rendering |
| `zustand` | Game engine and settings/stats stores |
| `firebase` | Client SDK for Auth, Firestore, and callable Functions |
| `firebase-admin` | Privileged Firestore access inside Cloud Functions |
| `firebase-functions` | Callable function runtime |
| `stripe` | Subscription checkout, portal, and webhook handling in Cloud Functions |
| `resend` | Transactional email from Cloud Functions |
| `tailwindcss` | Styling system |
| `vitest` + `@testing-library/react` | Unit testing the math and components |
