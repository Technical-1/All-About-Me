# Project Q&A

## Overview

Flux is an ambient sound and generative visuals app for iOS, Android, and the web, built from one React Native and Expo codebase. You layer nature recordings, noise, and synthesized drones into a soundscape while a Fibonacci-distributed particle sphere rotates on screen. An adaptive mode follows the time of day and your movement, and two-minute guided sessions shape the experience into a short arc. The most interesting technical piece is the renderer: a Skia `Atlas` that draws thousands of particles in one GPU call, with every per-particle transform computed in UI-thread worklets, so the sphere animates without React re-rendering.

## Problem Solved

Focus and relaxation apps tend to offer either a fixed playlist or a static mixer. Flux sits between them: you build the mix yourself, and the app keeps it moving on its own (time-of-day drift, motion response, timed sessions) so a background session doesn't feel like a loop. The visuals give you something calm to look at, and they run the same way in a browser tab as on a phone.

## Target Users

- **People who work or study with background sound** — a Focus mix, a Pre-Focus ramp, and adaptive drift that brightens through the morning and calms down at night
- **People winding down or falling asleep** — Sleep and Relax mixes, a Wind-Down session, and visuals that cool and slow overnight
- **Visual tinkerers** — particle count, speed, wobble, size, trails, six color schemes, and an optional physics simulation, with creations saved to a gallery

## Key Features

### Layered sound mixer
34 built-in layers in four categories: 15 nature, 3 noise, 9 tonal, and 7 ambient. 24 are bundled Freesound recordings and 10 are synthesized live: white, pink, and brown noise, drones, a pulse, binaural beats, and two solfeggio tones. Each layer has its own volume. A 3-band master EQ with six presets shapes the synthesized layers. Focus, Relax, Sleep, and Energy presets load curated combinations, and you can save your own.

### Adaptive mode
On by default. While audio plays, the app samples the clock every minute and, on native, the accelerometer about once a second. These feed smooth 24-hour curves that adjust intensity, EQ tilt, modulation rate, and particle speed, wobble, and size. Each soundscape mode has its own profile, so Sleep stays darker and slower than Energy at the same hour.

### Two-minute micro-sessions
Reset, Pre-Focus, and Wind-Down chips in the bottom bar each start a 120-second arc: about 25 seconds of settling, a core phase, then a 20-second resolve back to neutral. If nothing is playing, a session starts the matching soundscape. Tapping the chip again cancels it.

### First-run quiz
Three questions (what you want, how noisy your space is, calm or vivid visuals) choose a soundscape, a visual preset, and whether adaptive mode starts on. The mapping is deterministic, so the same answers always give the same setup.

### GPU particle sphere with optional physics
The sphere uses golden-angle point placement, depth-based size and opacity, drag-to-rotate, and trails. The physics option adds gravity, magnetism, short-range attraction and repulsion, friction, and flocking, while a spring holds the particles to the sphere shape.

### Custom sounds, saves, and backups
Import an audio file of 1 second to 3 minutes and trim it (anything over 2 minutes prompts a trim). It loops inside the trim window. Creations save with SVG thumbnails, favorites, and an optional auto-save. All data exports to a JSON file (a download on web, the share sheet on native) and imports back with validation.

### Audio-reactive background and credits
Background orbs scale and fade with bass, mid, and treble energy. A Sound Credits & Licenses screen lists the author, source link, and license for every CC-BY recording.

## Technical Highlights

### A single-draw-call particle renderer on the UI thread
Drawing each particle as its own view or SVG element means React and native view work for every particle, so smoothness drops as the count grows. `components/ParticleSphereSkia.tsx` instead uses one shared white-circle texture in a Skia `Atlas`, tinted per instance with a `modulate` color blend. Rotation, wobble, perspective projection, and depth-based alpha and size are computed per particle inside `useRSXformBuffer` and `useColorBuffer` worklets, driven by Reanimated shared values. Atlas can't z-sort sprites, so `buildParticleGeometry` in `lib/particleAtlas.ts` sorts points back-to-front once, and the depth cue hides the drift during rotation. The wobble clock's loop target is a whole number of 2π periods, so the animation never snaps when it repeats.

### Physics without per-frame allocation
The physics simulation runs in a JS `requestAnimationFrame` loop over flat `Float32Array` position and velocity buffers. Each frame it copies positions into one of two pre-allocated output buffers and publishes that to a shared value, alternating between them. The UI thread gets a new reference each frame (so it picks up the change) while the loop allocates nothing after setup.

### Seam-free adaptive curves and session arcs
Both `lib/adaptiveEngine.ts` and `lib/sessionArc.ts` sample keyframes with cubic smoothstep, which has zero slope at every knot, so each output is smooth with no visible corners. The adaptive curves wrap across midnight, so 23:59 flows into 00:00. Every session track ends on the same neutral values, so when a session finishes and adaptive mode takes over, nothing jumps. Both modules are pure and fully unit-tested. The hooks around them (`useAdaptiveContext`, `useSession`) only own the timers, sensor subscription, and React state.

### Keeping 20 Hz amplitude updates cheap
The FFT is read every 50 ms during playback. With the result in the main audio context, every component using `useAudio()` would re-render 20 times a second. `AmplitudeProvider` in `lib/AudioContext.tsx` holds it in its own context, keyed on whether audio is playing and how many layers are active (not on the layers array), so only the reactive background and the three level dots re-render. On the receiving side, `AudioReactiveBackground` eases toward each new value with an 80 ms `withTiming` instead of restarting a spring on every tick.

## Engineering Decisions

### Skia Atlas over SVG for the sphere
- **Constraint**: Thousands of particles with trails need to animate smoothly on phones and in browsers
- **Options**: One SVG circle per particle with Reanimated, WebGL through Three.js, or Skia's `Atlas`
- **Choice**: Skia `Atlas`, natively and on web through CanvasKit
- **Why**: SVG worked at a few hundred particles but scaled with element count. Three.js would have meant a separate GL path per platform. Atlas keeps one renderer everywhere and raises the cap to 2,000 on mobile and 5,000 on desktop. The cost is shipping the CanvasKit WASM on web, which `scripts/copy-canvaskit.js` stages into `public/` and `ParticleSphere.tsx` loads from the site root.

### One audio graph API on every platform
- **Constraint**: Synthesis, EQ, and frequency analysis must work on native too, not just in the browser
- **Options**: Keep Web Audio for web and simulate amplitude on native, write custom native modules, or adopt `react-native-audio-api`
- **Choice**: `react-native-audio-api` for the synthesis graph everywhere, with `expo-audio` kept for MP3 playback
- **Why**: It exposes the familiar `AudioContext` / `AnalyserNode` / `BiquadFilterNode` API on iOS, Android, and web, so the graph code is shared and native amplitude is real rather than estimated. The known limit is that `expo-audio` playback doesn't pass through the graph, so EQ and the FFT only cover the synthesized layers.

### Effects layered on top of the user's settings
- **Constraint**: Adaptive mode and sessions change visuals and loudness all the time, but switching them off must leave exactly what the user set
- **Options**: Write adaptive values into the settings and remember the originals, or derive an effective state on top
- **Choice**: Derive. `StudioScreen` computes `effectiveSettings` with `applyAdaptiveVisual`, and audio uses a separate adaptive gain (0.65–1.0) multiplied over the per-layer and master volumes
- **Why**: Nothing adaptive is ever saved, and `resetAdaptiveAudio` only has to restore unity gain and a flat EQ. Sessions reuse the same apply paths, so they need no audio code of their own.

### An entitlement seam before any paywall
- **Constraint**: A future premium tier shouldn't require touching every screen, but nothing should be locked today
- **Options**: Add a store SDK now, scatter feature flags, or build a small typed gate first
- **Choice**: `lib/entitlements.ts` with a persisted value, a subscribe/notify emitter, `useEntitlement()`, and `isGated()` reading an empty `PREMIUM_GATES` map
- **Why**: Call sites get a stable API now. Gating a feature later is one line, and wiring a purchase provider changes this file only.

## Frequently Asked Questions

### Does the particle sphere react to the music?
Not directly. The audio-reactive part is the background: its orbs respond to bass, mid, and treble energy, and three level dots in the studio header pulse with the bands. The sphere's motion comes from your settings, plus adaptive mode or a running session.

### What does adaptive mode actually change?
On the audio side: the master EQ tilt (warmer at night, brighter mid-morning), an overall gain factor between 0.65 and 1.0, and the modulation rate of the synthesized drones. On the visual side: particle speed, wobble, and size multipliers. It never changes your per-layer volumes or saved settings, and turning it off restores them.

### Why does motion sensing only work on phones?
`useAdaptiveContext` reads the accelerometer through `expo-sensors`, which isn't available in the web build. On web, and on any device where the sensor is missing or permission is denied, motion is treated as zero and adaptive mode runs on time of day alone.

### What happens at the end of a micro-session?
The last 20 seconds ease every parameter back to neutral. The session shows as complete for 2.5 seconds and then stops itself. Your audio keeps playing, and adaptive mode takes over again if it's on.

### How many particles can it draw?
The points slider goes from 50 to 2,000. The renderer also enforces a device cap: 2,000 on mobile screens and 5,000 on desktop, lowered to 800 and 2,000 with the Performance Mode setting, which is on by default on phones and narrow browsers.

### Can I move my creations to another device?
Yes. **Export Data** in Settings writes a versioned JSON file (a download on web, the share sheet on native), and **Import Data** reads it back. Import only accepts known keys with the right types: saved creations, favorites, recordings, app and particle settings, the onboarding flag, and the entitlement. Anything else is skipped and reported, so custom sounds and custom soundscapes are not restored by an import.

### Where do the sounds come from?
All 24 bundled recordings are from Freesound.org under CC0 or CC-BY. The ten CC-BY recordings are credited in the in-app Sound Credits & Licenses screen. The Python scripts in `scripts/` were used to analyze, trim, and make seamless loops with ffmpeg; they aren't part of the app.

### Is there an Easter egg?
Tap the "FLUX" logo seven times within three seconds. A Back to the Future flux capacitor fills the screen and its speedometer climbs to 88 MPH.
