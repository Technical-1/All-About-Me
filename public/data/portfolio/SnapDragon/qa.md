# Project Q&A Knowledge Base

## Overview

SnapDragon is an iOS card game based on Palace (also known as Shithead). Players race to get rid of their hand, then their face-up cards, then their face-down cards, by playing cards equal to or higher than the pile. It has pass-and-play, a computer opponent, and online matches. The most interesting technical part is online play: a TypeScript Cloud Functions backend deals the cards, referees every move in a Firestore transaction, keeps the deck and hidden cards in a document no client can read, and updates ELO ratings when a game ends.

## Problem Solved

Palace is a game of hidden information: face-down cards, the opponent's hand, the deck. A naive online version that lets clients write shared state gives that information to anyone who inspects network traffic, and lets a modified client play whatever it likes. SnapDragon brings the game to a phone and makes the online mode fair, with the server as the only party that knows and changes the full state.

## Target Users

- **Casual players**: start a local or AI game with no account, and play online with no sign-up because identity is anonymous
- **Two people sharing one phone**: a handoff screen covers the board between turns
- **Engineers reviewing the code**: a compact example of server-authoritative multiplayer on Firebase, with security rules and tests for each layer

## Key Features

### Three ways to play
Local pass-and-play, vs AI, and online. Local and AI games run entirely on the device using the Swift `Game` struct. Online games use the same SwiftUI card views but get their state from the server.

### A computer opponent with a real strategy
In the setup phase, the AI swaps high cards and 2s/10s out of its face-up row. In play it chases four-of-a-kind on the pile, plays its lowest regular rank (all copies at once), and saves 2s and 10s until nothing else works. When you are one card from winning, it holds back a 2 if it has any other option.

### Fair online matches
Matchmaking pairs players with ratings within 200 points who picked the same game speed. Each move goes to `applyMove`, which rejects plays out of turn, illegal cards, card ids that are not in the playable zone, and setup swaps outside your setup turn.

### Turn clocks, forfeits and disconnects
Four speeds (Relaxed 120s, Normal 60s, Fast 45s, Blitz 30s) set a per-turn countdown. When it hits zero, the app picks up the pile for you. Leaving a live game records a forfeit, and if the forfeit cannot reach the server you stay in the game and can try again. If your opponent's presence flag disappears, you are told they disconnected.

### Ratings and a local scoreboard
Online results update games played, wins and an ELO rating on the server, and the profile listener shows the new rating straight away. Local and AI results go to an on-device scoreboard with win rates, history, and your best (fewest-move) win against the AI.

## Technical Highlights

### The server holds the only copy of hidden state
`functions/src/projection.ts` turns one `GameState` into three Firestore documents: a public doc (pile, face-up cards, hand and face-down counts, `deckCount`), one `private/{uid}` doc per player, and `secret/state` with everything. `firestore.rules` lets a participant read the public doc, only the owner read their private doc, and no client read `secret`. `OnlineGameManager.rebuildGameIfReady()` fills opponent zones with `Card.hidden()` placeholders, so the client never holds values it should not know.

### Moves are transactional, and so are rating updates
`applyMoveImpl` in `functions/src/index.ts` follows Firestore's reads-before-writes rule. It reads `secret/state` and both `players` docs, then authorizes the move, applies it in memory, increments `moveSequence`, and writes every projection in the same transaction. If the move ends the game, the ELO update (K=32, floor 100, 1000 seed) goes into that transaction too, so stats are applied exactly once and can never disagree with the result.

### Consent tokens stop anyone from creating games against you
The game id is derived from both uids, which makes creation idempotent but would also let anyone open a game against any uid. `createGameImpl` therefore requires a `game_consents/<gameId>/<uid>` token from both players before it deals, and `database.rules.json` lets only the owner write their token. `MatchmakingService.createOnlineGameWithConsentRetry` retries only that specific `failed-precondition` error, up to 5 times. A daily `pruneConsents` job deletes tokens older than an hour from pairings that never turned into a game.

### Both rule engines are tested at their own layer
The Swift engine has 106 XCTest cases covering rules, the AI, scoreboard persistence, and sanitization. The TypeScript port has 27 pure Jest tests on dealing, play validation, face-down flips and the setup phase, plus 25 emulator tests on the callables: consent gating, turn authorization, malformed payloads, idempotent creation, ELO on finish, and pruning. Another 35 Mocha tests assert what the Firestore and RTDB rules allow and deny.

## Engineering Decisions

### Authoritative Cloud Functions over a shared client engine
- **Constraint**: Online games must be fair even against a modified client, and hidden cards must stay hidden.
- **Options**: (1) Clients write state and security rules validate it, (2) one client acts as host and deals, (3) the server owns the state.
- **Choice**: Option 3. The rules are ported to `functions/src/game.ts`, clients send moves, and Firestore rules deny every client write to `games`.
- **Why**: Rules can check who writes and what shape the data has, but they cannot evaluate a card game, and a host client necessarily sees the deck. The cost is two rule implementations, Swift for offline play and TypeScript for online, kept in step by tests on each side.

### Deterministic initiator plus idempotent create
- **Constraint**: Two clients find each other in the queue at the same moment and would both create a game.
- **Options**: (1) A dedicated matchmaking server, (2) a lock in the database, (3) a rule both sides compute the same way.
- **Choice**: The smaller uid initiates, the game id is built from both sorted uids, and `createGameImpl` returns early if `secret/state` already exists.
- **Why**: There is no coordination round-trip and no extra server, and even a duplicate call just returns the same game.

### Server-owned player profiles
- **Constraint**: Ratings feed matchmaking, so self-reported stats would break it.
- **Options**: (1) Rules that validate client stat increments, (2) server-only writes.
- **Choice**: Server-only. `players/{uid}` has `allow write: if false`, `ensureProfile` seeds it, and `applyMove` updates it.
- **Why**: Increment validation in rules is fragile and still lets a client claim a win it did not earn. Since the server already decides the winner, it is the natural place to write the result.

### Realtime Database for the short-lived parts
- **Constraint**: Presence needs a disconnect hook; queue entries and notifications are short-lived and frequent.
- **Options**: (1) All Firestore with heartbeat timestamps, (2) RTDB for ephemeral data and Firestore for game state.
- **Choice**: RTDB holds `matchmaking`, `game_consents`, `match_notifications` and `presence`; Firestore holds games and profiles.
- **Why**: `onDisconnectRemoveValue()` gives server-side cleanup when a client drops, which Firestore has no equivalent for. Firestore keeps the transactions and per-document read rules that game state relies on.

## Frequently Asked Questions

### How does the card game work?
Each player gets 4 cards in hand, 4 face-up and 4 face-down. During setup, each player may swap cards between hand and face-up row. On your turn you play one or more cards of the same rank that are equal to or higher than the pile, then draw one card from the deck for each card you played. 2s reset the rank, 10s clear the pile, four of a kind on top clears it, and clearing the pile gives you another turn. Aces are high, and after an Ace only an Ace, 2 or 10 can be played. If you cannot play, you pick up the pile. Once your hand and face-up cards are gone, you flip face-down cards blind, and an illegal flip makes you pick up the pile along with that card. First to empty everything wins.

### Can the other player see my cards online?
No. Your hand and face-down cards are written only to `games/{id}/private/{yourUid}`, which only you can read. The opponent's client gets your counts and your face-up cards. The deck exists only in `secret/state`, which no client can read; clients see only `deckCount`.

### What stops a modified client from cheating?
Every client write to game documents is denied by `firestore.rules`. Moves go through `applyMove`, which checks you are a participant, that it is your turn (or your setup turn), that the cards you name are in your playable zone, that the play is legal, and that face-down plays happen only once your hand and face-up cards are empty.

### How are the online cards shuffled?
`dealNewGame` in `functions/src/game.ts` runs a Fisher-Yates shuffle whose random source is Node's `crypto.randomInt`, then deals in the same round-robin order as the Swift `Game.start()`.

### What happens when my turn clock runs out?
The countdown starts from the public doc's `lastUpdated` timestamp. When it reaches zero, your client sends a single `pickup` move for that turn. Picking up is always legal, so play continues.

### What happens if my opponent closes the app?
Each client keeps a `presence/{uid}` flag in Realtime Database that is removed automatically on disconnect. Once your client has seen the opponent online, it shows a "Connection Lost" alert if the flag disappears. If you tap "Leave Game" in a live match, that counts as a forfeit and the server records your opponent as the winner.

### How is my rating calculated?
Standard ELO with K=32: the expected score is `1 / (1 + 10^((opponent - you) / 400))`, and your new rating is rounded and never drops below 100. New profiles start at 1000. Your rating is also your matchmaking `skillLevel`, and RTDB rules require it to be between 0 and 3000.

### Can the AI see my hidden cards?
No. Its decisions read the pile, its own cards, and the total number of cards you have left (to spot when you are on your last one). It never reads your hand or face-down values.
