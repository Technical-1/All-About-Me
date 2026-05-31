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

### Info Hub & Interactive Widget Guide
A public `/about` page documents what RepoLens is, how its stats are computed (including the honest accuracy caveats for large repositories), and the engineering choices behind it. Its centerpiece is an interactive widget gallery: the three badges render live for a sample repository, a dark/light toggle re-themes them instantly, and a per-widget "Show code" disclosure reveals copy-paste Markdown and HTML snippets that work for any public repo. A collapsible FAQ rounds out the page.

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

### Handling GitHub's lazy statistics API
GitHub serves `/stats/code_frequency` lazily: the first request for an uncached repo returns HTTP 202 (computing) or an empty series, and repos over ~10k commits return 422 outright. Rather than stalling on "Statistics unavailable", `deriveCodeFrequencyFallback` renders a stand-in chart immediately from the per-commit additions/deletions already in hand. Client-side polling with exponential backoff (3s, 6s, 12s, 24s, 48s) still runs — but only when the series is genuinely pending *and* the commit-derived estimate doesn't already cover the repo's full history, so small repos render complete data and skip polling entirely.

### Accurate line totals with honest labeling
"Total lines of code" is a derived metric, and the naive version — summing the ~100 commits in the display list — silently undercounts any repo with real history. When GitHub serves the full `/stats/code_frequency` weekly series, the total is the exact net (additions − deletions) across the repo's entire history. When it won't (422 on large repos, or still computing), the code pages commit history via GraphQL up to 2,500 commits and sums real per-commit deltas. The key is that the result never lies about its own precision: `FullRepoAnalysis` carries `totalLinesIsEstimated` and `totalLinesCommitsCovered`, and `estimateCoversFullHistory(covered, total)` promotes an estimate to an exact figure only when coverage provably reaches the repo's full commit count. The UI surfaces "estimate from N commits" rather than presenting an approximation as ground truth.

### Zero-fetch live widget previews
The `/about` widget gallery shows the three embed badges working in real time, but it ships no new data-fetching code. Because the `/api/embed/*` endpoints already return rendered SVG, each preview is just an `<img>` whose `src` points at the endpoint; the dark/light toggle simply rewrites the `theme` query param and the browser re-fetches. The Markdown/HTML snippets and preview URLs come from a single set of pure builders in `features/about/widgets.ts` (`embedSrc`, `markdownSnippet`, `htmlSnippet`), so what the visitor copies is guaranteed to match what they previewed. This keeps the interactive guide essentially free — no API routes, no client fetch logic, no extra rate-limit pressure.

### Feature-Sliced Component Architecture
Components are organized by domain: `layout/` for page structure, `ui/` for reusable primitives (Card with variant system, LoadingSkeleton), `features/` for domain-specific components (about, stats, commits, contributors, repos), and specialized directories for embed and effects. A barrel export enables clean imports from `@/components`.

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

## Engineering Decisions

### GraphQL for commits, REST for everything else
- **Constraint**: Unauthenticated users only get 60 GitHub requests/hour, and the old commit-detail loop burned 51 calls per analysis.
- **Options**: All-REST (simple but expensive), all-GraphQL (one query but requires schema work for every endpoint), or hybrid.
- **Choice**: Hybrid — GraphQL only for commit history, REST (via Octokit) for repo info, languages, contributors, and code frequency.
- **Why**: Commit detail was the dominant cost. Moving that one path to GraphQL cut API consumption ~98% per analysis while keeping the rest of the codebase on the well-typed Octokit client. GraphQL falls back to REST if it fails, so reliability is preserved.

### No database, JWT-only auth
- **Constraint**: I wanted users to access private repos via OAuth without taking on user-data liability.
- **Options**: Persist tokens in Postgres/Redis, store them in encrypted cookies, or keep them in signed JWTs only.
- **Choice**: NextAuth v5 with JWT sessions — tokens live in the signed JWT, never written to a database.
- **Why**: No database means no breach surface for stolen tokens, no GDPR concerns, no infra to run. Users revoke access through GitHub. The trade-off is no cross-device session state, which doesn't matter for this product.

### Static OG/favicon over dynamic `ImageResponse`
- **Constraint**: The original `icon.tsx`, `apple-icon.tsx`, and `opengraph-image.tsx` regenerated identical images on every cold start via Satori.
- **Options**: Keep dynamic generation (no maintenance, costs edge compute), bake static PNGs (cheaper, requires manual regeneration on rebrand), or pre-render at build time.
- **Choice**: Static PNGs in `public/` for OG, favicon, and Apple icon. Kept dynamic generation only for the per-repo embed widgets where the image actually varies.
- **Why**: The brand image never changes; running Satori on every request was waste. Embed widgets do vary per repo, so dynamic generation stays there — cached at the edge for 1 hour to amortize the cost.

### Server/client split on the repo page
- **Constraint**: Dynamic `/repo/[owner]/[name]` routes needed per-page `generateMetadata()` (server-only) plus interactive charts (client-only).
- **Options**: Make the whole page a client component and lose dynamic OG/SEO, or split it.
- **Choice**: `page.tsx` is a server component that exports `generateMetadata()` and JSON-LD, then renders `RepoPageClient.tsx` for the interactive UI.
- **Why**: Search engines and social cards see real titles and descriptions per repository; users still get the client-side fetching and chart interactions. The split is mechanical and low-cost.

## Frequently Asked Questions

### Q: Why do some repositories show "Statistics unavailable"?

A: GitHub's statistics API has limitations. Repositories with over 10,000 commits may not have computed statistics available. Additionally, when you first request stats for a repository that hasn't been analyzed recently, GitHub needs time to compute them - the app will automatically poll until they're ready. For large repos, the app now falls back to calculating approximate code frequency from commit data.

### Q: How accurate is the "Total Lines" count?

A: It depends on what GitHub will serve. When GitHub provides the full `/stats/code_frequency` series, the total is the exact net of additions minus deletions across the repository's entire history — not an estimate. When that series is unavailable (large repos return 422, or it's still computing on first request), the app pages commit history through GraphQL up to 2,500 commits and sums the real per-commit line changes. In that case the number is labeled as an estimate and shows how many commits it covers, and it's only promoted back to "exact" if that coverage spans the repo's full commit count. The one thing it won't do is present an approximation as if it were authoritative.

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

A: Instead of making one REST call per commit to get detailed stats (additions, deletions, file changes), the app sends a single GraphQL query that fetches all commit details at once. For the default display list of up to 100 commits, this collapses what would be 100+ REST calls into one. The same query paginates with cursor-based `after`/`endCursor` (GitHub caps each `history` page at 100) to deepen further when computing line totals for repos GitHub won't serve statistics for. The REST API is used as a fallback if GraphQL is unavailable.

### Q: What's the difference between the public page and the dashboard?

A: The public page at `/` lets anyone analyze a repo by URL. The dashboard at `/dashboard` is for authenticated users and shows all their GitHub repos (including private ones) with one-click analysis. Both eventually land on the same `/repo/[owner]/[name]` page for results.

## Limitations

- **Large repos**: GitHub's statistics API can struggle with repositories over 10,000 commits, though the GraphQL fallback handles most cases
- **Rate limiting**: Heavy use without authentication will hit GitHub's 60 requests/hour limit
- **Stats computation time**: First-time analysis of a repository may require waiting for GitHub to compute statistics
- **Embed privacy**: Widgets only work for public repositories
- **Chart window**: The code-frequency chart displays the last 52 weeks for readability — line totals are computed over full history, but the visualization is intentionally scoped to the past year
