# Project Overview & FAQ

## Overview

RepoLens is a GitHub repository analytics tool that provides detailed insights into any public or private repository. I built it to solve the problem of quickly understanding a codebase's composition - how much code exists, what languages are used, who contributes, and how active development has been. The tool targets developers who want to evaluate repositories before contributing, hiring managers assessing candidate portfolios, and project maintainers who want to showcase their work with embeddable statistics widgets.

## Key Features

### Repository Analysis
Analyze any GitHub repository by entering its URL or selecting from your own repositories. The tool fetches and displays total lines of code, additions/deletions from recent commits, language breakdown by bytes, commit history with per-commit stats, and contributor information.

### Interactive Visualizations
The code frequency chart shows additions and deletions over the past year using an area chart with gradient fills. The language breakdown displays a horizontal bar with color-coded segments matching GitHub's language colors. All visualizations are responsive and animate on load.

### Embeddable Widgets
Generate SVG images that can be embedded directly in README files. Three widget types are available: repository stats (stars, forks, watchers, issues), code stats (lines, additions, deletions, commits), and language breakdown. Widgets support dark and light themes and are cached at the CDN edge for fast loading.

### GitHub OAuth Integration
Sign in with GitHub to access private repositories and increase API rate limits from 60 to 5,000 requests per hour. Authentication uses NextAuth v5 with JWT sessions - no credentials are stored on any server.

### User Dashboard
Authenticated users get a dedicated dashboard at `/dashboard` showing their repositories sorted by last update, with quick-analyze buttons. The dashboard supports search, pagination, refresh, and includes private repositories.

### Dynamic Repo Pages
Each repository analysis has its own URL at `/repo/[owner]/[name]`, making results deep-linkable, shareable, and bookmarkable. Both authenticated and unauthenticated users can access these pages.

### Privacy-First Design
The application never stores user credentials or access tokens in a database. All authentication happens through GitHub OAuth, and tokens exist only in browser sessions. Users can revoke access at any time through their GitHub settings.

## Technical Highlights

### GraphQL + REST Hybrid API Strategy
The most significant optimization is the hybrid GitHub API approach. Fetching commit history used to require 51+ REST API calls (1 for the commit list + 1 per commit for details). I replaced this with a single GraphQL query that returns everything in one call — a ~98% reduction in API consumption. The system falls back to REST if GraphQL fails, and can calculate approximate code frequency from commit data when the statistics API returns 422 for large repos.

### Handling GitHub's 202 Response
GitHub's statistics API returns HTTP 202 when stats are still being computed for a repository. I implemented client-side polling with exponential backoff (3s, 6s, 12s, 24s, 48s) that gracefully handles this case, showing a loading state while automatically retrying until data is available.

### Feature-Sliced Component Architecture
Components are organized by domain: `layout/` for page structure, `ui/` for reusable primitives (Card with variant system, LoadingSkeleton), `features/` for domain-specific components (stats, commits, contributors, repos), and specialized directories for embed and effects. A barrel export enables clean imports from `@/components`.

### Typed Caching with TTL
The caching layer uses a generic `Cache<T>` class with configurable TTL and max size. Pre-configured instances (`repoCache`, `statsCache`) handle unauthenticated request caching to stay within GitHub's 60 req/hr limit. Expired entries are cleaned up automatically.

### Server-Side Route Protection
The dashboard uses a Next.js server-side layout guard (`dashboard/layout.tsx`) that checks authentication via `auth()` and redirects unauthenticated users. This pattern keeps the auth check on the server, avoiding client-side flash.

### Zod Validation at API Boundaries
All API inputs pass through Zod schemas that handle multiple GitHub URL formats (full URLs, `owner/repo`, with or without `.git`). Validation happens only at system boundaries — internal code trusts validated data.

### Edge-Rendered Embed Images
The embed endpoints use Next.js's Edge runtime with `next/og` (Satori) to generate images on-demand. These are cached at the CDN edge for 1 hour (`s-maxage=3600`), which means the first request generates the image and subsequent requests are served instantly from cache. Shared utilities in `lib/embed-utils.tsx` keep the embed routes DRY.

### Parallel API Fetching
To minimize latency, I fetch repository info, languages, commits, code frequency, and contributors in parallel using `Promise.all()`. This reduces total request time significantly compared to sequential fetching, though it does consume more of the API rate limit per analysis.

### SEO & Static Image Optimization
I replaced the dynamically generated OG image, favicon, and Apple icon (which used edge `ImageResponse` to produce the same image on every request) with pre-rendered static PNGs. This eliminates unnecessary edge compute. I also added `robots.txt`, `sitemap.xml`, JSON-LD structured data (WebApplication + per-page WebPage), and per-page `generateMetadata()` for dynamic repo routes — which required splitting the repo page into a server component (for metadata) and a client component (for the interactive UI).

## Frequently Asked Questions

### Q: Why do some repositories show "Statistics unavailable"?

A: GitHub's statistics API has limitations. Repositories with over 10,000 commits may not have computed statistics available. Additionally, when you first request stats for a repository that hasn't been analyzed recently, GitHub needs time to compute them - the app will automatically poll until they're ready. For large repos, the app now falls back to calculating approximate code frequency from commit data.

### Q: How accurate is the "Total Lines" count?

A: The total lines metric is calculated from the commit history I can access (typically the most recent 50 commits). It's an approximation based on additions minus deletions. For a more accurate count, you'd need to clone the repository and run a tool like `cloc` locally.

### Q: Why should I sign in with GitHub?

A: Signing in provides three benefits: access to your private repositories, a much higher API rate limit (5,000 requests/hour vs 60 requests/hour), and a personal dashboard showing all your repos with quick-analyze buttons.

### Q: Is my GitHub data stored anywhere?

A: No. The application uses OAuth tokens that exist only in your browser session. I don't have a database, and your credentials never touch my servers beyond the initial OAuth handshake with GitHub.

### Q: Can I embed widgets for private repositories?

A: No, embed widgets only work for public repositories. This is because the embed endpoints don't have access to user authentication - they fetch data anonymously from GitHub's public API.

### Q: Why are embed images sometimes slow to load?

A: The first request for a new embed generates the image on-demand and may take 1-2 seconds. Subsequent requests within an hour are served from CDN cache and load instantly. If you're seeing consistently slow loads, GitHub's API might be rate-limited.

### Q: How do I customize the embed widget appearance?

A: You can customize widgets with URL parameters: `?theme=dark` or `?theme=light` for color scheme, and `?hideRepoName=true` to show only the stats without the repository name header.

### Q: What's the difference between the three widget types?

A: **Stats** shows social metrics (stars, forks, watchers, issues). **Code Stats** shows development metrics (lines, additions, deletions, commits). **Languages** shows the top programming languages used in the repository with their percentages.

### Q: Can I self-host RepoLens?

A: Yes! The project is designed to be self-hostable. You'll need to create your own GitHub OAuth App and set the required environment variables. It can be deployed to any platform that supports Next.js, including Vercel, Netlify, Railway, or your own server.

### Q: Why do some language colors not match GitHub?

A: I maintain a static mapping of language colors based on GitHub's linguist library. If a language isn't in my mapping, it falls back to a default gray color. The mapping covers all common languages but may miss some obscure ones.

### Q: How does the GraphQL optimization work?

A: Instead of making one REST call per commit to get detailed stats (additions, deletions, file changes), the app sends a single GraphQL query that fetches all commit details at once. For a typical 50-commit analysis, this reduces API calls from 51 to 1. The REST API is used as a fallback if GraphQL is unavailable.

### Q: What's the difference between the public page and the dashboard?

A: The public page at `/` lets anyone analyze a repo by URL. The dashboard at `/dashboard` is for authenticated users and shows all their GitHub repos (including private ones) with one-click analysis. Both eventually land on the same `/repo/[owner]/[name]` page for results.

## Limitations

- **Large repos**: GitHub's statistics API can struggle with repositories over 10,000 commits, though the GraphQL fallback handles most cases
- **Rate limiting**: Heavy use without authentication will hit GitHub's 60 requests/hour limit
- **Stats computation time**: First-time analysis of a repository may require waiting for GitHub to compute statistics
- **Embed privacy**: Widgets only work for public repositories
- **Historical data**: Code frequency only shows the past year; older history isn't available through the API
