# Technology Stack

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.3.7 | React framework with App Router, server components, and API routes |
| **React** | 19.0.3 | UI component library with latest concurrent features |
| **TypeScript** | 5.9.3 | Type safety and improved developer experience |
| **Tailwind CSS** | 3.4.16 | Utility-first styling with custom GitHub-inspired theme |
| **Recharts** | 2.15.0 | Interactive data visualizations for code frequency charts |
| **Lucide React** | 0.468.0 | Modern icon library with consistent design |

## Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js API Routes** | 15.3.7 | Serverless API endpoints for repo analysis |
| **NextAuth.js (Auth.js)** | 5.0.0-beta.25 | GitHub OAuth authentication |
| **Octokit** | 21.0.2 | Official GitHub REST API client |
| **GitHub GraphQL API** | v4 | Efficient commit history fetching (1 call vs 51+) |
| **Zod** | 4.3.5 | Runtime validation for API inputs |
| **next/og (Satori)** | Built-in | SVG-to-image generation for embed widgets (OG/favicon are static PNGs) |

## Infrastructure & Deployment

| Service | Purpose |
|---------|---------|
| **Vercel** | Hosting with edge functions, automatic deployments |
| **Vercel Edge Network** | CDN for static assets and cached embed images |
| **GitHub OAuth** | Authentication provider |
| **GitHub API** | Data source for repository statistics (REST + GraphQL) |

### Vercel Configuration

- **Region**: `iad1` (US East) for optimal GitHub API latency
- **Function Duration**: 30 seconds max for API routes
- **Edge Runtime**: Used for embed image generation routes

## Key Dependencies Explained

### @octokit/rest (v21.0.2)

I chose Octokit as the GitHub API client because:

- It's the official SDK maintained by GitHub
- Provides TypeScript definitions out of the box
- Handles authentication, rate limiting headers, and pagination
- Abstracts away the complexity of the REST API

### GitHub GraphQL API

I added GraphQL alongside REST to optimize the most expensive operation — commit history:

- A single GraphQL query replaces 51+ REST API calls for fetching commit details
- Reduces rate limit consumption by ~98% for the commit-fetching path
- Falls back to REST automatically if GraphQL fails
- Also enables fallback code frequency calculation for repos >10k commits

### next-auth (v5.0.0-beta.25)

I'm using the v5 beta of NextAuth (now Auth.js) because:

- Native App Router support with server-side auth checks
- Simplified configuration compared to v4
- JWT-based sessions without database dependency
- Easy access token extraction for API calls
- Type-safe session augmentation via `next-auth.d.ts`

### zod (v4.3.5)

I added Zod for API input validation because:

- Runtime type checking at API boundaries complements TypeScript's compile-time checks
- Supports complex validation (GitHub URL parsing with multiple formats)
- Produces clear, user-friendly error messages
- Schema-first approach documents expected inputs

### recharts (v2.15.0)

I selected Recharts for data visualization because:

- React-native components that integrate well with the stack
- Responsive by default with `ResponsiveContainer`
- Good documentation and TypeScript support
- Customizable tooltips and legends

### lucide-react (v0.468.0)

Lucide provides the iconography because:

- Consistent, clean design language
- Tree-shakeable - only imports icons used
- Drop-in replacement for Feather icons
- Active maintenance and regular updates

## Development Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| **ESLint** | 9.16.0 | Code linting with Next.js config |
| **eslint-config-next** | 15.3.7 | Next.js-specific ESLint rules |
| **PostCSS** | 8.4.49 | CSS processing for Tailwind |
| **Autoprefixer** | 10.4.20 | Automatic vendor prefixes |
| **@types/node** | 22.10.2 | Node.js type definitions |
| **@types/react** | 19.0.1 | React type definitions |
| **@types/react-dom** | 19.0.1 | React DOM type definitions |

## Runtime Requirements

- **Node.js**: >= 18.17.0 (required for Next.js 15)
- **npm**: Package management (lock file included)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_GITHUB_ID` | Yes | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | Yes | GitHub OAuth App Client Secret |
| `AUTH_SECRET` | Yes | Random string for JWT signing |
| `NEXT_PUBLIC_SITE_URL` | No | Site URL for OpenGraph metadata |

## Build & Runtime

### Development

```bash
npm run dev          # Start with Turbopack
```

### Production

```bash
npm run build        # Next.js production build
npm run start        # Start production server
```

### Linting

```bash
npm run lint         # ESLint check
```

## Design System

I implemented a custom GitHub-inspired dark theme using Tailwind CSS:

```typescript
colors: {
  github: {
    dark: '#0d1117',      // Main background
    darker: '#010409',    // Darker accents
    border: '#30363d',    // Border color
    accent: '#238636',    // Primary green
    'accent-hover': '#2ea043',
    muted: '#8b949e',     // Secondary text
    link: '#58a6ff',      // Links
    text: '#c9d1d9',      // Primary text
    card: '#161b22',      // Card backgrounds
  }
}
```

### Typography

- **Sans-serif**: Inter for UI text
- **Monospace**: JetBrains Mono for code/data

### Custom CSS Features

- Glass morphism card effects with backdrop blur
- Animated gradient backgrounds
- Staggered fade-in animations for stats
- Custom scrollbar styling
- Hover lift effects on stat cards
- Slow pulse, gradient, and float animations via extended keyframes

### Component Library

The `ui/` directory provides a reusable component system:

- **Card** — Compound component (`Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`) with `default`, `glass`, and `stat` variants
- **LoadingSkeleton** — Full-page spinner, card skeleton, and stats grid skeleton
- **RepoInput** — Form with URL parsing and validation
- **PrivacyNotice** — Dismissable privacy disclosure banner
