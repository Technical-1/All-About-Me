# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|---|---|---|---|
| Language | TypeScript | 5.9 | Strict throughout, and one shared type definition for the wire format |
| Runtime | Cloudflare Workers | wrangler 4.125 | Serves the app, the API and the socket from one origin |
| State | Durable Objects | SQLite-backed | One authoritative instance per room, which is exactly the shape of a game |
| UI | React | 19.2 | Small surface here; the game is a phase machine and React maps onto that cleanly |
| Build | Vite | 7.1 | Fast enough that the test suite can rebuild before every run |
| Validation | zod | 4.1 | The wire format is one schema file, enforced on both ends |

## Frontend

- **Framework**: React 19.2
- **State management**: two hooks, no library. `useRoom.ts` owns the game socket,
  `useCall.ts` owns WebRTC. Server state arrives as whole snapshots, so there is
  nothing to reconcile.
- **Styling**: hand-written CSS, one file. Brutalist: hard borders, offset
  shadows, no radii, and a phase-driven accent colour so players can see the game
  advance without reading.
- **Type**: Archivo Black and JetBrains Mono, self-hosted via `@fontsource` so
  there is no third-party origin in the CSP and no external request on first paint
- **Routing**: hand-rolled over the History API. Deliberately not hash routing —
  hash changes have been observed dropping camera permission in iOS home-screen
  web apps, which would matter the moment someone installs the app and joins a call.

## Backend

- **Runtime**: Cloudflare Workers
- **State**: one Durable Object per room, with WebSocket hibernation so an idle
  lobby costs nothing
- **API style**: WebSocket for the game, a small JSON API for room creation and
  the SFU handshake
- **Auth**: no accounts. Seats are held by an HMAC token scoped to one room, so a
  dropped connection can reclaim its seat and nothing else.

## Realtime media

- **SFU**: Cloudflare Realtime, driven through its HTTPS API from the Worker
- **TURN**: Cloudflare Realtime TURN, credentials minted per client with a
  one-hour TTL, including TLS on 443 for networks that block UDP
- **Client**: raw `RTCPeerConnection`. No SDK, so publish, subscribe and
  renegotiation are hand-written in `apps/game/src/useCall.ts`.

## Infrastructure

- **Hosting**: Cloudflare Workers with static assets, custom domain on
  `oddoneout.games`
- **Rate limiting**: Workers rate-limit binding on room creation, which degrades
  to no limit where the binding does not exist
- **Secrets**: `wrangler secret` for the token signing key and the Realtime
  credentials. No default in the committed config, so a missing secret fails loudly
  rather than signing sessions with a known value.
- **Monitoring**: Workers observability

## Development Tools

- **Package manager**: pnpm workspaces
- **Testing**: Vitest, running inside workerd via `@cloudflare/vitest-pool-workers`
- **Image generation**: sharp for the icon set, satori for the social card so its
  headline is set in the real display face rather than whatever the build machine
  happens to have installed

## Key Dependencies

| Package | Purpose |
|---|---|
| `zod` | Every client and server frame is parsed through a schema before it reaches game logic |
| `@cloudflare/vitest-pool-workers` | Runs the test suite inside the real runtime, so Durable Objects and WebSockets are genuine rather than mocked |
| `satori` | Renders the Open Graph card to SVG with glyphs as outlines, so no font needs installing at build time |
| `sharp` | Rasterises the icon set and the social card |
| `@fontsource/archivo-black` | Self-hosted display face |
| `concurrently` | Runs the Vite dev server and `wrangler dev` side by side |

## Repository Layout

```
packages/protocol   wire format, zod schemas shared by both sides
packages/content    question sets, pairing rules, the review sheet generator
apps/game/worker    Worker, Durable Object, rules engine, SFU client
apps/game/src       React client
```
