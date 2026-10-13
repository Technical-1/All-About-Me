# Technology Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (ES modules) | — | The effect is a few hundred lines of canvas maths; no type system or compile step needed |
| Rendering | HTML5 Canvas 2D | Native | The effect is flat; 2D canvas keeps the whole simulation on the CPU with no shader code |
| Build | Vite | ^7.2.4 (lockfile 7.3.3) | Zero-config dev server and production build for a plain-JS page |
| Testing | Vitest | ^4.1.7 | Runs the pure simulation module natively as ES modules, with the same config as Vite |
| Font | Montserrat Black (900) | Google Fonts | Bold geometric sans-serif close to the show's title type, which gives dense particle outlines |

## Frontend

- **Framework**: none — vanilla JavaScript
- **State Management**: module-level variables in `src/main.js` (`particles`, `waves`, `config`, `currentText`)
- **Styling**: inline `<style>` block in `index.html` (translucent, blurred input and button over a black canvas)
- **Build Tool**: Vite

## Infrastructure

- **Hosting**: Vercel static hosting at `pluribus-text-gen.vercel.app`
- **CI/CD**: none in the repo (no workflow files or `vercel.json`)
- **Monitoring**: none

### PWA

- **Manifest**: `public/manifest.webmanifest`, standalone display, black background and theme colour
- **Icons**: `icon-192.png` / `icon-512.png` with purpose `any`, and `icon-maskable-192.png` / `icon-maskable-512.png` with purpose `maskable`
- **Apple**: `apple-touch-icon` (180 px), `apple-mobile-web-app-capable`, black-translucent status bar

## Development Tools

- **Package Manager**: npm (`package-lock.json`)
- **Linting**: none configured
- **Formatting**: none configured
- **Testing**: Vitest — 15 tests in `src/simulation.test.js` across `waveForce`, `waveVisualParticleCount` and `textScanBounds`

### Requirements

- Node.js 20.19+ or 22.12+ (Vite 7's engine range)

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Dev server on `localhost:5173` |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Serve the production build locally |
| `test` | `vitest run` | Run the test suite once |
| `test:watch` | `vitest` | Run tests in watch mode |
| `generate-icons` | `node scripts/generate-icons.js` | Render the PWA icons from SVG |

## Key Dependencies

There are no runtime dependencies; all three packages are dev dependencies.

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^7.2.4 | Dev server and bundler |
| `vitest` | ^4.1.7 | Unit tests for `src/simulation.js` |
| `sharp` | ^0.33.5 | Used by `scripts/generate-icons.js` to render `icon-192.svg` and `icon-maskable.svg` to PNG |

## Why This Stack?

### Why no React, Vue or Svelte?
The page is one canvas and one text box. All the work happens in an imperative `requestAnimationFrame` loop, so a declarative framework would add bundle weight and a reconciliation layer with nothing to reconcile. The production JavaScript bundle is 6.71 kB, 2.81 kB gzipped.

### Why not Three.js or WebGL?
The rings, bands and waves all live on a flat plane, and the particle count is one the CPU handles on 2D canvas. A GPU renderer would bring shader code and a large dependency for no visible difference.

### Why Vitest?
The simulation maths is plain ES modules. Vitest runs them without a separate Babel or Jest transform setup, and shares Vite's module resolution.

### Why Vercel?
A static Vite build needs no server, and Vercel serves one with zero configuration, HTTPS and a CDN on the free tier.

## Performance Considerations

- **Responsive particle density**: grid gap, texture spacing and sample step change below a 520 px short side (`applyResponsiveTuning()` in `src/main.js`)
- **Capped wave rings**: at most 220 decorative dots per wave per frame (`maxWaveVisualParticles`)
- **Region-limited text scan**: `getImageData` reads only the text bounding box from `textScanBounds()`
- **Precomputed ellipse terms**: each letter's exclusion test uses stored `1/rx²` and `1/ry²`
- **Debounced rebuilds**: resizes, keystrokes and keyboard close share one 150 ms debounce
