# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | 5 | Type safety across API payloads and component props |
| Framework | Next.js | 16.1 | App Router gives a clean server/client split for a tiny app |
| Runtime | React | 19.2 | Comes with Next.js; server components keep the page render trivial |
| Styling | Tailwind CSS | 4 | Utility-first; zero custom CSS files outside `globals.css` |

## Backend

- **Runtime**: Node.js (Vercel serverless functions)
- **API style**: Single POST endpoint (`/api/preview`) — no router, no framework on top
- **Auth**: Bearer token compared against `PREVIEW_API_KEY` env var
- **Storage**: Upstash Redis via `@upstash/redis` REST client

## Infrastructure

- **Hosting**: Vercel (Hobby tier — free, single-region)
- **Storage**: Upstash Redis (provisioned through Vercel KV integration)
- **CI/CD**: Vercel's Git integration — push to `main`, auto-deploy
- **Monitoring**: Vercel runtime logs; no separate APM

## Development Tools

- **Package Manager**: npm
- **Linting**: ESLint with `eslint-config-next`
- **Testing**: Vitest with `jsdom` environment, React Testing Library
- **JSON construction**: `jq -n` in the CLI skill (safe escaping for HTML/Markdown payloads)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@upstash/redis` | REST client for the Redis store; sets the single `current-preview` key with TTL |
| `next` | App Router, server components, API route handler |
| `marked` | Markdown → HTML conversion on the server |
| `sanitize-html` | Strips dangerous tags/attributes from Markdown output before storage |
| `react` / `react-dom` | UI rendering (server + client component split) |
| `tailwindcss` | All styling outside the iframe-injected markdown CSS |
| `vitest` + `@testing-library/react` | Unit and component tests (45 in total) |
