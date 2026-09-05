# Project Q&A

## Overview

Exorcise is a native macOS app for removing a specific person from your Apple Photos library without the app ever deleting a photo. It finds every photo of a chosen person, classifies each as "solo" (just them) or "group" (them plus other people you know), and files them into two clearly named albums for you to review and bulk-delete in Photos. The interesting technical core: Apple offers no public API for Photos' People data, so Exorcise reads it directly from the Photos library's own SQLite database — with runtime schema introspection so it survives Photos version differences.

## Problem Solved

After a breakup, a falling-out, or a loss, people often want photos of one specific person out of their library — but a 20,000-photo library makes that a miserable manual slog, and group photos (which you may want to keep) are mixed in with solo shots (which you may not). Exorcise turns that into a ten-minute review instead of an afternoon of scrolling, while deliberately refusing to be the thing that deletes anything.

## Target Users

- **Anyone "exorcising" an ex or estranged person** — gets every photo of them gathered, pre-sorted into keep-worthy group shots vs. solo shots, with full veto power before anything is filed
- **Photo-library organizers** — a fast way to isolate one person's entire photographic footprint into albums

## Key Features

### Person-first search
A face grid of everyone Photos has named, searchable, with photo counts — pick one person and scan their whole footprint at once.

### Solo vs. Group triage
Every photo of the target is classified by whether other recognized people are also in it, because "photo of just my ex" and "photo of my ex at my sister's wedding" deserve different fates. Pets are deliberately excluded from "other people."

### Review before anything happens
A two-tab grid with everything selected by default, per-tab Select All/Deselect All, live counts, and click-to-preview at full quality (fetching from iCloud if needed). The app states plainly that selected photos get *filed for review*, not deleted.

### Non-destructive output
Two albums — `Exorcise - [Name] (Solo)` and `(Group)` — created or appended with deduplication, and the completion screen reports exactly how many photos were actually added.

## Technical Highlights

### Reading People data Apple doesn't expose
Photos' People folder is reachable through PhotoKit but comes back empty on modern macOS, and no replacement API exists. `PeopleDatabase.swift` copies the library's `Photos.sqlite` (plus WAL) to a temp directory, opens the copy, and introspects table columns at runtime — handling both old and new face-table column names, merged person records, pet detection types, and trashed/hidden assets. Any partial read (torn copy, I/O error) throws instead of silently returning truncated data, because a half-read index would misclassify photos rather than fail visibly.

### Cancellation-safe scanning with generation tokens
Scans run in a detached task across multi-second PhotoKit enumerations. A naive cancel left a race: the old task's cleanup could wipe a newly started scan's state, or worse, commit person A's results while the UI showed person B. Every scan now captures a generation number (`PhotosManager.startScan`), every main-actor write is guarded on it, and cancellation bumps it — making stale writes structurally impossible rather than merely unlikely.

### Classification as a pure function
Solo/group classification is a dictionary lookup over a precomputed reverse index (photo UUID → count of recognized people), implemented in `ScanClassifier.swift` with no PhotoKit dependency, so the core logic is exhaustively unit-testable and the scan itself is near-instant.

### A self-driving end-to-end test
`--autotest` runs the entire real pipeline — scan, classify, create albums in the actual library, verify contents through PhotoKit, then delete only the albums it created (and refuses to run at all if same-named albums already exist). It turns "does the whole thing actually work on a real 20k-photo library" into a one-command check with a written pass/fail report.

## Engineering Decisions

### Database read vs. on-device face recognition
- **Constraint**: No public People API anywhere on Apple platforms
- **Options**: Read the Photos database; recognize faces ourselves with the Vision framework; ship nothing
- **Choice**: Read the database on macOS
- **Why**: I measured the Vision alternative before rejecting it — sampling single-person photos with known identities as ground truth, Vision's generic image embeddings scored 66.7% nearest-neighbor identity accuracy (and an early, naively sampled version of the same test scored 82.8%, a reminder that burst photos can flatter a similarity metric). One wrong face in three is unshippable for this product; the database read keeps Photos' own accuracy. The measurement also settled the iOS question: without file access to the database, iOS needs a real face-embedding model, so the iOS port is parked.

### Albums as the only output
- **Constraint**: The product exists to enable deletion, the one irreversible act
- **Options**: Delete photos directly with confirmation; move to a staging area; create albums and let Photos own deletion
- **Choice**: Albums only — the app has no deletion code path for photos at all
- **Why**: A bug in an app that deletes photos is catastrophic; a bug in an app that makes albums is an inconvenience. It also means re-running is safe and idempotent (append + dedupe).

### Reported counts reflect reality, not intent
- **Constraint**: The library can change between scan and filing (photos deleted, albums synced)
- **Options**: Report selected counts; observe library changes live; report what was actually written
- **Choice**: Album writes return the count actually added; the done screen shows that, and stale identifiers can't create empty albums
- **Why**: Live change observation adds complexity for a rare case; honest write-time accounting handles the same failure with one returned integer

### One window, stable identity
- **Constraint**: Scan/review state lives in a single shared manager; macOS's default multi-window scene would let a second window silently corrupt the first's flow. Separately, an unsigned dev build made macOS treat every rebuild as a new app, re-prompting for Photos access
- **Choice**: A single-`Window` scene, and Developer ID signing even for local builds
- **Why**: Both are one-line fixes for whole classes of confusing behavior

## Frequently Asked Questions

### Does Exorcise ever delete photos?
No — it has no code path that deletes a photo. It creates two albums and tells you their names; deletion happens in Photos, by you.

### Why does it need to read the Photos library database directly?
Because Apple provides no API for the People that Photos recognizes. The app reads a temporary copy of the library's database (never the live files), and only with the sandbox's read-only Pictures access. Nothing is uploaded anywhere; the app has no network access at all.

### Why does my Photos library have to be in the Pictures folder?
The sandbox entitlement grants read access to Pictures specifically. If several libraries live there, Exorcise picks the most recently written one — the live system library — rather than a stale backup.

### A photo of my ex with a stranger showed up as "Solo" — why?
Photos only tracks people it has recognized and you (or it) have confirmed. An unrecognized stranger doesn't count as another person, so the photo classifies as solo. That's exactly what the review grid is for — deselect it.

### What about photos of my ex with my dog?
Solo. Pet face clusters are explicitly filtered out of the person counts, so an animal in frame never turns a solo photo into a "group" photo.

### What happens if I run it twice for the same person?
It appends to the existing albums and skips photos already in them, so repeat runs are safe and duplicates don't accumulate.

### Do iCloud photos work?
Yes. Grid thumbnails use fast local previews; the click-to-preview view fetches full quality from iCloud on demand. Adding an iCloud photo to an album doesn't require downloading it.

### Is there an iPhone version?
Not currently. iOS apps cannot read the Photos database, and on-device recognition measured well below shippable accuracy without bundling a dedicated face-recognition model — so the iOS port is parked until that trade-off changes.
