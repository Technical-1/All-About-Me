# Tech Stack

## Frontend Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Astro** | 5.16.11 | Static site generator with island architecture for optimal performance |
| **React** | 19.2.3 | Interactive component islands (chat, toggles, project cards) |
| **TypeScript** | - | Type safety throughout the codebase |
| **Tailwind CSS** | 3.4.19 | Utility-first styling with custom theme variables |

### Why These Choices

**Astro**: Perfect for a portfolio site - most content is static, but I needed interactive islands for the AI chat. Astro's partial hydration means users only download JavaScript for components that need it.

**React 19**: The chat interface requires complex state management and streaming updates. React's concurrent features help keep the UI responsive during WebLLM inference.

**Tailwind CSS**: Rapid iteration on design with consistent spacing and colors. Custom CSS variables (`--accent-primary`, `--bg-surface`, etc.) enable runtime theme switching.

## AI & Machine Learning

| Technology | Version | Purpose |
|------------|---------|---------|
| **@mlc-ai/web-llm** | 0.2.80 | Browser-based LLM inference using WebGPU |
| **@anthropic-ai/sdk** | 0.72.1 | Claude API for cloud chat fallback |
| **@xenova/transformers** | 2.17.2 | In-browser embeddings for RAG semantic search |

### AI Architecture

I implemented a hybrid approach:

- **Local inference**: WebLLM runs SmolLM2-1.7B-Instruct entirely in the browser via WebGPU. No data leaves the device.
- **Cloud fallback**: Anthropic Claude 3 Haiku provides faster, higher-quality responses when WebGPU isn't available.
- **RAG embeddings**: Xenova's MiniLM-L6-v2 generates 384-dimensional embeddings for semantic search over portfolio content.

## 3D Graphics

| Technology | Version | Purpose |
|------------|---------|---------|
| **Three.js** | 0.182.0 | 3D rendering for hero section particle effects |
| **@react-three/fiber** | 9.5.0 | React renderer for Three.js |
| **@react-three/drei** | 10.7.7 | Useful Three.js helpers and abstractions |

### Why Three.js

The hero section features an interactive particle system. React Three Fiber provides a declarative way to build Three.js scenes while maintaining React's component model.

## State Management

| Technology | Version | Purpose |
|------------|---------|---------|
| **Zustand** | 5.0.10 | Lightweight state management with persistence |

### Store Architecture

A single store handles theme state with localStorage persistence:

- **themeStore**: Manages light/dark mode with system preference detection
- **Persist middleware**: Theme preference survives page refreshes

I chose Zustand over Context for its simplicity and built-in persistence support.

## Content & Rendering

| Technology | Version | Purpose |
|------------|---------|---------|
| **@astrojs/mdx** | 4.3.13 | MDX support for blog posts |
| **marked** | 17.0.1 | Markdown parsing for portfolio content |
| **mermaid** | 11.12.2 | Diagram rendering in architecture docs |
| **@tailwindcss/typography** | 0.5.19 | Prose styling for markdown content |

## Infrastructure & Deployment

| Platform | Purpose |
|----------|---------|
| **Vercel** | Production hosting with edge functions |
| **GitHub** | Source control and CI/CD |
| **@astrojs/vercel** | Vercel adapter for SSR API routes |

### Deployment Pipeline

- Push to main triggers Vercel build
- Embeddings regenerated on each deploy
- API routes run as Vercel serverless functions
- Static assets cached at edge

## Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **tsx** | 4.7.0 | TypeScript execution for build scripts |
| **Puppeteer** | 24.36.1 | OG image generation |

## Key Dependencies Deep Dive

### @mlc-ai/web-llm
Enables running LLMs directly in the browser using WebGPU. I use SmolLM2-1.7B-Instruct because it balances quality with download size (~1.7GB). The model is cached in IndexedDB after first download.

### @xenova/transformers
Provides the same transformer models as Hugging Face but compiled for browser execution. I use MiniLM-L6-v2 for generating query embeddings at runtime - it's small (~23MB) and fast enough for real-time search.

### Zustand
Minimal state management that "just works." The persist middleware handles localStorage serialization automatically. No reducers, no actions - just a simple store with direct mutations.

### marked + mermaid
Portfolio markdown files can include Mermaid diagrams. The marked renderer is configured to detect mermaid code blocks and render them as interactive diagrams.

## Performance Considerations

### Bundle Size
- Core app: ~150KB gzipped (excluding WebLLM model)
- WebLLM model: ~1.7GB (cached after first load)
- Xenova embedder: ~23MB (lazy loaded on chat page)

### Runtime Performance
- Static pages load instantly from edge cache
- Chat page lazy loads AI dependencies
- Theme toggle is instant (no network request)
- RAG search completes in <100ms

### SEO & Accessibility
- All pages pre-rendered with semantic HTML
- OpenGraph images for social sharing
- Theme respects system preference
- Keyboard navigation throughout
