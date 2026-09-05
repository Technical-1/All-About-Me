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
    PM --> PK[PhotoKit\nassets · thumbnails · albums]
    PDB --> Lib[(Photos.sqlite\ntemp copy)]
    PM --> SC[ScanClassifier\npure function]
```

## Component Descriptions

### ContentView
- **Purpose**: Linear navigation state machine — pick → scan → review → done — plus authorization and alert handling
- **Location**: `Exorcise/ContentView.swift`
- **Key responsibilities**: Screen transitions driven by observable scan state; guards against navigating on stale results

### PhotosManager
- **Purpose**: The only type that touches PhotoKit; owns all observable app state
- **Location**: `Exorcise/Services/PhotosManager.swift`
- **Key responsibilities**: Authorization, loading people (via PeopleDatabase) and the UUID→PHAsset map, running scans off the main actor with cancellation safety, creating/deduplicating albums, thumbnail caching

### PeopleDatabase
- **Purpose**: Extracts named people and per-photo person counts from the Photos library database, since no public People API exists
- **Location**: `Exorcise/Services/PeopleDatabase.swift`
- **Key responsibilities**: Locate the library, copy the SQLite files to temp, introspect the schema at runtime, fail loudly on partial reads, filter to humans and unmerged persons

### ScanClassifier
- **Purpose**: Solo/group classification as a pure function over a reverse index
- **Location**: `Exorcise/Services/ScanClassifier.swift`
- **Key responsibilities**: Deterministic, fully unit-tested classification with no PhotoKit dependency

### Views & Components
- **Purpose**: Thin SwiftUI screens reading manager state directly
- **Location**: `Exorcise/Views/`, `Exorcise/Components/`
- **Key responsibilities**: People grid with search; two-tab review grid with per-tab bulk selection and click-for-full-quality preview; progress and completion screens

## Data Flow

1. On launch the app requests Photos authorization, then loads people and the classification index off the main thread (spinner until done)
2. The user picks a person; the scan classifies each of their photos by counting distinct recognized people per photo (solo = 1, group = >1)
3. The review screen shows Solo/Group tabs, all photos selected by default; the user deselects keepers
4. Exorcise creates or appends to the two albums, deduplicating against existing contents, and reports the counts actually added
5. The done screen names the albums; deletion happens in Photos, on the user's schedule

## External Integrations

| Service | Purpose | Notes |
|---------|---------|-------|
| PhotoKit | Asset fetch, thumbnails, album creation | Sandboxed, `.readWrite` authorization; albums only ever created or appended, never photos deleted |
| Photos library database | Source of People data | Read-only intent via a temp copy; schema introspected at runtime; requires read-only Pictures entitlement |
| Vision framework | Feasibility measurement only (`--vision-spike`) | Not part of the user-facing product |

## Key Architectural Decisions

### People from the Photos database, not PhotoKit
- **Context**: Photos' People folder exists in PhotoKit but returns zero children on modern macOS; there is no public People API
- **Decision**: Read `ZPERSON`/`ZDETECTEDFACE`/`ZASSET` from a temp copy of `Photos.sqlite`, mapping asset UUIDs to `PHAsset`s by identifier prefix
- **Rationale**: The alternatives were on-device face recognition (measured at 66.7% identity accuracy with Vision feature prints — not shippable) or shipping nothing. Reading the database keeps Photos-level accuracy; runtime schema introspection and loud failure on partial reads contain the fragility of an undocumented format

### Generation-token scan cancellation
- **Context**: Scans run in a detached task over long synchronous PhotoKit calls; a cancelled scan could otherwise clobber or even commit results over a newly started scan for a different person
- **Decision**: Every scan captures a generation number; all main-actor state writes are guarded on it, and cancellation bumps it
- **Rationale**: Simpler and more robust than task-identity comparison or actor-serializing the scans; a stale task's writes become no-ops regardless of where it was interrupted

### Non-destructive by construction
- **Context**: The app's whole domain is emotionally loaded bulk deletion
- **Decision**: The app can only create or append to albums; deletion stays in Photos
- **Rationale**: Removes the worst failure mode entirely, simplifies the permission story, and keeps the user in control of the irreversible step. Reported counts are what was actually added, not what was selected, so stale scans can't overstate results

### Value-type snapshot model
- **Context**: Strict Swift concurrency with PhotoKit types that aren't Sendable
- **Decision**: People and classification data live in immutable value-type snapshots (`LibraryData`), with `@unchecked Sendable` only where PhotoKit's documented thread-safety justifies it
- **Rationale**: Scans and the UI read consistent snapshots; the library-changed-during-use edge case is handled at the album-write boundary instead of with change observers
