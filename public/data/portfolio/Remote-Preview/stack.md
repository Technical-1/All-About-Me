# Tech Stack

## Core

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15 | App Router framework (server + client components) |
| TypeScript | 5 | Type safety across API and components |
| React | 19 | UI rendering |
| Tailwind CSS | 4 | Utility-first styling with CSS variables |

## Backend

| Technology | Purpose |
|-----------|---------|
| Upstash Redis | KV storage for preview data (via `@upstash/redis`) |
| Next.js API Routes | POST endpoint for receiving content |
| Bearer Token Auth | Simple API key authentication |

## Infrastructure

| Technology | Purpose |
|-----------|---------|
| Vercel | Hosting (Hobby tier, free) |
| Vercel KV Integration | Manages Upstash Redis connection |
| GitHub | Source control (`Technical-1/Remote-Preview`) |

## Testing

| Technology | Purpose |
|-----------|---------|
| Vitest | Test runner with jsdom environment |
| React Testing Library | Component testing |
| @testing-library/jest-dom | DOM assertion matchers |

## Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | Linting (Next.js config) |
| Claude Code | AI-assisted development |
| Claude Skill | CLI-to-preview automation |
| `jq` | JSON payload construction in skill |

## Key Dependencies

```json
{
  "@upstash/redis": "KV storage client",
  "next": "15.x - App Router framework",
  "react": "19.x - UI library",
  "tailwindcss": "4.x - CSS framework",
  "vitest": "Test runner",
  "@testing-library/react": "Component testing",
  "@testing-library/jest-dom": "DOM matchers"
}
```
