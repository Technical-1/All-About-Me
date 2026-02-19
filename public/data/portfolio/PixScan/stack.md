# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | Swift | 5.9+ | Primary development language |
| UI Framework | SwiftUI | iOS 15+ | Declarative UI with gesture support |
| OCR Engine | Apple Vision | iOS 15+ | On-device text recognition |
| Photo Access | PhotoKit (Photos) | iOS 15+ | Photo library read/write/delete |
| Persistence | UserDefaults | Native | Session state across app launches |

## Frontend

- **Framework**: SwiftUI (100% — no UIKit views)
- **State Management**: `@StateObject` / `@ObservedObject` with `ObservableObject` (MVVM)
- **Styling**: Native SwiftUI modifiers, custom `ViewModifier` for button press effects
- **Navigation**: `NavigationView` with `.sheet()` presentations
- **Gestures**: `DragGesture`, `TapGesture(count: 2)`, `LongPressGesture`

## Infrastructure

- **Hosting**: Native iOS app (App Store / TestFlight)
- **CI/CD**: Xcode build system
- **Monitoring**: Console logging (`print()` with DEBUG flags)

## Development Tools

- **IDE**: Xcode 16.2
- **Build System**: Xcode native (no SPM, CocoaPods, or Carthage)
- **Package Manager**: None (zero external dependencies)
- **Testing**: XCTest (unit + UI test stubs present)

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
The project uses only Apple's native frameworks. This eliminates dependency management overhead, reduces app size, and ensures long-term stability without third-party breakage risk.

### Background Threading for OCR
OCR requests run on a `.userInitiated` quality-of-service background queue to keep the UI responsive while processing high-resolution images.

### Efficient Photo Loading
Photos are loaded on-demand with target size constraints rather than preloading the entire library. The `PHCachingImageManager` pattern ensures memory efficiency when dealing with large photo libraries.
