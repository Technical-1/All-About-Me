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
- **State Management**: React useState hooks (no external state library needed)
- **Styling**: Tailwind CSS with custom animations in `index.css`
- **Build Tool**: Vite 5 with React plugin
- **PWA**: vite-plugin-pwa 0.19.2 (Workbox service worker, auto-update)
- **Typography**: Space Grotesk (custom font via Tailwind config)
- **Icons**: Custom SVG components (`Icons.jsx`)

## Backend / API

- **Runtime**: Vercel Serverless Functions (production API proxy)
- **Dev Proxy**: Vite dev server proxy (local development)
- **External API**: Urban Dictionary API v0 (`/v0/define`, `/v0/random`, `/v0/autocomplete-extra`)
- **Caching**: Vercel KV (server-side, production), localStorage (client-side, 7-day TTL)

## Infrastructure

- **Hosting**: Vercel (recommended) or Netlify
- **CI/CD**: Git push triggers auto-deploy on Vercel
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection (via `vercel.json`)
- **Asset Caching**: 1-year immutable cache for hashed assets

## Development Tools

- **Package Manager**: npm
- **CSS Processing**: PostCSS + Autoprefixer
- **Linting**: N/A (minimal project)
- **Testing**: N/A (manual testing)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` | UI component library |
| `react-dom` | React DOM renderer |
| `@vercel/kv` | Server-side key-value cache for API responses |
| `vite` | Dev server and production bundler |
| `@vitejs/plugin-react` | React Fast Refresh + JSX transform for Vite |
| `vite-plugin-pwa` | Progressive Web App support (Workbox) |
| `tailwindcss` | Utility-first CSS framework |
| `postcss` | CSS processing pipeline |
| `autoprefixer` | Automatic vendor prefixes for CSS |
