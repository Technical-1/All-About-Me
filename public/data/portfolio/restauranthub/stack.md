# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (JSX) | ES2020+ | Single language across frontend and Cloud Functions |
| Framework | React | 18.2 | Component model that fits the page/section structure well |
| Build Tool | Vite | 7.3 | Fast cold start and HMR; trivial config for a SPA |
| Backend | Firebase | — | Auth + Firestore + Functions + Storage + Analytics in one project, generous free tier |
| Database | Firestore | — | Document model fits per-location overrides naturally; rules-based security |
| Functions | Firebase Functions v2 | Node 20 | Trigger-based architecture matches contact-email and scheduled review-sync flows |

## Frontend

- **Framework**: React 18.2
- **State**: Single `FirebaseContext` + local `useState`; no global store library
- **Routing**: React Router 6.0.2 with subdomain-aware data loading
- **Styling**: TailwindCSS 3.4 wired to CSS custom properties for runtime theming
- **i18n**: i18next 25 + react-i18next 16, with per-tenant translation docs loaded from Firestore
- **Forms**: React Hook Form 7.55
- **Animation**: Framer Motion 10.16
- **Icons**: Lucide React 0.484
- **QR codes**: `qrcode.react` 4.2
- **SEO**: `react-helmet-async` 2.0

## Backend

- **Platform**: Firebase (Firestore, Auth, Functions, Storage, Analytics)
- **API style**: Direct Firestore SDK from the client, governed by `firestore.rules`
- **Auth**: Firebase Auth (email + password); admin role verified against `adminUsers` collection
- **Functions runtime**: Node 20, Firebase Functions v2 (`onDocumentCreated`, `onCall`, `onRequest`, `onSchedule`)
- **Email**: Resend via Cloud Function trigger
- **Reviews**: Google Places API via scheduled / callable Cloud Function

## Infrastructure

- **Hosting**: Firebase Hosting (config in `firebase.json`); Vercel-deployable as a fallback (`vercel.json`)
- **Secrets**: Firebase Functions secrets (`RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`)
- **Storage**: Firebase Storage with `storage.rules`

## Development Tools

- **Package Manager**: pnpm (workspaces enabled for functions)
- **Linting**: ESLint with `react-app` config
- **Path aliases**: `vite-tsconfig-paths` for `components/`, `pages/`, etc.
- **CSS pipeline**: PostCSS + Autoprefixer
- **Testing**: None — verification is manual through the demo mode and admin dashboards

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `firebase` | Client SDK for Firestore, Auth, Storage, Analytics |
| `firebase-admin` / `firebase-functions` | Server-side SDK and trigger primitives for Cloud Functions |
| `resend` | Email API client used by the contact-inquiry trigger |
| `react-router-dom` | Client-side routing with admin guards |
| `react-hook-form` | Form state + validation for contact, catering, and admin forms |
| `i18next` / `react-i18next` | Runtime translation registration per tenant |
| `qrcode.react` | Generates downloadable QR codes for printed table cards and posters |
| `framer-motion` | Page/section animations and modal transitions |
| `react-helmet-async` | Per-page meta and Open Graph tags |
| `date-fns` | Reservation slot and event date formatting |

## TailwindCSS Theming

Tailwind is wired to CSS custom properties rather than hard-coded colors. `src/lib/theme.js` ships five preset palettes (Forest Green, Warm Bistro, Coastal Blue, Modern Noir, Rustic Harvest). `applyTheme(theme)` writes each color to `:root`, so changing themes from the admin panel is instant and shared CSS bundles stay flat across tenants.
