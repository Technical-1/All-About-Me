# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Swift | 5.0 mode, Xcode 26 toolchain | Native platform language; the app is entirely framework-bound |
| UI | SwiftUI | iOS 17.6+ | Declarative gesture handling and accessibility actions come for free |
| Photo access | PhotoKit | iOS 17.6+ | The only sanctioned way to read, cache and delete library assets |
| Text recognition | Vision | iOS 17.6+ | Runs on-device, which is the product's core privacy claim |
| Reachability | Network | iOS 17.6+ | `NWPathMonitor` decides whether an iCloud round-trip is worth attempting |
| Persistence | UserDefaults | Native | The data is a set, a list and a totals record; no relational shape to model |

**No third-party dependencies.** Zero Swift Package Manager packages — everything is a system framework.

## Frontend

- **Framework**: SwiftUI throughout; UIKit appears only at the edges — `UIImage` for decoded assets, a `UIColor` dynamic provider for interface-style-aware colours, `UIPasteboard` for copy, and feedback generators for haptics
- **State Management**: `@StateObject` / `@EnvironmentObject` over a single `ObservableObject`, with a `@MainActor` loader object per rendered asset
- **Sharing and export**: `ShareLink` and `.fileExporter` rather than bridging `UIActivityViewController`
- **Gestures**: `DragGesture`, `TapGesture(count: 2)`, `LongPressGesture`, `MagnifyGesture`
- **Accessibility**: Named `.accessibilityAction` entries, `accessibilityReduceMotion`, `accessibilityVoiceOverEnabled`, Dynamic Type, and a WCAG AA colour palette resolved per interface style (`AccessibleColors.swift`)
- **Assets**: App icon with light, dark and tinted variants; a vector template-rendered logo in About so it follows the foreground colour in dark mode
- **Layout**: `GeometryReader` for size-dependent image requests

## Platform

- **Target**: iPhone only (`TARGETED_DEVICE_FAMILY = 1`), portrait
- **Deployment target**: iOS 17.6
- **Distribution**: Built for the App Store (version 1.0, build 3 submitted), signed with automatic provisioning; bundle ID `Kanfer.PixScan`
- **Privacy manifest**: `PrivacyInfo.xcprivacy`, declaring UserDefaults access (reason `CA92.1`), no tracking and no collected data types
- **Export compliance**: `ITSAppUsesNonExemptEncryption = NO` set in build settings

## Infrastructure

- **Hosting**: Native iOS app; no backend of any kind
- **Marketing site**: Static HTML on Vercel, carrying the privacy policy the App Store requires to be publicly reachable
- **CI/CD**: No hosted CI. Releases follow a written runbook: `xcodebuild` archive and export, then `xcrun altool` validate and upload authenticated with an App Store Connect API key (key files are gitignored)
- **Monitoring**: None. No analytics, no crash reporting, no network requests of the app's own

## Development Tools

- **IDE**: Xcode 26
- **Package Manager**: none needed — zero third-party packages
- **Unit testing**: Swift Testing (`@Test`, `#expect`, `@Suite(.serialized)`) — 121 tests across seven files
- **UI testing**: XCUITest with `XCTSkipUnless` guards for an empty simulator library — 24 tests, plus an `AppStoreShots` capture test that walks the real deck and saves each card as a screenshot attachment
- **Screenshot generation**: A Python script (`docs/app-store/marketing/build_screenshots.py`) renders HTML canvases at 1320 x 2868 with headless Chrome at 2x, downsamples with Pillow, and resamples a 1284 x 2778 set, so marketing layout stays editable text rather than a flattened image

## Key Dependencies

All system frameworks; the table records what each is actually load-bearing for.

| Framework | Purpose |
|-----------|---------|
| `Photos` (PhotoKit) | Asset fetching, `PHCachingImageManager` prefetch, change observation, batch deletion |
| `Vision` | `VNRecognizeTextRequest` at `.accurate` with language correction |
| `Network` | `NWPathMonitor` reachability, gating network access on image requests |
| `SwiftUI` | Entire UI, gesture and accessibility layer |
| `UniformTypeIdentifiers` | `FileDocument` conformance for `.txt` export |
| `StoreKit` | `SKStoreReviewController` review prompt, requested once after 500 reviewed photos |
