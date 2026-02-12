# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | ~5.9.3 | Type safety across frontend and serverless backend |
| Framework | React | ^19.2.0 | Component-based UI with hooks for state management |
| Build Tool | Vite | ^7.2.4 | Fast dev server with HMR, optimized production builds |
| Styling | Tailwind CSS | ^4.1.18 | Utility-first CSS with v4's new engine |
| Hosting | Vercel | - | Static site + serverless functions |

## Frontend

- **Framework**: React 19
- **State Management**: React hooks + localStorage (no external state library)
- **Styling**: Tailwind CSS v4 + CSS custom properties for theming (4 theme variants)
- **Build Tool**: Vite 7 with @vitejs/plugin-react
- **Animations**: Framer Motion for page transitions and UI animations
- **Crossword Grid**: @jaredreisinger/react-crossword (interactive SVG-based grid)
- **PWA**: Service worker with cache-first strategy for assets, network-first for HTML

## Backend

- **Runtime**: Node.js 18+
- **Framework (dev)**: Express 5 via `server.dev.ts`
- **Framework (prod)**: Vercel serverless functions (`api/` directory)
- **API Style**: REST (single POST endpoint)
- **Authentication**: Cloudflare Turnstile (bot protection, not user auth)

## Infrastructure

- **Hosting**: Vercel (auto-deploys from GitHub)
- **CDN**: Vercel Edge Network
- **Bot Protection**: Cloudflare Turnstile (invisible captcha)
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy (via vercel.json)

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint 9 with typescript-eslint and react-hooks/react-refresh plugins
- **TypeScript**: Strict mode with project references (`tsc -b`)
- **Dev Server**: Vite (frontend) + tsx watch (API)
- **PostCSS**: autoprefixer

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Anthropic Claude API client for AI-powered word/clue generation |
| `@jaredreisinger/react-crossword` | Interactive SVG crossword grid with keyboard navigation |
| `crossword-layout-generator` | Algorithm for arranging words into valid crossword grid layouts |
| `framer-motion` | Declarative animations and page transitions |
| `canvas-confetti` | Victory celebration confetti animation |
| `lz-string` | Compression for puzzle data in shareable URLs |
| `react` / `react-dom` | UI framework (v19 with concurrent features) |
| `@vercel/node` | Types and utilities for Vercel serverless functions |
| `tailwindcss` / `@tailwindcss/vite` | Utility-first CSS framework with Vite integration |
| `cors` / `express` | Development API server (not used in production) |
