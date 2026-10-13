# All-About-Me

Personal portfolio website with AI-powered chat assistant.

A modern portfolio site built with Astro and React featuring an interactive AI chat that can answer questions about my background, projects, and experience. The chat supports both local inference (WebLLM) and cloud fallback (Claude API), with RAG-powered responses grounded in actual project documentation.

## Features

- **AI Chat Assistant** - Interactive chat that answers questions about my portfolio using either local WebLLM or Claude API
- **RAG-Powered Responses** - Semantic search over pre-computed embeddings ensures accurate, grounded answers
- **Project Showcase** - Domain-grouped shelves of every repo, synced nightly from GitHub, with detail pages that render architecture diagrams, tech stack, and Q&A pulled from each project's own docs
- **Technical Blog** - Markdown/MDX posts with scheduled publishing (future-dated posts stay out of the listing, and out of search indexes, until their date arrives)
- **Dark/Light Theme** - System-aware theme with instant switching and persistence
- **Responsive Design** - Optimized for mobile, tablet, and desktop

## Tech Stack

- **Framework**: Astro 5 with React 19 islands, View Transitions between pages
- **AI**: WebLLM (SmolLM2-1.7B) for local inference, Claude Haiku 4.5 for the cloud mode, Xenova Transformers (MiniLM-L6-v2) for embeddings
- **Content**: Astro content collections (Markdown/MDX blog); `marked` + Mermaid for the synced project docs
- **Data sync**: Nightly GitHub Action pulling repo metadata and `.portfolio/` docs
- **Tests**: Vitest
- **Styling**: Tailwind CSS with custom theme variables
- **State**: Zustand with persistence
- **Deployment**: Vercel (static pages plus one serverless chat route), Vercel Analytics

## Getting Started

### Prerequisites

- Node.js 24 (the version the sync workflow pins)
- npm (the repo ships a `package-lock.json`)

### Installation

```bash
git clone https://github.com/Technical-1/All-About-Me.git
cd All-About-Me
npm install
```

### Development

```bash
# Start development server
npm run dev

# Build for production (includes embedding generation)
npm run build

# Preview production build
npm run preview

# Unit tests (Vitest: shelf placement and Markdown chunking)
npm test
```

`npm run dev` serves whatever `public/data/rag/embeddings.json` is on disk. Run `npm run generate-embeddings` first if you've changed portfolio docs or blog posts and want the local chat to see them.

### Environment Variables

Create a `.env` file for cloud chat functionality:

```
ANTHROPIC_API_KEY=your_api_key_here
```

The nightly sync needs a `GH_PRIVATE_TOKEN` repository secret with read access to every repo it lists, plus an optional `EXCLUDED_REPOS` secret (comma-separated repo names to keep off the site). You only need them locally to run `node scripts/fetch_private_repos.js` by hand.

## Project Structure

```
All-About-Me/
├── src/
│   ├── components/     # React/Astro islands (chat, projects, blog, global)
│   ├── content/        # Blog content collection (Markdown/MDX) + schema
│   ├── layouts/        # Astro layouts
│   ├── lib/            # GitHub data layer, RAG (browser + server), shelf placement + tests
│   ├── pages/          # Astro pages, blog/project routes, chat API
│   ├── stores/         # Zustand state management
│   └── styles/         # Global CSS and theme
├── public/
│   ├── data/           # Synced repo JSON, portfolio docs, personal knowledge files, embeddings
│   ├── screenshots/    # Synced project preview images
│   └── og/             # OpenGraph images
├── scripts/            # Repo sync, category map, embeddings + chunker tests, OG images, chat test scripts
├── .github/workflows/  # Nightly repo sync
└── docs/               # Documentation and prompts
```

## Key Features Explained

### Project Data Sync

`.github/workflows/sync-private-repos.yml` runs every night at 07:00 UTC:

1. `scripts/fetch_private_repos.js` lists every repo I own, public and private. It drops forks (apart from a small allowlist of my own repos that GitHub flags as forks) and anything on the exclusion list, and nothing is fetched from an excluded repo. The exclusion list is a short hard-coded array plus whatever the `EXCLUDED_REPOS` secret supplies, so the names of hidden repos never have to be committed to this public repo.
2. Each remaining repo's `.portfolio/architecture.md`, `stack.md`, and `qa.md` go to `public/data/portfolio/<repo>/`, and `.portfolio/preview.png|gif` goes to `public/screenshots/<slug>/`. Directories left behind by renamed or deleted repos are pruned.
3. Each repo gets a shelf from `scripts/repo-categories.js`. Unlisted repos fall to `other`.
4. The bot commits the result, and the push triggers a Vercel deploy that rebuilds the embeddings.

Don't hand-edit `private_repos.json`, `featured_repos.json`, or `public/data/portfolio/`, because the next sync overwrites them. To recategorize a repo, edit `repo-categories.js` and run `node scripts/apply-categories.js` to restamp the local JSON.

On the projects page, any repo without a preview image shows on **Work in Progress** whatever its category, and academic coursework always stays on its own shelf. The page also merges in GitHub's public repo listing in the browser (forks and archived repos dropped), with the synced JSON winning wherever both describe the same repo. Only repos with `.portfolio/` docs get a detail page, and a private repo never links out to its GitHub URL.

### Hybrid AI Chat

The chat opens in cloud mode and checks the device on mount:
- **Desktop-width (1024px+) browser that can create a WebGPU device**: a Local/Cloud toggle appears. Local mode runs SmolLM2-1.7B in the browser, so no message leaves the device. A site-wide preloader starts downloading the model in the background once any page goes idle.
- **Anything else**: cloud only, using Claude Haiku 4.5 through `/api/chat`, which streams over Server-Sent Events and enforces a per-IP rate limit and message-size limits

### RAG System

Embeddings are generated at build time (`scripts/generate-embeddings.ts`) from the synced portfolio docs, the personal knowledge files in `public/data/personal/`, and published Markdown blog posts. Drafts, future-dated posts, and `.mdx` posts are skipped. `scripts/lib/chunker.ts` splits each file on `##`/`###` headings into chunks of up to about 500 tokens, keeping code blocks whole. At runtime:
1. User query is embedded using Xenova MiniLM-L6-v2 (in the browser for local mode, in the API route for cloud mode)
2. Cosine similarity scores every chunk
3. Keyword boosting lifts chunks that contain query terms verbatim
4. The top 8 chunks above a 0.20 score are appended to the system prompt

### Theme System

- Inline script prevents flash on load
- Respects `prefers-color-scheme` on first visit
- Zustand persistence saves preference
- CSS variables enable instant switching

## License

Unlicensed (personal project). The source is public on GitHub for reference.

## Author

Jacob Kanfer - [GitHub](https://github.com/Technical-1) - [LinkedIn](https://linkedin.com/in/jacob-kanfer)
