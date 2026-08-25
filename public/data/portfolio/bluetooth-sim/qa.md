# Project Q&A

## Overview

bluetooth-sim is a two-app research instrument for studying how Apple Health handles step data. A macOS app simulates a Bluetooth fitness band; an iOS app receives that data and writes it into HealthKit under fully controlled conditions — or writes directly, with no radio at all. The interesting technical bit: the tool can capture the exact "anatomy" of how any real HealthKit writer (Apple's own pedometer, the Oura app) structures its samples, then replay that shape under its own identity — which is how it demonstrated that a real step-challenge app accepts synthetic data with no identity check.

## Problem Solved

HealthKit-based step challenges present their data as "verified through Apple Health," but Apple Health is a merge engine, not an oracle: totals depend on which sources overlap, in what windows, at what priority order. There was no user-visible way to answer basic questions — does a challenge app count manually written samples? Does it care which app wrote them? What happens when two sources claim the same walk? bluetooth-sim turns those questions into controlled, repeatable experiments with read-back on both sides.

## Target Users

- **Developers building HealthKit-integrating apps** — a test harness that exercises the merge/attribution behavior their products depend on, without owning a drawer of wearables
- **Quantified-self researchers** — a way to see exactly how their own Health data is structured, sourced, and arbitrated

## Key Features

### Simulated BLE wearable (WearableSim, macOS)
Advertises a custom GATT service streaming a cumulative step counter, cadence, heart rate, battery, and device information. The simulation runs on deterministic walk/rest cycles — cadence is genuinely zero during rest, heart rate ramps and decays — so streamed data has the texture of real activity rather than a constant drip.

### Relay mode (Stepper, iOS)
Scans, connects, and converts the streamed counter into HealthKit writes batched into multi-minute windows that match the iPhone pedometer's own sample shape. Handles counter resets, bounded reconnection with backoff, and never writes a negative or duplicated step.

### Capture and shape replay (Stepper, iOS)
Profiles any HealthKit writer's sample anatomy — device descriptors, metadata keys, durations, value distributions — for steps and distance. One tap replays a captured profile as a batch under Stepper's identity, separating what data *looks like* from which app *wrote it*.

### Verify (Stepper, iOS)
A stacked per-source chart of the last seven days next to read-back of everything Stepper wrote, with full attribution inline. This is where HealthKit's merge behavior becomes visible: the whole bar is the total consumers see; the segments show who contributed it.

## Technical Highlights

### A simulation you can replay bit-for-bit
`GenericTrackerEngine` computes cadence and heart rate as pure functions of the passed timestamp — all variation comes from a SplitMix64 hash of the walk/rest cycle index, never from system randomness. That makes the simulation testable with exact-value assertions, lets the Mac UI draw 5-minute sparklines by sampling the past without touching state (locked by the `historyLeavesStepCounterUntouched` test), and means any recorded session replays identically.

### One choke point for a dangerous API
CoreBluetooth freezes a characteristic's value forever if you pass one at construction — a classic way to ship a peripheral that serves stale data. `GATTServerBuilder` is the single place blueprints become `CBMutableService`s, it always passes `value: nil`, it answers reads live from the engine, and it never sets encryption-required permissions (which would trigger pairing dialogs). Every service in the app flows through it.

### Relay writes shaped like the real thing
`RelayWriteAdapter` accumulates BLE stream segments and flushes one HealthKit sample per ~3-minute window — because the iPhone's own pedometer writes ~5-minute batched samples and the Oura app writes 60-second grains, and a one-sample-per-second firehose is a fingerprint. Windows derive strictly from stream segment timestamps, so writes can never overlap; flushes fire on interval expiry, counter reset, disconnect, and stop.

### Read-back that survives an identity change
HealthKit locks a source's display name to the bundle ID it first saw, so renaming the app required a new bundle ID — which orphans history under the old source. The read-back filter accepts both bundle identities, so the full experiment record stays visible across the rename.

## Engineering Decisions

### Custom GATT UUIDs over standard services
- **Constraint**: no widely implemented standard step-count characteristic exists, and macOS refuses third-party publication of Battery `0x180F` and Device Information `0x180A` outright
- **Options**: fight the refusal (not possible), omit battery/device-info, or publish them under custom 128-bit twin UUIDs
- **Choice**: custom service for steps plus twin UUIDs for battery and device info; Heart Rate keeps its official `0x180D`, which macOS publishes fine
- **Why**: real trackers carry steps in vendor services anyway, so custom UUIDs are more realistic than a fictional standard profile — and the twins keep the data path alive on every Mac

### Read-only distance
- **Constraint**: the simulator wrote steps but no distance, and real walking produces both — a potential shape fingerprint
- **Options**: add paired distance writes with an assumed stride model, or capture first
- **Choice**: capture only, with distance locked to read-only
- **Why**: the capture showed the real wearable companion app on the same phone (Oura) writes *no distance at all* — steps-only is the faithful wearable-app shape, so a paired write would have been the less realistic choice

### Single profile instead of device emulation
- **Constraint**: emulating real bands (Whoop, Oura) at the radio layer was proven feasible — public reverse-engineered protocols exist for both
- **Options**: build Whoop/Oura GATT emulation, or consolidate on the custom tracker
- **Choice**: consolidate. The captured-shape replay already tests what matters downstream, and the vendored Whoop protocol research is kept as a document (`docs/protocols/whoop4.md`)
- **Why**: a research instrument should be exactly as large as its purpose; the deleted emulation code is one `git checkout` away if that ever changes

## Frequently Asked Questions

### Does this work in the iOS Simulator?
No. CoreBluetooth reports "unsupported" there by design, so the relay path is verified on physical hardware only — every build in the Makefile pins a device destination or `generic/platform=iOS`.

### Can I use it with my real Oura ring or Whoop band?
Not directly, and that is deliberate. BLE-level emulation of those bands was researched and proven feasible (the vendored Whoop protocol spec is in `docs/protocols/whoop4.md`), but experiments showed consumer apps ingest data by *shape*, so replaying a captured shape through HealthKit tests the same thing without touching a vendor's radio protocol.

### Why don't Stepper's steps show up in my step-challenge total?
Most likely Data Sources & Access priority: HealthKit does not sum overlapping windows across sources — the higher-priority source wins them. Drag Stepper above your phone's own source and masked steps appear. The Verify tab's per-source chart makes this visible, and the experiment record (E12) documents the mechanism.

### Why didn't renaming the app change its source name in Apple Health?
HealthKit locks a source's display name to the bundle ID it first saw. Renaming the source required a new bundle ID, which mints a fresh identity (and one re-authorization). The read-back accepts both identities so history survives.

### Is any health data sent anywhere?
No. There is no network code in either app — no analytics, no telemetry, no third-party packages at all. Health data is written to the local HealthKit store and read back locally.

### What does the Capture tab actually capture?
The writer-controlled fields of other apps' samples: HKDevice descriptor strings, metadata keys, sample durations, and value distributions — for steps and distance. It cannot capture (or forge) a source's *identity*, which HealthKit assigns from the writing app's code signature.

### What do I need to build and run it?
Xcode 26+, XcodeGen, a personal signing team, and a physical HealthKit-capable iPhone. `make generate && make build-ios && make build-mac` from a fresh clone.
