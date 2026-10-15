# Tech Stack

## Frontend Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Astro** | 5.16.11 | Static site generator with island architecture and View Transitions |
| **React** | 19.2.3 | Interactive component islands (chat, theme toggle, project shelves) |
| **TypeScript** | 5.9.3 | Strict mode (`astro/tsconfigs/strict`) across the site and build scripts |
| **Tailwind CSS** | 3.4.19 | Utility-first styling with custom theme variables |

### Why These Choices

**Astro**: Perfect for a portfolio site - most content is static, but I needed interactive islands for the AI chat. Astro's partial hydration means users only download JavaScript for components that need it.

**React 19**: The chat interface juggles streaming output, model-loading progress, mode switching and error states. In local mode, generated tokens are buffered and flushed to state every 150 ms so the UI stays smooth while WebLLM generates.

**Tailwind CSS**: Rapid iteration on design with consistent spacing and colors. Custom CSS variables (`--accent-primary`, `--bg-surface`, etc.) enable runtime theme switching.

## AI & Machine Learning

| Technology | Version | Purpose |
|------------|---------|---------|
| **@mlc-ai/web-llm** | 0.2.80 | Browser-based LLM inference using WebGPU |
| **@anthropic-ai/sdk** | 0.72.1 | Claude API for the cloud chat mode |
| **@xenova/transformers** | 2.17.2 | MiniLM embeddings at build time and for queries at runtime |

### AI Architecture

I implemented a hybrid approach:

- **Local inference**: WebLLM runs SmolLM2-1.7B-Instruct, 4-bit quantized, entirely in the browser via WebGPU. No data leaves the device.
- **Cloud mode**: Anthropic Claude Haiku 4.5 is the default for every visitor and the only option on devices that can't run the model locally.
- **RAG embeddings**: MiniLM-L6-v2 generates 384-dimensional embeddings for semantic search over portfolio content. The same model embeds the visitor's query, in the browser for local mode or in the API route for cloud mode.

## Visual Design

The hero and background are plain CSS and Astro, with no 3D or canvas work. `GeometricBackground.astro` draws a grid and rotated red and teal rectangles that match the OpenGraph image style, and `HeroSection.astro` runs a small typing animation that restarts cleanly across View Transitions. Type is set in DM Sans, Inter and JetBrains Mono from Google Fonts.

## State Management

| Technology | Version | Purpose |
|------------|---------|---------|
| **Zustand** | 5.0.10 | Lightweight state management with persistence |

### Store Architecture

A single store handles theme state with localStorage persistence:

- **themeStore**: Manages light/dark mode, seeded from the class the inline head script already applied
- **Persist middleware**: Theme preference survives page refreshes

I chose Zustand over Context for its simplicity and built-in persistence support. Everything else (chat messages, shelf filters) is local component state.

## Content & Rendering

| Technology | Version | Purpose |
|------------|---------|---------|
| **@astrojs/mdx** | 4.3.13 | MDX support for blog posts |
| **marked** | 17.0.1 | Build-time Markdown to HTML for the synced project docs |
| **mermaid** | 11.12.2 | Client-side diagram rendering on project detail pages |
| **@tailwindcss/typography** | 0.5.19 | Prose styling for markdown content |
| **@astrojs/sitemap** | 3.7.0 | Sitemap generation for `jacobkanfer.com` |

## Infrastructure & Deployment

| Platform | Purpose |
|----------|---------|
| **Vercel** | Production hosting; the chat API runs as a serverless function |
| **@astrojs/vercel** 9.0.4 | Vercel adapter for the one server-rendered route |
| **@vercel/analytics** 1.6.1 | Page analytics, mounted once in `BaseLayout` |
| **GitHub Actions** | Nightly repo + portfolio-doc sync (`sync-private-repos.yml`, Node 24) |
| **Web3Forms** | Contact form delivery without a backend of my own |

### Deployment Pipeline

- Push to main triggers a Vercel build, including the nightly bot commit that refreshes repo data
- `npm run build` regenerates the embeddings before `astro build`, so new project docs reach the chat within a day
- The chat route runs as a Vercel serverless function; every other page is static

## Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **npm** | - | Package manager (`package-lock.json`) |
| **tsx** | ^4.7.0 | TypeScript execution for build and test scripts |
| **Vitest** | 4.1.8 | Unit tests for the pure logic (shelf placement in `src/lib/projectSections.ts`, Markdown chunking in `scripts/lib/chunker.ts`) |
| **@astrojs/check** | 0.9.9 | Type checking for `.astro` files (`npx astro check`) |
| **Puppeteer** | 24.36.1 | OG image generation, plus browser-driven chat quality scripts |

There is no linter or formatter configured.

## Key Dependencies Deep Dive

### @mlc-ai/web-llm
Enables running LLMs directly in the browser using WebGPU. I use SmolLM2-1.7B-Instruct (`q4f16_1`) because it balances answer quality with download size (about 1 GB). WebLLM keeps the weights in the browser's Cache Storage after the first download.

### @xenova/transformers
Runs Hugging Face transformer models in JavaScript, in both Node and the browser. I use MiniLM-L6-v2 for every embedding: it is small (about 23 MB quantized) and fast enough to embed a query on each message.

### Zustand
Minimal state management that "just works." The persist middleware handles localStorage serialization automatically. No reducers, no actions - just a simple store with direct mutations.

### marked + mermaid
Portfolio markdown files can include Mermaid diagrams. `marked` turns them into ordinary code blocks at build time; a client script on the detail page then finds blocks that start with a Mermaid keyword and swaps them for rendered, zoomable SVG.

## Performance Considerations

### Payload
- WebLLM model: about 1 GB, downloaded in the background by a site-wide preloader on capable desktops and cached after first load
- MiniLM embedder: about 23 MB, fetched on the first local-mode question
- Embeddings index: a single JSON file of tens of megabytes, fetched by the browser only in local mode

### Runtime Performance
- Static pages are pre-rendered and served from Vercel's CDN
- AI libraries are dynamically imported: WebLLM only once the preloader or chat has confirmed WebGPU on a desktop-width screen, Transformers.js only when local mode runs a search
- Theme toggle is instant (no network request)

### SEO & Accessibility
- All pages pre-rendered with semantic HTML, canonical URLs and a generated sitemap
- Per-page OpenGraph images for social sharing
- Scheduled blog posts are `noindex` until they publish
- Skip-to-content link, ARIA roles on the chat log and mode switch
- Theme respects system preference
