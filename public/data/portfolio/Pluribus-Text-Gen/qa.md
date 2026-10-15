# Project Q&A

## Overview

Pluribus Particle Text is an interactive browser recreation of the opening title sequence from Apple TV+'s *Pluribus*. Type up to 12 characters and they are drawn as white dots arranged in fingerprint-like elliptical bands radiating from the first letter, while circular waves ripple outward and pull the surrounding dot field into moving compression rings. It runs on plain HTML5 Canvas and vanilla JavaScript with no runtime dependencies, and the numeric core is split into a pure, unit-tested module.

## Problem Solved

Title sequences like this are normally made in motion-graphics software and exported as video. This project shows the look can be produced live in a browser from a few hundred lines of 2D canvas maths, and makes it interactive so a visitor can see their own word in the style and save it as an image.

## Target Users

- **Fans of the show** — render a name or word in the title style and download it as a share-sized PNG
- **Creative coders** — a compact, readable example of a canvas particle system with wave forces and procedural texture
- **Designers** — a quick way to mock up Pluribus-style text

## Key Features

### Fingerprint text pattern
Only text pixels where `effectiveDist % textureSpacing < textureThickness` become particles. The distance is measured from the first letter's centre with the vertical offset doubled, so the bands are ellipses, and a `Math.sin(dy * 0.05) * 2` term adds an organic wobble.

### Wave aggregation
A wave is emitted from the first letter every 140 frames and grows by 6 px per frame. Background particles within the wave band are pulled toward the crest, which bunches them into a visible travelling ring, and then spring back. Text particles ignore waves and only jitter slightly.

### Live text input
The input is limited to 12 characters and the text is upper-cased before rendering. An empty box falls back to the default `PLUR1BUS`. The font size is fitted to 86% of the viewport width and 55% of its height.

### Screenshot export
The camera button copies the live canvas onto a black 1200x630 canvas, scaled to fit and centred, and downloads it as `og-image.png`. Everything happens client-side.

### Installable PWA
A web manifest with standalone display, separate `any` and `maskable` icon sets, and Apple home-screen meta tags let it install on iOS, Android and desktop.

## Technical Highlights

### A NaN guard that keeps the field from corrupting itself
In `waveForce()` (`src/simulation.js`), the direction to the crest is `dx / dist`. A particle exactly on the wave origin gives `dist === 0`, and the resulting NaN never leaves the particle's position, because the return-to-base step multiplies NaN by the friction factor and that is still NaN. This applies to text particles too, whose wave strength is zero, since NaN times zero is NaN. The function returns zero force at zero distance, and `src/simulation.test.js` includes regression tests for both particle types.

### Reading back only the text, not the whole screen
To find text pixels, `init()` draws the string with `fillText` and reads it back with `getImageData`. Reading the full canvas on a large display copies millions of pixels just to find a strip in the middle. `textScanBounds()` computes the text's box (with padding for Montserrat's ascent and descent), clamps it to the canvas, and `createTextParticles()` converts region-local coordinates back to canvas coordinates.

### Elliptical exclusion zones for clean letter edges
Each character gets an ellipse sized from its measured width and the font size, padded 1.1x horizontally and 1.3x vertically, with `1/rx²` and `1/ry²` stored up front. A background grid point is dropped if `dx²·invRxSq + dy²·invRySq <= 1` for any letter. That is a multiply-add-compare per letter, run once per rebuild, and gives a smoother margin than rectangles.

### Mobile keyboard and resize handling
Opening a mobile keyboard shrinks the viewport, which would otherwise rebuild the scene at half height mid-typing. `src/main.js` keeps `fullWidth`/`fullHeight` separate from the live viewport, ignores size changes while the input has focus, restores the real size 100 ms after blur, and routes `window` resize, `visualViewport` resize, typing and blur through one 150 ms debounce so they produce a single rebuild.

## Engineering Decisions

### Vanilla JS and 2D Canvas
- **Constraint**: One full-screen animation and one input, with thousands of dots updated every frame.
- **Options**: A component framework with a canvas, Three.js or raw WebGL, or plain 2D canvas.
- **Choice**: Plain ES modules and the 2D canvas API.
- **Why**: There is no UI state worth a framework, and the effect is flat, so a GPU renderer would add shader code and a large dependency without changing what is on screen. The production JavaScript bundle is 6.71 kB (2.81 kB gzipped).

### Pure maths module instead of testing through the canvas
- **Constraint**: The canvas code needs a browser to run, but the wave maths needed regression coverage.
- **Options**: Mock the canvas in a DOM test environment, use browser-based end-to-end tests, or extract the maths.
- **Choice**: `src/simulation.js` holds side-effect-free functions; `main.js` calls them.
- **Why**: The tests assert exact numbers in milliseconds under plain Vitest with no DOM shim, and a mocked canvas would mostly test the mock.

### Hard caps on per-frame work
- **Constraint**: The animation runs indefinitely, including on low-end phones.
- **Options**: Trust the default parameters, or bound every cost that grows with radius or screen size.
- **Choice**: Ring dots per wave capped at 220 (`waveVisualParticleCount()`), the text scan limited to its bounding box, and rebuilds debounced.
- **Why**: Ring dots used to grow linearly with radius, and a full-screen readback scales with display size; both are costs that only appear on big screens or after the page has been open a while.

### Responsive parameters in JavaScript rather than CSS
- **Constraint**: The effect should look the same on a phone and a large monitor, not just shrink.
- **Options**: CSS media queries on the canvas, or retuning the simulation itself.
- **Choice**: `applyResponsiveTuning()` switches texture spacing, line thickness, grid gap, wave band and sample step when the shorter side is 520 px or less.
- **Why**: CSS cannot change particle density or band width, and without the retune the fingerprint lines blur into a solid fill at phone size.

## Frequently Asked Questions

### Why does the default text use a "1" instead of an "I"?
The show's title card uses a stylised 1 in place of the I, so the default `PLUR1BUS` matches it. You can type anything up to 12 characters.

### How many particles are on screen?
It depends on the viewport. Background particles come from a grid with a 26 px gap (22 px on small screens), so a 1920x1080 window starts from about 3,100 grid points, minus the ones inside letter ellipses. Text particle count depends on the word and font size, since only pixels on a fingerprint line are kept. Each wave also draws up to 220 decorative ring dots per frame.

### Why do the waves start at the first letter?
The original sequence anchors on the opening P, so the waves and the fingerprint bands both radiate from the first character's centre.

### Can I change the colours or speed?
Only by editing code. The dots are drawn as `rgba(255, 255, 255, alpha)` in `src/main.js`, and speed, emission rate, strength and band width are fields on the `config` object at the top of the same file.

### Where does the screenshot come from?
It is the live canvas at the moment you click, drawn onto a black 1200x630 canvas and exported with `toDataURL`. If your window is not 1.91:1, the frame is letterboxed rather than cropped.

### Can I install it on my phone?
Yes. On iOS use Share, then Add to Home Screen; Chromium browsers on Android and desktop offer an install prompt. It opens in standalone mode without browser chrome.

### How do I run the tests?
`npm test` runs the Vitest suite once (15 tests) and `npm run test:watch` re-runs on change. They cover `waveForce`, `waveVisualParticleCount` and `textScanBounds`.
