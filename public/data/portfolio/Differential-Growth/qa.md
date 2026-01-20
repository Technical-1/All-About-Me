# Project Q&A

## Overview

**Differential Growth Simulator** is a Progressive Web App that generates organic, coral-like generative art from text, images, and shapes using differential growth algorithms. Users can type any text, upload an image, select from a shape library, or draw freehand, and watch as the simulation fills the shape with intricate, naturally-growing patterns reminiscent of coral reefs, lichen, or frost formations. The app runs entirely in the browser with offline support, making it accessible to artists, designers, and anyone curious about generative art without requiring software installation or technical expertise.

## Problem Solved

Traditional generative art tools often require programming knowledge or expensive software. This simulator democratizes differential growth - a fascinating natural phenomenon - by providing an intuitive visual interface. Users can create unique, organic artwork in seconds and export it in various formats for use in design projects, prints, or social media.

## Target Users

- **Graphic designers** seeking unique organic textures and patterns
- **Artists** exploring generative and algorithmic art
- **Educators** demonstrating natural growth patterns and emergent complexity
- **Hobbyists** interested in creative tools and digital art
- **Developers** learning about physics simulations and canvas rendering

## Key Features

### Multiple Input Modes
Transform any text into organic growth patterns, upload images to fill with coral-like textures, choose from procedural shapes (circles, stars, hearts, spirals), generate geometric patterns, or paint freehand with the brush tool.

### Real-Time Physics Simulation
The differential growth algorithm simulates thousands of interconnected nodes applying repulsion, attraction, and alignment forces. Growth happens in real-time with 30+ FPS performance even with 5,000+ nodes.

### Adaptive Quality System
The app monitors frame rate and automatically adjusts simulation quality on slower devices. Users get the best possible experience regardless of their hardware.

### Comprehensive Export Options
Export creations as PNG, SVG, PDF, WebP, animated GIF, or video (MP4/WebM). SVG export preserves vector paths for infinite scaling. Video export uses ffmpeg.wasm for in-browser encoding.

### Progressive Web App
Install on any device, work offline, auto-save progress, copy images directly to clipboard, and share via native share APIs on mobile devices.

### Phase-Based Animation
Define growth phases with different parameters to create dynamic animations - start tight and sparse, then expand into dense organic fills.

### Force Fields
Apply radial, directional, vortex, or wave force fields to guide growth direction and create interesting distortion effects.

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

## Frequently Asked Questions

### Q: How does differential growth work?

Differential growth simulates how organisms like coral, lichen, and some plants grow. It models a chain of connected points (nodes) with three main forces: repulsion (nodes push apart when too close), attraction (connected nodes pull toward each other), and alignment (nodes try to stay smooth with their neighbors). When the distance between two connected nodes exceeds a threshold, a new node is inserted between them - this is the "growth." The combination of growth and forces creates the characteristic organic, space-filling patterns.

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

### Q: How do I create perfectly symmetrical patterns?

The simulation includes intentional randomness for organic appearance. For more symmetrical results, use the shape selector with geometric shapes (circle, polygon) and reduce the alignment strength while increasing attraction. Alternatively, export to SVG and use vector software to mirror/duplicate the result.

### Q: Does the app work offline?

Yes. After the first visit, the PWA caches all necessary assets. You can work offline, and creations are auto-saved to IndexedDB. Install the app to your home screen for the best offline experience.

### Q: How do I share my creations?

Use the Share button to access native sharing on mobile devices, copy images directly to clipboard, or generate a shareable URL that encodes your current settings. You can also export and share the files manually.
