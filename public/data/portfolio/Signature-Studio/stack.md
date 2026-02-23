# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript (ES5) | N/A | Vanilla JS, no transpilation needed |
| Markup | HTML5 | N/A | Single-file application |
| Styling | CSS3 | N/A | Embedded styles with CSS custom properties |
| Fonts | Google Fonts | N/A | Playfair Display + DM Sans |

## Frontend

- **Framework**: None — vanilla HTML/CSS/JS
- **State Management**: Plain variables (`strokes[]`, `currentMode`, `drawPaused`, etc.)
- **Styling**: Embedded `<style>` block with CSS custom properties (`:root` variables)
- **Build Tool**: None — no build step required
- **Typography**: Playfair Display (serif, titles), DM Sans (sans-serif, UI)

## Embedded Data

- **Hershey Vector Fonts**: ~40KB of single-stroke font data (3 families) embedded as JSON in a `<script>` tag
- **Font Families**: `scripts` (light), `scriptc` (medium), `cursive`

## Infrastructure

- **Hosting**: Vercel (static site deployment)
- **CI/CD**: Vercel auto-deploy on push to `main`
- **Domain**: signature-studio-nu.vercel.app

## Development Tools

- **Package Manager**: None (no dependencies)
- **Linting**: None
- **Formatting**: None
- **Testing**: Manual browser testing

## Key Dependencies

This project has **zero runtime dependencies**. Everything is vanilla:

| Technology | Purpose |
|------------|---------|
| SVG `stroke-dashoffset` | Drawing animation effect |
| `requestAnimationFrame` | Smooth 60fps animation loop |
| Canvas 2D API | Real-time freehand drawing |
| `navigator.clipboard` | Copy-to-clipboard for exports |
| CSS Custom Properties | Theming system |
| Google Fonts CDN | Playfair Display + DM Sans typography |

## Export Dependencies (Generated Code)

The exported React component requires these in the consuming project:

| Package | Purpose |
|---------|---------|
| `motion/react` (Framer Motion) | SVG path animation with variants |
| `@/lib/utils` (`cn`) | Tailwind CSS class merging |
