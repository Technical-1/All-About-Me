# Project Q&A Knowledge Base

## Overview

Video ASCII Converter is a browser-based tool that converts a video file into
real-time ASCII art with playback controls, recording, and exports. It runs
entirely client-side in vanilla JavaScript on top of Vite, deployed as a
static SPA on Vercel. I built it as a one-tab tool where the hot path is a
per-frame canvas → character pipeline, with bounded memory and adaptive
performance so that long videos don't degrade the experience.

## Key Features

- **Real-time conversion** of MP4/WebM/OGG/MOV/AVI/MKV with adaptive frame
  rate that throttles on slow devices.
- **Five character sets** (standard, blocks, binary, dots, custom) and
  **four color modes** (grayscale, ANSI xterm 256-cube, RGB, full-RGB).
- **Sobel edge detection** plus brightness / contrast / invert controls.
- **Playback controls**: play/pause/stop, ±5s skip, seek, volume, mute, and
  0.5× / 1× / 2× speed.
- **Recording with a hard 1,800-frame cap** to keep memory bounded, plus
  exports as JSON, a self-contained HTML player, animated GIF (sampled +
  progress UI), and PNG screenshot (per-cell colors honored).
- **Settings persisted** in `localStorage`.

## Technical Highlights

### Adaptive frame loop instead of fixed FPS
The `videoController` measures actual frame time and throttles target FPS
when the loop falls behind, then recovers when there's slack (floor 10,
ceiling 60, ±5 step). The result is smooth playback on modest hardware that
would stutter at a hard 60 fps.

### Bounded memory for recording
Each recorded frame stores `{ text, html, colors }`, where `colors` is
roughly `width × height` per frame. Without a cap, a long video would OOM
the tab. I enforce a hard `maxFrames=1800` cap in `ExportManager` (auto-stops
on hit). For GIF export, the buffer is additionally sampled down to ≤120
frames before encoding so that exports finish in seconds-to-tens-of-seconds
rather than minutes.

### GIF export with visible progress
gif.js encodes off the main thread, but the *drawing* loop (canvas paints
each character for each frame) runs in the main thread. I wired both phases
through an `onProgress(phase, pct)` callback: "Drawing frames… X%" during
the paint loop, then "Encoding GIF… Y%" from gif.js's `progress` event. A
sticky toast reflects the current state. Without this feedback, long
exports look indistinguishable from a hang.

## Development Story

- **Timeline**: Built iteratively. A 2026-05-18 audit (`AUDIT.md`)
  catalogued ~30 findings — security gaps in an older Share feature, broken
  UI features, correctness bugs, and project hygiene gaps. Most of the work
  since has been working through that prioritized list, then trimming
  features (Share, TXT export, CI) that weren't earning their complexity.
- **Hardest part**: The original codebase had a Share feature with a stored
  XSS vector — the server accepted arbitrary HTML and the viewer injected
  it directly into the DOM. Rewriting it to persist only structured
  `{ text, colors }` and rebuild output with safe DOM APIs (capability-URL
  share IDs, rgb/hex color allowlist on both ends) was the largest single
  refactor. The feature was later removed entirely when the free-tier KV
  quota became impractical, but the hardening work and the discipline of
  treating an unauthenticated write endpoint as a hostile surface stayed
  with me.
- **Lessons learned**:
  - "Structured data over HTML strings" is the cheapest way to make a class
    of XSS bugs impossible by construction.
  - Adaptive FPS beats fixed FPS for anything that has to keep up with media.
  - Long-running browser operations need *visible* progress, not just
    `await`; otherwise users assume the tab has hung and reload.
  - Features without a free, durable hosting story don't survive long.
  - Any UI element that needs to persist over a container has to live as a
    *sibling* of the container in a positioned wrapper — never as a child.
    Containers whose contents are rewritten will erase their own children
    every frame.
- **Future plans**:
  - Address remaining minor findings in `AUDIT.md` (charset-custom restore
    ordering, error handler reading the wrong field on media error events).
  - A proper test suite for the modules — right now only the pure helpers
    are unit-tested.

## Frequently Asked Questions

### How does the real-time conversion work?
On every animation frame, `videoController` triggers the loop:
`frameProcessor` draws the current `<video>` frame to an offscreen canvas at
the chosen output resolution, applies image adjustments and optional Sobel
edge detection, then hands a pixel buffer to `asciiConverter`. The converter
maps each pixel to a character from the selected charset and wraps it for
the chosen color mode. `renderEngine` writes those spans to the live DOM.
Everything happens in the user's tab — there is no server-side rendering.

### Why no framework?
The DOM surface is small (a few control panels and one big text display),
but the hot path runs every frame. A virtual-DOM reconciler between me and
the render code would add bundle weight and a layer to debug whenever a
render glitch appeared. Plain modules give me one render function with
predictable per-frame cost.

### Why is there a 1,800-frame recording cap?
Each frame stores text, HTML, and a per-cell colors array roughly
`width × height` in size. Auto-recording runs the whole video by default,
so a long video at 30 fps would OOM the tab. The cap auto-stops the
recorder with a predictable memory ceiling. The GIF path additionally
samples to ≤120 frames before encoding, keeping export time tractable.

### How does the ANSI color mode render?
`asciiConverter.toAnsiColor()` quantizes each pixel's RGB to the xterm
6×6×6 color cube using the standard levels `[0, 95, 135, 175, 215, 255]`
and emits an inline `rgb()` CSS color on the span. Because it's a real CSS
color (not a class name), it renders in the browser, exports correctly to
PNG/GIF, and survives copy/paste of the HTML.

### Why was the Share feature removed?
The deployed Vercel project couldn't provision another free-tier Upstash
Redis database, and the feature was non-functional without one. Rather than
leave a broken button in the UI, I removed the whole feature surface
(button, handler, serverless function, viewer page, dependencies). The git
history preserves the hardening work that went into it.

### Why is there no GitHub Actions CI?
For a solo project where I run `npm run lint` and `npm test` locally before
pushing, the marginal value of automated CI was low. The lint + test infra
exists; only the workflow file was scoped out.

### What would I improve?
A proper test suite for the modules — right now only the pure helpers are
unit-tested. After that, the remaining minor findings in `AUDIT.md`
(charset-custom restore ordering, error handler reading the wrong field on
media error events).
