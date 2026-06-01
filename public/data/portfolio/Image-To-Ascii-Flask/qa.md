# Project Q&A

## Overview

This is a Flask web app that converts uploaded images into ASCII art with a live-updating preview. Users pick an image, adjust width/height and the character ramp, and the server returns ASCII as JSON for instant on-screen rendering, copy, or download. The interesting technical work is in hardening a public file-upload endpoint and making server-side SVG conversion deploy reliably.

## Problem Solved

People want to turn an image into ASCII art without installing anything. A hosted web tool removes the friction of a local Python setup, and doing the conversion server-side keeps the browser-side code trivial while supporting formats (including SVG) that need native libraries to process.

## Target Users

- **Casual users** — anyone who wants to drop in an image and get shareable text art.
- **Developers** — people grabbing ASCII for READMEs, terminal banners, or comments.

## Key Features

### Live preview with debounced conversion
Changing the width/height sliders or character set re-runs the conversion automatically, debounced in `script.js` so rapid slider drags don't flood the server with requests.

### Multiple character sets plus custom ramps
Presets (standard, extended, simple, blocks, detailed) cover different detail/contrast trade-offs, and a custom field lets users supply any ramp.

### Broad format support including SVG
PNG, JPG, GIF, BMP, and WEBP are decoded directly by Pillow; SVG uploads are rasterized to PNG by cairosvg first, so vector art works too.

### Copy and download
The rendered ASCII can be copied to the clipboard or downloaded as a text file from the browser.

## Technical Highlights

### Hardened upload endpoint
`POST /convert` validates the file extension against an allowlist, enforces a 16 MB body cap (`MAX_CONTENT_LENGTH`), and clamps width/height to `[1, 300]` via `parse_dimension`. Bad client input returns a `400`; unexpected failures log the real exception server-side and return a generic `500`, so internals never leak to the client.

### Reflected-XSS-safe error rendering
Conversion errors are returned as plain text/JSON rather than interpolated into HTML, closing a reflected-XSS vector where a crafted filename or message could otherwise be echoed back as markup.

### In-memory SVG rasterization
SVG bytes are read straight from the upload, passed to `cairosvg.svg2png`, and wrapped in a `BytesIO` for Pillow — no temp files touch disk. The conversion path is identical for raster and rasterized-SVG inputs from that point on.

### Bounded resize to prevent memory exhaustion
Because the image is resized to the requested grid with LANCZOS, an unbounded dimension could blow up memory. Capping the max dimension at 300 keeps any single request cheap regardless of the source image size.

## Engineering Decisions

### Server-side conversion over client-side
- **Constraint**: Support formats like SVG that need native libraries, while keeping the front-end simple.
- **Options**: Do everything in-browser with Canvas, or convert on the server.
- **Choice**: Server-side conversion with Pillow + cairosvg.
- **Why**: Native SVG rasterization and consistent Pillow output are easier server-side; the browser only has to POST a file and render text. (A separate client-side build exists for the offline/zero-latency use case.)

### Docker on Render instead of the default buildpack
- **Constraint**: cairosvg needs `libcairo2`, which the stock Python buildpack lacks — SVG conversion failed in production.
- **Options**: Hope the platform base image ships cairo, or pin it ourselves.
- **Choice**: A Dockerfile that installs `libcairo2`, wired up via `render.yaml`.
- **Why**: Pinning the system dependency in the image is the only reliable fix; it makes the production environment reproducible.

### No upload directory
- **Constraint**: Uploaded files are only needed transiently.
- **Options**: Save to a temp dir and clean up, or process in memory.
- **Choice**: Process the upload stream in memory.
- **Why**: Removes cleanup logic, disk-write permissions, and a class of race conditions; the size caps keep memory bounded.

## Frequently Asked Questions

### How does an image become ASCII?
The server converts the image to grayscale, resizes it to the requested character grid with LANCZOS resampling, then maps each pixel's brightness (0–255) to a character in the ramp — darker pixels get denser glyphs.

### Why does the preview update on its own?
The front-end debounces slider and character-set changes and re-POSTs to `/convert`, so the ASCII refreshes shortly after you stop adjusting without a manual "convert" click.

### How are SVG files handled?
SVGs can't be decoded by Pillow directly, so cairosvg rasterizes them to PNG bytes in memory first; the rest of the pipeline is identical to raster uploads. This is why the production image installs `libcairo2`.

### Is there a file size or dimension limit?
Yes — uploads are capped at 16 MB, and the output width/height are clamped to 1–300 characters to keep each conversion cheap and prevent memory exhaustion.

### Why run on port 5001 locally?
macOS often uses port 5000 for AirPlay, so the dev server defaults to 5001; you can pass a different port as a CLI argument.

### Is there a command-line version?
The core `image_to_ascii` logic also runs as a standalone script, and a dedicated CLI build of the converter exists separately for headless/scripted use.
