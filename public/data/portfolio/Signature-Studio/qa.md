# Project Q&A Knowledge Base

## Overview

Signature Studio is a web-based tool for creating animated signature SVGs. Users can draw their signature freehand, type their name using single-stroke calligraphic fonts (Hershey fonts from the 1960s), or upload an image and trace over it with snap-to-ink drawing. The tool generates an animated preview and exports production-ready code as a React component, raw SVG, path data, or Lottie JSON. Files can be downloaded as SVG, PNG, animated GIF, or Lottie JSON. The React component export is based on Kian Bazza's signature animation component.

## Key Features

- **Draw Mode**: Freehand signature drawing with mouse or trackpad. No click required — movement auto-draws, spacebar toggles on/off, 150ms lift timeout detects pen-up.
- **Type Mode**: Type a name and select from seven Hershey single-stroke calligraphic fonts with live preview.
- **Upload Mode**: Upload an image (drag-and-drop or file picker), adjust ink detection threshold, and trace over it with snap-to-ink drawing. View modes show original, threshold, or ink overlay.
- **Animated Preview**: Stroke-by-stroke drawing animation with per-stroke timing proportional to path length, ghost outlines, and adjustable speed.
- **Multi-Format Export**: React component (Framer Motion), raw SVG markup, raw path data, or Lottie JSON — all with one-click copy.
- **File Downloads**: SVG, PNG, animated GIF, and Lottie JSON file downloads.

## Technical Highlights

### Single-Stroke Vector Fonts (Hershey Fonts)
I use Hershey fonts — vector fonts designed in the 1960s by Dr. Allen V. Hershey at the Naval Weapons Laboratory. Unlike regular fonts (which are filled outlines), these are true single-stroke paths made of just `M` (move) and `L` (line) commands. This makes them perfect for stroke-dashoffset animation because each character is one continuous pen path, not a filled shape. The app includes 7 font families: scripts, scriptc, cursive, gothic, gothic italic, roman, and roman complex.

### SVG Stroke Animation Without Libraries
The animation preview uses a pure SVG technique: each path gets `stroke-dasharray` and `stroke-dashoffset` set to its total length (plus a 2-unit buffer to prevent round linecap artifacts from `getTotalLength()` float imprecision). A `requestAnimationFrame` loop gradually reduces the offset, revealing the path. Each stroke has independent timing with cubic ease-out, creating a natural writing cadence.

### Snap-to-Ink Tracing
The upload mode detects ink pixels in uploaded images using brightness thresholding. When tracing, drawn points are snapped to the nearest ink pixel within a configurable radius. This keeps your traced strokes aligned with the original signature without being overly rigid. The threshold and snap radius are adjustable via sliders, and view modes let you see the original image, the thresholded result, or an overlay.

### Lottie Export
I built a custom SVG-to-Lottie converter that tokenizes SVG path commands (M/L/C) and converts them into Lottie shape layer data with Trim Path animations — the Lottie equivalent of stroke-dashoffset. Each stroke gets independent timing with delays, producing the same drawing animation in any Lottie player.

### Stroke Processing Pipeline
Raw drawn points go through a multi-stage pipeline: two-pass moving average smoothing (windows of 5 and 3) to remove hand tremor, Ramer-Douglas-Peucker simplification (tolerance 2.8) to reduce point count, then Catmull-Rom spline interpolation converted to SVG cubic Bezier curves for smooth output.

## Development Story

- **Origin**: I found Kian Bazza's animated signature React component and wanted a way to generate it with any signature, not just hardcoded paths.
- **Evolution**: Started as a single `index.html` file with zero dependencies. As features grew (upload/trace mode, Lottie export, GIF generation), I migrated to Vite with modular JS files and npm dependencies.
- **Hardest Part**: Getting the freehand drawing to feel natural. I went through many iterations on the input system — including Pointer Lock API for trackpad drawing — before settling on the simple movement-based approach with spacebar toggle and lift timeout.
- **Lessons Learned**: Sometimes the simplest approach wins. The trackpad-specific Pointer Lock implementation was complex and brittle; removing it in favor of basic pointermove with a pause toggle was both simpler code and better UX.
- **Future Plans**: Potentially add stroke width customization per-stroke, color selection, and more export format options.

## Frequently Asked Questions

### How does the drawing work without clicking?
When drawing is unpaused (via spacebar), any `pointermove` event on the canvas starts a stroke. If the pointer stops moving for 150ms, the stroke ends automatically. This mimics natural pen-up/pen-down behavior without requiring mouse buttons. Touch/pen input works with direct press instead of spacebar.

### What are Hershey fonts?
Single-stroke vector fonts created in the 1960s by Dr. Allen Hershey. Unlike normal fonts (filled outlines), each character is a series of line segments forming one continuous stroke — perfect for pen-drawing animation effects.

### How does the snap-to-ink tracing work?
When you upload an image, the app converts it to grayscale and creates an "ink map" based on a brightness threshold. While tracing, each point you draw is checked against nearby pixels — if an ink pixel exists within the snap radius, your point gets moved to it. This keeps your strokes aligned with the original signature.

### Why is there a +2 buffer on stroke-dashoffset?
SVG's `getTotalLength()` returns a float that can be slightly imprecise. With `stroke-linecap: round`, even a sub-pixel gap between the dasharray and actual path length causes a tiny visible dot at the path start. Adding 2 units of buffer ensures the path is fully hidden before animation begins.

### How does the Lottie export work?
The custom converter in `lottie.js` parses SVG path `d` strings into M/L/C commands, converts them to Lottie shape layer vertices, and wraps each in a Trim Path animator — the Lottie equivalent of SVG stroke-dashoffset. Per-stroke delays create the sequential drawing effect.

### What does the exported React component require?
The generated component uses `motion/react` (Framer Motion) for `pathLength` animation and `cn` from `@/lib/utils` for Tailwind class merging. These are common in Next.js + Tailwind projects.

### How is the animated GIF generated?
The app uses gif.js to render each animation frame to an offscreen canvas, capturing the progressive stroke-dashoffset reveal. Frames are assembled client-side into an animated GIF — no server involved.

### Why did you migrate from a single HTML file to Vite?
The app grew to need npm packages (fit-curve for Bezier fitting, gif.js for GIF export) and the single file became hard to maintain. Vite provides fast HMR during development and optimized production builds. The original `index.html` is preserved as a reference.
