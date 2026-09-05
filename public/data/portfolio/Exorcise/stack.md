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

## Infrastructure

- **Project generation**: [XcodeGen](https://github.com/yonaskolb/XcodeGen) — `project.yml` is the source of truth; the `.xcodeproj` is disposable
- **Signing**: Developer ID (keeps the Photos permission grant stable across rebuilds)
- **CI/CD**: None — local `xcodebuild` builds and tests
- **Distribution**: Local install; notarized DMG is the intended path when published

## Development Tools

- **Testing**: Swift Testing (`@Test`/`#expect`) for the pure logic; a flag-gated in-app self-test (`--autotest`) exercises the full pipeline against a real library and cleans up after itself
- **Icon pipeline**: `scripts/generate-icon.swift` draws the app icon with CoreGraphics and emits the full `.appiconset`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| — | No third-party dependencies. PhotoKit, SQLite3, Vision, and AppKit/SwiftUI are all system frameworks |
