# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | Swift | 5.9+ | Primary development language |
| UI Framework | SwiftUI | iOS 17+ | Declarative UI with gesture support |
| OCR Engine | Apple Vision | iOS 17+ | On-device text recognition |
| Photo Access | PhotoKit (Photos) | iOS 17+ | Photo library read/write/delete |
| Persistence | UserDefaults | Native | Session state across app launches |

## Frontend

- **Framework**: SwiftUI (100% — no UIKit views except share sheets)
- **State Management**: `@StateObject` / `@EnvironmentObject` with `ObservableObject` (MVVM)
- **Styling**: Native SwiftUI modifiers, custom `ButtonPress` ViewModifier for press effects
- **Navigation**: `NavigationStack` with `.sheet()` presentations
- **Gestures**: `DragGesture`, `TapGesture(count: 2)`, `LongPressGesture`, `MagnifyGesture`, `Menu`
- **Layout**: `GeometryReader` for responsive sizing (replaces deprecated `UIScreen.main`)

## Infrastructure

- **Hosting**: Native iOS app (App Store / TestFlight)
- **CI/CD**: Xcode build system
- **Monitoring**: Console logging (`print()` with DEBUG flags)

## Development Tools

- **IDE**: Xcode 16.2+
- **Build System**: Xcode native with `PBXFileSystemSynchronizedRootGroup` (auto-discovers new files)
- **Package Manager**: None (zero external dependencies)
- **Unit Testing**: Swift Testing framework (`@Test`, `#expect`) with `@Suite(.serialized)` — 32 tests
- **UI Testing**: XCTest / XCUITest with conditional skips (`XCTSkipUnless`) — 25 tests

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `SwiftUI` | Entire UI layer — views, gestures, navigation, animations |
| `Photos` | Fetch photo assets, request permissions, batch-delete photos |
| `Vision` | `VNRecognizeTextRequest` for accurate OCR with language correction |
| `UIKit` | `UIActivityViewController` for share sheet, `UIImpactFeedbackGenerator` for haptics |
| `Foundation` | `UserDefaults` for persistence, `DispatchQueue` for threading |

## Notable Implementation Choices

### Zero External Dependencies
The project uses only Apple's native frameworks. This eliminates dependency management overhead, reduces app size, and ensures long-term stability without third-party breakage risk. The onboarding tutorial uses SF Symbol compositions on gradient backgrounds instead of bundled image assets, keeping the app binary minimal.

### Background Threading for OCR
OCR requests run on a `.userInitiated` quality-of-service background queue to keep the UI responsive while processing high-resolution images.

### Efficient Photo Loading with Prefetching
Photos are loaded on-demand with target size constraints. `PHCachingImageManager` prefetches the next 3 images ahead of the current index on every swipe, ensuring smooth transitions without loading the entire library into memory.

### Modular Architecture
The codebase is split into 16 focused Swift files (down from a monolithic 1,561-line ContentView). Each component has a single responsibility, making the code more maintainable and testable. Xcode 16's `PBXFileSystemSynchronizedRootGroup` automatically discovers new files without manual project configuration.

### Comprehensive Test Coverage
32 unit tests using Swift Testing (`@Test`, `#expect`) with `@Suite(.serialized)` validate model logic, persistence, onboarding data types, view instantiation, and safe subscript behavior. 25 UI tests with `XCTSkipUnless` conditional skips test smoke scenarios, onboarding flow elements, and photo-dependent interactions including instruction bar visibility and long-press full-screen viewer.

### App Store Deployment Ready
Includes a `PrivacyInfo.xcprivacy` privacy manifest declaring UserDefaults usage (CA92.1) and automatic code signing — all required for App Store submission. The interactive onboarding replaces the static launch screen, providing a better first-run experience.
