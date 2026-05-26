# Project Q&A

## Overview

Pluribus Particle Text is an interactive web experience that recreates the opening title sequence from Apple TV+'s "Pluribus" using particles in a fingerprint-like concentric pattern. Type any text and it renders as thousands of tiny dots arranged in elliptical bands radiating from the first letter, with circular waves that ripple outward and tug background particles toward each wave crest. The whole thing runs on pure HTML5 Canvas and vanilla JavaScript — no frameworks, no WebGL.

## Problem Solved

TV title sequences look impossible to reproduce outside of After Effects. This project shows the Pluribus aesthetic — fingerprint typography plus rippling waves — can be done in a browser with 2D Canvas math, and made interactive so the visitor can see their own name in the style.

## Target Users

- **Designers** wanting a quick way to mock up Pluribus-style text visuals
- **Creative coders** studying particle systems and Canvas animation techniques
- **Fans of the show** who want to render their name in the iconic style and share it

## Key Features

### Fingerprint text pattern
Particles are placed only where `(distance from first letter) % textureSpacing < textureThickness`. The result is concentric elliptical lines emanating from the first character — the distinctive fingerprint look. A small `Math.sin(dy * 0.05) * 2` offset adds organic waviness so the bands don't look mechanically perfect.

### Wave aggregation
Circular waves emit from the first letter every ~140 frames and expand outward. Background particles within a configurable band around the wave radius get pulled toward the crest, producing visible compression bands as the wave travels. Text particles are immune to wave forces and only have subtle jitter.

### Pixel-accurate text scanning
Text is rendered to a hidden canvas first, then scanned pixel by pixel to decide where to place particles. Any font, any character, any size works without the particle system knowing anything about typography.

### Screenshot export
A camera button captures the live canvas as a 1200×630 PNG (standard Open Graph dimensions) entirely client-side, ready to drop into a social post.

### PWA install
The site ships a web manifest with standalone display mode plus icons at 180/192/512 px, so it installs to a home screen on iOS and Android.

## Technical Highlights

### Particle rendering at 60 fps without WebGL
The render loop has to push thousands of particles per frame on plain 2D Canvas. Each particle draws as a single `arc()` call with a pre-set `fillStyle` per type to minimise context state changes, ellipse inclusion tests use pre-computed inverse squared radii, and particle update logic is separated from the draw pass so there's only one read/write cycle through the array per frame. Code lives in `src/main.js`.

### Elliptical exclusion zones for clean text edges
Background particles need to stay out of letter shapes without per-pixel collision checks every frame. During init, each character gets a bounding ellipse with stored `1/rx²` and `1/ry²` values. Placement uses one multiply-add-compare per zone — cheap enough to run against every candidate background particle during init, and the result is crisper than pixel masking because the boundary is mathematically smooth.

### Mobile keyboard viewport handling
Opening a mobile keyboard fires a resize event that shrinks the visual viewport. Naively reinitialising on resize would collapse the canvas mid-typing. The fix stores `fullWidth`/`fullHeight` separately from the live viewport, skips updates while the text input is focused, and uses the `visualViewport` API for accurate metrics, then reinitialises after blur with a short delay so the layout settles first.

### Wave physics without differential equations
Real wave dynamics (interference, decay, reflection) would dominate the CPU budget. Instead each wave is a single expanding radius, and any background particle within `waveBandWidth` of that radius gets a velocity nudge toward the crest. Combined with a 0.90 friction coefficient that pulls particles back to their origin, this produces convincing ripple-band motion in a handful of lines of math.

## Engineering Decisions

### Vanilla JS over a framework
- **Constraint**: Thousands of particles updating every frame, single-purpose UI.
- **Options**: React + Canvas, Svelte + Canvas, vanilla JS + Canvas.
- **Choice**: Vanilla JS, direct Canvas calls.
- **Why**: There's no shared state to manage and no component tree worth diffing. A framework would add bundle weight and a render layer the project doesn't need; the whole app stays under ~50 KB.

### 2D Canvas instead of Three.js / WebGL
- **Constraint**: Effect is fundamentally 2D — concentric ellipses and ripple bands on a flat plane.
- **Options**: Three.js sprites, raw WebGL shaders, 2D Canvas.
- **Choice**: 2D Canvas API.
- **Why**: WebGL would add ~600 KB and a shader-authoring step for an effect that's already cheap on CPU at this particle count. Three.js stayed listed in `package.json` from an early prototype but is not imported.

### Elliptical exclusion zones over pixel masking
- **Constraint**: Background particles must not visually collide with letter shapes.
- **Options**: Sample the rendered-text bitmap per particle, use rectangular bounding boxes, use elliptical bounds.
- **Choice**: Elliptical zones with pre-computed inverse squares.
- **Why**: Bitmap sampling is the most accurate but requires keeping the offscreen canvas hot and doing per-pixel reads. Rectangles leak particles into letter corners. Ellipses are O(1) per check, look better than rectangles, and the test reduces to one multiply-add-compare.

### JS-driven responsive scaling instead of CSS breakpoints
- **Constraint**: The visual effect needs to feel proportionally similar at every size, not just rearrange.
- **Options**: CSS media queries adjusting font/canvas size, JS reading viewport and adjusting particle parameters.
- **Choice**: JS-driven, with `textureSpacing`, `bgGridGap`, and `waveBandWidth` all scaling to viewport.
- **Why**: CSS can resize the canvas but can't retune particle density or wave width. Driving the parameters from JS keeps the fingerprint banding visible on a 360 px phone screen and a 2560 px desktop without one looking sparse or the other looking muddy.

## Frequently Asked Questions

### Why does the default text use a "1" instead of an "I" in PLUR1BUS?
The show's title card uses a stylised 1 in place of the I. The default text matches the source; users can type whatever they want.

### How many particles are on screen at once?
It varies with viewport size and text length. A typical desktop view runs 2,000–4,000 background particles plus 500–1,500 text particles, controlled by `bgGridGap` and `sampleStep` in `src/main.js`.

### Why do the waves originate from the first letter?
The original title sequence anchors visually on the P, so waves emit from the first character's centre to match. It also gives the fingerprint pattern a natural origin to radiate from.

### Can I change the particle colour?
Not without editing code. The fill is hardcoded as `rgba(255, 255, 255, alpha)` in `main.js` to match the show's black-and-white look. Swapping it is a one-line change.

### Why is `three` listed in `package.json` if it isn't used?
It was added during an early prototype that explored 3D rendering and never removed. The shipped implementation uses only the 2D Canvas API. Safe to ignore.

### How is the screenshot button implemented?
It creates an offscreen 1200×630 canvas, redraws the current frame into it at the OG aspect ratio, and triggers a PNG download via an anchor tag. Entirely client-side.

### Can I install this on my phone?
Yes. On iOS use Share → Add to Home Screen; on Android Chrome will show an install prompt. The `manifest.webmanifest` declares standalone display mode so it runs without browser chrome.

### How are the PWA icons built?
`scripts/generate-icons.js` uses `sharp` to convert `public/favicon.svg` into PNGs at 180, 192, and 512 px. Run `npm run generate-icons` to regenerate.
