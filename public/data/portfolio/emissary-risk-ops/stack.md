# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | 5 | Type safety across the client/server boundary and the shared form schema |
| Framework | Next.js (App Router) | 16.1 | One project for static marketing pages and the server-side data proxy, with first-class Vercel deploys |
| UI library | React | 19 | Current React; the app uses Server/Client component boundaries from the App Router |
| Styling | Tailwind CSS | 4 | Fast iteration; `@theme inline` maps the brand palette to utility classes |
| Animation | Framer Motion | 12 | Declarative mount/exit animations for the intro and section reveals |
| Mapping | Leaflet + leaflet.heat | 1.9 / 0.2 | Lightweight, OSS, no API key or usage billing for tiles |

## Frontend

- **Framework**: Next.js 16 App Router, React 19
- **State Management**: Local component state + `sessionStorage` (intro once-per-session); no global store needed
- **Styling**: Tailwind CSS 4 with CSS custom-property design tokens; `class-variance-authority` for component variants merged via `clsx` + `tailwind-merge`
- **Icons**: lucide-react
- **Build Tool**: Next.js / Turbopack

## Backend

- **Runtime**: Node.js (Vercel serverless functions)
- **Framework**: Next.js Route Handlers
- **API Style**: REST-ish JSON endpoints (`/api/geolocation`, `/api/crime-data`, `/api/contact`)
- **Auth**: None — public site; the contact endpoint is protected by rate limiting + a honeypot rather than auth

## Infrastructure

- **Hosting**: Vercel
- **CI/CD**: Vercel Git integration (build on push)
- **Security headers**: CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` set in `next.config.ts`
- **Monitoring**: none

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint (`eslint-config-next`)
- **Testing**: Vitest + Testing Library + jsdom
- **Type Checking**: `tsc --noEmit`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` / `react` / `react-dom` | App Router framework and UI runtime |
| `leaflet` / `react-leaflet` / `leaflet.heat` | Interactive map and the crime heatmap layer |
| `framer-motion` | Intro dissolve animation and scroll-reveal sections |
| `react-hook-form` / `@hookform/resolvers` | Contact form state and validation wiring |
| `zod` | Form schema shared between client and server validation |
| `class-variance-authority` / `clsx` / `tailwind-merge` | Typed component variants and conflict-free class merging |
| `lucide-react` | Icon set |
| `vitest` / `@testing-library/react` | Unit and route-handler tests |
