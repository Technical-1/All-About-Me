# Architecture

Odd One Out for iOS is the native iPhone client for [oddoneout.games](https://oddoneout.games),
a real-time party game where everyone is asked the same question except one
player, and nobody is told who. The app speaks the production server's existing
WebSocket protocol and HTTP endpoints; the backend was not changed at all, so
iOS and web players share the same rooms.

## System Diagram

```mermaid
flowchart TD
    subgraph "iPhone app (SwiftUI, iOS 17+)"
        ROUTER[AppRouter<br/>tabs, with practice / room covering them]
        LAND[Screens/Home<br/>Play, Decks, How to play, Settings]
        PRACTICE[Practice/<br/>scripted first-launch round]
        ROOM[Screens/Room<br/>one view per phase + call grid]
        CONN[Networking/RoomConnection<br/>socket, reducer, backoff]
        CALL[Call/CallController<br/>WebRTC publish + pull]
        STORE[Networking/Stores<br/>UserDefaults, web-compatible keys]
        PROTO[Protocol/<br/>Codable mirror of the wire format]
    end

    SERVER[Cloudflare Worker + Durable Objects<br/>oddoneout.games]
    SFU[Cloudflare Realtime<br/>SFU + TURN]

    ROUTER --> LAND
    ROUTER --> PRACTICE
    ROUTER --> ROOM
    ROOM --> CONN
    ROOM --> CALL
    PRACTICE -->|send hook, no network| CONN
    CONN <-->|wss /api/ws| SERVER
    CALL -->|session, tracks, renegotiate via the Worker| SERVER
    CALL <-->|media, never via the game server| SFU
    CONN --> PROTO
    CONN --> STORE
```

## Component Descriptions

### RoomConnection
- **Purpose**: Owns the room socket and the client-visible slice of game state,
  one instance per joined room.
- **Location**: `OddOneOut/Networking/RoomConnection.swift`
- **Key responsibilities**: join with the stored seat token, a 25-second
  heartbeat, exponential backoff from 500 ms to an 8-second cap, an immediate
  reconnect when the app returns to the foreground, and a message reducer that
  tests drive directly without a network.

### CallController
- **Purpose**: In-app voice and video against the Cloudflare Realtime SFU.
- **Location**: `OddOneOut/Call/CallController.swift`
- **Key responsibilities**: capture and publish over sendonly transceivers, pull
  remote tracks as the roster changes, attribute inbound tracks to players by the
  `mid` the SFU reports, renegotiate on demand, and sequence camera shutdown
  before peer-connection close because frames delivered into a closing connection
  crash libwebrtc. A generation counter lets a join abandoned mid-flight (the host
  turning the call off, the player leaving) stop at its next await without
  publishing, and the call re-announces itself after the game socket reconnects,
  since the server clears call presence on disconnect.

### Wire protocol mirror
- **Purpose**: Swift's version of the server's message schemas.
- **Location**: `OddOneOut/Protocol/`
- **Key responsibilities**: Codable models for every frame, deliberately tolerant
  of a newer server: unknown score reasons decode to a safe fallback instead of
  failing the frame, and new optional fields are additive.

### Practice engine
- **Purpose**: The first-launch tutorial round, played against three bots.
- **Location**: `OddOneOut/Practice/PracticeScript.swift`
- **Key responsibilities**: intercepts outbound messages through a hook on the
  socket layer and answers them with scripted server frames, so the real phase
  screens run a complete round with zero network and no test-only UI.

### Theme and components
- **Purpose**: The same brutalist design system as the site: hard borders,
  offset shadows, one loud accent that re-tints the whole room per phase.
- **Location**: `OddOneOut/Theme/`, `OddOneOut/Components/`

## Data Flow

1. The player joins by code, or starts a room over the same HTTP endpoint the
   web client uses. The socket opens and sends the stored per-room seat token,
   which restores seat, score and a locked answer after any disconnection.
2. Server frames arrive as JSON, decode through the protocol mirror, and reduce
   into observable state; each phase screen renders from that state alone.
3. During a call, media flows directly between the phone and Cloudflare's SFU.
   The game server only ever brokers session and track identifiers.
4. When iOS suspends the app and kills the socket, foregrounding reconnects
   immediately rather than waiting out the backoff, and the server replays the
   current phase.
5. A shared `https://oddoneout.games/r/CODE` link opens the app through a
   universal link (`Route.from(url:)` in `AppRouter.swift`); the Worker's
   `apple-app-site-association` file claims `/r/*` for this app.

## Key Architectural Decisions

### Native navigation and interaction, web-identical gameplay
- **Context**: The first build copied the website's single scrolling landing page
  pixel for pixel, and on a phone it read as a website in a container.
- **Decision**: Split the port along one line. Navigation, entry and interaction
  are native: a tab bar (Play, Decks, How to play), a Settings sheet, the room as
  a full-screen cover with a confirmed Leave, segmented controls, a stepper and a
  toggle in host settings, haptics, Dynamic Type on the brand fonts, dark mode and
  an App Shortcut. Gameplay, rules, game-screen copy, the wire protocol and the
  brand stay identical to the website.
- **Rationale**: Players judge "native" by how the app is navigated and how it
  responds to a thumb, not by typeface. Keeping the game layer identical keeps
  mixed iOS and web rooms coherent, and every departure is recorded in one list so
  a parity review reads it as intent rather than drift.

### Dark mode as "accent islands"
- **Context**: A single `ink` token meant both "text on the page" and "text on a
  bright accent". Inverting it for dark mode would put cream text on orange.
- **Decision**: Adaptive tokens flip the page (paper to near-black, ink to cream),
  and anything drawn on an accent fill resolves in light mode locally
  (`accentSurface()`), with a fixed `onAccent` ink for text on accents.
- **Rationale**: One environment override per accent surface is far harder to get
  wrong than choosing a text colour at every one of about a hundred call sites.

### A native SwiftUI port rather than a wrapped web view
- **Context**: The web client already worked in Safari, so the cheap option was
  a WebView shell.
- **Decision**: A full native port: SwiftUI views, Swift networking, native
  WebRTC.
- **Rationale**: The call is the difference. A wrapped page re-prompts for
  camera permission in ways users read as broken, and backgrounding kills a
  WebView's socket and media harder than a native app's. Native also means the
  practice round, haptics and phase transitions feel like an app rather than a
  site in a frame.

### The wire protocol mirrored by hand, tolerant by construction
- **Context**: The server's schemas are TypeScript. Swift needs the same shapes,
  and the two clients will not always update in lockstep.
- **Decision**: A hand-written Codable mirror with explicit tolerance rules:
  enums carry a fallback case, new fields are optional, and an unknown value can
  never discard a whole frame.
- **Rationale**: Code generation from the schemas would guarantee freshness but
  produce brittle strictness; a strict enum once meant a new server-side score
  reason silently dropped the entire result frame. Tolerance is the property
  that actually matters for a client that ships through app review on a delay.

### The practice round runs the real screens, not a copy
- **Context**: A tutorial that reimplements the game UI goes stale the moment
  the game changes.
- **Decision**: A scripted engine feeds the standard room screens through the
  socket layer's send hook, swallowing outbound messages and replying with
  scripted frames.
- **Rationale**: The tutorial is the game, so it cannot drift. The alternative,
  a bespoke onboarding flow, doubles every future phase-screen change.

### One third-party dependency
- **Context**: The app needs WebRTC, which Apple does not ship as SDK.
- **Decision**: Exactly one package, a maintained build of libwebrtc; everything
  else is system frameworks.
- **Rationale**: Every dependency in an App Store binary is a review surface, a
  size cost and a supply-chain exposure. URLSession's WebSocket support and
  SwiftUI's Observation framework cover the rest natively.

### The project file is generated
- **Context**: Xcode project files merge badly and drift invisibly.
- **Decision**: `project.yml` is the source of truth; `xcodegen generate`
  produces the project.
- **Rationale**: Target settings, entitlements and the dependency are reviewable
  in one small YAML file instead of a pbxproj diff.
