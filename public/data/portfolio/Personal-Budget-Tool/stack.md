# Technology Stack

Versions are the minimums declared in `package.json`.

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (JSX) | ES2020+ | Primary language with JSX for React components; no TypeScript build step |
| Framework | React | 19.2.0 | Hooks-based UI with `React.lazy()` code splitting |
| Routing | React Router (`react-router-dom`) | 7.16.0 | Two routes only: landing page at `/`, app at `/app` |
| Build Tool | Vite | 7.2.4 | Fast dev server and production builds; also hosts the Vitest config |
| State Management | Zustand | 5.0.9 | Lightweight global stores with no provider boilerplate |
| Database | IndexedDB (`idb`) | 8.0.3 | Thin Promise wrapper over structured client-side storage |
| Encryption | WebCrypto (`crypto.subtle`) | Browser built-in | AES-GCM and PBKDF2 with no third-party crypto dependency |
| Sync Backend | Firebase | 12.14.0 | Auth, Firestore, and Storage without running a server; optional at build time |

## Frontend

- **Framework**: React 19.2.0
- **State Management**: Zustand 5 — 7 stores: `budgetStore`, `trackingStore`, `uiStore`, `authStore`, `goalsStore`, `historyStore`, `toastStore`
- **Routing**: React Router for `/` and `/app`; in-app views selected by a `view` string in `uiStore`
- **Styling**: CSS custom properties (design tokens) with a `data-theme` attribute for dark/light mode
- **Build Tool**: Vite 7.2.4 with `@vitejs/plugin-react` 5.1.1
- **Code Splitting**: `React.lazy()` for all views except Dashboard; jsPDF loaded on demand

## Data, Security & Storage

- **Primary Storage**: IndexedDB via `idb` (`BudgetFlowDB` schema v4, 13 object stores including a `receipts` blob store)
- **Encryption at Rest**: Per-store field encryption (`src/db/crypto.js`) using a 256-bit AES-GCM data key held only in memory after unlock
- **Key Management**: Envelope encryption — the data key is wrapped by PBKDF2-SHA256 (600,000 iterations) keys derived from the passphrase and from a recovery code (`src/crypto/`)
- **Storage Durability**: `navigator.storage.persist()` requested at startup (`src/utils/storagePersistence.js`)
- **Theme Persistence**: localStorage
- **Currency Persistence**: Module-level singleton with a listener pattern, saved to IndexedDB settings
- **Validation**: Zod 4.3.5 for import/export, AI responses, and receipt metadata

## Sync (optional)

- **Auth**: Firebase Auth with Google popup sign-in
- **Data**: One encrypted snapshot document plus the wrapped-key record per user in Cloud Firestore
- **Files**: Encrypted receipt files in Firebase Storage
- **Security Rules**: Deny-by-default; each user can only access `users/{uid}` (`firestore.rules`, `storage.rules`)
- **Feature Flag**: `firebaseEnabled` is true only when `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID` are set

## Data Visualization & Export

- **Charts**: Recharts 3.6.0 (bar, line, and pie charts)
- **PDF Export**: jsPDF 4.0.0 (lazy-loaded for monthly budget reports)
- **Calendar Export**: Custom RFC 5545 ICS generator (no external dependency)

## PWA & Offline

- **Service Worker**: Workbox via `vite-plugin-pwa` 1.2.0
- **Caching Strategy**: Precaching for static assets; CacheFirst for Google Fonts (365-day TTL)
- **Registration**: `workbox-window` 7.4.0
- **Update Strategy**: Auto-update (`registerType: 'autoUpdate'`), `start_url: '/app'`

## AI Integration

- **Provider**: Anthropic Messages API, model Claude Sonnet 4.6 (set once in `src/constants/index.js`)
- **Method**: Direct browser fetch with a user-provided API key
- **Feature**: Image-to-budget parsing (handwritten or printed budget sheets)

## Icons & UI

- **Icon Library**: Lucide React 0.562.0
- **Accessibility**: Font scale hook (Small/Normal/Large/Extra Large), focus trapping in modals, ARIA dialog roles

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9.39.1 (flat config) with `eslint-plugin-react-hooks` 7.0.1 and `eslint-plugin-react-refresh` 0.4.24
- **Type Hints**: `@types/react` and `@types/react-dom` for editor support (not TypeScript)
- **Testing**: Vitest 4.0.18 with jsdom 28.1.0
  - `@testing-library/react` 16.3.2
  - `@testing-library/jest-dom` 6.9.1
  - 314 tests across 36 files, covering the calculation engine, stores, crypto primitives and key vault, at-rest encryption and migration, the sync engine, backup apply/export, AI import helpers, calendar export, schemas, and key components (encryption key setup, sync conflict, privacy, income setup, getting started, homepage)

## Infrastructure

- **Hosting**: Vercel (static build; SPA rewrites plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy` headers in `vercel.json`)
- **Backend**: Firebase managed services only — no custom server
- **CI/CD**: GitHub Actions — lint, test, and build on a Node 20 + 22 matrix with npm caching
- **Monitoring**: None server-side; a local 20-entry error log (`src/utils/errorLog.js`) captures caught errors

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework and DOM renderer |
| `react-router-dom` | Landing page vs. app routing |
| `zustand` | State management (7 stores) |
| `idb` | Promise-based IndexedDB wrapper for all local persistence |
| `firebase` | Optional Google sign-in, encrypted snapshot sync, and receipt storage |
| `zod` | Schema validation for backups and AI-parsed budgets |
| `recharts` | Spending trends and category breakdown charts |
| `jspdf` | PDF generation for monthly budget reports |
| `lucide-react` | SVG icon library |
| `vite-plugin-pwa` / `workbox-window` | Service worker generation and lifecycle |
| `vitest` / `@testing-library/react` | Unit and component tests |
