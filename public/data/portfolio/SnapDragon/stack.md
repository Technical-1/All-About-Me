# Technology Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language (app) | Swift | Swift 5 language mode | Native iOS, and value types fit a card-game state model |
| UI | SwiftUI | iOS/iPadOS 17.4+ deployment target | Declarative views driven straight from a `Game` value; uses the two-parameter `onChange` from iOS 17 |
| Language (server) | TypeScript | ^5.5.4 (strict mode, ES2021 target) | Type-checked port of the game rules for the authoritative server |
| Server runtime | Cloud Functions on Node.js | Node 24 (`engines` and `runtime: nodejs24`) | Serverless callables with no infrastructure to run for a hobby-scale game |
| Backend | Firebase | `firebase-ios-sdk` up to next major from 11.14.0 | Auth, two databases, functions and emulators under one SDK and CLI |
| Testing | XCTest, Jest, Mocha | Jest ^29.7.0, Mocha ^11.0.0 | One harness per layer: Swift rules, server rules and callables, security rules |

## Frontend (iOS App)

- **Framework**: SwiftUI with `NavigationStack`, `.navigationDestination` and sheets
- **State Management**: `@State` holding the `Game` struct for local play; `ObservableObject` classes (`FirebaseManager`, `OnlineGameManager`, `MatchmakingService`) with `@Published` for online state; `@MainActor` on the Firebase-facing classes
- **Concurrency**: async/await for callables and RTDB writes
- **Styling**: Native SwiftUI modifiers with a dark blue `LinearGradient` theme
- **Build Tool**: Xcode project with Swift Package Manager dependencies

## Backend (Firebase)

- **Runtime**: Node.js 24, 2nd-gen Cloud Functions (`firebase-functions/v2/https` `onCall`, `firebase-functions/v2/scheduler` `onSchedule`)
- **API Style**: Firebase callable functions: `createOnlineGame`, `applyMove`, `ensureProfile`
- **Scheduled jobs**: `pruneConsents`, every 24 hours
- **Auth**: Firebase Anonymous Auth; every callable rejects calls without `req.auth.uid`
- **Primary Database**: Cloud Firestore (`games` public, private and secret docs; `players` profiles)
- **Secondary Database**: Realtime Database (`matchmaking`, `game_consents`, `match_notifications`, `presence`)
- **Randomness**: `crypto.randomInt` feeding a Fisher-Yates shuffle for server deals

## Infrastructure

- **Hosting**: Firebase (Functions, Firestore, Realtime Database, Auth); the scheduled function needs the Blaze plan
- **CI/CD**: none; builds run from Xcode and deploys run through `firebase deploy`
- **Monitoring**: Cloud Functions logs (`console.warn` / `console.log`); no app analytics is wired up
- **Emulators**: Firebase Emulator Suite: Firestore 8080, Realtime Database 9000, Functions 5001, emulator UI enabled

## Development Tools

- **Package Managers**: Swift Package Manager (app), npm (`functions/`, `firebase-tests/`)
- **Type checking**: `tsc` with `strict: true`
- **Linting / Formatting**: Xcode warnings and default formatting; no ESLint or SwiftLint configured
- **Testing**:
  - XCTest: 106 tests in `SnapDragonTests/` (GameLogic 43, GameAI 14, ScoreManager 21, Security 28)
  - Jest + ts-jest: 52 tests in `functions/test/` (27 pure game-logic tests, 25 callable tests run against the Firestore and RTDB emulators with `npm run test:emu`)
  - Mocha + `@firebase/rules-unit-testing`: 35 rules tests in `firebase-tests/` (Firestore games, matches and players; hardening; RTDB matchmaking)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `FirebaseAuth` | Anonymous sign-in for online play |
| `FirebaseFirestore` | Snapshot listeners on game projections and the live player profile |
| `FirebaseDatabase` | Matchmaking queue, consent tokens, match notifications, presence with `onDisconnectRemoveValue()` |
| `FirebaseFunctions` | Calling `createOnlineGame`, `applyMove` and `ensureProfile` |
| `firebase-functions` (^7.2.5) | Callable and scheduled function triggers |
| `firebase-admin` (^13.10.0) | Server-side Firestore transactions and RTDB access that bypass client rules |
| `ts-jest` (^29.2.5) | Running the TypeScript server tests under Jest |
| `@firebase/rules-unit-testing` (^3.0.4) | Asserting allow and deny outcomes against the rules in the emulator |

The Xcode project also links `FirebaseAnalytics`, `FirebaseMessaging` and `FirebaseAI`, but no app code imports them yet.

## Local Storage

| Mechanism | Purpose |
|-----------|---------|
| `UserDefaults` | Local game history (with a corrupt-data backup key), recent player names, last-used player name |

## Security & Quality

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| Game integrity | `applyMove` / `createOnlineGame` | Server deals and validates every move; clients cannot write game docs |
| Card visibility | Public / `private/{uid}` / `secret/state` docs | Rules limit each player to their own hidden cards; nobody can read the deck |
| Match creation | Mutual RTDB consent tokens | A game is only dealt when both players agreed to that pairing |
| Ratings | Server-owned `players/{uid}` | Stats and ELO are written only by Cloud Functions |
| Input | `InputSanitizer` + `ScoreManager` | Name sanitization at entry and again at persistence; the server also trims and caps display names at 40 characters |
| Logging | `GameLogger` with `@autoclosure` | Debug-only logging with nothing printed in release builds |
