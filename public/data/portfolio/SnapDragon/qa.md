# Project Q&A Knowledge Base

## Overview

SnapDragon is a strategic iOS card game built with SwiftUI and Firebase, based on the classic "Palace" (also known as "Shithead") card game. Players race to empty their hand, face-up cards, and face-down cards by playing cards equal to or higher than the current pile. The app supports local 2-player pass-and-play, a smart AI opponent, and real-time online multiplayer powered by Firebase.

## Key Features

- **Multiple Game Modes**: Local 2-player, AI opponent, and online multiplayer — all sharing the same core game logic
- **Intelligent AI**: Multi-layered strategy that prioritizes low cards, saves 2s and 10s for critical moments, detects when opponents are near victory, and attempts four-of-a-kind combinations
- **Real-time Online Play**: Firebase-powered matchmaking with skill-based opponent matching and live game state synchronization via Firestore snapshot listeners
- **Persistent Scoreboard**: Tracks wins, losses, and move counts across sessions using UserDefaults, with separate stats for AI and human games

## Technical Highlights

### Value-type Game Engine
I built the entire game logic as Swift structs (Game, Card, Player) rather than classes. This means every game state mutation is a clean copy — no shared mutable state bugs. The same `Game` struct powers local play, AI games, and online matches. For online mode, `GameStateData` acts as a Codable bridge that serializes the `Game` to/from Firestore.

### AI Strategy System
The AI opponent uses a priority-based decision tree rather than simple random play. It evaluates: matching pile cards for four-of-a-kind combos → playing lowest valid regular cards → using 2s to reset rank when it's high → saving 10s as last resort pile clearers. It also detects when the human player is down to their last card and adjusts strategy accordingly (avoiding wasting 2s that would benefit the opponent).

### Dual Firebase Database Architecture
I chose to use both Firebase Realtime Database and Cloud Firestore together: RTDB handles the matchmaking queue (optimized for real-time presence detection and low-latency queue operations), while Firestore manages game sessions and player profiles (better for structured queries, offline support, and document-based game state). This hybrid approach gives the best of both worlds.

### Defense-in-Depth Security
I implemented multi-layer input sanitization: an `InputSanitizer` utility strips HTML tags, filters to a safe character set, collapses whitespace, and enforces a 20-character limit. This runs at both the UI layer (name input views) and the persistence layer (ScoreManager), so no code path can persist unsanitized input. Firebase security rules enforce per-user write restrictions and participant-only game state updates. All 160+ debug print statements were replaced with a `GameLogger` utility that compiles to zero code in release builds using `@autoclosure`.

### Comprehensive Test Suite
I added 79 unit tests across 4 XCTest suites covering the core game logic (30 tests for rules, special cards, win detection), AI strategy (12 tests for decision-making edge cases), score persistence (18 tests for CRUD and stat calculation), and security (19 tests for sanitization and bounds safety). The value-type Game struct made testing straightforward — each test creates a fresh game state with no shared mutable state.

## Engineering Decisions

### Single Game struct for local, AI, and online play
- **Constraint**: Online matches must follow identical rules to local play — any divergence would mean players see different outcomes for the same move.
- **Options**: (1) Separate engines per mode with shared rule tables, (2) Server-authoritative game logic via Cloud Functions, (3) One value-type `Game` struct used everywhere with a Codable bridge for transport.
- **Choice**: Option 3 — one `Game` struct, with `GameStateData` as the Firestore-friendly Codable mirror.
- **Why**: Eliminates rule drift by construction. The value-type semantics make state copying for serialization trivial, and the same XCTest cases that cover local play cover online play.

### Realtime Database for matchmaking, Firestore for game state
- **Constraint**: Matchmaking needs sub-second presence/queue updates; game sessions need structured queries and reliable per-document updates.
- **Options**: (1) All Firestore, (2) All Realtime Database, (3) Split by access pattern.
- **Choice**: Split — RTDB owns the matchmaking queue, Firestore owns sessions and profiles.
- **Why**: RTDB's flat tree and presence semantics fit the queue model; Firestore's snapshot listeners and document model fit move-by-move game updates. Each database stays in its strength zone.

### Host-based initialization for online games
- **Constraint**: Both clients see the new session document almost simultaneously and would race to deal cards, leading to mismatched hands.
- **Options**: (1) Server-authored initial state via Cloud Functions, (2) Lock-based coordination, (3) Designate the first player in the `players` array as the deck dealer.
- **Choice**: Option 3 — the first player in the array initializes the deck and writes the starting state.
- **Why**: Zero server cost, deterministic resolution, and the rule is obvious from reading any client. The second client simply waits for the initial `GameStateData` snapshot.

### Defense-in-depth name sanitization
- **Constraint**: Player names are written to both local UserDefaults and shared Firebase documents. A single missed sanitization path could persist HTML or oversized payloads.
- **Options**: (1) Sanitize only at the UI layer, (2) Sanitize only at the persistence layer, (3) Sanitize at both, with Firebase rules as a third barrier.
- **Choice**: Option 3 — `InputSanitizer` runs in the name input views and again inside `ScoreManager`, with Firestore/RTDB rules enforcing per-user write scope.
- **Why**: Future call sites that bypass the UI still get sanitized before they hit storage, and a compromised client still can't write outside its user namespace.

## Frequently Asked Questions

### How does the card game work?
Each player gets 4 cards in hand, 4 face-up (visible), and 4 face-down (hidden). During setup, you can swap hand and face-up cards strategically. Then players take turns playing cards equal to or higher than the current lowest rank. 2s reset the rank, 10s clear the pile, and four-of-a-kind also clears. When you run out of hand cards, you play face-up, then face-down blindly. First to empty all cards wins.

### How does the AI decide what to play?
The AI follows a priority chain: (1) match the pile's top card to chase four-of-a-kind, (2) play the lowest valid regular card, (3) use a 2 to reset if the rank is above 7, (4) use a 10 as a last resort, (5) pick up the pile if nothing works. It also avoids playing 2 on top of another 2 and saves special cards when the opponent is about to win.

### Why SwiftUI instead of UIKit?
SwiftUI's declarative approach made the card game UI much simpler to build — card layouts, animations, and state-driven updates are natural fits. The `@State` / `@Published` pattern integrates cleanly with the value-type Game struct, and NavigationStack handles the multi-screen flow elegantly.

### How does online matchmaking work?
When a player searches for a match, their profile (skill level, preferred game speed) is added to a Firebase Realtime Database queue. The app monitors the queue for compatible opponents (within ±200 ELO, same game speed). When a match is found, a Firestore game document is created, both players are notified, and the game begins with a real-time snapshot listener syncing every move.

### How is game state synced in online mode?
Each move converts the local `Game` struct into a `GameStateData` Codable object, which is written to Firestore. The opponent's client has a snapshot listener that fires on every change, parses the `GameStateData`, and reconstructs the `Game` struct locally. The host player (first in the players array) handles initialization to prevent race conditions.

### What happens if a player disconnects mid-game?
The Firestore snapshot listener on the remaining client surfaces the stale state, and the session document carries a `lastUpdated` timestamp the UI uses to flag a disconnection. The game is not auto-resolved — the disconnected player can reopen the app and resume from the last persisted `GameStateData`.

### Can the AI cheat by peeking at hidden cards?
No. The AI runs against the same `Game` struct a human plays against, and its decision tree only reads from publicly visible state: the top of the pile, its own hand, and counts of opponent cards. Face-down cards remain face-down for the AI just like they do for the user.

### Why anonymous authentication instead of accounts?
Online play needs a stable user identity, but the game has no social graph yet. Firebase Anonymous Auth gives every install a persistent UID without forcing email/password or social login flows, which would add friction for what is still a casual card game.

### Why is the Game model a struct instead of a class?
Every move is a state transition I want to be auditable and serializable. With a struct, mutating a `Game` produces a new value I can compare to the previous one, write to Firestore, and pass through SwiftUI's diffing without worrying about shared references. Classes would let two views accidentally mutate the same instance — exactly the bug class I wanted to design out.
