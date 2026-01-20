# Simple-Backgammon Q&A

## Project Overview

Simple-Backgammon is a modern web-based implementation of the classic backgammon board game. I built this to provide a polished, accessible backgammon experience with AI opponents at multiple difficulty levels, real-time online multiplayer, and thoughtful features like game saving and statistics tracking. The target audience includes casual players wanting a quick game against the computer, friends who want to play together on the same device or online, and backgammon enthusiasts looking for a clean, ad-free gaming experience.

## Key Features

### Single Player vs AI

Three difficulty levels provide appropriate challenge for all skill levels. Easy mode makes random valid moves - good for learning. Medium mode evaluates moves based on hitting blots, making points, and avoiding danger. Hard mode uses lookahead evaluation, considering future move potential and building primes.

### Real-Time Online Multiplayer

Players can create private rooms with shareable 6-character codes or join via matchmaking queue. The game uses WebSockets for instant move synchronization. If a player disconnects, they have 5 minutes to reconnect before the room closes. An in-game chat allows communication between opponents.

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

### Challenge: Real-Time Synchronization

The main challenge with online multiplayer was ensuring game state consistency between players. I solved this by making the server authoritative - all game logic runs server-side, and clients only send intents (roll dice, make move). The server validates every action and broadcasts the resulting state. This prevents cheating and ensures both players always see the same board.

### Challenge: Canvas Click Detection

Determining which point was clicked on the board required careful coordinate math. I divided the board into regions (top/bottom halves, quadrants, bear-off areas) and calculated point indices based on click position relative to those regions. The click handler maps pixel coordinates to game coordinates accounting for the bar, variable canvas size, and point orientation.

### Innovative: Functional Game State

I implemented the game logic using functional patterns. The `makeMove()` function returns a new state object rather than mutating the existing one. This made implementing undo trivial - I simply push state snapshots to a history array and pop them on undo. It also simplified the multiplayer sync since state updates are immutable.

### Innovative: Server-Side Logic Duplication

Rather than sharing code between client and PartyKit server (which proved problematic with bundling), I duplicated the game logic. The server-side version in `party/backgammon.ts` implements the same rules as `lib/game.ts`. This ensures the server can fully validate moves and prevents any client-side tampering.

### Challenge: Bearing Off Rules

Backgammon's bearing off rules have subtle edge cases. You can only bear off when all pieces are in your home board. You can use a higher die to bear off if no exact match exists, but only for the furthest-back piece. I implemented these rules carefully with helper functions like `canBearOff()` and special handling in `calculateAvailableMoves()`.

## Frequently Asked Questions

### How does the AI decide its moves?

The Easy AI simply picks a random valid move. The Medium AI scores each move based on tactical factors: hitting opponent blots (+4), making a safe point with 2+ pieces (+2), leaving a blot in dangerous territory (-3), and advancing toward home (+1). The Hard AI additionally uses lookahead - it simulates each move, scores the resulting positions, and picks the move leading to the best future options.

### Can I play on my phone?

Yes. The game is fully responsive and works well on mobile devices. Touch interactions are supported for all game actions. You can also install it as a Progressive Web App from your browser's menu for an app-like experience.

### How do I save a game?

When you exit a game (clicking "Back to Menu"), your current game state is automatically saved. Up to 5 games can be saved simultaneously. To resume, click "Continue Saved Game" from the main menu. If you have multiple saves, you can choose which one to continue.

### What happens if I disconnect during an online game?

You have 5 minutes to reconnect to the same game room. Your opponent will see a "Player disconnected" message. When you return, you'll resume from where you left off. If you don't reconnect within 5 minutes, the room closes and the game ends.

### Can spectators watch online games?

The architecture supports spectators (they join with a -1 player index), but I haven't exposed this in the UI yet. Spectators would see the board and moves in real-time but couldn't interact.

### How are room codes generated?

Room codes are 6 characters using letters A-Z (excluding I and O) and numbers 2-9 (excluding 0 and 1). This avoids confusion between similar-looking characters while providing millions of possible combinations.

### Why don't you use a chess-style rating system?

I wanted to keep the project simple and focused. A rating system would require user accounts, persistent server-side storage, and matchmaking based on skill. The current design works without accounts - anyone can play immediately. Rating systems could be a future enhancement.

### Can I customize the board colors?

Not currently. The classic green board with brown/tan points is hardcoded. Adding theme customization would be a straightforward enhancement - the colors are defined as constants in `Board.tsx`.

### Why is the game logic duplicated between client and server?

PartyKit servers run in a Cloudflare Workers environment with specific bundling constraints. Sharing TypeScript modules between the Next.js frontend and PartyKit proved problematic. Duplicating the ~200 lines of game logic was simpler and ensures the server can authoritatively validate all moves.

### How do I report a bug?

The project is open source on GitHub. Please open an issue describing the bug, including steps to reproduce it, what you expected to happen, and what actually happened. Screenshots or browser console errors are helpful.
