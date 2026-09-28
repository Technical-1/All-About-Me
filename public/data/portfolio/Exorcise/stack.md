# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Swift | 5 (strict concurrency: complete) | Native PhotoKit access; strict checking catches actor-isolation bugs at compile time |
| UI | SwiftUI | macOS 14+ | Declarative screens map cleanly to the app's linear flow; Observation framework removes boilerplate |
| Photos access | PhotoKit | macOS 14 SDK | The only sanctioned way to fetch assets and write albums in the sandbox |
| People data | SQLite (C API) | system `SQLite3` module | Reads the Photos library database directly — no wrapper dependency needed for four queries |
| State | Observation framework (`@Observable`) | macOS 14+ | Finer-grained view updates than `ObservableObject` with less ceremony |

## App

- **Architecture**: Single `@MainActor` observable manager; pure-function classification; thin views
- **Concurrency**: Swift Concurrency throughout — detached tasks for library work, generation tokens for cancellation safety
- **Images**: `PHCachingImageManager` with a bounded warm-up for large grids
- **Sandbox**: App Sandbox with Photos permission and read-only Pictures access; no network entitlement at all
- **Accessibility**: SwiftUI accessibility labels, values and custom actions; VoiceOver, Voice Control, Dark Interface, Differentiate Without Color and Reduced Motion

## Infrastructure

- **Project generation**: [XcodeGen](https://github.com/yonaskolb/XcodeGen) — `project.yml` is the source of truth; the `.xcodeproj` is disposable
- **Signing**: Developer ID for local builds (keeps the Photos permission grant stable across rebuilds); Apple Distribution for the Mac App Store archive
- **CI/CD**: None — local `xcodebuild` builds and tests
- **Distribution**: Mac App Store; listing copy and review notes live in `docs/app-store/`, generated screenshots and the social card in `marketing/`

## Development Tools

- **Testing**: Swift Testing (`@Test`/`#expect`) for the pure logic (classification, result counts, burst frame totals, count wording, pruning deleted photos from the snapshot); flag-gated in-app modes exercise the real library — `--autotest` (Debug builds only, since it writes to the library) runs the full album pipeline end-to-end and cleans up after itself (never the delete path), `--face-probe` verifies the face-geometry coordinate convention against Vision, `--vision-spike` benchmarks on-device face-identity accuracy; a staged `--screenshot-scene` mode renders the real UI over credited stock photos so App Store screenshots are reproducible from a Release build and never show a real library
- **Icon pipeline**: `scripts/generate-icon.swift` draws the app icon with CoreGraphics and emits the full `.appiconset`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| — | No third-party dependencies. PhotoKit, SQLite3, Vision, and AppKit/SwiftUI are all system frameworks |
