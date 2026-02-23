# Project Q&A Knowledge Base

## Overview

Signature Studio is a web-based tool for creating animated signature SVGs. Users can either draw their signature freehand or type their name using single-stroke calligraphic fonts (Hershey fonts from the 1960s). The tool generates an animated preview and exports production-ready code as a React component, raw SVG, or path data. The React component export is based on Kian Bazza's signature animation component.

## Key Features

- **Draw Mode**: Freehand signature drawing with mouse or trackpad. No click required — movement auto-draws, spacebar toggles on/off, 150ms lift timeout detects pen-up.
- **Type Mode**: Type a name and select from three Hershey single-stroke calligraphic fonts with live preview.
- **Animated Preview**: Stroke-by-stroke drawing animation with per-stroke timing proportional to path length, ghost outlines, and adjustable speed.
- **Multi-Format Export**: React component (Framer Motion), raw SVG markup, or raw path data — all with one-click copy.

## Technical Highlights

### Single-Stroke Vector Fonts (Hershey Fonts)
I use Hershey fonts — vector fonts designed in the 1960s by Dr. Allen V. Hershey at the Naval Weapons Laboratory. Unlike regular fonts (which are filled outlines), these are true single-stroke paths made of just `M` (move) and `L` (line) commands. This makes them perfect for stroke-dashoffset animation because each character is one continuous pen path, not a filled shape.

### SVG Stroke Animation Without Libraries
The animation preview uses a pure SVG technique: each path gets `stroke-dasharray` and `stroke-dashoffset` set to its total length (plus a 2-unit buffer to prevent round linecap artifacts from `getTotalLength()` float imprecision). A `requestAnimationFrame` loop gradually reduces the offset, revealing the path. Each stroke has independent timing with cubic ease-out, creating a natural writing cadence.

### Stroke Processing Pipeline
Raw drawn points go through a multi-stage pipeline: two-pass moving average smoothing (windows of 5 and 3) to remove hand tremor, Ramer-Douglas-Peucker simplification (tolerance 2.8) to reduce point count, then Catmull-Rom spline interpolation converted to SVG cubic Bézier curves for smooth output.

## Development Story

- **Origin**: I found Kian Bazza's animated signature React component and wanted a way to generate it with any signature, not just hardcoded paths.
- **Hardest Part**: Getting the freehand drawing to feel natural. I went through many iterations on the input system — including Pointer Lock API for trackpad drawing — before settling on the simple movement-based approach with spacebar toggle and lift timeout.
- **Lessons Learned**: Sometimes the simplest approach wins. The trackpad-specific Pointer Lock implementation was complex and brittle; removing it in favor of basic pointermove with a pause toggle was both simpler code and better UX.
- **Future Plans**: Potentially add more font options, stroke width customization, and color selection.

## Frequently Asked Questions

### How does the drawing work without clicking?
When drawing is unpaused (via spacebar), any `pointermove` event on the canvas starts a stroke. If the pointer stops moving for 150ms, the stroke ends automatically. This mimics natural pen-up/pen-down behavior without requiring mouse buttons.

### What are Hershey fonts?
Single-stroke vector fonts created in the 1960s by Dr. Allen Hershey. Unlike normal fonts (filled outlines), each character is a series of line segments forming one continuous stroke — perfect for pen-drawing animation effects.

### Why is there a +2 buffer on stroke-dashoffset?
SVG's `getTotalLength()` returns a float that can be slightly imprecise. With `stroke-linecap: round`, even a sub-pixel gap between the dasharray and actual path length causes a tiny visible dot at the path start. Adding 2 units of buffer ensures the path is fully hidden before animation begins.

### Why a single HTML file instead of a framework?
Zero dependencies means zero build step. The entire app deploys as one static file on Vercel. The Hershey font data (~40KB) is embedded so there are no external requests. This keeps it simple, fast, and easy to fork.

### What does the exported React component require?
The generated component uses `motion/react` (Framer Motion) for `pathLength` animation and `cn` from `@/lib/utils` for Tailwind class merging. These are common in Next.js + Tailwind projects.

### Why does the first stroke sometimes look different?
The drawing system waits for 3+ points before rendering quadratic Bézier curves. With only 1-2 points, it only moves to the start position without drawing a visible line, preventing the initial "glitch" of a straight segment appearing.
