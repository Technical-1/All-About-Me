# All-About-Me

Personal portfolio website with AI-powered chat assistant.

A modern portfolio site built with Astro and React featuring an interactive AI chat that can answer questions about my background, projects, and experience. The chat supports both local inference (WebLLM) and cloud fallback (Claude API), with RAG-powered responses grounded in actual project documentation.

## Features

- **AI Chat Assistant** - Interactive chat that answers questions about my portfolio using either local WebLLM or Claude API
- **RAG-Powered Responses** - Semantic search over pre-computed embeddings ensures accurate, grounded answers
- **Project Showcase** - Domain-grouped shelves of every repo, synced nightly from GitHub, with detail pages that render architecture diagrams, tech stack, and Q&A pulled from each project's own docs
- **Technical Blog** - Markdown/MDX posts with scheduled publishing (future-dated posts stay hidden until their date arrives)
- **Dark/Light Theme** - System-aware theme with instant switching and persistence
- **Responsive Design** - Optimized for mobile, tablet, and desktop

## Tech Stack

- **Framework**: Astro 5 with React islands
- **AI**: WebLLM (SmolLM2-1.7B) for local inference, Claude Haiku 4.5 for cloud fallback, Xenova Transformers for embeddings
- **Content**: Astro content collections (Markdown/MDX blog)
- **Data sync**: Nightly GitHub Action pulling repo metadata and `.portfolio/` docs
- **Tests**: Vitest
- **Styling**: Tailwind CSS with custom theme variables
- **State**: Zustand with persistence
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 24 (what the sync workflow and Vercel use)
- npm or pnpm

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

# Unit tests
npm test
```

`npm run dev` serves whatever `public/data/rag/embeddings.json` is on disk. Run `npm run generate-embeddings` first if you've changed portfolio docs or blog posts and want the local chat to see them.

### Environment Variables

Create a `.env` file for cloud chat functionality:

```
ANTHROPIC_API_KEY=your_api_key_here
```

The nightly sync needs a `GH_PRIVATE_TOKEN` repository secret with read access to every repo it lists. You only need it locally to run `node scripts/fetch_private_repos.js` by hand.

## Project Structure

```
All-About-Me/
├── src/
│   ├── components/     # React/Astro islands (chat, projects, blog, global)
│   ├── content/        # Blog content collection (Markdown/MDX) + schema
│   ├── layouts/        # Astro layouts
│   ├── lib/            # GitHub API, RAG, project categorization
│   ├── pages/          # Astro pages, blog/project routes, chat API
│   ├── stores/         # Zustand state management
│   └── styles/         # Global CSS and theme
├── public/
│   ├── data/           # Synced repo JSON, portfolio docs, personal knowledge files, embeddings
│   ├── screenshots/    # Synced project preview images
│   └── og/             # OpenGraph images
├── scripts/            # Repo sync, category map, embeddings, OG images, chat test scripts
└── docs/               # Documentation and prompts
```

## Key Features Explained

### Project Data Sync

`.github/workflows/sync-private-repos.yml` runs every night at 07:00 UTC:

1. `scripts/fetch_private_repos.js` lists every repo I own, public and private. It drops forks and anything in `EXCLUDED_REPOS`, and nothing is fetched from an excluded repo.
2. Each remaining repo's `.portfolio/architecture.md`, `stack.md`, and `qa.md` go to `public/data/portfolio/<repo>/`, and `.portfolio/preview.png|gif` goes to `public/screenshots/<slug>/`.
3. Each repo gets a shelf from `scripts/repo-categories.js`. Unlisted repos fall to `other`.
4. The bot commits the result, and the push triggers a Vercel deploy that rebuilds the embeddings.

Don't hand-edit `private_repos.json`, `featured_repos.json`, or `public/data/portfolio/`, because the next sync overwrites them. To recategorize a repo, edit `repo-categories.js` and run `node scripts/apply-categories.js` to restamp the local JSON.

On the projects page, any repo without a preview image shows on **Work in Progress** whatever its category, and academic coursework always stays on its own shelf.

### Hybrid AI Chat

The chat automatically detects WebGPU support:
- **WebGPU available**: Offers local mode (no data sent to servers)
- **No WebGPU**: Uses Claude Haiku 4.5 via the API, with rate limiting and input validation

### RAG System

Embeddings are generated at build time from the synced portfolio docs, the personal knowledge files in `public/data/personal/`, and published blog posts. Drafts and future-dated posts are skipped. At runtime:
1. User query is embedded using Xenova MiniLM-L6-v2
2. Cosine similarity finds relevant chunks
3. Keyword boosting improves exact match accuracy
4. Top results are injected into the LLM context

### Theme System

- Inline script prevents flash on load
- Respects `prefers-color-scheme` on first visit
- Zustand persistence saves preference
- CSS variables enable instant switching

## License

Unlicensed (personal project). The source is public on GitHub for reference.

## Author

Jacob Kanfer - [GitHub](https://github.com/Technical-1) - [LinkedIn](https://linkedin.com/in/jacob-kanfer)
