# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | ~5.9 | Type safety across frontend and Cloud Functions |
| Runtime | Node.js | 20+ | Development tooling and Cloud Functions runtime |
| Framework | React | 19.2 | UI rendering with hooks-based architecture |
| Build Tool | Vite | 7.3 | Fast HMR dev server and optimized production builds |

## Frontend

- **Framework**: React 19 with TypeScript
- **Routing**: TanStack Router 1.x (file-based, type-safe)
- **State Management**: TanStack Query 5.x (server state), React Context (auth)
- **Styling**: Tailwind CSS 4.x (CSS-based config via `@theme`)
- **Fonts**: Playfair Display (display), DM Sans (body) via Google Fonts
- **PWA**: vite-plugin-pwa 1.x with Workbox service worker

## Backend

- **Platform**: Firebase
- **Database**: Cloud Firestore (document store with subcollections)
- **Authentication**: Firebase Auth (Google provider via popup)
- **Functions**: Cloud Functions v2 (Node.js, `onCall` callable)
- **Security**: Firestore security rules with field-level update restrictions

## Infrastructure

- **Frontend Hosting**: Vercel (SPA rewrites via vercel.json)
- **Backend Hosting**: Firebase (Cloud Functions + Firestore)
- **CI/CD**: Manual deploy via Vercel CLI and Firebase CLI

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9 with react-hooks and react-refresh plugins
- **Type Checking**: TypeScript compiler (`tsc -b`)
- **Testing**: Vitest 4.x + React Testing Library + happy-dom
- **Dev Server**: Vite with HMR

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@tanstack/react-router` | File-based routing with type-safe params |
| `@tanstack/react-query` | Server state management, caching, mutations |
| `firebase` | Client SDK for Auth, Firestore, and Cloud Functions |
| `tailwindcss` | Utility-first CSS with v4 CSS-native configuration |
| `vite-plugin-pwa` | Service worker generation for offline PWA support |
| `cheerio` | Server-side HTML parsing for link scraping (in Cloud Functions) |
| `@testing-library/react` | Component testing with user-centric queries |
| `vitest` | Fast test runner with Vite integration |
