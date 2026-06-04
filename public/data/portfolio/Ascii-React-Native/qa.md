# Project Q&A

## Overview

ASCII Converter turns a photo into ASCII art with a live editor — pick an image, then adjust resolution, character set, color mode, and tone while the text preview updates in real time. It's built with React Native + Expo so the same code runs in the browser and on phones; the interesting part is that the entire conversion pipeline is shared and pure, with platform differences confined to a single pixel-reading function.

## Problem Solved

ASCII-art generators are usually either web-only or require uploading your image to a server. This one runs entirely on-device/in-browser — your photo never leaves the client — and offers the kind of live, tweakable controls (character ramps, color output, edge detection) that static one-shot converters don't.

## Target Users

- **People who want shareable ASCII art** — convert a photo and copy it, download an HTML version with color, or save a PNG.
- **Terminal/retro enthusiasts** — ANSI color mode emits real escape codes; the block and detailed ramps target monospace rendering.

## Key Features

### Live, pixel-accurate conversion
Each pixel is reduced to luminance and mapped to a character in the active ramp. Adjusting any control re-renders the preview immediately.

### Multiple output formats
Grayscale text, inline-RGB HTML, ANSI terminal escape codes, and a complete styled HTML document — plus export via clipboard, file/Blob download, or a rendered PNG.

### Real edge detection and tone controls
A Sobel pass produces an actual edge map; brightness, contrast, and invert are applied per pixel before the glyph mapping.

## Technical Highlights

### Platform-split pixel reading behind one interface
Reading raw pixels is the only step that truly differs by platform: the web uses an offscreen `<canvas>` (`getImageData`), while iOS/Android use a Skia offscreen surface (`readPixels`). Both are exposed as the identical `getPixels(uri, w, h)` in `src/getPixels.web.js` and `src/getPixels.native.js`, which Metro resolves by extension. Everything downstream — `src/asciiCore.js` — consumes a plain RGBA byte array and has no idea which platform produced it.

### A pure, tested conversion core
`src/asciiCore.js` imports nothing from React, the DOM, or native modules, so it runs under plain Jest. `pixelsToAscii()`, `applyEdgeDetection()`, `adjustBrightnessContrast()`, and `rgbToAnsi()` are covered by unit tests (luminance mapping, charset inversion, HTML-span output, edge magnitude on a known vertical edge, clamping). The hard logic is verified in isolation rather than only through the UI.

### Decode-once pixel cache + debounced reprocessing
The decoded RGBA buffer is cached in a ref keyed by `uri|WxH`. Changing brightness, contrast, character set, or color mode reuses that buffer and re-runs only the cheap mapping pass; the image is re-decoded solely when it or its dimensions change. A ~150 ms debounce on the reprocess effect collapses rapid stepper taps into a single conversion.

### Edge detection that composes with the cache
`applyEdgeDetection()` writes Sobel magnitude into a fresh, fully-opaque buffer instead of mutating its input, so toggling it on and off never corrupts the cached source image.

## Engineering Decisions

### Share the pipeline, branch only at the pixel boundary
- **Constraint**: React Native has no `<canvas>`, but the brightness→glyph mapping and color logic are identical on every platform.
- **Options**: Duplicate the converter per platform; branch at runtime on `Platform.OS`; or isolate the platform-specific part behind a resolved module boundary.
- **Choice**: A pure core plus two `getPixels` files resolved by Metro's platform extensions.
- **Why**: One tested implementation of the tricky logic, and the native-only Skia dependency stays out of the web bundle (confirmed by a clean web build).

### Cache the decode, debounce the rest
- **Constraint**: Decoding is expensive; tone/character tweaks are frequent and shouldn't re-decode.
- **Options**: Re-decode on every change; cache the decoded buffer; or move conversion to a worker.
- **Choice**: Cache the decoded buffer and debounce the reprocess effect.
- **Why**: Keeps the editor responsive at the Ultra preset without the complexity of a worker, which is overkill for these image sizes.

### Web-first deployment from a cross-platform codebase
- **Constraint**: The app is built cross-platform, but the intended distribution is the web.
- **Options**: Maintain native store builds, or deploy the static web export.
- **Choice**: Ship the web export; keep the native code paths intact but unshipped.
- **Why**: A static web build needs no app-store overhead while the shared architecture leaves the door open to native later.

## Frequently Asked Questions

### How is a pixel turned into a character?
Each pixel's RGB is converted to luminance (`0.299R + 0.587G + 0.114B`), normalized to `0–1`, and used to index into the active character ramp (dark glyphs for dark pixels). Inverting the toggle reverses the ramp.

### What do the different color modes output?
Grayscale is plain text. RGB and HTML-RGB wrap each glyph in a `<span>` with the pixel's color. ANSI emits real terminal escape codes (`\x1b[..m`) using the nearest of eight ANSI colors. The HTML-RGB export wraps the colored spans in a complete, openable HTML document.

### Why does it need a development build on phones?
Pixel sampling on native uses Skia, which is a native module — it isn't available in Expo Go, so iOS/Android require a dev build. The web version has no such requirement.

### Does my image get uploaded anywhere?
No. Decoding, sampling, and conversion all happen on the client (canvas in the browser, Skia on device). Nothing is sent to a server.

### Can I use my own characters?
Yes — the Custom Characters field overrides the presets. The order matters: list glyphs from darkest to lightest to control the tonal ramp.

### Why are there separate `getPixels.web.js` and `getPixels.native.js` files?
Metro resolves platform-specific extensions automatically, so importing `./src/getPixels` loads the canvas version on web and the Skia version on native. It keeps each platform's dependencies out of the other's bundle without runtime branching.
