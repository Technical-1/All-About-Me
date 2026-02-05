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

## Frontend

- **Framework**: None (Vanilla JavaScript with ES Modules)
- **Rendering**: HTML5 Canvas API for whiteboard, DOM for UI
- **State Management**: Y.js shared types (Y.Map, Y.Array) as the single source of truth
- **Styling**: Custom CSS3 with CSS variables, Inter font from Google Fonts
- **Build Tool**: Vite in MPA (Multi-Page Application) mode

## Backend

- **Runtime**: PartyKit (Cloudflare Workers-based)
- **Server**: 35-line WebSocket broadcast relay (`party/index.ts`)
- **API Style**: WebSocket binary protocol (Y.js sync protocol)
- **Authentication**: Client-side token encoding with signature verification
- **Encryption**: E2E AES-256-GCM — server never sees plaintext

## Infrastructure

- **Hosting**: Vercel (static site) + PartyKit (WebSocket server)
- **CI/CD**: Vercel auto-deploy from Git
- **URL Routing**: Vercel rewrites (`/room/:id` → `room.html`)
- **Caching**: Immutable caching for JS bundles, must-revalidate for HTML

## Development Tools

- **Package Manager**: npm
- **Bundler**: Vite (Rollup-based production builds)
- **Dev Server**: Vite dev server with custom middleware for room routing
- **Image Generation**: Sharp (for favicon/icon generation via `scripts/generate-icons.js`)
- **Concurrent Dev**: concurrently (run Vite + PartyKit dev servers together)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `yjs` | CRDT document model — Y.Map for boards, Y.Array for shapes |
| `y-indexeddb` | Persist Y.Doc to browser IndexedDB for offline support |
| `y-partykit` | PartyKit integration helpers for Y.js |
| `y-protocols` | Y.js sync and awareness wire protocols |
| `partykit` | Server runtime for the WebSocket relay |
| `partysocket` | Client-side WebSocket with auto-reconnect for PartyKit |
| `lib0` | Y.js utility library (encoding/decoding binary protocols) |
| `vite` | Build tool and dev server |
| `concurrently` | Run multiple dev servers in parallel |
| `sharp` | Image processing for favicon generation |

## Cryptography Stack

| Component | Technology | Configuration |
|-----------|-----------|---------------|
| Key Derivation | PBKDF2 | 100,000 iterations, SHA-256 |
| Encryption | AES-256-GCM | Authenticated encryption with 12-byte random IV |
| Salt | Room ID | Room-specific keys (same password = different keys per room) |
| API | Web Crypto API | Hardware-accelerated, browser-native |

## Browser Requirements

- WebSocket API
- IndexedDB
- Web Crypto API (crypto.subtle)
- TextEncoder/TextDecoder
- HTML5 Canvas
- ES Modules (`type="module"`)
