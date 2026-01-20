# Simple-Backgammon Architecture

## System Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["Client (Next.js App)"]
        UI["React Components"]
        Canvas["Canvas Board Renderer"]
        Three["Three.js Dice/Hero"]
        Hooks["Custom Hooks"]
        GameLib["Game Logic Library"]
        Storage["LocalStorage Manager"]
    end

    subgraph Server["PartyKit Server"]
        MatchMaking["Matchmaking Party"]
        GameRoom["Game Room Party"]
        RoomStorage["Room State Storage"]
    end

    subgraph Hosting["Deployment"]
        Vercel["Vercel (Next.js)"]
        PartyKitCloud["PartyKit Cloud"]
    end

    UI --> Canvas
    UI --> Three
    UI --> Hooks
    Hooks --> GameLib
    Hooks --> Storage

    Hooks <--> |WebSocket| MatchMaking
    Hooks <--> |WebSocket| GameRoom
    GameRoom --> RoomStorage

    Client --> Vercel
    Server --> PartyKitCloud
```

## Component Relationships

```mermaid
flowchart LR
    subgraph Pages["Next.js Pages"]
        Home["/ (Home)"]
        Difficulty["/difficulty"]
        Game["/game"]
        Online["/online"]
        Stats["/stats"]
    end

    subgraph Components["UI Components"]
        ModeSelector
        DifficultySelector
        Board
        Dice3D
        Hero3D
        GameControls
        GameChat
        SavedGamesModal
        Stats_Comp["Stats Display"]
    end

    subgraph Logic["Game Logic"]
        GameModule["game.ts"]
        AIModule["ai.ts"]
        MovesModule["moves.ts"]
        BoardModule["board.ts"]
        DiceModule["dice.ts"]
    end

    Home --> ModeSelector
    Home --> Hero3D
    Home --> SavedGamesModal
    Difficulty --> DifficultySelector
    Game --> Board
    Game --> Dice3D
    Game --> GameControls
    Online --> Board
    Online --> GameChat
    Stats --> Stats_Comp

    Board --> GameModule
    GameControls --> GameModule
    GameModule --> AIModule
    GameModule --> MovesModule
    GameModule --> BoardModule
    GameModule --> DiceModule
```

## Online Multiplayer Data Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant MM as Matchmaking Server
    participant GR as Game Room
    participant P2 as Player 2

    P1->>MM: CREATE_ROOM
    MM->>P1: ROOM_CREATED (code)
    P1->>GR: JOIN_ROOM (code)
    GR->>P1: ROOM_JOINED (waiting)

    P2->>MM: JOIN_ROOM (code)
    MM->>P2: ROOM_JOINED
    P2->>GR: JOIN_ROOM (code)
    GR->>P1: PLAYER_JOINED
    GR->>P2: ROOM_JOINED
    GR->>P1: GAME_START
    GR->>P2: GAME_START

    P1->>GR: ROLL_DICE
    GR->>P1: DICE_ROLLED
    GR->>P2: DICE_ROLLED

    P1->>GR: MAKE_MOVE
    GR->>P1: MOVE_MADE
    GR->>P2: MOVE_MADE
```

## Architecture Overview

### Key Architectural Decisions

#### 1. Canvas-Based Board Rendering

I chose HTML5 Canvas over SVG or DOM-based rendering for the game board for several reasons:

- **Performance**: Canvas provides smooth 60fps animations for piece movements, hit detection, and board interactions without DOM thrashing
- **Precise Control**: I have pixel-perfect control over drawing triangles, pieces, and calculating click zones
- **Single Surface**: All board elements (points, pieces, bar, bear-off areas) render on one surface, simplifying coordinate calculations

The downside is accessibility - Canvas content is not accessible to screen readers. For a future iteration, I would add ARIA live regions to announce game state changes.

#### 2. Pure TypeScript Game Logic

I implemented all game rules (move validation, bearing off, hitting blots) in pure TypeScript without any UI dependencies:

- **Testability**: The game logic can be unit tested independently
- **Server Reuse**: The same logic runs on both client and PartyKit server for authoritative game state
- **Functional Style**: Functions like `makeMove()` return new state objects rather than mutating, making undo trivial

#### 3. PartyKit for Real-Time Multiplayer

I selected PartyKit over alternatives like Socket.io or Firebase for real-time features:

- **Edge-First**: PartyKit runs on Cloudflare Workers, placing game rooms close to players
- **Durable Objects**: Room state persists automatically, handling disconnections gracefully
- **Simple API**: WebSocket management is handled automatically with the `partysocket` React hook

I duplicated the game logic in the PartyKit server rather than importing from the shared lib due to PartyKit's build constraints. This ensures the server is authoritative - clients cannot cheat by sending invalid moves.

#### 4. Three.js for 3D Dice Only

I intentionally limited Three.js usage to dice animations and the hero background:

- **Bundle Size**: Three.js is ~150KB gzipped. Keeping it isolated to specific components allows code splitting
- **Complexity Budget**: A full 3D board would add complexity without proportional UX benefit
- **CSS 3D Fallback**: The 3D dice use CSS transforms with Three.js only for the more complex hero scene

#### 5. Local-First with Optional Online

The game works entirely offline with localStorage persistence:

- **Save/Resume**: Up to 5 games can be saved and resumed anytime
- **Statistics**: Win/loss records persist across sessions
- **PWA Support**: The app can be installed and played without internet

Online multiplayer is an enhancement, not a requirement. This architecture means the core game never depends on server availability.

#### 6. AI Strategy Implementation

I implemented three difficulty levels with increasing sophistication:

- **Easy**: Random valid move selection
- **Medium**: Single-move scoring (hit blots, make points, avoid danger)
- **Hard**: Lookahead evaluation considering future move potential

The AI runs entirely client-side, keeping server load minimal and allowing instant responses.

### Directory Structure Rationale

```
/app              - Next.js 14 App Router pages
/components       - React components (UI only, no business logic)
/lib              - Pure TypeScript modules (game logic, storage, types)
/lib/multiplayer  - Multiplayer-specific type definitions
/hooks            - Custom React hooks (bridge between UI and logic)
/party            - PartyKit server code (separate runtime)
/public           - Static assets, PWA icons
```

This separation ensures:
- Components remain presentational and testable
- Game logic is reusable across client/server
- Hooks encapsulate complex stateful interactions
