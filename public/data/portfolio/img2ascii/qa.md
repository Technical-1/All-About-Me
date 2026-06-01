# Project Q&A

## Overview

`img2ascii` is a single-file Python command-line tool that converts raster images into ASCII art. It resizes an image to a character grid, maps each pixel's brightness onto a configurable character ramp, and prints the result as plain text or SVG. The interesting technical angle is that its core is a small, polymorphic function reusable from a terminal, another script, or a web backend.

## Problem Solved

ASCII art generators are usually buried in interactive web apps. When you want to convert images from a shell script, a build step, or a batch job — or embed the conversion logic in a Python service — you need something headless and importable. `img2ascii` is that headless counterpart.

## Target Users

- **Scripters / automation** — people who want to convert images in a pipeline or cron job without a browser.
- **Python developers** — anyone who wants to `import image_to_ascii` and get ASCII rows back from a path, a PIL image, or an upload stream.
- **Terminal tinkerers** — users who just want to drop an image into the terminal as text art.

## Key Features

### Brightness-mapped conversion
Each pixel's grayscale luminance (0–255) is scaled to an index into a character ramp ordered dark-to-light, so denser glyphs land on darker regions.

### Configurable grid and ramp
Width, height, and the character set are all flags, letting users trade detail against contrast and control aspect ratio (characters are taller than wide, so the grid is set explicitly rather than inferred).

### Text or SVG output
Plain text for terminals and files; SVG `<tspan>` elements (with XML-escaped content and computed line offsets) for embedding the art in a vector graphic.

### Importable core
`image_to_ascii()` accepts a file path, a PIL `Image`, or a file-like object, so the same logic serves CLI, library, and server callers.

## Technical Highlights

### Delegating downsampling to LANCZOS
Rather than sampling one source pixel per character, the image is resized to the exact `(width, height)` character grid with Pillow's LANCZOS resampling, then read cell-by-cell. High-quality resampling averages detail into each cell, producing cleaner art than nearest-neighbor sampling — relevant code is the `resize` + `getdata` loop in `image_to_ascii`.

### Polymorphic input handling
`image_to_ascii` branches on input type: `str` paths and file-like objects are opened with `Image.open`, while an existing PIL `Image` is used directly. This lets a Flask upload handler pass a stream and a CLI pass a path through the identical function with no temp-file dance.

### SVG escaping
`format_for_svg` escapes `&`, `<`, and `>` before emitting `<tspan>` content, so character ramps containing markup-significant glyphs produce valid SVG.

## Engineering Decisions

### Grayscale-only in the CLI
- **Constraint**: A richer browser-based converter already handles color modes, edge detection, and live preview.
- **Options**: Port the full color pipeline to the CLI, or keep the CLI minimal.
- **Choice**: Grayscale luminance mapping only.
- **Why**: The CLI's value is portability and scriptability. Color and interactivity belong in the web app; duplicating them here would add weight without serving the headless use case.

### Pillow as the only dependency
- **Constraint**: The tool should be trivial to install and vendor into other projects.
- **Options**: Add an SVG rasterizer for SVG *input*, or stay raster-only.
- **Choice**: Raster input via Pillow alone; SVG is an *output* format, not an input one.
- **Why**: SVG input would require a native rasterizer (cairo) and the system-library friction that comes with it. Keeping a single pure-Python-installable dependency makes `pip install -r requirements.txt` fast and reliable.

## Frequently Asked Questions

### How does the brightness-to-character mapping work?
The image is converted to grayscale, so each pixel is a value from 0 (black) to 255 (white). That value is scaled to an index into the character ramp: `int(pixel / 255 * (len(chars) - 1))`. Because the default ramp `@%#*+=-:. ` runs dense-to-sparse, darker pixels get heavier characters.

### Why do I have to set both width and height?
Terminal characters are taller than they are wide, so a grid that matches the image's pixel aspect ratio looks vertically stretched. Setting height independently lets you compensate (a common starting point is height ≈ half the width).

### Can I use my own characters?
Yes — pass `--chars` with any string ordered dark-to-light, e.g. `--chars " .:-=+*#%@"`. The first character maps to the brightest pixels and the last to the darkest, depending on ramp order.

### Can I convert SVG files?
No — input must be a raster format Pillow can decode (PNG, JPG, GIF, BMP, WEBP). SVG here refers only to the `--format svg` *output* mode. Rasterizing SVG input would pull in a native dependency this tool deliberately avoids.

### Can I call it from my own Python code?
Yes. `from img2ascii import image_to_ascii` and call it with a path, a PIL `Image`, or any file-like object; it returns a list of strings, one per row.

### What happens on a bad image or empty character set?
`image_to_ascii` raises `ValueError` (empty `chars` is rejected explicitly, and decode failures are wrapped), and the CLI prints the error to stderr and exits non-zero so it composes correctly in scripts.
