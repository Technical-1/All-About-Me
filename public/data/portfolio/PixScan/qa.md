# Project Q&A Knowledge Base

## Overview

PixScan is a privacy-focused iOS app that helps users efficiently manage their photo library by combining swipe-based curation with on-device OCR text extraction. It's designed for anyone who has accumulated thousands of photos and wants a fast, intuitive way to sort through them — keeping what matters, deleting what doesn't, and extracting text from receipts, screenshots, or documents along the way.

## Key Features

- **Swipe-Based Curation**: Four-direction swipe gestures for rapid photo triage — left to delete, right to keep, up/down to extract text. Inspired by the speed of dating app interfaces.
- **On-Device OCR**: Apple Vision framework extracts text from photos with accurate recognition and language correction, entirely on-device.
- **Smart Delete Queue**: Photos aren't deleted immediately. They're queued with preview, metadata, and batch operations so nothing is lost by accident.
- **Session Persistence**: Progress is saved to UserDefaults automatically. Close the app, come back later, and pick up exactly where you left off.
- **Text Export**: Search, copy, share, or save all extracted text as a `.txt` file.

## Technical Highlights

### Tinder-Style Photo Triage
I built the swipe interface using SwiftUI's `DragGesture`, mapping four distinct swipe directions to different actions. The card-style UI provides visual feedback — color-coded indicators, smooth animations, and haptic feedback — making it feel natural to process hundreds of photos in minutes.

### Vision Framework OCR Pipeline
The OCR pipeline loads full-resolution images on a background thread, runs `VNRecognizeTextRequest` with `.accurate` recognition level and language correction, then collects results back on the main thread. A caching mechanism (tracking processed photo IDs) prevents re-scanning photos that have already been processed.

### Lightweight Persistence Without a Database
Rather than introducing Core Data or SQLite for what's essentially a set of string identifiers, I used UserDefaults to store processed photo IDs as a serialized array. This keeps the app lightweight while ensuring users never lose their progress.

## Development Story

- **Hardest Part**: Getting the swipe gesture thresholds right so all four directions feel distinct and intentional. The diagonal edge cases required careful tuning of offset comparisons.
- **Lessons Learned**: UserDefaults works well for small state, but with very large photo libraries (10,000+), the serialized ID set could grow. A migration path to a more scalable store would be worth planning.
- **Future Plans**: Potential features include smart text categorization (receipts vs. documents vs. screenshots), iCloud sync for processed state across devices, and photo tagging/albums integration.

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
Each processed photo's unique identifier is saved to UserDefaults after you swipe it. When you relaunch the app, it loads this set of IDs and automatically skips to the first unprocessed photo. You can also reset all progress with the "Start Over" button.

### What would you improve?
I'd add smart text categorization to automatically group extracted text by type (receipts, documents, screenshots). I'd also consider migrating persistence from UserDefaults to SwiftData for better scalability with very large photo libraries, and add Spotlight integration so extracted text is searchable system-wide.
