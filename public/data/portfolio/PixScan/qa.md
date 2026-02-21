# Project Q&A Knowledge Base

## Overview

PixScan is a privacy-focused iOS app that helps users efficiently manage their photo library by combining swipe-based curation with on-device OCR text extraction. It's designed for anyone who has accumulated thousands of photos and wants a fast, intuitive way to sort through them — keeping what matters, deleting what doesn't, and extracting text from receipts, screenshots, or documents along the way.

## Key Features

- **Swipe-Based Curation**: Four-direction swipe gestures for rapid photo triage — left to delete, right to keep, up/down to extract text. Inspired by the speed of dating app interfaces.
- **On-Device OCR**: Apple Vision framework extracts text from photos with accurate recognition and language correction, entirely on-device.
- **Smart Delete Queue**: Photos aren't deleted immediately. They're queued with preview, metadata, and batch operations so nothing is lost by accident.
- **Full Session Persistence**: Progress, OCR texts, and delete queue are all saved to UserDefaults automatically. Close the app, come back later, and pick up exactly where you left off — including your pending deletions and extracted text.
- **Text Export**: Search, copy, share, or save all extracted text as a `.txt` file.
- **Image Prefetching**: `PHCachingImageManager` prefetches upcoming images for smooth, lag-free swiping through large libraries.

## Technical Highlights

### Tinder-Style Photo Triage
I built the swipe interface using SwiftUI's `DragGesture`, mapping four distinct swipe directions to different actions. The card-style UI provides visual feedback — color-coded indicators, smooth animations, and haptic feedback — making it feel natural to process hundreds of photos in minutes.

### Vision Framework OCR Pipeline
The OCR pipeline loads full-resolution images on a background thread, runs `VNRecognizeTextRequest` with `.accurate` recognition level and language correction, then collects results back on the main thread. A caching mechanism (tracking processed photo IDs) prevents re-scanning photos that have already been processed.

### Lightweight Persistence Without a Database
Rather than introducing Core Data or SQLite, I used UserDefaults to store processed photo IDs as a serialized set, recognized OCR texts as JSON-encoded `Codable` structs, and the delete queue as an array of asset localIdentifiers. This keeps the app lightweight while ensuring users never lose their progress — not just which photos were swiped, but also their pending deletions and all extracted text.

### Modular Codebase from a Monolith
The original ContentView was 1,561 lines handling everything. I refactored it into 13 focused files — each view component, utility, and modifier in its own file. Xcode 16's `PBXFileSystemSynchronizedRootGroup` auto-discovers new `.swift` files, so the extraction required zero project file changes.

### Comprehensive Test Suite
I built 12 unit tests using Swift Testing (`@Test`, `#expect`) covering model logic, persistence round-trips, and edge cases like empty identifiers and out-of-bounds subscripts. The 15 UI tests use `XCTSkipUnless` to gracefully skip photo-dependent tests on simulators without photos, while smoke tests (launch, toolbar icons, initial state) always run.

## Development Story

- **Hardest Part**: Getting the swipe gesture thresholds right so all four directions feel distinct and intentional. The diagonal edge cases required careful tuning of offset comparisons. Refactoring a 1,561-line monolith into modular components while maintaining identical behavior was also a significant effort.
- **Lessons Learned**: UserDefaults works well for small state, but with very large photo libraries (10,000+), the serialized ID set could grow. A migration path to SwiftData would be worth planning. Splitting code into separate files early prevents monolith accumulation.
- **Future Plans**: Potential features include smart text categorization (receipts vs. documents vs. screenshots), iCloud sync for processed state across devices, photo tagging/albums integration, and SwiftData migration for persistence.

## Frequently Asked Questions

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
The project follows MVVM with a single `PhotoViewModel` and 13 focused Swift files. View components (`PhotoCard`, `PhotoPermissionView`, `DeleteQueueView`, `OCRNotesView`, `PhotoThumbnail`, `PhotoPreview`) are each in their own file. Shared utilities (`SwipeDirection`, `ButtonPress`, `Collection+Safe`, `ViewControllerUtils`) are extracted for reuse. Xcode 16's auto-discovery means no manual project file configuration when adding new files.

### How is the app tested?
12 unit tests using Swift Testing validate model logic (persistence, selection, safe subscripts, Codable round-trips). 15 UI tests using XCTest cover smoke scenarios (launch, toolbar icons, initial state) and photo-dependent interactions (swipe gestures, delete queue sheet, OCR notes sheet). Photo-dependent tests use `XCTSkipUnless` to skip gracefully on simulators without photos.

### What would you improve?
I'd add smart text categorization to automatically group extracted text by type (receipts, documents, screenshots). I'd also consider migrating persistence from UserDefaults to SwiftData for better scalability with very large photo libraries, and add Spotlight integration so extracted text is searchable system-wide.
