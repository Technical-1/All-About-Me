# Technology Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (ES modules) | — | The app is an imperative Canvas program; no framework runtime is needed to drive `ctx` calls |
| Server language | TypeScript | compiled by PartyKit | Type-checked `Party.Server` interface for the relay; the only TypeScript file in the repo |
| Rendering | HTML5 Canvas 2D | — | One surface for every tool, the live previews, and the off-screen export render |
| Sync engine | Y.js | ^13.6.0 (13.6.29 locked) | Mature JavaScript CRDT with an UndoManager that understands local versus remote changes |
| Relay | PartyKit | ^0.0.115 | Per-room WebSocket isolation on Cloudflare's edge, deployed with one command, for a server that only broadcasts |
| Crypto | Web Crypto API | browser built-in | Native AES-GCM, PBKDF2 and ECDSA with no crypto library in the bundle |
| Build tool | Vite | ^8.0.16 | Multi-page builds and a dev server whose middleware can mirror Vercel's routing |
| Tests | Vitest | ^4.1.8 | Native ES modules, and runs the pure logic modules in Node with no DOM |
| Export | jsPDF | ^4.2.1 | Wraps the rendered canvas image in a single-page PDF |

## Frontend

- **Framework**: None — vanilla ES modules, four HTML entry points (`index.html`, `room.html`, `boards.html`, `how-it-works.html`)
- **Rendering**: Canvas 2D for the board; DOM for the toolbar, tabs, popups, modals, and cursor labels
- **State management**: the Y.Doc is the single source of truth (`boards` Y.Map of Y.Arrays, plus a `boardNames` Y.Map); ephemeral state (cursors, previews, laser) lives in Y.js awareness
- **Styling**: hand-written CSS (`css/styles.css`) with CSS custom properties; Inter from Google Fonts
- **Build tool**: Vite in MPA mode (`appType: 'mpa'`)

## Backend

- **Runtime**: PartyKit (Cloudflare Workers based)
- **Server**: `party/index.ts`, 35 lines — forwards each message to every other connection in the room and never inspects it
- **Wire protocol**: one type byte plus payload (`js/protocol.js`): `UPDATE`, `SNAPSHOT`, `SNAPSHOT_REQUEST`, `AWARENESS`, `ROTATE`, and a plaintext `PRESENCE_PROBE`. Document messages carry an `{epoch, update, sig}` envelope encoded with lib0
- **Authorization**: capability links (owner / editor / viewer) whose permissions come from the ECDSA P-256 keys they contain, verified by every peer and rooted in a per-room owner key
- **Encryption**: AES-256-GCM on every frame except the presence probe; the relay never holds a key

## Infrastructure

- **Hosting**: Vercel (static frontend) and PartyKit (relay, `whiteboard-collab` in `partykit.json`)
- **CI/CD**: GitHub Actions. `ci.yml` runs `npm ci`, `npm test` and `npm run build` on Node 24 for every pull request and push to `main`. `deploy-partykit.yml` re-runs the same gates and then `partykit deploy`, only on pushes that touch `party/`, `partykit.json`, the npm manifests, or the workflow itself. Vercel deploys the frontend from Git.
- **URL routing**: `cleanUrls: true` plus one rewrite, `/room/:id` → `/room`, in `vercel.json`. The rewrite targets the extensionless path because `cleanUrls` redirects `/room.html` to `/room`. The Vite dev middleware in `vite.config.js` mirrors both rules so local URLs match production.
- **Security headers** (`vercel.json`): CSP with `default-src 'self'; script-src 'self'` (no `unsafe-inline`), `connect-src 'self' wss://*.partykit.dev`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'self'`; plus HSTS (two years, subdomains), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a `Permissions-Policy` that turns off camera, microphone and geolocation. Google Fonts is the only third-party origin allowed.
- **Caching**: `max-age=0, must-revalidate` by default; `/js/*` is served `immutable` for one year
- **SEO**: canonical links and JSON-LD on the two public pages, `robots.txt` that disallows `/room/`, and a two-URL `sitemap.xml`
- **Monitoring**: none

## Development Tools

- **Package manager**: npm (with `overrides` pinning `esbuild` ^0.25.12 and `undici` ^6.26.0)
- **Dev servers**: Vite, plus `partykit dev` for a local relay; `concurrently` runs both with `npm run dev:all`
- **Testing**: Vitest in the Node environment (`vitest.config.js`), 26 files under `tests/` covering key derivation, signing, certificates, the wire protocol, signed sync, the snapshot cache, the transport, capability links, sanitizers, geometry, text wrap, laser trails, keyboard intent, board history, and connector cascade-delete with undo. The logic is factored into browser-free modules so it can be tested without a DOM.
- **Linting / formatting**: none configured
- **Image generation**: `scripts/generate-icons.js` uses sharp to render the favicon set from `public/favicon.svg`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `yjs` | CRDT document: a Y.Map of boards, a Y.Array of shapes per board, and `Y.UndoManager` |
| `y-indexeddb` | Persists the Y.Doc to IndexedDB, so boards load offline and survive reloads |
| `y-protocols` | The awareness protocol for presence (cursors, previews, laser trails) |
| `lib0` | Varint binary encoding for the signed envelopes and awareness frames |
| `jspdf` | Turns the export render into a downloadable PDF |
| `partykit` | Relay runtime types and the `dev` / `deploy` CLI |
| `vite` | Dev server and multi-page production build |
| `vitest` | Test runner |
| `concurrently` | Runs Vite and the PartyKit dev server together |
| `sharp` | Favicon generation |

`partysocket` and `y-partykit` are still listed in `package.json` but nothing in the client imports them. The transport in `js/sync-provider.js` uses the browser's native `WebSocket` with its own backoff (100 ms doubling to a 2.5 s cap), and document sync is the custom signed layer rather than y-partykit's provider.

## Cryptography Stack

| Component | Technology | Configuration |
|-----------|-----------|---------------|
| Key derivation | PBKDF2-HMAC-SHA-256 | 600,000 iterations for new rooms. The count travels in the link's `kdf` field and is clamped to `[100,000, 5,000,000]` on decode, so a tampered link can't weaken derivation below the legacy floor or stall a victim on a multi-second one. Links without `kdf` use 100,000. |
| Salt | 16 random bytes per room | Minted with the room and carried in the link, so a password can't be attacked with a table precomputed from the public room ID. Links without a salt fall back to `whiteboard-{roomId}`. |
| Encryption | AES-256-GCM | Random 12-byte IV per message, prepended to the ciphertext; derived key is non-extractable |
| Signing | ECDSA P-256 / SHA-256 | Raw 64-byte r‖s signatures over `epoch ‖ update`. Chosen over Ed25519 for Web Crypto support across installed browsers |
| Certificates and notices | ECDSA P-256 over canonical JSON | The owner key signs `{room, epoch, editorPub}` certificates and `{type: 'rotate', room, from, to}` rotation notices |
| Key handling | Web Crypto | Keys travel as base64 (raw public, PKCS8 private) in the URL fragment and are imported as non-extractable `CryptoKey`s |

## Browser Requirements

`checkBrowserCompatibility()` in `app.js` checks the first four at startup and shows an "unsupported browser" screen if any is missing:

- WebSocket
- IndexedDB
- Web Crypto (`crypto.subtle`)
- TextEncoder / TextDecoder
- HTML5 Canvas
- ES modules (`type="module"`)
