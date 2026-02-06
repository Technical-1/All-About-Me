# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | ~5.9 | Type safety across the entire codebase |
| Framework | React | ^19.2 | Component-based UI with hooks |
| Build Tool | Vite | ^7.2 | Fast HMR development and optimized production builds |
| Styling | Tailwind CSS | ^4.1 | Utility-first CSS with dark mode support |
| Charts | Recharts | ^3.5 | Progress and accuracy trend visualization |

## Frontend

- **Framework**: React 19 (hooks-based, functional components only)
- **State Management**: Lifted state in App.tsx with React Context for cross-cutting concerns (theme, toast, topic)
- **Styling**: Tailwind CSS 4 with PostCSS integration, dark mode via class strategy
- **Build Tool**: Vite 7 with manual chunk splitting (react-vendor, recharts)
- **Routing**: Custom hash-based router (`useHashRouter` hook)

## Infrastructure

- **Hosting**: Vercel (static site deployment)
- **PWA**: Web App Manifest with standalone display, installable on mobile/desktop
- **Storage**: localStorage (all data client-side, no backend)
- **SEO**: JSON-LD structured data, Open Graph/Twitter meta tags, sitemap.xml, robots.txt

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9 with TypeScript and React hooks plugins
- **Testing**: Vitest with React Testing Library, jsdom environment, V8 coverage
- **Bundle Analysis**: rollup-plugin-visualizer (generates dist/stats.html)
- **Image Processing**: Sharp (for OG image and favicon generation)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` | UI component framework |
| `react-dom` | React DOM rendering |
| `recharts` | SVG-based charts for stats/progress visualization |
| `@tailwindcss/postcss` | Tailwind CSS PostCSS plugin |
| `@vitejs/plugin-react` | Vite React integration with Fast Refresh |
| `vitest` | Unit test runner compatible with Vite config |
| `@testing-library/react` | Component testing utilities |
| `puppeteer` | Browser automation (OG image generation scripts) |
| `sharp` | Image processing (favicon/icon generation) |
| `rollup-plugin-visualizer` | Bundle size analysis and visualization |
