# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | Swift | 5.9+ | Primary language for all app logic and UI |
| Framework | SwiftUI | iOS 16+ | Declarative UI framework for all views |
| Backend | Firebase | Latest | Authentication, real-time sync, matchmaking |
| IDE | Xcode | 15.0+ | Build system and project management |

## Frontend (iOS App)

- **Framework**: SwiftUI (iOS 16+)
- **State Management**: `@State`, `@StateObject`, `@EnvironmentObject`, `@Published` (Combine-backed)
- **Styling**: Native SwiftUI modifiers with `LinearGradient` ocean-blue theme
- **Build Tool**: Xcode / Swift Package Manager
- **Navigation**: `NavigationStack` with `.navigationDestination` and `.sheet` modifiers

## Backend (Firebase)

- **Authentication**: Firebase Auth (Anonymous sign-in)
- **Primary Database**: Cloud Firestore (game state, player profiles, leaderboards)
- **Secondary Database**: Firebase Realtime Database (matchmaking queue)
- **Analytics**: Firebase Analytics (game events tracking)
- **Messaging**: Firebase Messaging (push notifications - SDK included)
- **AI**: Firebase AI SDK (included in dependencies)

## Infrastructure

- **Hosting**: Firebase (backend services)
- **CI/CD**: N/A (manual Xcode builds)
- **Emulators**: Firebase Emulator Suite (Firestore port 8080, RTDB port 9000)

## Development Tools

- **Package Manager**: Swift Package Manager (SPM)
- **Linting**: Xcode built-in warnings
- **Formatting**: Xcode default
- **Testing**: N/A (no test suite yet)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `FirebaseAuth` | Anonymous user authentication for online play |
| `FirebaseFirestore` | Document database for game state and player profiles |
| `FirebaseDatabase` | Realtime Database for matchmaking queue |
| `FirebaseAnalytics` | Game event tracking and user behavior analytics |
| `FirebaseAnalyticsCore` | Core analytics framework |
| `FirebaseAI` | Firebase AI integration (future features) |
| `FirebaseFunctions` | Cloud Functions for server-side matchmaking logic |
| `FirebaseMessaging` | Push notification support for match found alerts |

All Firebase packages are sourced from the official `firebase-ios-sdk` repository via Swift Package Manager.

## Local Storage

| Mechanism | Purpose |
|-----------|---------|
| `UserDefaults` | Game results history, recent player names, last used player name |
