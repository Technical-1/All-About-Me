# Architecture Overview

## System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser[Web Browser]
        URL[URL Parameters]
    end

    subgraph Frontend["Frontend - Next.js 15 App Router"]
        SessionCtx[SessionProvider<br/>Auth Context]

        subgraph Pages["Pages"]
            PublicPage["(public)/page.tsx<br/>Repo Search"]
            Dashboard["dashboard/page.tsx<br/>User Dashboard"]
            RepoPage["repo/[owner]/[name]/page.tsx<br/>Server Component + Metadata<br/>→ RepoPageClient.tsx"]
        end

        subgraph Components["Components"]
            subgraph Layout["layout/"]
                Header[Header]
                Footer[Footer]
            end
            subgraph UIComp["ui/"]
                Card[Card]
                RepoInput[RepoInput]
                LoadingSkeleton[LoadingSkeleton]
                PrivacyNotice[PrivacyNotice]
            end
            subgraph Features["features/"]
                StatsOverview[stats/StatsOverview]
                LanguageBreakdown[stats/LanguageBreakdown]
                CodeFrequency[stats/CodeFrequencyChart]
                CommitHistory[commits/CommitHistory]
                Contributors[contributors/ContributorsList]
                UserRepos[repos/UserReposList]
            end
            subgraph EmbedComp["embed/"]
                EmbedShare[EmbedShare Modal]
            end
            subgraph Effects["effects/"]
                Particles[ParticleBackground]
            end
        end
    end

    subgraph API["API Layer - Next.js Route Handlers"]
        AuthRoute["/api/auth/[...nextauth]"<br/>NextAuth Handlers]
        RepoRoute["/api/repo"<br/>Repository Analysis]
        StatsRoute["/api/repo/stats"<br/>Stats Polling]
        UserReposRoute["/api/user/repos"<br/>User Repositories]

        subgraph Embed["Embed Image Generation"]
            EmbedStats["/api/embed/stats"]
            EmbedCodeStats["/api/embed/code-stats"]
            EmbedLangs["/api/embed/languages"]
        end
    end

    subgraph Services["Service Layer"]
        GitHubLib[lib/github.ts<br/>GitHub API Wrapper<br/>REST + GraphQL]
        AuthConfig[auth.ts<br/>NextAuth Configuration]
        CacheLib[lib/cache.ts<br/>TTL Cache]
        Validations[lib/validations.ts<br/>Zod Schemas]
        FormatLib[lib/format.ts<br/>Formatting Utils]
        EmbedUtils[lib/embed-utils.tsx<br/>Embed Widget Helpers]
        StructuredData[lib/structured-data.ts<br/>JSON-LD Schemas]
    end

    subgraph External["External Services"]
        GitHubREST[GitHub REST API<br/>via Octokit]
        GitHubGraphQL[GitHub GraphQL API]
        GitHubOAuth[GitHub OAuth<br/>Authentication]
        Vercel[Vercel Edge Network<br/>CDN + Hosting]
    end

    Browser --> Pages
    URL --> Pages
    SessionCtx --> Pages
    Pages --> Components

    PublicPage --> RepoRoute
    Dashboard --> UserReposRoute
    RepoPage --> RepoRoute
    CodeFrequency --> StatsRoute
    Pages --> AuthRoute

    RepoRoute --> GitHubLib
    RepoRoute --> Validations
    StatsRoute --> GitHubLib
    UserReposRoute --> GitHubLib

    AuthRoute --> AuthConfig
    AuthConfig --> GitHubOAuth

    GitHubLib --> GitHubREST
    GitHubLib --> GitHubGraphQL
    GitHubLib --> CacheLib

    Embed --> GitHubREST
    Embed --> EmbedUtils
    Embed --> Vercel

    RepoRoute --> CacheLib
```

## Routing Architecture

```mermaid
graph LR
    subgraph Public["Public Routes"]
        Home["/ — Repo search + analysis"]
    end

    subgraph Protected["Protected Routes"]
        DashboardRoute["/dashboard — User repos"]
    end

    subgraph Dynamic["Dynamic Routes"]
        RepoRoute["/repo/[owner]/[name] — Repo stats"]
    end

    subgraph APIRoutes["API Routes"]
        Auth["/api/auth/*"]
        Repo["/api/repo"]
        Stats["/api/repo/stats"]
        UserRepos["/api/user/repos"]
        EmbedAPI["/api/embed/*"]
    end

    Home -->|Sign in| DashboardRoute
    DashboardRoute -->|Select repo| RepoRoute
    Home -->|Enter URL| RepoRoute
    DashboardRoute -->|Auth guard| Home

    RepoRoute --> Repo
    RepoRoute --> Stats
    DashboardRoute --> UserRepos
    Home --> Repo
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextJS as Next.js App
    participant API as API Routes
    participant Cache as TTL Cache
    participant GitHub as GitHub API

    User->>Browser: Enter repository URL
    Browser->>NextJS: Navigate / Submit form
    NextJS->>API: POST /api/repo

    alt Unauthenticated Request
        API->>Cache: Check cache
        alt Cache Hit
            Cache-->>API: Return cached data
        else Cache Miss
            API->>GitHub: Fetch repo data (60 req/hr limit)
            Note over API,GitHub: REST for repo info + GraphQL for commits
            GitHub-->>API: Repository stats
            API->>Cache: Store result (10 min TTL)
        end
    else Authenticated Request
        API->>GitHub: Fetch repo data (5000 req/hr limit)
        Note over API,GitHub: REST for repo info + GraphQL for commits
        GitHub-->>API: Repository stats + private repos
    end

    API-->>NextJS: Analysis results
    NextJS-->>Browser: Render visualizations

    Note over Browser,NextJS: Code frequency may need polling

    opt Stats Computing (202 response)
        Browser->>API: Poll /api/repo/stats
        API->>GitHub: Retry stats request
        GitHub-->>API: Stats ready or 202
        API-->>Browser: Data or retry signal
    end
```

## Component Architecture

```
components/
├── index.ts                    # Barrel exports for clean imports
├── layout/                     # Page structure components
│   ├── Header.tsx              # Navigation, auth state, branding
│   └── Footer.tsx              # Attribution and tech stack info
├── ui/                         # Reusable atomic UI components
│   ├── Card.tsx                # Card system (default/glass/stat variants)
│   ├── LoadingSkeleton.tsx     # Loading states, spinners, skeletons
│   ├── RepoInput.tsx           # Repository URL input form
│   └── PrivacyNotice.tsx       # Privacy disclosure banner
├── features/                   # Domain-specific feature components
│   ├── stats/
│   │   ├── StatsOverview.tsx       # Stars, forks, watchers grid
│   │   ├── LanguageBreakdown.tsx   # Color-coded language bar
│   │   └── CodeFrequencyChart.tsx  # Additions/deletions area chart
│   ├── commits/
│   │   └── CommitHistory.tsx       # Commit log with details
│   ├── contributors/
│   │   └── ContributorsList.tsx    # Top contributors grid
│   └── repos/
│       └── UserReposList.tsx       # User's repo dashboard
├── embed/
│   └── EmbedShare.tsx          # Widget embed code generator modal
└── effects/
    └── ParticleBackground.tsx  # Animated background particles
```

## Key Architectural Decisions

### 1. Next.js 15 App Router with Route Groups

I chose Next.js 15's App Router because it provides the best developer experience for a React application that needs both client-side interactivity and server-side data fetching. The refactored routing uses:

- **Route groups** `(public)` for unauthenticated pages without affecting URLs
- **Server-side layout guards** in `/dashboard/layout.tsx` for protected routes
- **Dynamic segments** `/repo/[owner]/[name]` for deep-linkable repo analyses
- Turbopack for faster development builds

### 2. Feature-Sliced Component Architecture

Components are organized by domain rather than flat in a single directory:

- **layout/** — structural components that appear on every page
- **ui/** — generic, reusable atomic components (Card, LoadingSkeleton)
- **features/** — domain-specific components grouped by feature area
- **embed/** and **effects/** — specialized concerns
- A barrel export (`index.ts`) enables clean imports from `@/components`

### 3. GraphQL + REST Hybrid API Strategy

The GitHub integration now uses both REST and GraphQL APIs:

- **GraphQL** fetches commit history in a single call (replacing 51+ REST calls)
- **REST** handles repo info, languages, contributors, and code frequency
- **Fallback chain**: GraphQL → REST → calculated approximation for code frequency
- This hybrid approach dramatically reduces API rate limit consumption

### 4. Edge Runtime for Embed Image Generation

The embed routes (`/api/embed/*`) use the Edge runtime with `next/og` (Satori) for SVG-to-image generation. I made this choice because:

- Edge functions have lower cold start times than serverless functions
- Image generation needs to be fast for README embeds
- CDN caching at the edge reduces API calls significantly
- The 1-hour cache (`s-maxage=3600`) balances freshness with performance

### 5. Typed In-Memory Caching with TTL

The caching layer was extracted into a dedicated generic `Cache<T>` class in `lib/cache.ts`:

- Type-safe with generics — `repoCache` and `statsCache` are pre-configured instances
- Configurable TTL (10 min for repos, 10 min for stats) and max size (100/50 entries)
- Automatic cleanup of expired entries
- Only used for unauthenticated requests to respect GitHub's 60 req/hr limit

### 6. Zod Validation at API Boundaries

All API route inputs are validated with Zod schemas in `lib/validations.ts`:

- `RepoRequestSchema` handles multiple GitHub URL formats (`owner/repo`, full URLs, etc.)
- `StatsRequestSchema` validates stats polling requests
- Clear, user-friendly error messages via `formatZodError()`
- Validation at the boundary only — internal code trusts validated data

### 7. Client-Side Authentication State with NextAuth v5

I use NextAuth v5 (Auth.js) with the GitHub provider for authentication. The access token is stored in the JWT and passed to the client session. Key reasons:

- No database required — tokens exist only in signed JWTs
- Privacy-first approach — no credentials stored server-side
- The `repo` scope allows access to private repositories
- Session data is available on both client and server via `SessionProvider`

### 8. Parallel Data Fetching

In `lib/github.ts`, I fetch repository data, languages, commits, code frequency, and contributors in parallel using `Promise.all()`. This significantly reduces total request time compared to sequential fetching, though it increases API usage per request.

### 9. Progressive Enhancement for Statistics

GitHub's statistics API returns 202 when stats are still being computed. Rather than blocking the UI, I:

- Return empty data immediately and render placeholders
- Poll with exponential backoff (3s, 6s, 12s, 24s, 48s) on the client
- Use a fallback endpoint for contributors if stats aren't ready
- Show clear loading states with helpful messaging

### 10. URL-Based State Management

Repository selection is reflected in the URL via dynamic routes (`/repo/[owner]/[name]`) and query params (`?repo=owner/repo`). This enables:

- Shareable links to specific repository analyses
- Browser history navigation
- Bookmarkable results
- SEO benefits for public repository pages

### 11. SEO Infrastructure

I added a comprehensive SEO layer to improve discoverability:

- **Static OG/favicon images** — replaced dynamic edge-generated `ImageResponse` icons with pre-rendered PNGs in `public/`, eliminating unnecessary edge compute for images that never change
- **`robots.ts`** — allows `/`, disallows `/api/` and `/dashboard`, references sitemap
- **`sitemap.ts`** — includes only the homepage (dynamic repo pages are infinite and discovered organically)
- **JSON-LD structured data** — `WebApplication` schema on every page via root layout, `WebPage` schema on individual repo pages via `lib/structured-data.ts`
- **Per-page metadata** — the repo page uses a server/client split so the server component can export `generateMetadata()` with dynamic title, description, and OG tags for each `owner/name` combination
- **Dashboard noindex** — the protected dashboard has `robots: { index: false, follow: false }` to prevent accidental crawling
