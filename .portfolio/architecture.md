# Architecture

## System Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        HP[Home Page]
        EP[Experience Page]
        PP[Projects Page]
        BP[Blog Page]
        CP[Contact Page]
        RP[Resume Page]
        CH[Chat Page]
    end

    subgraph "Layout & Components"
        BL[BaseLayout]
        NB[Navbar]
        FT[Footer]
        TT[ThemeToggle]
        GB[GeometricBackground]
        HS[HeroSection]
    end

    subgraph "Project Components"
        PS[ProjectShelves]
        CRC[CompactRepoCard]
        PSEC[projectSections]
        PD[Project Detail Page]
    end

    subgraph "Blog"
        BC[Content Collection]
        BS[blog/index + slug]
        TG[TabbedGuide]
    end

    subgraph "Chat System"
        CI[ChatInterface]
        WLP[WebLLM Preloader]
        API[Chat API Endpoint]
    end

    subgraph "AI/RAG System"
        RAG[RAG Module]
        EMB[Embeddings JSON]
        XEN[Xenova Transformers]
        ANT[Anthropic Claude API]
    end

    subgraph "State Management"
        TS[themeStore]
        ZS[Zustand]
    end

    subgraph "Data Layer"
        FR[featured_repos.json]
        PR[private_repos.json]
        PF[Portfolio Files]
        GHA[GitHub API]
    end

    HP --> BL
    EP --> BL
    PP --> BL
    BP --> BL
    CP --> BL
    RP --> BL
    CH --> BL

    BL --> NB
    BL --> FT
    BL --> GB
    NB --> TT
    TT --> TS
    TS --> ZS

    HP --> HS
    PP --> PS
    PP --> CRC
    PP --> PD
    PS --> PSEC

    PSEC --> FR
    PD --> PF
    PS --> GHA
    PS --> PR

    BP --> BS
    BS --> BC
    BS --> TG

    CH --> CI
    CI --> WLP
    CI --> API
    CI --> RAG

    API --> ANT
    API --> RAG
    RAG --> EMB
    RAG --> XEN
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant ChatInterface
    participant WebLLM
    participant API
    participant RAG
    participant Claude

    alt Local Mode (WebGPU)
        User->>ChatInterface: Send message
        ChatInterface->>RAG: searchContext(query)
        RAG->>RAG: Embed query with Xenova
        RAG->>RAG: Cosine similarity + keyword boost
        RAG-->>ChatInterface: Relevant chunks
        ChatInterface->>WebLLM: Generate response
        WebLLM-->>ChatInterface: Streamed response
        ChatInterface-->>User: Display response
    else Cloud Mode
        User->>ChatInterface: Send message
        ChatInterface->>API: POST /api/chat
        API->>RAG: searchContext(query)
        RAG-->>API: Relevant chunks
        API->>Claude: messages.stream()
        Claude-->>API: SSE stream
        API-->>ChatInterface: Streamed response
        ChatInterface-->>User: Display response
    end
```

## Key Architecture Decisions

### 1. Hybrid AI Chat System

I implemented a dual-mode chat system that can run either locally in the browser or via cloud API:

- **Local Mode**: Uses WebLLM with SmolLM2-1.7B model running on WebGPU. The model is preloaded in the background when the user hovers over navigation links, reducing perceived latency.
- **Cloud Mode**: Falls back to Anthropic's Claude Haiku 4.5 for devices without WebGPU support or when the user prefers faster responses.

The mode toggle is only shown when WebGPU is detected, otherwise cloud mode is used automatically.

### 2. RAG (Retrieval-Augmented Generation)

Rather than fine-tuning a model or stuffing all project information into the system prompt, I implemented semantic search over pre-computed embeddings:

- **Build-time**: `generate-embeddings.ts` processes portfolio markdown files, chunks them, and generates embeddings using Xenova transformers (MiniLM-L6-v2)
- **Runtime**: User queries are embedded with the same model, then compared via cosine similarity + keyword boosting
- **Hybrid Search**: Pure semantic search missed exact project names, so I added keyword boosting for terms that appear verbatim in the content

This approach keeps the LLM context small while providing accurate, grounded answers.

### 3. Static Site with Dynamic Islands

I chose Astro for its island architecture:

- **Static pages**: Most pages are pre-rendered at build time for fast loads and SEO
- **React islands**: Interactive components (chat, theme toggle, project cards) hydrate on the client
- **Partial hydration**: Using `client:load` or `client:only="react"` minimizes JavaScript sent to the browser

### 4. Theme System

The theme implementation handles several edge cases:

- **No flash**: An inline script in `<head>` reads localStorage before paint
- **System preference**: Respects `prefers-color-scheme` on first visit
- **React sync**: Zustand store syncs with DOM state on mount to avoid hydration mismatch
- **Persistence**: Theme preference persists via Zustand's persist middleware

### 5. GitHub Integration

Project data comes from multiple sources:

- **Public repos**: Fetched from GitHub API at build time
- **Private repos**: Manually curated in `private_repos.json` with metadata
- **Featured projects**: Subset with rich portfolio documentation
- **Portfolio files**: Markdown docs in `.portfolio/` directories provide architecture/stack/Q&A content

### 6. Project Shelves & Categorization

The projects page groups every repo into domain shelves (AI, Crypto & Fintech, Developer Tools, Automation, and so on) rather than a flat wall. The placement logic lives in `src/lib/projectSections.ts` and is deliberately small:

- **`shelfFor(repo)`**: maps a repo to a shelf. `academic` is an explicit stored category that always wins. Any repo without a preview image is demoted to a `work-in-progress` shelf, so unfinished work never sits next to polished projects. Otherwise the repo lands on its stored domain category.
- **`sortWithinShelf`**: orders each shelf featured → active → archived, breaking ties by most-recent push.
- **`featuredFromShelves`**: collects featured repos across every shelf into one cross-shelf group that backs the mobile "Featured" filter.

`ProjectShelves` is a client island; on narrow screens it renders a sticky pill bar (All / Featured / per-shelf) so mobile visitors can filter instead of scrolling every shelf. The categorization is pure and unit-tested in `projectSections.test.ts`.

### 7. Scheduled Blog Publishing

The blog is an Astro content collection (`src/content/blog`, schema in `src/content/config.ts`) that accepts both Markdown and MDX, so richer posts can embed React (for example the `TabbedGuide` island). Each post's frontmatter carries a `pubDate` and a `draft` flag:

- A `draft: true` post has no page at all.
- A post with a future `pubDate` still builds a page but is filtered out of the listing until its date arrives.

Because the repo rebuilds nightly (the same job that snapshots repo data), a scheduled post surfaces on its publish date with no manual step. This lets me queue a slate of posts ahead of time.

### 8. Rate Limiting & Security

The chat API implements defensive measures:

- **IP-based rate limiting**: 20 requests per minute per IP
- **Memory bounds**: Map size limited to prevent DoS via memory exhaustion
- **Input validation**: Message length, count, and total conversation size limits
- **Error sanitization**: Internal errors are logged but generic messages returned to clients

### 9. Component Organization

```
src/
├── components/
│   ├── blog/         # TabbedGuide (MDX-embedded React island)
│   ├── chat/         # ChatInterface - AI chat functionality
│   ├── global/       # Shared components (Navbar, Footer, ThemeToggle)
│   ├── hero/         # Landing page hero section
│   └── projects/     # ProjectShelves, CompactRepoCard, GitHubReposWall
├── content/          # Blog content collection + schema
├── layouts/          # BaseLayout wraps all pages
├── lib/              # github.ts, rag.ts, rag-server.ts, projectSections.ts
├── pages/            # Astro pages, blog/project routes, chat API
├── stores/           # Zustand state management
└── styles/           # Global CSS with theme variables
```

### 10. Build Pipeline

The build process generates embeddings before Astro builds:

```bash
npm run build
# 1. tsx scripts/generate-embeddings.ts → public/data/rag/embeddings.json
# 2. astro build → static site with prerendered pages
```

This ensures RAG data is always fresh when deployed.
