# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | Swift | 5.0 | App + tests |
| UI | SwiftUI | iOS 18.2+ | Declarative UI; `@EnvironmentObject` for shared state |
| Audio API (primary) | MediaPlayer | iOS framework | Local-library playlists, playback, artwork |
| Audio API (fallback) | MusicKit | iOS framework | Apple Music catalog when MediaPlayer is unauthorized |
| DSP | AVFoundation + Accelerate (vDSP) | iOS framework | FFT, RMS, chroma features for real-audio analysis |
| Test | XCTest | iOS framework | 43 test cases across the pure-function, concurrency, and DSP layers |
| CI | GitHub Actions + `xcodebuild` | macos-15 runner | Build + test gate on push/PR |
| Build | Xcode | 16.2+ | iOS 18.2 SDK required |

## Architecture Pattern

- **UI**: SwiftUI views consuming two `ObservableObject` managers via `@EnvironmentObject`
- **State**: All shared mutable state lives in `MusicKitManager` and `PlayerManager`
  (`@StateObject` at the app root, injected into the view tree)
- **Persistence**: `Codable` JSON to `Documents/saved_optimized_playlists.json`;
  API keys to iOS Keychain (`SecItem*`)
- **Concurrency**: `async`/`await` + `DispatchGroup` + `DispatchQueue.global` for
  off-main work. A serial `stateQueue` guards thread-safe mutable state in the
  API client singletons and `SongTransitionAnalyzer`; the analyzer's expensive
  optimize phase (scoring + reorder + 2-opt) runs on its own serial queue, off
  the main thread.

## Frontend

- **Framework**: SwiftUI (iOS 18.2 minimum deployment)
- **Navigation**: `NavigationStack` throughout (iOS 16+ replacement for the
  deprecated `NavigationView`)
- **State Management**: Two-manager `ObservableObject` model + per-view `@State`
- **Image Loading**: Manual via `MPMediaItemArtwork.image(at:)`; results cached in a
  bounded `NSCache<NSString, UIImage>` (limit 200, auto-evicts under memory pressure)
- **Color Extraction**: Custom HSV-based dominant-color algorithm in
  `ColorExtraction.swift` (off-main via `extractAsync`)

## "Backend" (External APIs)

The app is a single-binary iOS client; there is no first-party backend.

- **Apple MediaPlayer / MusicKit**: built-in OS APIs
- **GetSongBPM**: `https://api.getsongbpm.com` — REST, `api_key=` query param,
  curated BPM/key/danceability database. Free with attribution.
- **Anthropic Claude**: `https://api.anthropic.com/v1/messages` — REST, using
  Claude 3.5 Haiku, batched track analysis (~$0.001/song)

## Infrastructure

- **Hosting**: N/A — distributed via the App Store (target). Marketing site at
  `docs/index.html` (GitHub Pages).
- **CI/CD**: GitHub Actions, two jobs:
  - `Build (iOS, no signing)` — `xcodebuild ... -destination 'generic/platform=iOS' clean build`
  - `Test (iOS Simulator, unit tests)` — picks an available simulator dynamically,
    `xcodebuild test` with `id=<UUID>` form
- **Signing**: Manual / per-developer. Provisioning profile `PlaylistMixer`
  (team `M7SN262HK4`, bundle `Kanfer.PlaylistMixer`)
- **Monitoring**: None (no backend; no analytics)

## Development Tools

- **Package Manager**: None (no SPM dependencies; everything is built-in frameworks)
- **Linting**: None currently (open follow-up)
- **Formatting**: None (no SwiftFormat / swift-format configured)
- **Testing**: XCTest, run via `xcodebuild test` on iOS Simulator
- **Logging**: Custom `appLog` in `Log.swift` — drop-in replacement for `print` that
  is compiled out of release builds via `#if DEBUG`

## Key Dependencies

The app has **zero third-party dependencies** — no SwiftPM packages, no CocoaPods,
no Carthage. Everything is either an iOS-framework import or first-party code.

### Imported iOS Frameworks

| Framework | Purpose |
|---|---|
| `SwiftUI` | All view code |
| `MediaPlayer` | Playlist + track fetching, playback, artwork |
| `MusicKit` | Catalog search, library playlist creation |
| `AVFoundation` | Audio file reading, audio session category |
| `Accelerate` (vDSP) | FFT, RMS, dot product, vector ops |
| `PhotosUI` | `PhotosPicker` for custom artwork selection |
| `Security` | `SecItem*` Keychain access |
| `Foundation` | `URLSession`, `JSONDecoder`/`Encoder`, `Codable` |
| `XCTest` (test target only) | Unit tests |

## File Layout

```
PlaylistMixer/
├── PlaylistMixerApp.swift         # @main App, @StateObject managers
├── SplashScreenView.swift         # 0.8s tap-skippable splash
├── ContentView.swift              # TabView root + most sub-views
├── OptimizedPlaylistView.swift    # Optimize flow + VibeSplitView
├── MiniPlayerView.swift           # Mini player + QueueView + ArtworkColorExtractor
├── FullPlayerView.swift           # Full-screen now playing
├── ClaudeSettingsView.swift       # Claude API key settings
├── GetSongBPMSettingsView.swift   # GetSongBPM API key settings
├── ArtworkImage.swift             # Lazy artwork loader (off-main)
├── PlaylistArtworkManager.swift   # Bounded NSCache for artwork
├── ColorExtraction.swift          # Shared dominant-color algorithm
│
├── MusicKitManager.swift          # Apple Music auth/fetch/persist
├── PlayerManager.swift            # MPMusicPlayerController wrapper
├── SongTransitionAnalyzer.swift   # Cascade + greedy + 2-opt
├── AudioAnalyzer.swift            # FFT-based BPM/key/energy
├── ClaudeAPI.swift                # Claude REST client
├── GetSongBPMAPI.swift            # GetSongBPM REST client
├── Keychain.swift                 # SecItem* wrapper
│
├── Track.swift                    # Identifiable Track model
├── Playlist.swift                 # Identifiable Playlist model
├── Log.swift                      # appLog (#if DEBUG)
│
└── Assets.xcassets, Preview Content

PlaylistMixerTests/
├── StableHashTests.swift          # FNV-1a determinism (5 tests)
├── TempoScoreTests.swift          # Lorentzian falloff (7)
├── KeyScoringTests.swift          # Mode-aware Camelot (10)
├── GenreLookupTests.swift         # findMatchingGenre direction (8)
├── KeychainTests.swift            # Round-trip; XCTSkip if unsigned (7)
├── FallbackSeedCacheTests.swift   # Seed-dependent fallback caching (2)
└── EnergyAnalysisTests.swift      # Short-track energy guard (4)
```

## Notable Build Settings

| Setting | Value | Why |
|---|---|---|
| `IPHONEOS_DEPLOYMENT_TARGET` | 18.2 | MusicKit's `MusicLibraryRequest.filter` API + NavigationStack |
| `ENABLE_TESTABILITY` | YES (Debug) | `@testable import PlaylistMixer` for tests |
| `SWIFT_VERSION` | 5.0 | Stable; Swift 6 strict concurrency migration is deferred |
| `INFOPLIST_KEY_CFBundleDisplayName` | SmoothQueue | Display name override (target/bundle remain "PlaylistMixer") |
| `INFOPLIST_KEY_NSAppleMusicUsageDescription` | (descriptive string) | Required for MusicKit auth prompt |
| File system synchronized groups | YES | Adding new `.swift` files needs no `project.pbxproj` edits |
