# Tech Stack

## Core Technologies

| Category  | Technology           | Version       | Why this choice                                                       |
| --------- | -------------------- | ------------- | --------------------------------------------------------------------- |
| Language  | TypeScript           | 5.x           | Type safety across a large multi-module app                           |
| Framework | Next.js (App Router) | 16.x          | Server + client in one framework; route-level layouts and API routes  |
| UI        | React                | 19.x          | Component model the rest of the stack is built on                     |
| Database  | Firebase Firestore   | 11.x          | Real-time listeners out of the box; no server to run for live updates |
| Auth      | Firebase Auth        | 11.x          | Custom claims let RBAC ride inside the JWT                            |
| Payments  | Stripe Connect       | `stripe` 20.x | Per-tenant payouts with the platform out of the flow of funds         |

## Frontend

- **Framework**: Next.js 16 App Router + React 19
- **UI library**: Mantine v8 (components, hooks, modals, notifications)
- **State**: Zustand for client state; Firestore listeners for server state
- **Icons**: Tabler Icons, imported through a single centralized module
- **Payments UI**: `@stripe/react-stripe-js` (PaymentElement) + `@stripe/react-connect-js` (embedded onboarding)

## Backend

- **Runtime**: Next.js API routes (Node runtime) + Firebase Cloud Functions
- **Data access**: Firebase Admin SDK (server) / client SDK (browser)
- **API style**: REST route handlers wrapped by `withRbacAuth()` for permission + tenant checks
- **Auth model**: Firebase ID token (Bearer) verified server-side; role/ownerId/permissions read from custom claims

## Infrastructure

- **Hosting**: Vercel (Next.js app), Firebase (Firestore rules/indexes, Cloud Functions)
- **Deploys**: manual — `vercel --prod` for the app, `firebase deploy` for Firestore/Functions
- **Rate limiting**: Upstash / Vercel KV (Redis), per-user counters on billed endpoints
- **Monitoring**: server-side logging + audit log entries on auth events

## Development Tools

- **Package Manager**: pnpm
- **Linting**: ESLint
- **Formatting**: Prettier (via a pre-commit hook)
- **Testing**: Jest (unit), Playwright (e2e)

## Key Dependencies

| Package                                                         | Purpose                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `next` / `react`                                                | App framework + UI runtime                                            |
| `@mantine/core` (+ `@mantine/modals`, `@mantine/notifications`) | UI component system                                                   |
| `firebase` / `firebase-admin`                                   | Client + server access to Firestore and Auth                          |
| `stripe`                                                        | Server-side Stripe API (intents, refunds, Connect accounts, webhooks) |
| `@stripe/connect-js` / `@stripe/react-connect-js`               | Embedded Stripe Connect onboarding                                    |
| `@stripe/react-stripe-js` / `@stripe/stripe-js`                 | Card payment UI (PaymentElement)                                      |
| `zustand`                                                       | Client state stores                                                   |
| `@upstash/redis`                                                | Rate-limit counters                                                   |
| `@tabler/icons-react`                                           | Icon set                                                              |
