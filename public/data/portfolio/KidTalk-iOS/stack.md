# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Swift | 5 | Native target; no cross-platform layer wanted |
| UI | SwiftUI | iOS 17.6+ | `@Observable` lands in 17, which is what the state model relies on |
| Backend | Firebase (Auth + Firestore) | 12.x via SPM | Already backed the web app — same project, same data, no second backend |
| AI | Anthropic Claude Haiku 4.5 | — | Called through the web app's existing Vercel proxy, so the API key never ships in the binary |

## Frontend

- **Framework**: SwiftUI, iPhone (portrait-only) + iPad (all orientations, multitasking)
- **State Management**: `@Observable` classes (one per tab) owned by `ContentView` and injected;
  `@Environment` for cross-cutting services (theme, auth, onboarding)
- **Styling**: hand-ported design tokens in `KidTalk/Theme/Theme.swift` — the web Tailwind palette
  as Swift constants, with light/dark pairs resolved through `UITraitCollection`
- **Fonts**: Nunito 400–800 bundled as TTFs, so typography matches the website rather than
  approximating it with the system font
- **Build Tool**: xcodebuild; the project uses Xcode 16+ synchronized folder groups, so adding a
  file needs no project-file edit and produces no merge conflict

## Backend

- **Runtime**: none of our own — the iOS app is a client
- **API Style**: REST over `URLSession` against two Vercel functions (`ai-translate`, `ai-encode`)
  on `kidtalktranslator.app`
- **Auth**: Firebase Auth. Sign in with Apple via native `ASAuthorizationAppleIDProvider` with a
  SHA-256 nonce; Google via the native GoogleSignIn SDK (`GIDSignIn` → `GoogleAuthProvider`
  credential), so the account picker is the system one rather than a web popup
- **Data integrity**: enforced in Firestore security rules (counter changes bound to the caller's
  own vote document written in the same transaction, daily submission cap,
  `netScore == upvotes − downvotes`), not in client code
- **Moderation**: report and block on every submission; a `moderator` custom claim gates the
  web dashboard and every privileged rule; Cloud Functions auto-approve at 25 verified net
  upvotes (held if reported) and alert a human on every report

## Infrastructure

- **Hosting**: App Store distribution; the API and database are shared with the web deployment
- **CI/CD**: none — local `xcodebuild` and the runbook in `docs/app-store/CHECKLIST.md`
- **Monitoring**: none

## Development Tools

- **Package Manager**: Swift Package Manager (Firebase, GoogleSignIn)
- **Linting**: compiler warnings; no SwiftLint
- **Testing**: Swift Testing for units (83 tests), XCUITest for UI (27 tests, including iPad
  layout, multitasking, the Community age gate and App Store capture suites)
- **Scripts**: `scripts/sim.sh` (build/run/test/screenshot), `scripts/shots.sh` (capture screenshots
  and export them out of the `.xcresult`), `scripts/export-dictionary.mjs` (regenerate the bundled
  dictionary from the web repo)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `FirebaseAuth` | Sign in with Apple and Google; session persistence in the keychain |
| `FirebaseFirestore` | Community submissions, votes, reports, blocks, the published dictionary, live snapshot listeners, transactions |
| `GoogleSignIn` | Native Google account picker; yields the ID token Firebase exchanges for a session |
| `AuthenticationServices` | Native Apple sign-in sheet |
| `CryptoKit` | SHA-256 for the sign-in nonce and the submission blacklist |
| `AVFoundation` | Pronunciation playback |
| `DeclaredAgeRange` | iOS 26+ age-range request behind the Community age gate |

Firebase and GoogleSignIn are the only third-party dependencies. Everything else is a system
framework — the term matcher, caches, blacklist and glossary merge are all hand-written against
Foundation, which keeps the behaviour identical to the JavaScript originals rather than
approximately similar.
