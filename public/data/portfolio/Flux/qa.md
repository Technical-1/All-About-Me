# Project Q&A Knowledge Base

## Overview

Flux is a generative art and ambient sound studio built with React Native and Expo. It creates real-time particle sphere visualizations that react to layered ambient soundscapes, running on iOS, Android, and the web from a single codebase. I built it as an exploration of audio-reactive visuals, cross-platform audio engineering, and creative coding — inspired by apps like Endel and tools like Processing/p5.js.

## Key Features

- **Audio-Reactive Particle Visualization**: A Fibonacci-distributed sphere of particles that pulses, wobbles, and shifts based on live audio amplitude analysis — bass drives size, mid drives wobble, treble drives trail intensity
- **Dual Audio Engine**: Web gets full procedural synthesis (white/pink/brown noise, FM oscillators, binaural beats, solfeggio frequencies) via Web Audio API; native gets high-quality file playback via expo-audio with background audio support
- **Bottom-Sheet UI Architecture**: All controls live in peek/expanded bottom sheets on mobile, with a smooth cross-fade transition system — the visualization stays visible at all times
- **Custom Sound Import**: Users can upload their own audio files with a full trim interface, duration validation, and automatic integration into the sound library
- **30+ Built-in Sounds**: Nature recordings, noise generators, tonal drones, and ambient textures sourced from Freesound.org and BBC Sound Effects
- **Real-Time Amplitude Analysis**: FFT-based on web (AnalyserNode), category-estimated on native — both feed the same visual reactivity pipeline

## Technical Highlights

### Cross-Platform Audio Architecture
The biggest engineering challenge was building a unified audio API that works across web and native. Web Audio API enables procedural sound generation (noise buffers, oscillator synthesis, FM modulation) and real frequency analysis via AnalyserNode — none of which is available through expo-audio. On native, I use file-based playback with simulated amplitude data estimated per sound category. The abstraction layer (`AudioProvider`) exposes a single `useAudio()` hook that hides all platform differences from the rest of the app.

### Fibonacci Sphere with Physics
The particle visualization uses golden angle distribution (`π × (3 - √5)`) for even sphere coverage, rendered as depth-sorted SVG circles. The optional physics engine adds gravity, magnetism, inter-particle forces, and boid-like flocking — all running in a requestAnimationFrame loop. Reanimated handles the base rotation on the UI thread for smooth 60fps, while physics runs on the JS thread with manual state updates.

### Sheet Transition System
I built a custom `SheetContentWrapper` component that renders both peek and expanded content simultaneously as overlapping layers, using Reanimated's `useSharedValue` interpolation on the sheet's `animatedIndex`. This avoids the flash/pop artifacts you get from conditional rendering when a sheet crosses snap points. The cross-fade midpoint is calculated dynamically from the sheet's snap point positions.

### SVG Thumbnail Consistency
Saved creations include a static SVG thumbnail generated with the exact same Fibonacci distribution algorithm as the live visualization. The same math runs in three places (live render, thumbnail generator, card preview), ensuring what users see in their gallery matches what they created.

## Engineering Decisions

### SVG rendering over WebGL/Three.js
- **Constraint**: Particles needed to render consistently across iOS, Android, and web — including older Android devices and varied web browsers — at 60fps
- **Options**: `@react-three/fiber` + Three.js for WebGL rendering, raw Skia via `@shopify/react-native-skia`, or React Native SVG
- **Choice**: React Native SVG with Reanimated driving rotation on the UI thread
- **Why**: WebGL had inconsistent GL context behavior across the target platforms during prototyping. SVG renders identically everywhere, the bundle stays smaller, and ~1200 particles still hit 60fps — well above the visual budget. The ceiling is lower than WebGL could reach, but the visual quality inside that range is strong enough that the simpler renderer wins.

### Amplitude simulation on native instead of a native FFT module
- **Constraint**: The native audio stack (`expo-audio`) exposes file playback but no real-time frequency analysis, while the visualization needs bass/mid/treble values to drive reactivity
- **Options**: Write a custom native module wrapping `AVAudioEngine` / Android `Visualizer`, ship without reactivity on native, or estimate amplitude from sound metadata
- **Choice**: Per-category amplitude estimation with exponential smoothing, sharing the same downstream pipeline as the web FFT path
- **Why**: A native module would have meant ejecting from the managed Expo workflow and maintaining iOS + Android implementations. The estimated signal is good enough to drive visually convincing reactivity, and the abstraction keeps a single `useAudio()` consumer API. The trade-off is documented and easy to swap later if a native module ships.

### `flux_` AsyncStorage key namespacing with prefix-filtered import
- **Constraint**: Bulk export/import has to be safe — restoring a backup must not stomp on other storage, and a third-party library writing to AsyncStorage must not poison Flux state
- **Options**: A single JSON blob under one key, separate storage buckets per data type, or namespaced keys with prefix filtering
- **Choice**: Every key prefixed with `flux_`; import filters on the prefix before writing
- **Why**: Per-type buckets multiplied the surface area for migrations. A single blob made partial reads expensive. Prefix filtering keeps reads cheap, lets export/import operate as a bulk scan, and makes "reset Flux data" a one-line operation that won't touch anything else on device.

### Dual content layers in bottom sheets instead of conditional rendering
- **Constraint**: Sheets need to show different content at peek vs expanded snap points without flash or pop artifacts when the user drags across the boundary
- **Options**: Swap children on snap-point change, render only the current snap's content, or render both layers and cross-fade
- **Choice**: A `SheetContentWrapper` that renders peek and expanded content as overlapping absolutely-positioned layers, cross-fading via Reanimated `useSharedValue` interpolation on `animatedIndex`
- **Why**: Conditional rendering caused visible mount/unmount jank mid-drag. Rendering both layers keeps the UI thread free of layout work during the gesture; only opacity changes, which Reanimated can drive on the UI thread. The cost is double the JSX in memory per sheet, which is negligible at this app size.

## Frequently Asked Questions

### How does the particle visualization work?
Points are distributed on a sphere using the Fibonacci/golden angle method, which produces the most visually uniform coverage (unlike latitude/longitude grids that cluster at poles). Each point is projected to 2D with depth-based sizing and opacity, rendered as SVG circles, and rotated via Reanimated's `withRepeat(withTiming(...))`. When physics is enabled, particles have velocity vectors influenced by configurable forces.

### Why use SVG instead of WebGL/Three.js?
I initially prototyped with `@react-three/fiber` and Three.js, but hit cross-platform GL context issues — especially on older Android devices and certain web browsers. SVG via `react-native-svg` renders consistently on all platforms, and combined with Reanimated for rotation, achieves 60fps with up to 1200 particles. The tradeoff is a lower particle ceiling than WebGL could achieve, but the visual quality is excellent within that range.

### How does audio reactivity work?
On web, the audio system runs an AnalyserNode with FFT size 256 every 50ms. The frequency bins are split into bass (0-10%), mid (10-40%), and treble (40-100%) ranges, each averaged and normalized to 0-1. On native, amplitude is estimated based on each sound layer's category and frequency characteristics, with some random variation for organic feel. Both paths apply exponential smoothing. The `ParticleSphere` reads these values to modulate particle size (bass), wobble intensity (mid), and trail opacity (treble).

### Why does the app have both file-based sounds and generated sounds?
File-based sounds (nature recordings, ambient textures) provide rich, organic audio that can't be synthesized. Generated sounds (noise types, oscillators, binaural beats) offer precise control and infinite variation without large audio files. On web, both coexist. On native, only file-based sounds are available since the Web Audio API synthesis isn't accessible — the generated sound options gracefully degrade.

### How is the bottom-sheet UI structured?
The app uses four `@gorhom/bottom-sheet` instances (Controls, Sounds, Library, Settings), each with 2-3 snap points. A custom `SheetContentWrapper` renders peek and expanded content as overlapping absolutely-positioned layers, with animated opacity interpolation based on the sheet's current snap index. Only one sheet can be open at a time. On desktop (≥900px), sheets are replaced by a sliding side panel that contains the same content.

### What's the Easter egg?
Tapping the "FLUX" logo 7 times within 3 seconds activates the Flux Capacitor — a full-screen animated SVG recreation of the Back to the Future flux capacitor. It features animated electric arcs along three paths and a speed counter that ramps up to 88 MPH. Each intermediate tap triggers a haptic pulse.

### How does data export/import work?
All app data is stored in AsyncStorage with a `flux_` key prefix. Export collects all `flux_*` keys into a versioned JSON object. Import validates the format, filters for `flux_*` keys only (ignoring anything else), and writes them back. This makes it safe to transfer data between devices or back up before a reset.

### What are the Python scripts for?
The `scripts/` directory contains Python tools for processing audio assets: analyzing duration/format, trimming long files (>5 min to 2 min with fade), and creating seamless loops via crossfade. They use ffmpeg/ffprobe (no Python audio libraries) and auto-backup originals before modifying. These are development-time tools, not part of the app runtime.
