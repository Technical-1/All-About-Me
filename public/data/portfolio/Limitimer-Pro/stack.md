# Tech Stack

Limitimer Pro is an npm-workspaces monorepo with four deployable units: a PWA, a PartyKit relay, Firebase Cloud Functions, and an Astro marketing site.

## Core technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language (app) | JavaScript (ES modules) | ES2022+ | Small UI, dominated by Y.js observers — a framework would add more than it removes |
| Language (relay) | TypeScript | — | PartyKit ships with typed `Party.Server` interfaces |
| CRDT | Y.js | ^13.6 | Conflict-free sync for timer + vote state without an authoritative server |
| Local persistence | y-indexeddb | ^9.0 | Survives refreshes, short disconnects, and full offline use |
| Sync transport | PartyKit | ^0.0.115 | Free-tier WebSocket relay; stateless room model fits Y.js perfectly |
| Bundler / dev server (app) | Vite | ^5.0 | Fast HMR for vanilla ES modules; trivial production builds |
| Auth + DB | Firebase (Auth + Firestore) | ^10.7 | Email/Google sign-in and a place to store the user tier with rules that block self-promotion |
| Payments | Stripe | SDK ^14 | Checkout + customer portal + webhook-driven tier updates |
| Cloud runtime | Firebase Functions | v4.5 (Node 20) | Stripe webhook handler and checkout session creator |
| Marketing site | Astro + Tailwind | Astro ^4.0, Tailwind ^3.4 | Static pricing/docs pages with no JS runtime cost |
| Testing | Vitest + jsdom | ^4.0 | Aligns with Vite; covers timer, voting, audit, utils, and feature-gate logic |

## App workspace (`app/`)

- **Entry**: `app/js/main.js` mounts on `DOMContentLoaded`, wires up four role-based screens (controller / speaker / participant / display).
- **State**: One Y.js document per room (`limitimer-${roomCode}`) with shared types `room`, `timer`, `presets`, `votes`, `voteResponses`, `participants`, `auditLog`.
- **Styling**: Hand-written CSS in `app/css/` — design tokens via CSS custom properties (`--color-success`, `--color-warning`, `--color-danger`).
- **Audio**: HTML5 `<audio>` with both OGG and MP3 sources for the timer-expired alarm.
- **Notifications**: Web Notifications API for the expiry alert when permission is granted.

## Relay workspace (`party/`)

- **Runtime**: Cloudflare Workers via PartyKit.
- **Protocol**: Binary frames are Y.js sync messages and get broadcast unchanged to other peers. Text frames are JSON (`ping`, `request_sync`, `room_meta`).
- **State**: None — the relay never reads document state.

## Functions workspace (`functions/`)

- **Runtime**: Node 20 on Firebase Functions v2.
- **Triggers**: Firestore `onDocumentCreated` for checkout sessions, HTTPS endpoint for the Stripe webhook.
- **Secrets**: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` via `defineSecret` — set with `firebase functions:secrets:set`, never committed.

## Website workspace (`website/`)

- **Framework**: Astro 4 with the Tailwind integration.
- **Build output**: Static HTML/CSS; deployed via Vercel (`vercel.json`).

## Infrastructure

- **App hosting**: Firebase Hosting (`firebase.json`).
- **Marketing site hosting**: Vercel.
- **Relay hosting**: PartyKit (`partykit.json`).
- **CI/CD**: GitHub Actions config in `.github/`; manual `npm run deploy:*` scripts for ad-hoc deploys.
- **Monitoring**: None beyond Firebase + PartyKit dashboards.

## Key runtime dependencies

| Package | Purpose |
|---------|---------|
| `yjs` | The CRDT itself — shared maps/arrays that hold all room state |
| `y-indexeddb` | Mirrors the Y.js doc to IndexedDB so refresh/offline works |
| `y-protocols` | Y.js sync and awareness protocol encoding |
| `lib0` | Y.js's binary encoding utilities |
| `firebase` (client) | Auth and Firestore SDK for the PWA |
| `firebase-admin` | Admin SDK for writing tier updates from the Stripe webhook |
| `stripe` | Stripe Node SDK for Checkout and webhook signature verification |
| `partykit` | PartyKit server runtime |
| `astro` / `@astrojs/tailwind` | Marketing site framework and Tailwind integration |

## Development tools

- **Package manager**: npm with workspaces (`app`, `party`, `website`); `functions/` is a separate package because Firebase tooling expects it.
- **Test runner**: Vitest with `jsdom` environment.
- **Process orchestration**: `concurrently` to run `npm run dev:app` and `npm run dev:party` together via `npm run dev` at the root.
- **Linting/formatting**: None checked in — small enough team to rely on review.

## Environment variables

The PWA reads its Firebase config from Vite-exposed env vars (`VITE_FIREBASE_*` in `app/.env.local`) consumed by `app/js/firebase-config.js`. The PartyKit host is also env-driven via `VITE_PARTYKIT_HOST` with a `localhost:1999` fallback (`app/js/config.js`). Stripe keys live only in Firebase Functions secrets.
