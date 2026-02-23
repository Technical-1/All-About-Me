# Project Q&A Knowledge Base

## Overview

PixScan is a privacy-focused iOS app that helps users efficiently manage their photo library by combining swipe-based curation with on-device OCR text extraction. It's designed for anyone who has accumulated thousands of photos and wants a fast, intuitive way to sort through them — keeping what matters, deleting what doesn't, and extracting text from receipts, screenshots, or documents along the way.

## Key Features

- **Interactive Onboarding**: First-launch tutorial with practice swipe cards, mock sheets, and feature highlights. Users must perform each gesture (including opening the delete queue and OCR menu) to progress. Uses SF Symbol compositions on gradient backgrounds — zero bundled assets.
- **Swipe-Based Curation**: Four-direction swipe gestures for rapid photo triage — left to delete, right to keep, up/down to extract text. Inspired by the speed of dating app interfaces.
- **On-Device OCR**: Apple Vision framework extracts text from photos with accurate recognition and language correction, entirely on-device.
- **Smart Delete Queue**: Photos aren't deleted immediately. They're queued with preview, metadata, and batch operations so nothing is lost by accident.
- **Full Session Persistence**: Progress, OCR texts, and delete queue are all saved to UserDefaults automatically. Close the app, come back later, and pick up exactly where you left off — including your pending deletions and extracted text.
- **Text Export**: Search, copy, share, or save all extracted text as a `.txt` file.
- **Full-Screen Photo Viewer**: Long press any photo to open it full-screen with pinch-to-zoom (1x–5x), pan when zoomed, and double-tap to toggle zoom level.
- **Compact Instruction Bar**: Color-coded icon-based instruction panel showing all swipe actions at a glance.
- **Image Prefetching**: `PHCachingImageManager` prefetches upcoming images for smooth, lag-free swiping through large libraries.
- **Progress Tracking**: Live counter with animated progress bar showing photos processed, kept, deleted, and OCR'd.
- **Screenshot Filter Mode**: Toggle between all photos and screenshots-only via toolbar menu. Processed IDs are shared across modes so nothing is re-processed.
- **Storage Savings Display**: Auto-formatted GB/MB display on delete buttons showing exactly how much space will be freed.

## Technical Highlights

### Tinder-Style Photo Triage
I built the swipe interface using SwiftUI's `DragGesture`, mapping four distinct swipe directions to different actions. The card-style UI provides visual feedback — color-coded indicators, smooth animations, and haptic feedback — making it feel natural to process hundreds of photos in minutes.

### Vision Framework OCR Pipeline
The OCR pipeline loads full-resolution images on a background thread, runs `VNRecognizeTextRequest` with `.accurate` recognition level and language correction, then collects results back on the main thread. A caching mechanism (tracking processed photo IDs) prevents re-scanning photos that have already been processed.

### Lightweight Persistence Without a Database
Rather than introducing Core Data or SQLite, I used UserDefaults to store processed photo IDs as a serialized set, recognized OCR texts as JSON-encoded `Codable` structs, and the delete queue as an array of asset localIdentifiers. This keeps the app lightweight while ensuring users never lose their progress — not just which photos were swiped, but also their pending deletions and all extracted text.

### Modular Codebase from a Monolith
The original ContentView was 1,561 lines handling everything. I refactored it into 13 focused files — each view component, utility, and modifier in its own file. Xcode 16's `PBXFileSystemSynchronizedRootGroup` auto-discovers new `.swift` files, so the extraction required zero project file changes.

### Full-Screen Photo Viewer with Gesture Composition
The full-screen viewer combines `MagnifyGesture` and `DragGesture` using `.simultaneously()` so users can pinch-to-zoom while panning — a common pattern in photo apps. Pan offset is boundary-clamped based on the current zoom level to prevent the image from drifting off-screen. Double-tap toggles between 1x and 2x zoom with animation.

### Interactive Onboarding with State Machine
I built the onboarding as a four-step state machine (`OnboardingStep` enum) gated by `@AppStorage`. The practice swipe phase uses a secondary `PracticePhase` state machine to guide users through post-swipe interactions — tapping the trash icon to open a mock delete queue, or the OCR icon to view mock extracted text. Pulsing toolbar overlays animate with `.repeatForever(autoreverses: true)` to draw attention. The entire flow uses zero bundled image assets — all sample cards are SF Symbol compositions on gradient backgrounds, keeping the binary minimal.

### Filter-Agnostic State Tracking
I designed the `processedPhotoIds` set to be filter-agnostic — tracked by unique `localIdentifier` rather than by filter context. This means adding new browse modes (like screenshot-only filtering) requires zero changes to the persistence layer. The `FilterMode` enum controls only the `PHFetchOptions` predicate, while the processing state works identically across all modes.

### Comprehensive Test Suite
I built 32 unit tests using Swift Testing (`@Test`, `#expect`) with `@Suite(.serialized)` to avoid UserDefaults race conditions. Tests cover model logic, persistence round-trips, onboarding data types (step progression, sample card configuration, flag preservation), view instantiation, and edge cases. The 25 UI tests use `XCTSkipUnless` to gracefully skip photo-dependent and onboarding-gated tests, while onboarding flow tests verify welcome screen elements, practice swipe prompts, feature highlights content, and permission screen layout.

## Development Story

- **Hardest Part**: Getting the swipe gesture thresholds right so all four directions feel distinct and intentional. The diagonal edge cases required careful tuning of offset comparisons. Refactoring a 1,561-line monolith into modular components while maintaining identical behavior was also a significant effort.
- **Lessons Learned**: UserDefaults works well for small state, but with very large photo libraries (10,000+), the serialized ID set could grow. A migration path to SwiftData would be worth planning. Splitting code into separate files early prevents monolith accumulation.
- **Future Plans**: Potential features include smart text categorization (receipts vs. documents vs. screenshots), iCloud sync for processed state across devices, photo tagging/albums integration, and SwiftData migration for persistence.

## Frequently Asked Questions

### How does the onboarding work?
On first launch, the app shows an interactive tutorial instead of the main photo view. Users practice all four swipe gestures on sample cards, open the mock delete queue and OCR notes sheets, and learn about undo, full-screen preview, and screenshot filtering. The tutorial ends with a photo library permission request. An `@AppStorage` flag ensures onboarding only shows once — subsequent launches go directly to the main app.

### How does the OCR work?
PixScan uses Apple's Vision framework (`VNRecognizeTextRequest`) to perform optical character recognition entirely on-device. It loads the full-resolution image, runs text detection with the `.accurate` recognition level and language correction enabled, then stores the extracted text with a timestamp.

### Why did you choose SwiftUI over UIKit?
SwiftUI's declarative syntax made it significantly faster to build the gesture-driven UI. The `DragGesture` API, combined with `@Published` properties on the view model, creates a reactive pipeline where swipe actions flow naturally into state changes and UI updates.

### How does the app handle large photo libraries?
Photos are fetched as lightweight `PHAsset` references — not loaded into memory until displayed. Images are loaded on-demand with size constraints, and OCR runs on a background thread to keep the UI responsive. The processed-photo tracking prevents redundant work across sessions.

### What happens if I accidentally swipe a photo to delete?
Double-tap to immediately undo and go back to the previous photo. Even if you don't catch it right away, photos aren't deleted immediately — they're added to a review queue where you can preview them, deselect specific ones, or cancel the deletion entirely.

### Does the app upload my photos anywhere?
No. PixScan processes everything locally on your device using Apple's native frameworks. No photos, text, or metadata ever leave your device. There are no analytics, no cloud APIs, and no network calls.

### How is progress saved?
Each processed photo's unique identifier is saved to UserDefaults after you swipe it. Additionally, recognized OCR texts are persisted as JSON-encoded structs, and the delete queue is stored as an array of asset localIdentifiers. When you relaunch the app, it restores all three: processed photo set, extracted texts, and pending deletions. You can reset all progress with the "Start Over" button.

### How is the codebase organized?
The project follows MVVM with a single `PhotoViewModel` and 16 focused Swift files. The app entry point gates between `OnboardingView` (first launch) and `ContentView` (returning user) via `@AppStorage`. View components (`OnboardingView`, `PhotoCard`, `FullScreenPhotoView`, `InstructionBar`, `PhotoPermissionView`, `DeleteQueueView`, `OCRNotesView`, `PhotoThumbnail`, `PhotoPreview`, `ProgressStatsView`) are each in their own file. Shared utilities (`SwipeDirection`, `ButtonPress`, `Collection+Safe`, `ViewControllerUtils`) are extracted for reuse. Xcode 16's auto-discovery means no manual project file configuration when adding new files.

### How is the app tested?
32 unit tests using Swift Testing validate model logic (persistence, selection, onboarding data types, view instantiation, safe subscripts, Codable round-trips). 25 UI tests using XCTest cover onboarding flow (welcome screen, practice prompts, feature highlights, permission screen), smoke scenarios (launch, initial state), and photo-dependent interactions (swipe gestures, long-press full-screen viewer, delete queue sheet, OCR notes sheet). Tests use `XCTSkipUnless` to skip gracefully when gated by onboarding or missing photos.

### What would you improve?
I'd add smart text categorization to automatically group extracted text by type (receipts, documents, screenshots). I'd also consider migrating persistence from UserDefaults to SwiftData for better scalability with very large photo libraries, and add Spotlight integration so extracted text is searchable system-wide.
