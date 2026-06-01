# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | 5.x | End-to-end type safety, including form data inferred from the validation schema |
| Framework | Next.js (App Router) | 16.x | Static generation for the marketing pages plus a single serverless route for the form, from one codebase |
| UI library | React | 19.x | Server Components by default, with client components only where interactivity is needed |
| Styling | Tailwind CSS | 4.x | Utility-first styling with CSS-variable theming for the luxury black/gold brand |

## Frontend

- **Framework**: Next.js 16 App Router with React 19 Server Components
- **State Management**: Local component state and React Hook Form — no global store needed for a marketing site
- **Styling**: Tailwind CSS 4 with brand colors defined as CSS variables in `globals.css` and surfaced through Tailwind's `@theme inline`
- **Animation**: Framer Motion for hero and section transitions
- **Build Tool**: Turbopack (via `next dev`/`next build --turbopack`)

## Backend

- **Runtime**: Next.js Route Handlers on the Node.js runtime
- **API Style**: A single REST-style `POST /api/contact` endpoint
- **Email**: Nodemailer talking to any SMTP provider
- **Auth**: None — the only server interaction is the public booking form, protected by a honeypot and rate limiting rather than accounts

## Infrastructure

- **Hosting**: Static pages + serverless function, deployable to Vercel or any Node host
- **CI/CD**: Git-based deploys
- **Monitoring**: None — email failures are logged server-side via `console.error`

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9 with `eslint-config-next`
- **Formatting**: ESLint defaults
- **Testing**: None — the surface area is small enough to verify by hand, and validation logic is centralized in one Zod schema

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` | App Router framework, static generation, and the serverless contact endpoint |
| `react` / `react-dom` | UI runtime (v19, Server Components) |
| `tailwindcss` + `@tailwindcss/postcss` | Utility styling and brand theming |
| `framer-motion` | Page and section animations |
| `react-hook-form` + `@hookform/resolvers` | Form state and Zod integration |
| `zod` | Shared validation schema for client and server |
| `nodemailer` | SMTP email delivery for booking notifications and confirmations |
| `class-variance-authority` + `clsx` + `tailwind-merge` | Variant-driven UI primitives and conflict-free className merging (`cn`) |
| `lucide-react` | Icon set used across the nav and forms |
