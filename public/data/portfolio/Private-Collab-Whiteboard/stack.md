# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript (ES Modules) | ES2022+ | Vanilla JS — no framework overhead for a canvas-heavy app |
| Server | TypeScript | — | PartyKit server type safety |
| Rendering | HTML5 Canvas | — | High-performance 2D drawing surface |
| Sync Engine | Y.js | ^13.6.0 | CRDT library for conflict-free real-time collaboration |
| Real-time | PartyKit | ^0.0.115 | WebSocket server for message relay |
| Build Tool | Vite | ^5.0.0 | Fast dev server and production bundler |
| Tests | Vitest | ^2.1.0 | Unit tests for crypto, protocol, sync, and link logic |

## Frontend

- **Framework**: None (Vanilla JavaScript with ES Modules)
- **Rendering**: HTML5 Canvas API for whiteboard, DOM for UI
- **State Management**: Y.js shared types (Y.Map, Y.Array) as the single source of truth
- **Styling**: Custom CSS3 with CSS variables, Inter font from Google Fonts
- **Build Tool**: Vite in MPA (Multi-Page Application) mode

## Backend

- **Runtime**: PartyKit (Cloudflare Workers-based)
- **Server**: ~35-line WebSocket broadcast relay (`party/index.ts`) — no app logic, no trust
- **API Style**: Typed binary protocol — signed `{epoch, update, sig}` envelopes + snapshots for doc sync; standard awareness for presence
- **Authorization**: Capability links (owner/editor/viewer) enforced by ECDSA P-256 signatures verified peer-side, rooted in a per-room owner key
- **Encryption**: E2E AES-256-GCM — server never sees plaintext

## Infrastructure

- **Hosting**: Vercel (static site) + PartyKit (WebSocket relay)
- **CI/CD**: GitHub Actions — every PR/push to `main` runs Vitest + the Vite build; the PartyKit relay deploys on push to `main`, path-filtered to server changes and gated behind that same job. The Vercel frontend auto-deploys from Git.
- **URL Routing**: Vercel rewrites (`/room/:id` → `room.html`)
- **Security headers**: Content-Security-Policy and related headers set in `vercel.json` (Google Fonts allow-listed)
- **Caching**: Immutable caching for JS bundles, must-revalidate for HTML

## Development Tools

- **Package Manager**: npm
- **Bundler**: Vite (Rollup-based production builds)
- **Dev Server**: Vite dev server with custom middleware for room routing
- **Testing**: Vitest (`npm test`) — 40+ unit tests over the crypto, certificate, protocol, signed-sync, and capability-link modules
- **Image Generation**: Sharp (for favicon/icon generation via `scripts/generate-icons.js`)
- **Concurrent Dev**: concurrently (run Vite + PartyKit dev servers together)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `yjs` | CRDT document model — Y.Map for boards, Y.Array for shapes |
| `y-indexeddb` | Persist Y.Doc to browser IndexedDB for offline support |
| `y-partykit` | PartyKit integration helpers for Y.js |
| `y-protocols` | Awareness (presence) wire protocol; doc sync is a custom signed layer |
| `partykit` | Server runtime for the WebSocket relay |
| `partysocket` | Client-side WebSocket with auto-reconnect for PartyKit |
| `lib0` | Binary encoding/decoding — used to frame the signed update envelopes |
| `vite` | Build tool and dev server |
| `vitest` | Test runner for the crypto, protocol, and sync units |
| `concurrently` | Run Vite + PartyKit dev servers in parallel |
| `sharp` | Image processing for favicon generation |

## Cryptography Stack

| Component | Technology | Configuration |
|-----------|-----------|---------------|
| Key Derivation | PBKDF2 | 100,000 iterations, SHA-256 |
| Encryption (confidentiality) | AES-256-GCM | Authenticated encryption with 12-byte random IV |
| Salt | Room ID | Room-specific keys (same password = different keys per room) |
| Signing (authorization) | ECDSA P-256 / SHA-256 | Raw r‖s (64-byte) signatures over `epoch ‖ update`; chosen over Ed25519 for universal Web Crypto support |
| Owner certificates | ECDSA P-256 over canonical JSON | Owner key signs `{room, epoch, editorPub}` to vouch for each epoch's editor key |
| API | Web Crypto API | Hardware-accelerated, browser-native; non-extractable verify keys |

## Browser Requirements

- WebSocket API
- IndexedDB
- Web Crypto API (crypto.subtle)
- TextEncoder/TextDecoder
- HTML5 Canvas
- ES Modules (`type="module"`)
