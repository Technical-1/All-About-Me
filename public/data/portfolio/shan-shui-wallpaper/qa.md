# Project Q&A

## Overview

Shan Shui Wallpaper is a macOS menu bar app that turns Lingdong Huang's procedural Chinese landscape generator, shan-shui-inf, into a live desktop wallpaper: an ink painting that scrolls slowly and endlessly behind the desktop icons. It is for anyone who wants a calm, never-repeating background. The interesting technical part is the rendering pipeline, which takes a generator designed to redraw an enormous SVG on every step and makes it scroll continuously with no script running per frame.

## Problem Solved

The original generator is a web page: it draws a fixed 3000×800 window, steps sideways when you click, and rebuilds the entire drawing each time. That is fine to look at once, but it cannot be a wallpaper. It does not fill a screen, it does not move smoothly, and redrawing constantly would keep a laptop busy all day. This project supplies the missing layer between the generator and the desktop.

## Target Users

- **Mac users who want a living wallpaper** — an ambient background that changes continuously without being distracting or expensive to run.
- **People who admire the original project** — a way to live with it rather than visit it, with controls over composition and colour.

## Key Features

### Endless, seeded landscape
Terrain is generated just ahead of the view and discarded behind it, so the scene can run indefinitely in bounded memory. Each painting comes from a seed, and "New Landscape" picks another.

### Terrain and colour controls
Sliders change zoom, mountain density, peak height, distant peaks and boats. Ink and paper colours change live, with presets from classic sepia to light-on-dark.

### Stays out of the way
The window ignores the mouse, never appears in the app switcher, and sits below the desktop icons. The drift stops whenever the desktop is covered and, optionally, on battery power.

### Seamless with full-screen apps
The system wallpaper is kept as a still of the current painting, so the swipe back from a full-screen app never reveals a different background.

### Proper distribution
Universal binary, Developer ID signed, notarized and stapled, shipped as a disk image by a tag-triggered pipeline.

## Technical Highlights

### Scrolling with no per-frame script
The scene is rasterized into canvas tiles and the strip of tiles is moved by a single linear transform animation (`startSegment` in `web/wallpaper.js`). The compositor runs it, so the page's main thread is idle between tile renders and a 150 ms render never causes a stutter. Speed changes just alter the animation's `playbackRate`. The strip is re-based every 24 tiles so offsets stay small.

### Coverage tiles for instant recolouring
Each tile's SVG is wrapped in a filter that flattens it onto white and maps luminance to alpha (`renderTile`). The resulting canvas holds only where the ink is. Colour is applied afterwards with one `source-in` fill (`tint`), so changing ink colour re-fills a handful of canvases and never re-renders the scene. This also removed the multiply blend mode the original relies on, which is what makes light ink on dark paper possible.

### Drawing only what overlaps a tile
The generator anchors each mountain or tree at an x position but gives no bounds, and wide elements reach far into neighbouring tiles. Including everything within a safe margin put about 20 MB of markup into every tile. `measure` scans an element's polyline points once to get its true extent, and each tile then includes only what overlaps it: about 3 MB per tile, with first paint in about a second.

### Keeping the drift honest across suspension
WebKit suspends a page whose window is hidden, but a compositor animation keeps advancing. On return the strip had moved past everything painted. The page now pauses on `visibilitychange`, and `pump` detects and undoes any jump in animation time larger than a few seconds of drift.

## Engineering Decisions

### Unmodified vendor file plus build-time patches
- **Constraint**: Composition constants are hardcoded inside the generator, and the original should remain clearly credited and intact.
- **Options**: Fork and edit the file; monkey-patch at runtime; rewrite at build time.
- **Choice**: Exact-match rewrites in `scripts/extract-engine.mjs`, applied while extracting the generator from the untouched vendored page.
- **Why**: The complete list of changes is six lines in one file, and the build stops if any pattern fails to match exactly once.

### System web view over a native port
- **Constraint**: The generator is about 4,000 lines of JavaScript producing SVG strings.
- **Options**: Port it to Swift and Core Graphics; embed a JavaScript engine and draw natively; host it in `WKWebView`.
- **Choice**: `WKWebView`.
- **Why**: It runs the original code as written, gives SVG rasterization and compositor animations for free, and WebKit already throttles and suspends hidden pages. The cost is a web content process, which is the app's main memory use.

### A still as the system wallpaper
- **Constraint**: macOS shows the real wallpaper during the swipe back from a full-screen space, regardless of how the window is configured.
- **Options**: Accept the flash; try window collection behaviours; set the system wallpaper to match.
- **Choice**: Set the system wallpaper to a still once a minute, and rewind the drift to that still when hidden.
- **Why**: Matching position as well as content is what makes the handover invisible. It changes a system setting, so it is a toggle and the original is restored on quit.

### No Xcode project
- **Constraint**: Six Swift files, no third-party packages, and a build that has to run identically on a laptop and in CI.
- **Options**: Xcode project; Swift Package; a shell script.
- **Choice**: `build.sh` calling `swiftc` and assembling the bundle by hand.
- **Why**: The whole build, including universal slices and signing, is readable in one screen and has nothing to keep in sync.

## Frequently Asked Questions

### Is the artwork yours?
No. Every mountain, tree and boat is drawn by the original generator. This project is the wallpaper machinery around it.

### Does it ever repeat?
Not in practice. Terrain is generated continuously from a seeded generator. The original's random number source would eventually fall into short cycles on a run of days, so it is replaced with a seeded sfc32.

### How much does it cost to run?
Scrolling itself is done by the compositor. The page does a fraction of a second of work each time a new tile is needed, roughly once a minute at the default speed, and stops entirely when the desktop is hidden. The web content process holding the tiles is the main memory cost.

### Why does it change my system wallpaper?
So that swiping back from a full-screen app shows the same picture and not your old background. It can be turned off in settings, and your own wallpaper is put back when the app quits.

### Why did the pylons survive but the roof sign did not?
Both are deliberate jokes in the original. The electricity pylons sit quietly in the landscape, so they are a toggle. The sign was lettered text on a rooftop, which reads badly on a wallpaper, so it is removed at build time.

### Can I use it on more than one display?
Yes. Each display gets its own window and its own stretch of scenery from the same seed.

### Why do terrain sliders restart the painting?
Terrain settings change what the generator produces, and scenery already drawn cannot be altered. Applying them only to new terrain would take minutes to scroll into view, so the scene repaints from the start with the same seed.
