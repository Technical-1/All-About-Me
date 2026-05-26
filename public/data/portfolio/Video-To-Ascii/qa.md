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

## Engineering Decisions

### Vanilla ES modules, no framework
- **Constraint**: A render loop that touches the DOM every frame at up to
  60 fps, with a small fixed surface of controls.
- **Options**: React/Preact for ergonomics; Svelte for compile-time updates;
  plain modules.
- **Choice**: Plain modules.
- **Why**: A reconciler between me and the render path adds bundle weight and
  one more layer to debug when a frame glitches. With one render function I
  know exactly what hits the DOM each tick.

### Adaptive frame rate over fixed 60 fps
- **Constraint**: The pipeline (decode → downscale → Sobel → character map →
  DOM write) is not free on modest hardware. A fixed 60 fps target lags
  badly; audio drifts and the browser jank-warns.
- **Options**: Hard 60; hard 30; user-pickable FPS; adaptive.
- **Choice**: Adaptive FPS in `videoController` — floor 10, ceiling 60, ±5
  step based on measured frame time.
- **Why**: A smooth 30 reads better than a stuttery 60, and the same build
  works on a Pi-class device and a current laptop without me picking a
  preset per machine.

### Structured `{ text, colors }` frames, not HTML strings
- **Constraint**: Recording stores playback for replay/export. An earlier
  Share feature also persisted frames to a backend, where treating the
  payload as HTML created a stored-XSS path.
- **Options**: Serialize the rendered `innerHTML` (cheap, unsafe); serialize
  per-cell text + colors (more code, but the receiver rebuilds the DOM with
  safe APIs and a color allowlist).
- **Choice**: Structured frames everywhere — `{ text, html, colors }` in
  memory, `{ text, colors }` for persistence.
- **Why**: Even after the Share feature was retired, the export paths
  (JSON, HTML player, GIF) all consume the structured form. No code path
  trusts an HTML blob.

### Hard 1,800-frame recording cap + GIF sub-sample to 120
- **Constraint**: Auto-recording runs the whole video by default. Each frame
  carries a `width × height` colors array; a long video at 30 fps OOMs the
  tab. GIF-encoding the full buffer at retina text size takes minutes.
- **Options**: No cap; user-set cap; fixed cap with sub-sampling at export.
- **Choice**: Fixed 1,800-frame ceiling in `ExportManager` (auto-stops on
  hit), and GIF export samples down to ≤120 frames before encoding.
- **Why**: Predictable memory and predictable export latency without making
  the user reason about buffer sizing.

### FPS overlay as a sibling, not a child, of the output element
- **Constraint**: `#ascii-output.innerHTML` is rewritten every frame, so any
  child element is detached on the first render. A previous fix using
  `position: fixed` on `document.body` collided with the toolbar/playback bar.
- **Options**: Body-fixed badge; child of `#ascii-output`; wrapper-relative
  sibling.
- **Choice**: An `.ascii-stage` wrapper (`position: relative`) around
  `#ascii-output`, with the badge appended as a sibling
  (`position: absolute`).
- **Why**: The stage isn't touched by the render loop, so the badge
  persists; and because it isn't a descendant of the output, it never
  pollutes `textContent` reads in the screenshot fallback path.

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

### Why is there both an HTML export and a JSON export?
The JSON export is the raw structured frame buffer (`text` + per-cell
`colors`). It's the canonical format the rest of the project consumes and is
useful for re-rendering elsewhere. The HTML export is a self-contained
single-file player that bundles the frames and a small replay script —
useful for sending someone a link without asking them to run a tool. They
have different audiences: JSON for programmatic reuse, HTML for "open and
press play."

### How accurate is the GIF compared to the live render?
Close, but not pixel-identical. The GIF draws each character cell onto a
canvas in the recorded color rather than rendering monospace HTML, so font
metrics differ slightly from the live `<pre>` rendering. The sampling step
(≤120 frames) also drops timing fidelity for videos longer than ~4s at
30 fps. The trade-off is intentional — encoding every frame at full text
size would take minutes for short videos and is rarely what's wanted.

### Can I run this offline?
Yes — after the first load there's no network dependency. Everything from
decoding to rendering to GIF encoding happens in the tab. Settings persist
in `localStorage` so reloads keep your preset.
