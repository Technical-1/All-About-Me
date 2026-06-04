# Project Q&A Knowledge Base

## Overview

SmoothQueue is an iOS app that reorders your Apple Music playlists for smooth,
DJ-style transitions between songs. Instead of shuffling randomly or playing
in album order, it analyzes each track's audio characteristics — BPM, energy,
musical key, fade structure — and uses a TSP-style algorithm to pick an order
that makes consecutive songs flow into each other.

It's for anyone who's ever made a road-trip / dinner-party / workout playlist
and found themselves manually reordering tracks so the energy doesn't crash
between "ambient piano piece" and "punk anthem." The app does that automatically.

## Key Features

- **Multi-source audio analysis** — Each track's characteristics come from a
  cascade: real audio analysis (for DRM-free files) → GetSongBPM curated
  database → Claude AI estimation → metadata heuristics. Each tier falls
  through to the next so the app works regardless of whether you've configured
  optional API keys.
- **Greedy + 2-opt playlist optimization** — Builds a weighted score matrix
  across all track pairs (energy continuity, tempo proximity via Lorentzian
  falloff, Camelot-wheel key compatibility, fade matching), constructs a
  starting tour with greedy nearest-neighbor, then improves it with a 2-opt
  local search pass that's aware of the cost function's asymmetry.
- **Multiple optimization profiles** — Standard Mix, Dance Party, Chill
  Session, DJ Transitions, Energy Flow, Tempo Match. Each is a different
  weighting of the four sub-scores.
- **Vibe splitting** — Split an optimized playlist into high-energy / chill /
  unknown buckets by an adjustable threshold, save each bucket as its own
  playlist.
- **Persistent saved playlists** — Save optimized orderings locally; export
  them back to Apple Music as new playlists.
- **Custom artwork** — Pick a Photos image for any saved playlist; compressed
  and stored alongside the playlist JSON.
- **Native auto-advance + custom queue** — The app sets the full track
  collection on the system music player so auto-advance is native, while
  maintaining a parallel array for the in-app "Up Next" display and manual
  reorder.

## Technical Highlights

### Reproducible-per-seed determinism via FNV-1a

Swift's built-in `Hasher` is seeded with a per-process random value, so
hashing the same inputs produces different numbers on every app launch. That
silently defeated the "reproducible results for a given random seed" design
goal — a saved playlist's cached fallback characteristics would change across
launches.

The fix is `SongTransitionAnalyzer.stableHash`, an FNV-1a 64-bit hash that's
stable across processes and devices. A given `(trackID, seed)` pair now
always produces the same value, which means the same seed gives the same
playlist order every time.

### Asymmetric-cost-aware 2-opt

Textbook 2-opt assumes a symmetric cost function (Euclidean TSP), so it only
re-scores the two boundary edges when proposing a segment reversal. Our
transition score is *asymmetric*: `cost(A→B) ≠ cost(B→A)` because energy
uses `source.endEnergy → target.startEnergy` and fade flags depend on
which side is source. Reversing a segment changes every interior edge's
direction too.

The implementation includes the full interior segment cost in both forward
and reversed direction when evaluating a candidate swap. Without that, the
optimizer could "improve" the boundary while making the interior strictly
worse — a silent quality regression with no error to report.

### Mode-aware Camelot key compatibility

Earlier versions ignored `mode` (major/minor) in key compatibility scoring,
which gave wrong answers for two musically-important cases. C major → A
minor is the *relative minor* relationship and a DJ staple; the
mode-agnostic code scored it as just "a third up." C major → C minor is the
*parallel minor*; the mode-agnostic code scored that as "same key" (1.0)
even though it's a striking modal shift.

The new scoring uses a Camelot-wheel-inspired switch on the
`(interval, sameMode)` pair: same-key-same-mode = 1.0, relative
major↔minor = 0.9, perfect 4th/5th = 0.8 same-mode / 0.65 different,
parallel mode = 0.6, etc.

### Off-main expensive UI work

Several places in the codebase do non-trivial work that used to run on the
main thread from SwiftUI lifecycle hooks like `.onAppear`:

- Album-artwork dominant-color extraction (~4000 pixel reads + HSV
  conversion + sort per call) runs from `MiniPlayerView` on every track
  change.
- The queue sheet does an `MPMediaQuery` per track to resolve display info.
- Saved-playlist track resolution may include a `MusicCatalogSearchRequest`
  network round-trip per track.

All three have been dispatched to a background queue with explicit hops back
to main for `@State` assignment. The shared `ColorExtraction.extractAsync`
helper bundles the off-main discipline so call sites don't have to remember.

### Thread-safe analyzer and off-main optimization

The track-characteristics cache and the per-source counters are written from
concurrent analysis callbacks and read from the UI. They're funneled through a
single serial `stateQueue` (the same pattern the API clients use), and each
optimize run carries a generation token so a superseded run's late callbacks
can't corrupt the current run's state.

The scoring matrix, greedy construction, and 2-opt pass run on a dedicated
serial queue off the main thread, with results delivered back on main — so
optimizing a large playlist never freezes the UI. The 2-opt pass is skipped
above 250 tracks (the greedy ordering is kept) to bound worst-case runtime on
the asymmetric cost function.

### iOS Keychain for API keys with safe migration

User-entered API keys live in iOS Keychain at
`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — accessible after first
device unlock (so background analysis works), not synced to iCloud Keychain
(so a leaked key on one device doesn't bleed across).

The migration from an earlier UserDefaults-based design is one-shot on first
launch and *only* removes the legacy entry after confirming the Keychain
write succeeded. On failure it logs and leaves the legacy entry in place so
the key isn't lost from both stores.

## Engineering Decisions

### Four-tier analysis cascade vs. single-source

- **Constraint**: Apple Music streaming tracks are DRM-protected — `MPMediaItem.assetURL` is `nil`, so real waveform analysis never fires for them. A single-source design would fail silently for most users' libraries.
- **Options**: (a) real-audio only and accept the DRM cliff; (b) require an API key and route everything through one external service; (c) cascade with graceful fallback.
- **Choice**: A four-tier cascade — real audio → GetSongBPM → Claude → metadata heuristics — where each tier falls through on failure.
- **Why**: Real-audio is the gold standard but only fires for ripped/owned files. GetSongBPM is free with attribution and covers a curated catalog. Claude can infer characteristics from title/artist for anything else. Metadata heuristics catch tracks no API recognizes. The app still works with zero keys configured; quality degrades gracefully instead of cliff-edging.

### Greedy + 2-opt vs. exact TSP solve

- **Constraint**: Reordering N tracks is a Traveling Salesman variant. Exact solutions are O(2^N); a 200-track playlist would need to finish before the user gets bored.
- **Options**: (a) exact branch-and-bound (too slow); (b) pure greedy (cheap but stuck in local minima); (c) greedy construction + local-search improvement.
- **Choice**: Greedy nearest-neighbor to build an initial tour, then a 2-opt pass that's aware of the asymmetric cost function.
- **Why**: 2-opt typically lifts the greedy tour by 5–15% on this scoring matrix and runs in well under a second for 200 tracks. The asymmetry-aware variant is the non-obvious part: standard 2-opt assumes symmetric costs, but `cost(A→B) ≠ cost(B→A)` here because energy uses `source.endEnergy → target.startEnergy`.

### JSON file persistence vs. SwiftData

- **Constraint**: Optimized playlists need to survive launches. Data is small (tracks × IDs + a few characteristic fields), structured, and never queried with predicates.
- **Options**: (a) SwiftData / Core Data; (b) `Codable` JSON to `Documents/`; (c) SQLite via GRDB.
- **Choice**: `Codable` JSON to `Documents/saved_optimized_playlists.json`.
- **Why**: SwiftData's schema-migration ceremony would dwarf the actual data. JSON is grep-able for debugging, trivially diff-able if a user reports a wrong order, and the whole file rewrites in milliseconds for the data sizes involved.

### iOS Keychain for API keys (with safe migration)

- **Constraint**: API keys are sensitive. The earlier design stored them in `UserDefaults`, which is plaintext on disk and readable by any backup workflow.
- **Options**: (a) leave them in UserDefaults; (b) add a custom encrypted file; (c) iOS Keychain.
- **Choice**: Keychain at `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, with a one-shot migration from the legacy UserDefaults entry.
- **Why**: `AfterFirstUnlock` keeps the key available for background analysis after the user has unlocked the device once per boot. `ThisDeviceOnly` prevents iCloud-Keychain sync, so a leaked key on one device doesn't bleed across. The migration only removes the legacy UserDefaults entry after the Keychain write succeeds — on failure the legacy is left in place so the key isn't lost from both stores.

## Frequently Asked Questions

### How does the analysis cascade work?

When you tap Optimize, the analyzer walks each track through four tiers:

1. **Real audio analysis** — Only fires for `MPMediaItem`s with a non-nil
   `assetURL` (DRM-free local files). Uses AVFoundation + Accelerate's vDSP
   to compute BPM via spectral flux + autocorrelation, energy via RMS,
   fades via amplitude envelope, and key via chroma + Krumhansl-Schmuckler.
2. **GetSongBPM** — If configured, looks up tempo, key, and danceability
   from a curated database by title + artist. Free with attribution; cached
   per-track per-process.
3. **Claude AI** — If configured, sends the track's title/artist/genre/year
   to Claude 3.5 Haiku with a JSON-schema prompt asking for BPM, energy arc
   (start → end), key, mode, and intro/outro types. Batched at 15 tracks
   per request for efficiency.
4. **Metadata fallback** — Genre lookup against a ~150-entry table, title
   keyword analysis ("remix", "acoustic", "live"…), release-year era
   adjustments, track-position bumps.

Once each track has a `TrackCharacteristics`, the scoring matrix gets
built and the greedy + 2-opt optimizer runs.

### Why does optimization need an internet connection sometimes?

The GetSongBPM and Claude tiers are network calls. Real-audio analysis and
metadata fallback are fully offline. With no API keys configured, the app
runs entirely offline — quality just depends more on metadata.

### Why does it sometimes give a different order on the same playlist?

By design. Tapping "Optimize" randomizes the seed each time, so re-tapping
gives a fresh mix. The seed is editable from the settings sheet — pin it
to get reproducible results across runs, or hit the dice button to roll a
new one without re-picking a profile.

### Why are my Apple Music streaming tracks getting low-confidence analysis?

DRM. `MPMediaItem.assetURL` is `nil` for protected streaming tracks, which
means the real-audio-analysis tier never fires. The app falls through to
the API tiers (which still give measured data via title/artist lookup) or
the metadata fallback (which gives reasonable but synthesized values).
Ripped CDs and DRM-free files get real measurements.

### How is the optimization actually computed?

For N tracks: an O(N²) score matrix is built across all pairs (each cell is
a weighted sum of the four sub-scores). The greedy step picks a start track
with the highest average outgoing score, then walks forward by always
picking the highest-scoring unvisited next-track. The 2-opt pass then tries
all `(i, j)` pairs and reverses the segment between them if doing so
improves the total tour score; capped at 5 passes to bound runtime.

For 200-track playlists that's about 8M operations per pass — fast enough
on-device. The whole scoring/reorder/2-opt phase runs off the main thread so
the UI stays responsive, and 2-opt is skipped above 250 tracks (the greedy
ordering is kept) to bound runtime on very large playlists.

### Where are API keys stored?

In iOS Keychain, under the service identifier derived from the bundle ID
and an account name per provider. Accessible after first device unlock;
not synced to iCloud Keychain. Settings views read through the API client
classes rather than the keychain directly, so there's a single
authoritative source per provider.

### What happens if some tracks can't be added when I export to Apple Music?

Export reports a partial result rather than failing silently. If the playlist
is created but some tracks couldn't be added — for example, they're unavailable
in your region or library — the app tells you how many of the total landed, and
the created playlist still appears in your library instead of being orphaned.

### Can I use the app without any API keys?

Yes. The analysis cascade is designed to degrade gracefully. With no API
keys, real-audio analysis fires for any DRM-free local files you have, and
the metadata fallback handles everything else. The optimization runs the
same way; the only difference is per-track confidence (which factors into
the scoring at low values via the synthetic-data weight reduction).

### What's the difference between the six optimization profiles?

Each profile is a different `(energy, tempo, key, fade)` weight tuple:

| Profile | Energy | Tempo | Key | Fade | Bias |
|---|---|---|---|---|---|
| Standard Mix | 0.25 | 0.25 | 0.25 | 0.25 | none |
| Dance Party | 0.4 | 0.3 | 0.1 | 0.2 | high energy + upbeat |
| Chill Session | 0.4 | 0.2 | 0.3 | 0.1 | none |
| DJ Transitions | 0.2 | 0.1 | 0.4 | 0.3 | upbeat |
| Energy Flow | 0.7 | 0.1 | 0.1 | 0.1 | none |
| Tempo Match | 0.1 | 0.7 | 0.1 | 0.1 | none |

Or roll your own via the sliders in the settings panel.

### Why is there a Mini Player that overlaps with the tab bar?

To keep playback control accessible no matter what screen you're on. Tap
the mini player to expand it into a full now-playing screen; tap the queue
button on the mini player to see the upcoming tracks; the controls are
always reachable.
