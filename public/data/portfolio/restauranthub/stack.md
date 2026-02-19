# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | JavaScript (JSX) | ES2020+ | Primary language for frontend and edge functions |
| Framework | React | 18.2 | Component-based UI library |
| Build Tool | Vite | 5.0 | Fast dev server and production bundler |
| Database | PostgreSQL (Supabase) | - | Relational database with RLS |
| Auth | Supabase Auth | 2.39 | Email/password authentication for admin |

## Frontend

- **Framework**: React 18.2
- **State Management**: React Context API (SupabaseContext) + local `useState`
- **Styling**: TailwindCSS 3.4 with custom brand theme (forest green, gold, warm brown)
- **Build Tool**: Vite 5.0 with `@vitejs/plugin-react`
- **Routing**: React Router DOM 6.0.2
- **Icons**: Lucide React 0.484
- **Animations**: Framer Motion 10.16
- **Forms**: React Hook Form 7.55

## Backend

- **Platform**: Supabase (hosted PostgreSQL + Auth + Edge Functions)
- **API Style**: Supabase JS client (auto-generated REST)
- **Authentication**: Email/password via Supabase Auth, admin role verified against `admin_users` table
- **Edge Functions**: Deno-based serverless functions for email delivery
- **Email**: Resend API for transactional contact notifications

## Infrastructure

- **Hosting**: Rocket.new (build platform), deployable to any static host
- **Database**: Supabase managed PostgreSQL with migrations
- **External Ordering**: Toast Tab (linked, not embedded)

## Development Tools

- **Package Manager**: pnpm
- **Linting**: ESLint (react-app config)
- **CSS Processing**: PostCSS + Autoprefixer
- **Path Aliases**: `vite-tsconfig-paths` for clean imports (`components/`, `pages/`)
- **Component Tagging**: `@dhiwise/component-tagger` for development tooling

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client for database, auth, and functions |
| `react-router-dom` | Client-side routing with nested routes and guards |
| `framer-motion` | Page transitions and UI animations |
| `lucide-react` | Consistent icon set across all pages |
| `react-hook-form` | Form state management and validation |
| `recharts` | Data visualization for admin analytics |
| `d3` | Advanced charting capabilities |
| `date-fns` | Date formatting and manipulation |
| `axios` | HTTP client for external API calls |
| `react-helmet` | Document head management for SEO |
| `react-router-hash-link` | Smooth scroll to page sections |
| `tailwindcss-animate` | Animation utility classes |

## TailwindCSS Custom Theme

The Tailwind config defines the Tela brand system:

- **Colors**: Forest green (`#2C5F41`), warm brown (`#8B4513`), gold accent (`#D4AF37`), warm off-white backgrounds
- **Fonts**: Playfair Display (headings), Inter (body), Source Sans Pro (captions), JetBrains Mono (data)
- **Shadows**: Custom warm-toned box shadows with green tints
- **Animations**: `fade-in-up` and `scale-in` keyframe animations
