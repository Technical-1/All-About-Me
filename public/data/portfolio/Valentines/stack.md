# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | strict mode | Type safety across frontend and Cloud Functions |
| Framework | Astro | 5.17 | Static page routing + React island hydration |
| UI Library | React | 19.2 | Interactive components via `client:only="react"` |
| Backend | Firebase | 12.8 | Auth, Firestore, Storage, Functions, Messaging |
| Payments | Stripe | via Cloud Functions | Subscription billing with trial periods |

## Frontend

- **Framework**: Astro 5 with React 19 islands
- **Routing**: React Router DOM 6 (BrowserRouter inside the App component)
- **State Management**: React Context (AuthProvider, CoupleProvider, ThemeProvider, SecretNoteProvider)
- **Styling**: CSS custom properties set dynamically by ThemeProvider, co-located component CSS files
- **Build Tool**: Vite (via Astro)
- **Canvas**: Konva + react-konva for interactive canvas elements
- **3D**: Three.js for landing page cherry blossom animation

## Backend

- **Runtime**: Node.js (Firebase Cloud Functions 2nd gen)
- **Database**: Firestore with persistent local cache and multi-tab support
- **Storage**: Firebase Cloud Storage with Resize Images extension for auto-thumbnails
- **Authentication**: Firebase Auth (email/password) with `coupleId` custom claims
- **API Style**: Firebase callable functions + Firestore realtime listeners
- **Webhooks**: Stripe webhook handler via HTTP Cloud Function

## Infrastructure

- **Frontend Hosting**: Vercel (auto-deploy from GitHub `main` branch)
- **Backend Hosting**: Firebase (Cloud Functions, Firestore, Storage)
- **Security**: Firebase App Check with reCAPTCHA v3, Firestore/Storage security rules
- **PWA**: Service worker via `@vite-pwa/astro` with Workbox `injectManifest` strategy

## Development Tools

- **Package Manager**: npm
- **Testing**: Vitest + jsdom + React Testing Library
- **Linting**: TypeScript strict mode
- **Firebase CLI**: Rules, functions, and storage deployment

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `firebase` | Client SDK for Auth, Firestore, Storage, Messaging, App Check |
| `firebase-admin` | Server SDK for Cloud Functions (auth claims, Firestore admin) |
| `react-router-dom` | Client-side routing within the React app |
| `date-fns` | Date formatting and manipulation |
| `three` | Three.js for landing page 3D cherry blossom animation |
| `konva` / `react-konva` | HTML5 canvas for interactive visual elements |
| `stripe` | Stripe Node.js SDK for billing in Cloud Functions |
| `@vite-pwa/astro` | PWA integration with service worker generation |
| `@astrojs/react` | React integration for Astro island components |
