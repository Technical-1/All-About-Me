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

- **Framework**: SwiftUI throughout; the only UIKit surfaces are `UIImage` for decoded assets and a `UIColor` dynamic provider for interface-style-aware colours
- **State Management**: `@StateObject` / `@EnvironmentObject` over a single `ObservableObject`, with a `@MainActor` loader object per rendered asset
- **Sharing and export**: `ShareLink` and `.fileExporter` rather than bridging `UIActivityViewController`
- **Gestures**: `DragGesture`, `TapGesture(count: 2)`, `LongPressGesture`, `MagnifyGesture`
- **Accessibility**: Named `.accessibilityAction` entries, `accessibilityReduceMotion`, `accessibilityVoiceOverEnabled`, Dynamic Type, and a WCAG AA colour palette resolved per interface style
- **Layout**: `GeometryReader` for size-dependent image requests

## Platform

- **Target**: iPhone only (`TARGETED_DEVICE_FAMILY = 1`), portrait
- **Deployment target**: iOS 17.6
- **Distribution**: App Store, signed with automatic provisioning
- **Privacy manifest**: `PrivacyInfo.xcprivacy`, declaring UserDefaults access and no tracking

## Infrastructure

- **Hosting**: Native iOS app; no backend of any kind
- **Marketing site**: Static HTML on Vercel, carrying the privacy policy the App Store requires to be publicly reachable
- **CI/CD**: `xcodebuild` archive, export, validate and upload driven by an App Store Connect API key
- **Monitoring**: None. No analytics, no crash reporting, no network requests of the app's own

## Development Tools

- **IDE**: Xcode 26
- **Unit testing**: Swift Testing (`@Test`, `#expect`, `@Suite(.serialized)`) — 118 tests
- **UI testing**: XCUITest with conditional skips — 25 tests, plus a suite that regenerates App Store screenshots by driving the real app
- **Screenshot generation**: Headless Chrome rendering HTML canvases at App Store dimensions, so marketing layout stays editable text rather than a flattened image

## Key Dependencies

All system frameworks; the table records what each is actually load-bearing for.

| Framework | Purpose |
|-----------|---------|
| `Photos` / `PhotosUI` | Asset fetching, `PHCachingImageManager` prefetch, change observation, batch deletion |
| `Vision` | `VNRecognizeTextRequest` at `.accurate` with language correction |
| `Network` | `NWPathMonitor` reachability, gating network access on image requests |
| `SwiftUI` | Entire UI, gesture and accessibility layer |
| `UniformTypeIdentifiers` | `FileDocument` conformance for `.txt` export |
| `StoreKit` | `SKStoreReviewController` review prompt after sustained use |
