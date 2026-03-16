# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | 5.7.2 | Type safety throughout the codebase |
| Framework | Next.js | 15.1.2 | React framework with App Router and optimized builds |
| UI Library | React | 19.0.0 | Concurrent rendering and improved performance |
| Styling | Tailwind CSS | 3.4.17 | Utility-first styling with custom theme integration |
| Animation | Framer Motion | 11.15.0 | UI transitions and gesture support |

### Why These Choices

**Next.js 15 + React 19**: I chose the latest versions to leverage React 19's improved concurrent rendering and Next.js 15's enhanced App Router. The App Router's server components provide excellent initial load times, though this app is primarily client-side due to the canvas-heavy nature.

**TypeScript**: Essential for a simulation with complex data structures. Type safety caught numerous bugs during development, especially around the physics engine's vector math and force calculations.

**Tailwind CSS**: Rapid iteration on UI design. I created a custom theme with CSS variables (`--theme-primary`, `--theme-background`, etc.) that allows runtime theme switching without CSS regeneration.

## State Management

| Technology | Version | Purpose |
|------------|---------|---------|
| **Zustand** | 5.0.9 | Lightweight state management with persistence middleware |

### Store Architecture

I chose Zustand over Redux for its minimal boilerplate and excellent TypeScript support. Three separate stores handle different concerns:

- **growthStore**: Simulation parameters (repulsion, attraction, etc.)
- **themeStore**: Visual theme with localStorage persistence
- **uiStore**: Transient UI state (panel open/close, dialog visibility)

## Validation & Security

| Technology | Version | Purpose |
|------------|---------|---------|
| **Zod** | 4.3.6 | Runtime schema validation for all user inputs |

### Validation Strategy

All user-facing inputs (growth settings, render options, shared URL state) pass through Zod schemas before reaching the simulation engine. Color values are sanitized against injection. Content Security Policy headers restrict script execution and support WebAssembly for ffmpeg.

## Rendering

| Technology | Purpose |
|------------|---------|
| **Canvas 2D API** | Primary rendering path — reliable across all browsers |
| **WebGL 2.0** | Hardware-accelerated rendering for high node counts |

### Rendering Strategy

I implemented a renderer abstraction (`IRenderer`) with automatic fallback:
1. Attempt WebGL 2.0 for maximum performance
2. Fall back to Canvas 2D if WebGL unavailable
3. Both renderers share the same interface

The Canvas 2D renderer handles all current use cases well. The WebGL renderer is structured for future optimization with instanced rendering when node counts exceed 10,000.

## Export & Media

| Technology | Version | Purpose |
|------------|---------|---------|
| **jsPDF** | 4.2.0 | PDF vector export for print-ready output |
| **ffmpeg.wasm** | 0.12.15 | In-browser video encoding for MP4/WebM export |
| **@ffmpeg/util** | 0.12.2 | Utility functions for ffmpeg.wasm integration |

### Export Philosophy

All heavy export dependencies are dynamically imported only when needed. This keeps the initial bundle small while supporting:
- PNG (native canvas)
- SVG (path generation from simulation data)
- PDF (via jsPDF)
- WebP (native canvas)
- GIF (frame capture + encoding)
- MP4/WebM (via ffmpeg.wasm)

## Sharing

| Technology | Version | Purpose |
|------------|---------|---------|
| **qrcode** | 1.5.4 | QR code generation for shareable URLs |

State is compressed and encoded into URLs for sharing. QR codes make it easy to share on mobile.

## PWA Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| **@ducanh2912/next-pwa** | 10.2.9 | Service worker generation and caching strategies |
| **IndexedDB** | Browser API | Offline storage for cached creations |
| **Clipboard API** | Browser API | Direct image copying to clipboard |

### Offline-First Design

I prioritized offline functionality:
- Service worker caches the app shell and assets
- CreationCache stores thumbnails and settings in IndexedDB
- Auto-save periodically captures work in progress
- The app functions completely offline after initial load

## Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| **Vitest** | 2.1.8 | Fast unit testing with native ESM support |
| **Playwright** | 1.57.0 | End-to-end and visual regression testing |
| **Testing Library** | 16.1.0 | React component testing utilities |
| **JSDOM** | 25.0.1 | DOM simulation for unit tests |

### Testing Strategy

- **Unit tests**: Core simulation logic (DifferentialGrowth, Vector2D, SpatialHash)
- **Validation tests**: Zod schema and sanitization coverage
- **Performance benchmarks**: Ensure spatial hash maintains O(1) lookups
- **Visual regression**: Playwright captures screenshots for render consistency
- **Integration tests**: React hooks with Testing Library

## Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **sharp** | 0.34.5 | Image processing for development assets |
| **autoprefixer** | 10.4.20 | CSS vendor prefixing |
| **postcss** | 8.4.49 | CSS processing pipeline |

## UI Components

| Technology | Version | Purpose |
|------------|---------|---------|
| **@heroicons/react** | 2.2.0 | Consistent icon set throughout the UI |
| **opentype.js** | 1.3.4 | Font parsing for text-to-path conversion |

## Infrastructure & Deployment

| Platform | Purpose |
|----------|---------|
| **Vercel** | Production hosting with edge caching |
| **GitHub** | Source control and CI/CD triggers |

### Deployment Pipeline

The project is configured for zero-config Vercel deployment:
- `next.config.ts` includes PWA configuration and CSP headers
- Automatic builds on push to main
- Preview deployments for pull requests
- Edge caching for optimal global performance

## Key Dependencies Deep Dive

### opentype.js
I use this for parsing font files to generate accurate text outlines. The built-in Canvas `measureText()` provides dimensions but not path data. Opentype.js extracts actual glyph paths which I convert to simulation seed points.

### Framer Motion
Handles all UI animations — panel transitions, button hovers, and dialog animations. I chose it over CSS animations for:
- Declarative API that integrates well with React state
- `AnimatePresence` for exit animations
- Gesture support for drag interactions

### Zod
Runtime validation for all user inputs and shared state. Schemas define valid ranges for simulation parameters, preventing invalid states from crashing the simulation. This is especially important for URL-encoded shared states where input isn't trusted.

### @ducanh2912/next-pwa
Generates the service worker and manifest automatically from Next.js configuration. I customized the caching strategy to:
- Cache-first for static assets
- Network-first for API routes (none currently, but future-proofed)
- Stale-while-revalidate for the HTML shell

## Performance Considerations

### Bundle Size
- Core app: ~180KB gzipped
- jsPDF: Loaded on-demand (~200KB)
- ffmpeg.wasm: Loaded on-demand (~25MB, only for video export)

### Runtime Performance
- Spatial hash enables 60 FPS with 5,000+ nodes
- Object pooling eliminates GC pauses
- Adaptive quality system downgrades gracefully on slower devices
- DPR-aware rendering for crisp display on high-DPI screens
