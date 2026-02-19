# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript (JSX) | ES2020 | Primary language with JSX for React components |
| Framework | React | 19.2.0 | UI framework with hooks-based architecture |
| Build Tool | Vite | 7.2.4 | Dev server with HMR and optimized production builds |
| State Management | Zustand | 5.0.9 | Lightweight global state with no boilerplate |
| Database | IndexedDB (idb) | 8.0.3 | Client-side structured storage with Promise API |

## Frontend

- **Framework**: React 19.2.0
- **State Management**: Zustand v5 (5 stores: budget, tracking, UI, goals, history + toast)
- **Styling**: CSS Custom Properties (design tokens) with `data-theme` attribute for dark/light mode
- **Build Tool**: Vite 7.2.4 with `@vitejs/plugin-react`
- **Routing**: Custom view state in Zustand (no React Router)
- **Code Splitting**: `React.lazy()` for all views except Dashboard

## Data & Storage

- **Primary Storage**: IndexedDB via `idb` library (BudgetFlowDB v3, 12 object stores)
- **Theme Persistence**: localStorage (theme preference)
- **Currency Persistence**: Module-level singleton with listener pattern
- **Validation**: Zod v4.3.5 for import/export data validation

## Data Visualization

- **Charts**: Recharts 3.6.0 (bar charts, line charts, pie charts)
- **PDF Export**: jsPDF 4.0.0 (lazy-loaded for monthly budget reports)
- **Calendar Export**: Custom RFC 5545 ICS generator (no external dependency)

## PWA & Offline

- **Service Worker**: Workbox via `vite-plugin-pwa` 1.2.0
- **Caching Strategy**: CacheFirst for Google Fonts (365-day TTL), precaching for static assets
- **Registration**: `workbox-window` 7.4.0 for service worker lifecycle management
- **Update Strategy**: Auto-update (`registerType: 'autoUpdate'`)

## AI Integration

- **Provider**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Method**: Direct browser fetch with user-provided API key
- **Feature**: Image-to-budget parsing (handwritten or printed budget sheets)

## Icons & UI

- **Icon Library**: Lucide React 0.562.0
- **Theming**: CSS custom properties with dark/light mode toggle
- **Accessibility**: Font scale hook (Small/Normal/Large/Extra Large), focus trapping in modals

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9.39.1 (flat config)
  - `eslint-plugin-react-hooks` 7.0.1
  - `eslint-plugin-react-refresh` 0.4.24
- **Type Hints**: `@types/react` and `@types/react-dom` for JSDoc IDE support (not TypeScript)
- **Dev Server**: Vite dev server with React Fast Refresh

## Infrastructure

- **Hosting**: Static files (client-only PWA, no backend)
- **CI/CD**: None configured
- **Monitoring**: None (client-side only)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework and DOM renderer |
| `zustand` | Lightweight state management (5 stores) |
| `idb` | Promise-based IndexedDB wrapper for all persistence |
| `recharts` | Data visualization (spending trends, category breakdown) |
| `lucide-react` | SVG icon library used throughout the UI |
| `jspdf` | PDF generation for monthly budget reports |
| `zod` | Schema validation for data import/export |
| `workbox-window` | PWA service worker lifecycle management |
| `vite-plugin-pwa` | Automatic service worker generation and manifest |
