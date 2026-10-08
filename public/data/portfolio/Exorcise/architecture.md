# Architecture

## System Diagram

```mermaid
flowchart TD
    subgraph Views
        Picker[PersonPickerView]
        Scanning[ScanningView]
        Results[ScanResultsView]
        Done[DoneView]
    end
    CV[ContentView\nlinear state machine] --> Picker & Scanning & Results & Done
    Picker & Scanning & Results --> PM[PhotosManager\n@MainActor @Observable]
    PM --> PDB[PeopleDatabase\nSQLite reader]
    PM --> PK[PhotoKit\nassets · thumbnails · albums · deletes]
    PDB --> Lib[(Photos.sqlite\ntemp copy)]
    PM --> SC[ScanClassifier\npure function]
    Picker & Results --> TL[ThumbnailLoader\nAsyncStream over PhotoKit]
    Picker --> FC[FaceCropper\nDB-located face crops]
```

## Component Descriptions

### ContentView
- **Purpose**: Linear navigation state machine (pick → scan → review → done), plus authorization and alert handling
- **Location**: `Exorcise/ContentView.swift`
- **Key responsibilities**: Screen transitions driven by observable scan state; guards against navigating on stale results

### PhotosManager
- **Purpose**: The only type that touches PhotoKit; owns all observable app state
- **Location**: `Exorcise/Services/PhotosManager.swift`
- **Key responsibilities**: Authorization, loading people (via PeopleDatabase) and the UUID→PHAsset map, running scans off the main actor with cancellation safety, counting burst frames, deleting and then pruning deleted photos from the loaded snapshot, creating/deduplicating albums, thumbnail caching

### PeopleDatabase
- **Purpose**: Extracts named people and per-photo person counts from the Photos library database, since no public People API exists
- **Location**: `Exorcise/Services/PeopleDatabase.swift`
- **Key responsibilities**: Locate the library, copy the SQLite files to temp, introspect the schema at runtime, fail loudly on partial reads, filter to humans and unmerged persons

### ScanClassifier
- **Purpose**: Solo/group classification as a pure function over a reverse index
- **Location**: `Exorcise/Services/ScanClassifier.swift`
- **Key responsibilities**: Deterministic, fully unit-tested classification with no PhotoKit dependency

### ThumbnailLoader
- **Purpose**: Streams progressive image deliveries (instant local preview, then full quality) with cancellation
- **Location**: `Exorcise/Services/ThumbnailLoader.swift`
- **Key responsibilities**: Wraps PhotoKit's opportunistic delivery in an `AsyncStream`; guarantees termination even for iCloud-offloaded originals under local-only requests; cancels the underlying request when a grid cell scrolls away

### FaceCropper
- **Purpose**: Person circles that always show the person
- **Location**: `Exorcise/Services/FaceCropper.swift`
- **Key responsibilities**: Crops thumbnails at the face position the Photos database records for that person (empirically verified coordinate convention), filters zero-geometry sentinel rows, falls back to Vision largest-face detection, and redraws crops into standalone bitmaps so full-size decodes aren't retained

### Views & Components
- **Purpose**: Thin SwiftUI screens reading manager state directly
- **Location**: `Exorcise/Views/`, `Exorcise/Components/`
- **Key responsibilities**: People grid with search; two-tab review grid with per-tab bulk selection, burst frame badges and click-for-full-quality preview; progress and completion screens; every person and photo exposed as a labeled accessibility control

## Data Flow

1. On launch the app requests Photos authorization, then loads people and the classification index off the main thread (spinner until done)
2. The user picks a person; the scan classifies each of their photos by counting distinct recognized people per photo (solo = 1, group = >1)
3. The review screen shows Solo/Group tabs, all photos selected by default; the user deselects keepers
4. On confirm, PhotoKit's delete request for the visible tab triggers the macOS confirmation dialog, and confirmed photos move to Photos' Recently Deleted (30-day recovery). A burst deletes as all of its frames, and the button already shows that total; the alternate action creates or appends to the two review albums with deduplication instead
5. The done screen reports the outcome: photos moved, bursts counted frame by frame (with the recovery path spelled out), or albums created with actual counts
6. Deleted photos are pruned from the loaded snapshot, so returning to the picker is instant and every person's count is already correct

## External Integrations

| Service | Purpose | Notes |
|---------|---------|-------|
| PhotoKit | Asset fetch, thumbnails, album creation, deletion | Sandboxed, `.readWrite` authorization; deletes always pass the OS confirmation dialog and land in Recently Deleted |
| Photos library database | Source of People data | Read-only intent via a temp copy; schema introspected at runtime; requires read-only Pictures entitlement |
| Vision framework | Thumbnail face-crop fallback; measurement modes (`--vision-spike`, `--face-probe`) | Detection runs on a GCD queue; concurrent blocking calls on the Swift cooperative pool can starve it |

## Key Architectural Decisions

### People from the Photos database, not PhotoKit
- **Context**: Photos' People folder exists in PhotoKit but returns zero children on modern macOS; there is no public People API
- **Decision**: Read `ZPERSON`/`ZDETECTEDFACE`/`ZASSET` from a temp copy of `Photos.sqlite`, mapping asset UUIDs to `PHAsset`s by identifier prefix
- **Rationale**: The alternatives were on-device face recognition, which measured 66.7% identity accuracy with Vision feature prints, or shipping nothing. Reading the database keeps Photos-level accuracy; runtime schema introspection and loud failure on partial reads contain the fragility of an undocumented format

### Generation-token scan cancellation
- **Context**: Scans run in a detached task over long synchronous PhotoKit calls; a cancelled scan could otherwise clobber or even commit results over a newly started scan for a different person
- **Decision**: Every scan captures a generation number; all main-actor state writes are guarded on it, and cancellation bumps it
- **Rationale**: Simpler and more robust than task-identity comparison or actor-serializing the scans; a stale task's writes become no-ops regardless of where it was interrupted

### OS-mediated deletion
- **Context**: The app's whole domain is emotionally loaded bulk deletion, the worst possible place for a silent bug
- **Decision**: Deletion goes through PhotoKit's asset-delete request, which forces a macOS confirmation dialog stating how many items will go and lands everything in Photos' Recently Deleted (30-day recovery); an alternate action files photos into review albums with no deletion at all
- **Rationale**: The irreversible step is guarded by the OS, not by app code. Nothing is deleted without a system confirmation, and even a confirmed delete is recoverable for a month. The app's own count has to agree with the dialog's: a burst is one asset in the grid but many frames in the library, so the review screen counts frames (`PHAsset.representsBurst`, fetched with `includeAllBurstAssets`) and the button shows the same number macOS will

### Face locations from the database, verified by measurement
- **Context**: Person-circle thumbnails must show the person, but the newest photo is often a group shot and any largest-face heuristic can crop a bystander
- **Decision**: Crop at the face rectangle Photos records per (person, photo) in `ZDETECTEDFACE`, after an in-app probe compared those coordinates against Vision detections across photo orientations to establish the convention (normalized to the upright image, bottom-left origin)
- **Rationale**: Correct by construction beats debatable heuristics because the recorded rectangle *is* the person. The undocumented format's risks are contained the same way as elsewhere: measure before trusting, filter invalid sentinel rows, and keep a Vision fallback for faces without geometry

### One accessibility element per photo tile
- **Context**: A photo tile has two mouse targets: clicking the photo opens a full-size preview, clicking its checkbox selects it. Exposed naively, VoiceOver and Voice Control users would meet two unlabeled elements per photo, hundreds of stops in a large grid, and no way to tell which one selects
- **Decision**: Each tile is a single accessibility element labeled "Photo" or "Burst of N photos", with a Selected / Not selected value; its default action toggles selection (the tile's main job) and a named "Preview" custom action opens the full-size view. Person circles became real plain-styled `Button`s labeled "Name, N photos"
- **Rationale**: Keeps one stop per photo and puts the primary task on the default action, while the preview stays reachable through the actions rotor. Verified by pressing controls through the Accessibility API (the interface VoiceOver itself uses) and by hand with VoiceOver running

### Value-type snapshot model
- **Context**: Strict Swift concurrency with PhotoKit types that aren't Sendable
- **Decision**: People and classification data live in immutable value-type snapshots (`LibraryData`), with `@unchecked Sendable` only where PhotoKit's documented thread-safety justifies it
- **Rationale**: Scans and the UI read consistent snapshots; the library-changed-during-use edge case is handled at the album-write boundary instead of with change observers. After a delete the app already knows exactly which assets went, so it rebuilds the snapshot without them (every person, not just the target) instead of re-reading the database
