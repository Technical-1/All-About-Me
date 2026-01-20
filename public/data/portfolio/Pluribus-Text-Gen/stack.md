# Technology Stack

## Frontend

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| HTML5 Canvas | Native | 2D particle rendering and animation |
| Vanilla JavaScript | ES6+ | Application logic, particle physics, event handling |
| CSS3 | Native | UI styling, glassmorphism effects |

### Build Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Vite | ^7.2.4 | Development server and production bundler |

### Dependencies

| Package | Version | Reason for Choice |
|---------|---------|-------------------|
| three | ^0.181.2 | Listed in package.json but not currently used in the implementation. Originally considered for 3D rendering but I switched to 2D Canvas for simplicity. |

### Fonts

| Font | Weight | Source |
|------|--------|--------|
| Montserrat | 900 (Black) | Google Fonts CDN |

I chose Montserrat Black because it closely matches the typography used in the actual Pluribus title sequence - bold, geometric sans-serif that creates strong particle outlines.

## Infrastructure

### Hosting

| Service | Purpose |
|---------|---------|
| Vercel | Static site hosting with automatic deployments |

I chose Vercel because:
- Zero-configuration deployments for Vite projects
- Automatic HTTPS and CDN distribution
- Free tier is more than sufficient for this static site
- Instant preview deployments for each commit

### Domain & SSL

- Custom domain: `pluribus-text-gen.vercel.app`
- SSL: Automatically provisioned by Vercel

## Development Environment

### Requirements

- Node.js v18 or higher
- npm (comes with Node.js)

### Scripts

```json
{
  "dev": "vite",           // Start dev server at localhost:5173
  "build": "vite build",   // Production build to /dist
  "preview": "vite preview" // Preview production build locally
}
```

## Why This Stack?

### Why No React/Vue/Svelte?

This project renders thousands of particles at 60fps. Every millisecond counts. Framework overhead - virtual DOM diffing, reactivity systems, component lifecycles - would add latency to the render loop. The Canvas API is imperative by nature, so a declarative framework would be swimming upstream.

### Why Not Three.js/WebGL?

I initially considered Three.js (it's still in package.json), but realized:

1. **Overkill**: I only need 2D rendering, not 3D
2. **Learning curve**: The 2D Canvas API was sufficient and let me understand the fundamentals
3. **Bundle size**: Three.js adds ~600KB, while my entire app is <50KB
4. **Compatibility**: 2D Canvas has broader browser support

### Why Vite?

- **Speed**: Near-instant hot module replacement during development
- **Modern**: Native ES modules, no bundling during dev
- **Simple**: Works out of the box with zero config for vanilla JS projects
- **Small**: Production builds are optimized and tree-shaken

### Why Vercel?

- **Integration**: Automatic deployments from GitHub pushes
- **Performance**: Edge network for fast global delivery
- **Simplicity**: No servers to manage for a static site
- **Cost**: Free for personal projects

## Browser Compatibility

The application uses:
- Canvas 2D API (supported in all modern browsers)
- ES6 modules (supported in all modern browsers)
- CSS backdrop-filter (gracefully degrades in older browsers)

Tested and working in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Considerations

- **Particle count**: Dynamically adjusted based on screen size
- **requestAnimationFrame**: Used for smooth 60fps animation
- **Object pooling**: Particles are reused rather than garbage collected
- **Math optimization**: Pre-calculated inverse squares for ellipse checks
