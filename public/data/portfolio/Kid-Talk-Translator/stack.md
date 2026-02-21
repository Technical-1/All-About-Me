# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript (ES Modules) | ES2022 | Full-stack language |
| Framework | React | ^18.2.0 | UI component library |
| Build Tool | Vite | ^5.1.4 | Dev server with HMR + production bundler |
| Styling | Tailwind CSS | ^3.4.1 | Utility-first CSS framework |

## Frontend

- **Framework**: React 18.2
- **State Management**: React useState/useContext hooks (ThemeContext, AuthContext)
- **Styling**: Tailwind CSS with dark mode (`darkMode: 'class'`), custom color palette (cream, coral, sage, ink, warmgray)
- **Build Tool**: Vite 5 with React plugin
- **PWA**: vite-plugin-pwa 0.19.2 (Workbox service worker, auto-update)
- **Typography**: Nunito (custom font via Tailwind config)
- **Icons**: Custom SVG components (`Icons.jsx`)

## Backend / API

- **Runtime**: Vercel Serverless Functions (production API proxy)
- **Dev Proxy**: Vite dev server proxy (local development)
- **AI API**: Claude (Anthropic SDK `@anthropic-ai/sdk ^0.77.0`) via `/api/ai-translate` serverless function
- **External API**: Urban Dictionary API v0 (`/v0/define`, `/v0/autocomplete-extra`, `/v0/autocomplete`)
- **Caching**: Vercel KV (server-side, production), localStorage (client-side, 7-day TTL for popular words, 20-entry LRU for AI results)
- **Auth**: Firebase Auth (Google sign-in + Apple sign-in via OAuth popup)
- **Database**: Firebase Firestore (community submissions, voting with transactions)

## Infrastructure

- **Hosting**: Vercel (recommended) or Netlify
- **CI/CD**: GitHub Actions (lint → test → build on push/PR; daily UD trending ingestion + community term merge via PR)
- **Monitoring**: Sentry (`@sentry/react ^10.39.0`, production only, 10% trace sample rate)
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection (via `vercel.json`)
- **Asset Caching**: 1-year immutable cache for hashed assets
- **Source Maps**: Hidden (uploaded to Sentry, not exposed to users)

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 8 + eslint-plugin-react + eslint-plugin-react-hooks + eslint-plugin-react-refresh + eslint-config-prettier
- **Formatting**: Prettier 3.8 (no semicolons, single quotes, trailing commas es5, 100 char width)
- **Testing**: Vitest 4 + React Testing Library 16 + jest-dom 6 + user-event 14 (57 tests, 12 test files)
- **CSS Processing**: PostCSS + Autoprefixer

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI component library and DOM renderer |
| `@anthropic-ai/sdk` | Claude AI API client for contextual slang analysis |
| `firebase` | Authentication (Google + Apple) and Firestore database |
| `@sentry/react` | Production error tracking and performance monitoring |
| `@vercel/kv` | Server-side key-value cache for API responses |
| `vite` | Dev server and production bundler |
| `@vitejs/plugin-react` | React Fast Refresh + JSX transform for Vite |
| `vite-plugin-pwa` | Progressive Web App support (Workbox) |
| `tailwindcss` | Utility-first CSS framework |
| `vitest` | Unit testing framework (Vite-native) |
| `@testing-library/react` | React component testing utilities |
