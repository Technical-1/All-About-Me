# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | Swift | 6.0 (strict concurrency) | Strict concurrency is worth it in an app whose entire state crosses actor boundaries between HealthKit, CoreBluetooth delegates, and SwiftUI |
| UI framework | SwiftUI + `@Observable` | iOS 17 / macOS 14 | One UI paradigm across both apps; Observation avoids most ObservableObject boilerplate |
| Health data | HealthKit | iOS 17 SDK | The subject of the research itself |
| Bluetooth | CoreBluetooth | iOS 17 / macOS 14 SDK | Peripheral mode on macOS, central mode on iOS — the whole pipeline |
| Charts | Swift Charts | iOS 17 / macOS 14 | Native stacked bars and line sparklines with no dependency |

## Project Shape

- **Apps**: two — `StepTester` (iOS, the experiment surface) and `WearableSim` (macOS, the simulated band)
- **Shared code**: one local Swift package (`BTSimKit`) holding the wire contract and simulation engine
- **API style**: none — no network anywhere, by design. Health data never leaves the device
- **Auth**: HealthKit entitlement + purpose strings; Bluetooth needs only usage strings

## Development Tools

- **Project generation**: XcodeGen — `project.yml` is the source of truth; the `.xcodeproj` is generated and gitignored
- **Build orchestration**: Makefile (`generate`, `test`, `build-ios`, `install-ios`, `build-mac`, `run-mac`)
- **Testing**: Swift Testing (26 tests across 6 suites), run with `swift test` from the package directory
- **Signing**: automatic signing against a personal development team; every build passes `-allowProvisioningUpdates`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| *(none)* | Zero third-party dependencies — everything rides on Foundation, SwiftUI, HealthKit, CoreBluetooth, and Charts |

That absence is deliberate: a tool that audits how health data behaves should not smuggle in opaque binaries to do it, and the needed surface (GATT, codecs, queries, charts) is fully covered by system frameworks.
