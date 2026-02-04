# All-About-Me

Personal portfolio website with AI-powered chat assistant.

A modern portfolio site built with Astro and React featuring an interactive AI chat that can answer questions about my background, projects, and experience. The chat supports both local inference (WebLLM) and cloud fallback (Claude API), with RAG-powered responses grounded in actual project documentation.

## Features

- **AI Chat Assistant** - Interactive chat that answers questions about my portfolio using either local WebLLM or Claude API
- **RAG-Powered Responses** - Semantic search over pre-computed embeddings ensures accurate, grounded answers
- **Project Showcase** - Rich project cards with architecture diagrams, tech stack details, and Q&A content
- **Dark/Light Theme** - System-aware theme with instant switching and persistence
- **Responsive Design** - Optimized for mobile, tablet, and desktop

## Tech Stack

- **Framework**: Astro 5 with React islands
- **AI**: WebLLM (SmolLM2-1.7B), Anthropic Claude API, Xenova Transformers
- **3D Graphics**: Three.js with React Three Fiber
- **Styling**: Tailwind CSS with custom theme variables
- **State**: Zustand with persistence
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
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
```

### Environment Variables

Create a `.env` file for cloud chat functionality:

```
ANTHROPIC_API_KEY=your_api_key_here
```

## Project Structure

```
All-About-Me/
├── src/
│   ├── components/     # React components (chat, projects, global)
│   ├── layouts/        # Astro layouts
│   ├── lib/            # Utilities (GitHub API, RAG system)
│   ├── pages/          # Astro pages and API routes
│   ├── stores/         # Zustand state management
│   └── styles/         # Global CSS and theme
├── public/
│   ├── data/           # JSON data and portfolio files
│   └── og/             # OpenGraph images
├── scripts/            # Build scripts (embedding generation)
└── docs/               # Documentation and prompts
```

## Key Features Explained

### Hybrid AI Chat

The chat automatically detects WebGPU support:
- **WebGPU available**: Offers local mode (no data sent to servers)
- **No WebGPU**: Uses Claude API with rate limiting and input validation

### RAG System

Embeddings are generated at build time from portfolio markdown files. At runtime:
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

Private repository - All rights reserved.

## Author

Jacob Kanfer - [GitHub](https://github.com/Technical-1) - [LinkedIn](https://linkedin.com/in/jacob-kanfer)
