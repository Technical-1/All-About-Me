# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript (ES5/ES6) | N/A | Vanilla JS with ES module imports |
| Markup | HTML5 | N/A | Application UI |
| Styling | CSS3 | N/A | Custom properties, dark theme |
| Build Tool | Vite | ^7.3.1 | Dev server, HMR, production bundling |
| Fonts | Google Fonts | N/A | Playfair Display + DM Sans |

## Frontend

- **Framework**: None — vanilla HTML/CSS/JS
- **State Management**: Plain variables (`strokes[]`, `currentMode`, `drawPaused`, etc.)
- **Styling**: Separate `style.css` with CSS custom properties (`:root` variables)
- **Build Tool**: Vite (root: `src/`, output: `dist/`)
- **Typography**: Playfair Display (serif, titles), DM Sans (sans-serif, UI)

## Embedded Data

- **Hershey Vector Fonts**: Single-stroke font data (7 families) across two JS modules
- **Font Families**: `scripts` (light), `scriptc` (medium), `cursive`, `gothic`, `gothic italic`, `roman`, `roman complex`
- **Location**: `src/fonts/hershey-data.js` and `src/fonts/hershey-extended.js`

## Infrastructure

- **Hosting**: Vercel (static site deployment)
- **CI/CD**: Vercel auto-deploy on push to `main`
- **Build**: `npm run build` (Vite)
- **Domain**: signature-studio-nu.vercel.app
- **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options via `vercel.json`

## Development Tools

- **Package Manager**: npm
- **Build Tool**: Vite ^7.3.1
- **Linting**: None
- **Formatting**: None
- **Testing**: Manual browser testing

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `vite` (dev) | Development server with HMR, production bundler |
| `fit-curve` | Bezier curve fitting for stroke smoothing |
| `gif.js` | Client-side animated GIF generation from canvas frames |

## Runtime Technologies (No Package)

| Technology | Purpose |
|------------|---------|
| SVG `stroke-dashoffset` | Drawing animation effect |
| `requestAnimationFrame` | Smooth 60fps animation loop |
| Canvas 2D API | Freehand drawing + trace overlay + GIF/PNG rendering |
| `navigator.clipboard` | Copy-to-clipboard for exports |
| CSS Custom Properties | Dark theme system |
| Google Fonts CDN | Playfair Display + DM Sans typography |

## Export Dependencies (Generated Code)

The exported React component requires these in the consuming project:

| Package | Purpose |
|---------|---------|
| `motion/react` (Framer Motion) | SVG path animation with variants |
| `@/lib/utils` (`cn`) | Tailwind CSS class merging |
