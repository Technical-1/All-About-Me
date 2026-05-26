# Project Q&A

## Overview

**Differential Growth Simulator** is a Progressive Web App that generates organic, coral-like generative art from text, images, and shapes using differential growth algorithms. Users can type any text, upload an image, select from a shape library, generate procedural patterns, or draw freehand with a brush tool, and watch as the simulation fills the shape with intricate, naturally-growing patterns reminiscent of coral reefs, lichen, or frost formations. The app runs entirely in the browser with offline support, making it accessible to artists, designers, and anyone curious about generative art without requiring software installation or technical expertise.

## Problem Solved

Traditional generative art tools often require programming knowledge or expensive software. This simulator democratizes differential growth — a fascinating natural phenomenon — by providing an intuitive visual interface. Users can create unique, organic artwork in seconds and export it in various formats for use in design projects, prints, or social media.

## Target Users

- **Graphic designers** seeking unique organic textures and patterns
- **Artists** exploring generative and algorithmic art
- **Educators** demonstrating natural growth patterns and emergent complexity
- **Hobbyists** interested in creative tools and digital art
- **Developers** learning about physics simulations and canvas rendering

## Key Features

### Multiple Input Modes
Transform any text into organic growth patterns, upload images to fill with coral-like textures, choose from procedural shapes (circles, stars, hearts, spirals), generate mathematical patterns (fractals, noise fields, grids), or paint freehand with the brush tool (circle, line, scatter, ribbon modes).

### Real-Time Physics Simulation
The differential growth algorithm simulates thousands of interconnected nodes applying repulsion, attraction, and alignment forces. Growth happens in real-time with 30+ FPS performance even with 5,000+ nodes.

### Force Field System
Apply six types of force fields (attraction, repulsion, vortex, turbulence, directional, gravity) to guide growth direction and create interesting distortion effects. Fields are configurable with strength, radius, and falloff.

### Layer System
Manage multiple independent growth layers with visibility, opacity, and blend mode controls. Layers render in order and can be reordered, locked, or soloed.

### Adaptive Quality System
The app monitors frame rate and automatically adjusts simulation quality on slower devices. Users get the best possible experience regardless of their hardware.

### Comprehensive Export Options
Export creations as PNG, SVG, PDF, WebP, animated GIF, or video (MP4/WebM). SVG export preserves vector paths for infinite scaling. Video export uses ffmpeg.wasm for in-browser encoding.

### Sharing
Generate compact shareable URLs that encode simulation settings. QR codes are generated automatically for easy mobile sharing.

### Progressive Web App
Install on any device, work offline, auto-save progress, copy images directly to clipboard, and share via native share APIs on mobile devices.

### Phase-Based Animation
Define growth phases with different parameters to create dynamic animations — start tight and sparse, then expand into dense organic fills.

## Technical Highlights

### Spatial Hash Grid
The core performance optimization. I reduced neighbor detection from O(n^2) to O(1) by partitioning space into a grid. Each cell tracks which nodes it contains, so finding nearby nodes only requires checking 9 cells instead of all nodes.

### Object Pooling
Growing paths constantly create new nodes. Rather than allocating new objects (which triggers garbage collection), I implemented a `NodePool` that pre-allocates and recycles node instances. This eliminated noticeable GC pauses during animation.

### Ref-Based Animation State
React's re-render cycle is too slow for 60 FPS animation. I store animation state (FPS, node count, iteration) in refs and only sync to React state when the simulation pauses or at low frequency intervals. This keeps the UI responsive without re-render overhead.

### Mask-Constrained Growth
Growth is constrained within boundaries using a mask texture. Rather than hard-clipping nodes (which breaks path continuity), I apply force fields that push nodes back inside when they drift outside. This produces smoother, more natural-looking edges.

### DPR-Aware Rendering
The canvas is sized at `width * devicePixelRatio` internally but displayed at CSS `width`. This ensures crisp rendering on Retina and high-DPI displays without blurry scaling artifacts.

### Input Validation & Security
All user inputs pass through Zod schemas for runtime type checking. Color values are sanitized against injection. Content Security Policy headers protect against XSS while supporting WebAssembly for ffmpeg. Error stack traces are stripped from analytics metadata in production.

## Engineering Decisions

### Standalone simulation class vs. React-embedded state
- **Constraint**: The simulation runs at 60 FPS with thousands of mutable nodes; React re-render cycles cannot keep up.
- **Options**: Drive state through `useState`/`useReducer`, use React refs end-to-end, or extract a pure TypeScript class.
- **Choice**: `DifferentialGrowth` is a standalone class in `src/lib/DifferentialGrowth.ts`. A thin `useGrowthSimulation` hook bridges it to React.
- **Why**: The engine keeps mutable state without violating React invariants, can be unit-tested in isolation, and is portable to a Web Worker or CLI later.

### Zustand over Redux or Context
- **Constraint**: Three concerns to manage (simulation params, theme, transient UI) without provider-tree re-render storms.
- **Options**: Redux Toolkit, React Context with reducers, Jotai/Recoil, Zustand.
- **Choice**: Three Zustand stores: `growthStore`, `themeStore` (persisted), `uiStore`.
- **Why**: Selector-based subscriptions avoid context re-render thrash, the API stays minimal, and the persistence middleware handles theme storage without extra wiring.

### Canvas 2D primary with WebGL fallback path, not the other way around
- **Constraint**: Reliable rendering across all target browsers and devices, with a future path to GPU-accelerated rendering at very high node counts.
- **Options**: WebGL-only, Canvas 2D-only, or an `IRenderer` abstraction with both.
- **Choice**: `IRenderer` interface with Canvas 2D as the default and WebGL 2.0 as an opt-in path; `RendererFactory` picks based on capability.
- **Why**: Canvas 2D handles the current node-count ceiling at 60 FPS, has zero compatibility risk, and the abstraction lets the WebGL renderer mature without changing call sites.

### URL state encoding for sharing instead of a backend
- **Constraint**: Users want to share their compositions, but the project is a static PWA with no server.
- **Options**: Stand up a backend with database storage, use a third-party paste service, or encode state in the URL.
- **Choice**: `ShareService` compresses settings and seed data into a Base64 URL fragment, with `qrcode` for mobile handoff.
- **Why**: Zero infrastructure, zero privacy concerns, the whole product stays deployable on a static host, and the QR path makes mobile sharing trivial.

## Frequently Asked Questions

### Q: How does differential growth work?

Differential growth simulates how organisms like coral, lichen, and some plants grow. It models a chain of connected points (nodes) with three main forces: repulsion (nodes push apart when too close), attraction (connected nodes pull toward each other), and alignment (nodes try to stay smooth with their neighbors). When the distance between two connected nodes exceeds a threshold, a new node is inserted between them — this is the "growth." The combination of growth and forces creates the characteristic organic, space-filling patterns.

### Q: Why does the simulation stop before reaching the maximum nodes?

The simulation uses stabilization detection. When growth rate drops significantly (less than 0.5 nodes per frame average over 20 frames), it concludes the shape is filled and stops. This prevents wasted computation on simulations that have effectively completed. You can increase the max nodes limit or adjust parameters like repulsion radius to encourage more growth.

### Q: Can I use the generated art commercially?

Yes. The app is MIT licensed, and artwork you create is yours to use however you wish, including commercial projects. Attribution is appreciated but not required.

### Q: Why is video export slow?

Video export uses ffmpeg.wasm, which runs WebAssembly in the browser. While convenient (no server needed), it is significantly slower than native ffmpeg. For best results, export shorter clips or use lower resolutions. Alternatively, export individual frames and combine them with desktop video software.

### Q: How do I get sharper exports?

Use the 2x or 4x scale options in the export dialog. The app renders at device pixel ratio by default, but higher scales create larger, more detailed outputs suitable for printing.

### Q: Why does performance drop with many nodes?

Even with spatial hashing optimization, more nodes mean more force calculations. The adaptive quality system helps by reducing the maximum node limit on slower devices. For best performance, use the "sparse" preset or reduce the max nodes setting manually.

### Q: Can I import my own fonts?

Currently, text rendering uses system fonts via the Canvas 2D API. Custom font support would require loading font files with opentype.js and converting them to paths. This is technically possible but not yet implemented. For now, you can upload an image of text in your desired font as a workaround.

### Q: How do force fields work?

Force fields are external influences placed on the canvas that affect node movement during simulation. Each field type creates different effects — vortex fields create spiraling patterns, turbulence adds organic noise, directional fields push growth in a consistent direction. You can combine multiple fields and adjust their strength, radius, and falloff from the Force Field panel.

### Q: How do I share my creations?

Use the Share button to generate a URL that encodes your current settings. A QR code is generated automatically for mobile sharing. You can also use native sharing on mobile devices, copy images directly to clipboard, or export files manually.

### Q: Does the app work offline?

Yes. After the first visit, the PWA caches all necessary assets. You can work offline, and creations are auto-saved to IndexedDB. Install the app to your home screen for the best offline experience.
