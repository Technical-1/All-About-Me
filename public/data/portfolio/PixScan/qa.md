# Project Q&A

## Overview

PixScan is an iPhone app for getting through a camera roll that has grown past the point of browsing. Photos are presented one at a time and dismissed with a swipe: keep, delete, or read the text off the photo first and let the photo go. Text recognition runs on-device through Apple's Vision framework, and the app makes no network requests of its own. The interesting engineering problem is not the swiping — it is that a real camera roll is mostly *not on the device*, and behaving correctly against a partially-resident, iCloud-backed library is where most of the work went.

## Problem Solved

Camera rolls accumulate screenshots taken for a single piece of information — a confirmation number, a wifi password, a total owed — and then never get opened again. Browsing them is unrewarding enough that the backlog grows indefinitely. PixScan reduces the decision to one gesture per photo, and removes the reason to keep many of them at all by extracting the text first.

## Target Users

- **Anyone with a years-old library** — a way to make progress in short sessions, with position saved between them
- **People who screenshot as note-taking** — receipts, confirmations and whiteboards become searchable text that outlives the image
- **Privacy-conscious users** — no account, no server, and no network requests originating from the app

## Key Features

### Four-direction triage
Swipe right to keep, left to delete, up or down to extract text before deciding. Double tap undoes the last decision, and a long press opens the photo full screen with pinch-to-zoom.

### Deletion you confirm, not deletion that happens
Swiping left marks a photo rather than deleting it. Deletion runs as a batch through `PHPhotoLibrary.performChanges`, so iOS presents its own confirmation and the photos remain recoverable in Recently Deleted for 30 days. The queue shows how much space the batch will reclaim before anything is committed.

### A searchable text library
Every extraction records the photo it came from and shows its thumbnail. Search highlights matches in place, entries sort by date or length, swipe actions are user-remappable, and the whole library exports as a `.txt` file.

### Running totals
After a batch deletion, the app reports what that batch removed and what has been removed across the app's lifetime — photos deleted, space freed, photos reviewed and text extractions.

### Usable without sight
The four decisions and undo are exposed as named accessibility actions, so the app's primary task is completable with VoiceOver, and addressable by name with Voice Control.

## Technical Highlights

### Modelling PhotoKit's result dictionary instead of discarding it
`PHImageManager.requestImage` reports its outcome through an info dictionary carrying degraded, in-cloud, cancelled and error flags. Collapsing that to a bare `UIImage?` makes four distinct outcomes indistinguishable, and under `.opportunistic` delivery — which invokes the handler more than once — a later nil silently overwrites an already-good image. `ImageRequestResult` in `PhotoImageLoader.swift` captures every flag, and the loader maps them onto an explicit state machine whose `partial` case means "we have something usable and could not get better". That case is what lets an offline device keep showing the cached thumbnail it genuinely has, instead of drawing an error over a perfectly good picture.

### Making prefetch actually hit
`PHCachingImageManager` only serves a prefetched result when the target size, content mode *and* options of the live request match what the prefetch was primed with. Priming with `options: nil` while requesting with a configured object means every lookup misses, and the prefetch becomes pure cost. Both paths in `PhotoViewModel.swift` now build options from one factory, and the prefetch window is bounded and released as it slides rather than growing for the length of the session.

### Measuring before destroying
Reporting freed space requires the size of assets that are about to stop existing. `processBatchDeletion` measures the batch to completion on a background queue *before* issuing the change request; an earlier version ran the two concurrently and the deletion regularly won, reporting zero bytes freed. Sizes come from `AssetSizeReader`, which probes for a KVC-only property through the Objective-C runtime before touching it — `value(forKey:)` raises an ObjC exception on a missing key, which Swift cannot catch, so the unguarded version would crash rather than degrade.

### Giving a gesture-driven app a non-gesture path
Every decision routed exclusively through `DragGesture`, and VoiceOver consumes swipes for its own navigation, so the app's primary task could not be completed with it running. The photo card in `ContentView.swift` now exposes Keep, Delete, both extract variants and Undo as named accessibility actions that call the same handlers the gestures call, rather than a parallel implementation that would drift out of step.

## Engineering Decisions

### On-device recognition over a cloud OCR service
- **Constraint**: The product's central claim is that photos never leave the device
- **Options**: A hosted OCR API with better accuracy on hard inputs, or Apple's Vision framework
- **Choice**: Vision, at `.accurate` with language correction
- **Why**: A cloud call would require uploading the photo, which contradicts the reason to install the app. It also removes the entire surface of an API key, rate limits and an offline failure mode.

### UserDefaults over Core Data or SwiftData
- **Constraint**: The persisted data is a set of identifiers, a list of text entries and a small totals record
- **Options**: A managed store with migrations, or JSON-encoded values in `UserDefaults`
- **Choice**: `UserDefaults`, with debounced writes and a hand-written decoder
- **Why**: There is no relational shape to model, so a database would add a migration surface without buying anything. The decoder matters more than the store: Swift's synthesised one requires every key to be present, so adding a stat in a later release would fail to decode and silently discard the user's history. Decoding field by field with defaults removes that failure mode.

### Counting events rather than deriving them
- **Constraint**: Lifetime totals cannot be computed from current state — the delete queue empties on success and reviewed photos are cleared by "Start Over"
- **Options**: Derive from live state, or persist counters incremented at the point of each event
- **Choice**: Persisted counters, decremented on undo
- **Why**: Derivation under-reports permanently and was already doing so: the progress bar's "deleted" figure was reading the queue's length, so it reset to zero the moment the queue was emptied.

### One view model rather than several
- **Constraint**: Deck state, delete queue, extracted text and totals all interact — deleting affects the queue, the deck and the totals at once
- **Options**: Split by feature, or a single observable object
- **Choice**: A single `PhotoViewModel`
- **Why**: Splitting would require the pieces to observe each other for every cross-cutting operation. At this size the coupling is the honest description of the domain, and the seams that matter for testing were introduced as protocols instead.

## Frequently Asked Questions

### What happens when a photo is not downloaded from iCloud?
The app shows real download progress rather than a blank frame. If the device is offline, requests refuse network access so PhotoKit fails immediately with a "not downloaded" state rather than blocking on a transfer that cannot succeed — and any locally cached thumbnail is still shown. When connectivity returns, failed requests re-issue on their own.

### Does swiping left delete a photo immediately?
No. It marks the photo. Deletion happens when you confirm a batch, runs through `PHPhotoLibrary.performChanges` so iOS presents its own confirmation, and the photos go to Recently Deleted where they stay recoverable for 30 days.

### Can the app be used with VoiceOver?
Yes. The photo card exposes Keep, Delete, Extract text and keep, Extract text and delete, and Undo as named actions in the rotor, and Voice Control can address them by name. The first-run walkthrough offers a skip when VoiceOver is running, since its practice step advances only once each gesture has been performed.

### How accurate is the reported space saved?
Sizes come from a property that iOS exposes only through key-value coding. Where it is available the number is measured; where it is not, the app estimates from pixel count and prefixes the figure with `~`. A total is only presented as exact when every contributing size was.

### Why does extracted text keep a thumbnail of the source photo?
So an extraction can be traced back to what produced it. Entries record the asset identifier at extraction time and resolve it when the library is displayed. If the source photo was deleted the thumbnail is simply absent — the text survives the photo, which is the point.

### What is the screenshots-only filter matching on?
The PhotoKit media subtype `photoScreenshot`, so it reflects how iOS itself classifies the asset rather than guessing from dimensions. Reviewed photos are tracked by identifier across both modes, so switching filters never re-presents something already decided.

### Does the app work without a network connection?
Entirely, for anything already on the device. Text recognition is local, persistence is local, and there is no server to reach. The only thing a connection affects is fetching full-resolution photos that live in iCloud.

### How is it tested?
118 unit tests under Swift Testing cover the model, persistence, size and contrast arithmetic, and the accessibility surface, with protocol seams standing in for PhotoKit and the photo library. 25 UI tests drive the real app, and a separate suite generates the App Store screenshots by walking the running app rather than assembling them by hand.
