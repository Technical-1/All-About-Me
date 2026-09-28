# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | ~5.9 | Topic configs, progress records and backup files are all typed shapes; the compiler catches a malformed topic before a test does |
| UI | React | ^19.2 | Function components and hooks; the app is a handful of screens sharing one state tree |
| Build | Vite | ^7.2 | Fast dev server, and dynamic imports give every topic's data its own chunk for free |
| Styling | Tailwind CSS | ^4.1 | Utility classes with a class-based dark mode; a few design tokens live in `src/index.css` |
| Charts | Recharts | ^3.5 | The 30-day accuracy and session charts on the Stats page |

## Frontend

- **Framework**: React 19, function components only
- **State**: study state lifted into `LearningApp` (`src/App.tsx`) via `useAppState`; React Context for the current topic, theme and toasts
- **Routing**: a small hash router (`useHashRouter`) — landing, `#/learn/<topic>`, `#/about`, `#/privacy`
- **Styling**: Tailwind CSS 4 through PostCSS, light/dark/system theme
- **Build**: Vite 7 with manual chunks for React and Recharts plus one lazily loaded chunk per topic
- **Browser APIs**: Web Speech (read the question aloud), Web Audio (answer tones), Notifications (goal and inactivity reminders), Service Worker (offline)

## Backend

None. The app is static files; all data is in the browser's `localStorage`, and moving progress between devices is done with JSON backup files.

## Infrastructure

- **Hosting**: Vercel, static output
- **Security headers**: CSP (`script-src 'self'`, `frame-ancestors 'none'`, …), HSTS and friends, set in `vercel.json`
- **Offline**: hand-written service worker (`public/sw.js`) and a web app manifest
- **CI/CD**: Vercel's build (`npm run build`, which includes the type check); no separate CI pipeline
- **Monitoring**: none — nothing leaves the browser

## Development Tools

- **Package manager**: npm
- **Linting**: ESLint 9 with typescript-eslint and the React Hooks plugin
- **Testing**: Vitest 4 with React Testing Library in jsdom, V8 coverage; the suite is pinned to a non-UTC time zone so local-day logic is really exercised
- **Bundle analysis**: rollup-plugin-visualizer

## Key Dependencies

The runtime surface is three packages: `react`, `react-dom` and `recharts`.

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI |
| `recharts` | Stats charts |
| `vitest` | Test runner sharing Vite's config |
| `@testing-library/react` | Component tests that drive the UI the way a user does |
| `jsdom` | Browser environment for tests |
| `tailwindcss`, `@tailwindcss/postcss` | Styling |
| `rollup-plugin-visualizer` | Bundle size checks |
