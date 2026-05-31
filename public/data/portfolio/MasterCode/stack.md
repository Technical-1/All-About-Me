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
- **PWA**: Web App Manifest with standalone display, installable on mobile/desktop; hand-written service worker (`public/sw.js`) for offline asset caching
- **Storage**: localStorage (all data client-side, no backend), with JSON export/import for backup and portability
- **SEO**: JSON-LD structured data, Open Graph/Twitter meta tags, sitemap.xml, robots.txt

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9 with TypeScript and React hooks plugins
- **Testing**: Vitest with React Testing Library, jsdom environment, V8 coverage — 375 tests across 31 files
- **Bundle Analysis**: rollup-plugin-visualizer (generates dist/stats.html)

## Key Dependencies

The runtime dependency surface is intentionally tiny — only three production packages.

| Package | Purpose |
|---------|---------|
| `react` | UI component framework |
| `react-dom` | React DOM rendering |
| `recharts` | SVG-based charts for stats/progress visualization |
| `@tailwindcss/postcss` | Tailwind CSS PostCSS plugin (dev) |
| `@vitejs/plugin-react` | Vite React integration with Fast Refresh (dev) |
| `vitest` | Unit test runner compatible with Vite config (dev) |
| `@testing-library/react` | Component testing utilities (dev) |
| `rollup-plugin-visualizer` | Bundle size analysis and visualization (dev) |
