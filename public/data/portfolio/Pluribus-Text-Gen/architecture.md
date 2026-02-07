# Architecture Overview

## System Diagram

```mermaid
flowchart TB
    subgraph Browser["Browser Runtime"]
        subgraph UI["User Interface Layer"]
            HTML["index.html<br/>Text Input + Controls"]
            CSS["Inline CSS<br/>Styling + Layout"]
        end

        subgraph Core["Core Engine (main.js)"]
            Canvas["HTML5 Canvas API"]
            Config["Configuration Object<br/>Wave speed, spacing, etc."]

            subgraph ParticleSystem["Particle System"]
                TextParticles["Text Particles<br/>High opacity, subtle jitter"]
                BGParticles["Background Particles<br/>Grid layout, wave-responsive"]
            end

            subgraph WaveSystem["Wave System"]
                WaveEmitter["Wave Emitter<br/>First letter origin"]
                WavePhysics["Wave Physics<br/>Pull particles to crests"]
            end

            subgraph Rendering["Rendering Pipeline"]
                TextScan["Text Scanner<br/>Pixel-by-pixel analysis"]
                FingerprintGen["Fingerprint Generator<br/>Concentric elliptical lines"]
                ExclusionZones["Exclusion Zones<br/>Letter boundaries"]
                AnimLoop["Animation Loop<br/>60fps requestAnimationFrame"]
            end
        end
    end

        subgraph PWA["PWA Layer"]
            Manifest["manifest.webmanifest<br/>Installable app"]
            Icons["PWA Icons<br/>192px + 512px"]
            Screenshot["Screenshot Export<br/>1200x630 OG image"]
        end
    end

    subgraph External["External Resources"]
        Font["Google Fonts<br/>Montserrat Black 900"]
        Vercel["Vercel Hosting<br/>Static deployment"]
    end

    subgraph DevTools["Development Tools"]
        IconGen["generate-icons.js<br/>Sharp-based icon pipeline"]
    end

    HTML --> Canvas
    Config --> ParticleSystem
    Config --> WaveSystem
    TextScan --> FingerprintGen
    FingerprintGen --> TextParticles
    ExclusionZones --> BGParticles
    WaveEmitter --> WavePhysics
    WavePhysics --> BGParticles
    ParticleSystem --> AnimLoop
    WaveSystem --> AnimLoop
    AnimLoop --> Canvas
    Font -.-> HTML
    Manifest -.-> HTML
    Icons -.-> Manifest
    Screenshot --> Canvas
    Browser --> Vercel
    IconGen -.-> Icons
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Input as Text Input
    participant Init as init()
    participant Scanner as Text Scanner
    participant Canvas as Canvas Context
    participant Particles as Particle Array
    participant Waves as Wave Array
    participant Loop as Animation Loop

    User->>Input: Type text
    Input->>Init: Trigger init()
    Init->>Canvas: Clear and resize
    Init->>Scanner: Render text to hidden context
    Scanner->>Scanner: Scan pixels for text boundaries
    Scanner->>Particles: Create TEXT particles (fingerprint pattern)
    Init->>Particles: Create BG particles (grid, exclude letters)
    Init->>Waves: Clear wave array

    loop Every Frame (60fps)
        Loop->>Waves: Spawn new wave (every 140 frames)
        Loop->>Waves: Update wave radii
        Loop->>Particles: Apply wave forces to BG particles
        Loop->>Particles: Apply friction/return force
        Loop->>Canvas: Draw BG particles
        Loop->>Canvas: Draw wave ring particles
        Loop->>Canvas: Draw TEXT particles (on top)
    end
```

## Key Architecture Decisions

### 1. Vanilla JavaScript Over Frameworks

I chose to build this with vanilla JavaScript and the native Canvas API rather than using a framework like React or a library like Three.js. The reasons were:

- **Performance**: Direct Canvas API access eliminates framework overhead for a graphics-intensive application
- **Simplicity**: The application has a single purpose with no complex state management needs
- **Bundle Size**: The entire application is under 11KB of JavaScript, which would balloon significantly with framework dependencies
- **Learning**: Working directly with the Canvas API provided deeper understanding of 2D rendering

### 2. Single-File Architecture

The entire particle system lives in `main.js` (~390 lines). While this could be modularized, I kept it unified because:

- All components are tightly coupled (particles depend on waves, both depend on config)
- The file is still easily navigable at this size
- No build-time code splitting needed for such a small codebase

### 3. Elliptical Exclusion Zones

Rather than using pixel-perfect collision detection between background particles and text, I implemented mathematical elliptical exclusion zones around each letter. This approach:

- Is computationally cheaper than per-pixel checks every frame
- Creates cleaner visual separation between text and background
- Allows for configurable padding via `gapScaleX` and `gapScaleY`

### 4. Fingerprint Pattern Generation

The text particles are not placed at every text pixel. Instead, I use a mathematical formula:
```javascript
(effectiveDist) % textureSpacing < textureThickness
```

This creates concentric elliptical lines emanating from the first letter, mimicking a fingerprint pattern. The `organic` offset adds subtle waviness to prevent perfectly geometric lines.

### 5. Layered Rendering Order

I render in a specific order to achieve the correct visual hierarchy:
1. Background particles (lowest layer)
2. Wave ring particles (middle layer)
3. Text particles (top layer)

This ensures text remains readable even when waves pass through.

### 6. Responsive Design Strategy

Rather than using CSS media queries, I implemented responsive behavior in JavaScript:

- Font size scales based on viewport dimensions
- Particle density and spacing adjust for small screens
- Wave parameters adapt to screen size

This approach ensures the visual effect scales proportionally rather than just repositioning elements.

### 7. Wave Physics Simplification

The original Pluribus effect likely uses more sophisticated physics. I simplified to:

- Waves pull particles toward the wave crest (not push outward)
- High friction (0.90) causes rapid return to base position
- Text particles are immune to wave forces (only have subtle jitter)

This achieves a similar visual effect with much simpler math.

### 8. Mobile Viewport Handling

Mobile keyboards resize the viewport, which would cause the canvas to shrink and reinitialize. I solved this by:

- Storing `fullWidth`/`fullHeight` separately from the live viewport
- Skipping dimension updates when the text input is focused (keyboard is open)
- Using the `visualViewport` API for more accurate resize events on mobile
- Reinitializing with correct dimensions on input blur (keyboard close)

### 9. PWA Support

The app is installable as a Progressive Web App with:

- A `manifest.webmanifest` defining the app name, icons, and standalone display mode
- Apple-specific meta tags for iOS home screen support
- Icons at 180px, 192px, and 512px generated from SVG source via a `sharp`-based Node script
