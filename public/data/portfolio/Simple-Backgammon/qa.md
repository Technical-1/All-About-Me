# Simple-Backgammon Q&A

## Project Overview

Simple-Backgammon is a modern web-based implementation of the classic backgammon board game. I built this to provide a polished, accessible backgammon experience with AI opponents at multiple difficulty levels, real-time online multiplayer, and thoughtful features like game saving and statistics tracking. The target audience includes casual players wanting a quick game against the computer, friends who want to play together on the same device or online, and backgammon enthusiasts looking for a clean, ad-free gaming experience.

## Key Features

### Single Player vs AI

Three difficulty levels provide appropriate challenge for all skill levels. Easy mode makes random valid moves - good for learning. Medium mode evaluates moves based on hitting blots, making points, and avoiding danger. Hard mode uses lookahead evaluation, considering future move potential and building primes.

### Real-Time Online Multiplayer

Players can create private rooms with shareable 6-character codes or join via matchmaking queue. The game uses WebSockets for instant move synchronization. If a player disconnects, they have a 90-second grace window to reconnect; if they time out mid-game, the present opponent wins by forfeit. An in-game chat allows communication between opponents, and reconnecting players are replayed the recent chat history.

### 3D Animated Dice

CSS 3D transforms create realistic dice rolling animations. The dice tumble with physics-inspired motion before settling on final values. Doubles are shown with four dice to make the bonus clear.

### Multiple Saved Games

Up to 5 games can be saved and resumed anytime. Each save captures the complete board state, current turn, and game mode. Games are stored in localStorage so they persist across browser sessions.

### Autocomplete Feature

When pieces have passed each other and no more contact is possible (no hitting), the game detects this state. Players can then click "Autocomplete" to automatically bear off remaining pieces without manual moves.

### Statistics Tracking

The app tracks wins, losses, and games played across all modes. Statistics are broken down by AI difficulty level and include win streaks. This provides motivation and progress tracking for regular players.

### Progressive Web App

The game can be installed as a standalone app on mobile or desktop. Once installed, it works offline with full functionality (except online multiplayer). The app includes proper icons and manifests for a native-like experience.

### Responsive Design

The interface adapts smoothly from desktop to mobile. Touch interactions work naturally for selecting and moving pieces. The board scales to fit available space while remaining playable.

## Technical Highlights

### One rule engine, shared by client and server

Online play needs to be cheat-proof *and* consistent across both clients — and the most common way that breaks is the client and server quietly disagreeing about the rules. I avoided a second implementation entirely: `party/backgammon.ts` imports `createInitialState`, `makeMove`, `doRollDice`, and `endTurn` from the same `lib/game` module the browser uses. Clients send only intents (`ROLL_DICE`, `MAKE_MOVE`); the authoritative server recomputes legality with byte-for-byte identical code, so there's no way to fabricate a move and no way for the two sides to drift. A test (`party/__tests__/shared-engine.test.ts`) scans the server source and fails if it ever re-declares an engine function, keeping the single-source-of-truth invariant honest.

### Immutable game state with cheap undo

`lib/game.ts` and `lib/moves.ts` treat the board as a value: `makeMove()` returns a new state object instead of mutating in place. Undo is then trivially a history stack of those snapshots, popped on demand. The same property makes multiplayer rollback and AI lookahead straightforward — the Hard AI in `lib/ai.ts` simulates candidate moves against snapshots without worrying about restoring state.

### Canvas-based board with hit-test math

The board renders to a single `<canvas>` element for 60fps animation without DOM thrashing. Click detection maps pixel coordinates back to point indices by partitioning the canvas into the bar, the four quadrants, and the two bear-off areas, then computing index offsets per region. This avoids per-element event listeners and keeps the rendering loop fast on mobile.

### Bearing-off rules with overshoot handling

Bearing off has subtle constraints: all 15 checkers must be in the home board, an exact die match bears that point, and a larger die can only bear off the furthest-back checker. `canBearOff()` and the bear-off paths in `calculateAvailableMoves()` encode these rules explicitly so the same logic governs both AI play and online move validation.

### Disconnect grace that survives server hibernation

PartyKit hibernates idle rooms to save resources, which means a naïve `setTimeout` for the reconnect grace period would silently vanish on restart and a forfeit would never fire. Instead, the room persists `disconnectedAt` in its durable state and schedules a **storage alarm** (`reconcileDisconnectAlarm()` in `party/backgammon.ts`). `onAlarm()` runs even after the room wakes from hibernation, recomputes who has exceeded the 90-second window, and resolves the room deterministically — opponent-wins-by-forfeit if a game is live, otherwise close the room. The alarm is recomputed on every connect/disconnect so it always tracks the soonest deadline.

## Engineering Decisions

### Server authority via a shared engine, not a duplicated one
- **Constraint**: Online play must be tamper-proof and stay in sync across two browsers and a possible reconnect.
- **Options**: Trust the client and broadcast state; full server authority with the rules re-implemented in the server; full server authority that imports the same `lib/` engine the client uses.
- **Choice**: Full server authority that imports the shared `lib/game` engine, with a test that forbids re-declaring engine functions in `party/`.
- **Why**: A duplicated rule set is the classic source of client/server desync — the two copies drift one bug-fix at a time. Reusing the exact module the client runs makes desync structurally impossible, and the `shared-engine.test.ts` guard means a future contributor can't reintroduce a copy without the suite going red. The server stays authoritative (clients send intents, not state) without paying the duplication tax.

### Canvas vs. SVG/DOM for the board
- **Constraint**: Smooth piece animations on mobile, with a board that scales to the viewport.
- **Options**: One `<div>` per point and checker (DOM), an SVG scene graph, a single canvas.
- **Choice**: Canvas with manual hit-testing.
- **Why**: 28 points × up to 15 checkers each is enough nodes that DOM layout starts to cost on phones. Canvas gives pixel-perfect control and a single redraw per frame. The trade-off is no screen-reader support, which I would address with an ARIA live region for move announcements if I shipped this beyond a hobby project.

### PartyKit vs. Socket.io or Firebase Realtime DB
- **Constraint**: Real-time rooms, durable across short disconnects, with no separate DB to operate.
- **Options**: Self-hosted Socket.io on a VM; Firebase Realtime DB; PartyKit on Cloudflare.
- **Choice**: PartyKit.
- **Why**: Durable Objects give me per-room persistence for free, the edge runtime keeps latency low, and there is no separate backend to deploy. Socket.io would have needed a server I have to babysit; Firebase couples me to a heavier SDK and a different mental model than message-passing.

### Hand-rolled AI vs. an MCTS/neural engine
- **Constraint**: Three difficulty tiers, runnable in the browser with no network round-trip.
- **Options**: Random/heuristic/lookahead in TypeScript; bundle a small WASM engine; call out to a server-side bot.
- **Choice**: Three TypeScript strategies in `lib/ai.ts` — random for Easy, single-ply heuristic scoring for Medium, shallow lookahead for Hard.
- **Why**: A self-contained AI keeps the game offline-capable, avoids any server cost, and is good enough to teach beginners and challenge casual players. A real backgammon engine would be a much larger project than the rest of the app combined.

## Frequently Asked Questions

### How does the AI decide its moves?

The Easy AI simply picks a random valid move. The Medium AI scores each move based on tactical factors: hitting opponent blots (+4), making a safe point with 2+ pieces (+2), leaving a blot in dangerous territory (-3), and advancing toward home (+1). The Hard AI additionally uses lookahead - it simulates each move, scores the resulting positions, and picks the move leading to the best future options.

### Can I play on my phone?

Yes. The game is fully responsive and works well on mobile devices. Touch interactions are supported for all game actions. You can also install it as a Progressive Web App from your browser's menu for an app-like experience.

### How do I save a game?

When you exit a game (clicking "Back to Menu"), your current game state is automatically saved. Up to 5 games can be saved simultaneously. To resume, click "Continue Saved Game" from the main menu. If you have multiple saves, you can choose which one to continue.

### What happens if I disconnect during an online game?

You have a 90-second grace window to reconnect to the same game room. Your opponent sees a "Player disconnected" message, and when you return you resume exactly where you left off — including the recent chat history. If you don't make it back in time and a game is in progress, your opponent wins by forfeit; if there's no active game, the room simply closes. This deadline is enforced by a durable storage alarm, so it still fires correctly even if the server hibernated the room while you were gone.

### Can spectators watch online games?

The architecture supports spectators (they join with a -1 player index), but I haven't exposed this in the UI yet. Spectators would see the board and moves in real-time but couldn't interact.

### How are room codes generated?

Room codes are 6 characters using letters A-Z (excluding I and O) and numbers 2-9 (excluding 0 and 1). This avoids confusion between similar-looking characters while providing millions of possible combinations.

### Why don't you use a chess-style rating system?

I wanted to keep the project simple and focused. A rating system would require user accounts, persistent server-side storage, and matchmaking based on skill. The current design works without accounts - anyone can play immediately. Rating systems could be a future enhancement.

### Can I customize the board colors?

Not currently. The classic green board with brown/tan points is hardcoded. Adding theme customization would be a straightforward enhancement - the colors are defined as constants in `Board.tsx`.

### How do the client and server stay in sync about the rules?

They run the same code. The PartyKit server imports its move validation, dice, and bear-off logic from the `lib/game` module the browser also uses, so there is no second copy to drift out of sync. To keep it that way, `party/__tests__/shared-engine.test.ts` reads the server source and fails the build if it re-declares any engine function — making "single source of truth" an enforced invariant rather than a convention.

### How does the matchmaking queue avoid pairing the same player against themselves on a flaky connection?

The matchmaking server in `party/matchmaking.ts` keys waiting players by their connection ID. A reconnect produces a new connection ID, but the room-rejoin path goes through the game room directly using the 6-character room code, not back through the queue. The 90-second reconnect window lives on the game room, not the matchmaker, so a dropped player rejoining their own room doesn't get matched as a new player.
