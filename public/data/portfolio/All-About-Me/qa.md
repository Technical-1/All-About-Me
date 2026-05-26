# Project Q&A

## Overview

**All-About-Me** is my personal portfolio website built with Astro, React, and AI-powered features. It showcases my work experience, projects, skills, and includes an AI chat assistant that can answer questions about my background. The chat runs either locally in the browser using WebLLM (no data sent to servers) or via Claude API as a fallback. The site features a RAG (Retrieval-Augmented Generation) system that provides accurate, grounded answers by searching through my project documentation.

## Problem Solved

Traditional portfolio sites are static and one-directional - visitors read what's written but can't ask follow-up questions. This portfolio solves that by providing an interactive AI assistant that can answer specific questions about my experience, explain project details, and have natural conversations. The local-first approach respects privacy while the RAG system ensures accurate answers grounded in actual documentation rather than hallucinations.

## Target Users

- **Recruiters and hiring managers** researching my background
- **Potential collaborators** learning about my technical skills
- **Fellow developers** interested in my projects or implementation approaches
- **Anyone curious** who prefers asking questions over reading through pages

## Key Features

### AI Chat Assistant
An interactive chat interface that answers questions about my background, projects, and experience. Supports both local (WebLLM) and cloud (Claude) modes with automatic fallback based on device capabilities.

### RAG-Powered Responses
Semantic search over pre-computed embeddings ensures the AI provides accurate, grounded answers rather than making things up. Hybrid search combines vector similarity with keyword boosting for better accuracy.

### Project Showcase
Interactive project cards with rich detail pages showing architecture diagrams, tech stack breakdowns, and Q&A content pulled from each project's documentation.

### Dark/Light Theme
System-aware theme switching with no flash on load. Persists preference across sessions.

### Responsive Design
Fully responsive layout that works on mobile, tablet, and desktop with appropriate component adaptations.

### Privacy-First Local AI
The WebLLM option runs entirely in the browser - no data is sent to external servers. Perfect for visitors who prefer not to share their questions with cloud services.

## Technical Highlights

### Hybrid AI Architecture
I built a dual-mode chat system that detects WebGPU support and offers local inference when available. The WebLLM model (SmolLM2-1.7B) is preloaded in the background when users hover over navigation links, reducing perceived latency when they actually open the chat.

### RAG Implementation
Pure semantic search struggled with exact matches like project names. I implemented hybrid search that boosts scores when query terms appear verbatim in content, significantly improving accuracy for questions like "Tell me about the AHSR project."

### Theme Synchronization
Coordinating theme state between an inline script (needed to prevent flash), React hydration, and Zustand persistence required careful handling. The solution reads initial state from DOM in the Zustand store initializer, then syncs on mount.

### Streaming Responses
Both local and cloud modes stream responses token-by-token for a responsive feel. The cloud API uses Server-Sent Events while WebLLM uses async iteration over the completion stream.

## Engineering Decisions

### Hybrid local + cloud chat over single-mode
- **Constraint**: Want a privacy-first chat experience but not at the cost of users on older devices losing the feature entirely.
- **Options**: Cloud-only (Claude API); local-only (WebLLM, but ~30% of visitors lack WebGPU); hybrid with feature detection.
- **Choice**: Detect WebGPU support; serve WebLLM locally when available, fall back to Claude API otherwise. Both paths share the same RAG layer and streaming UX.
- **Why**: No visitor is locked out, and the people who can run it locally get true privacy. The cloud fallback also covers the warmup gap while the 1.7GB WebLLM model downloads on first visit.

### Hybrid semantic + keyword search over pure vector similarity
- **Constraint**: A visitor typing "Tell me about AHSR" should reliably retrieve the AHSR project even when its embedding is closer to a different project's vector.
- **Options**: Pure cosine similarity on MiniLM-L6-v2 embeddings; BM25 keyword search; hybrid scoring.
- **Choice**: Cosine similarity over chunked portfolio docs, with a multiplicative boost when query terms appear verbatim in the chunk.
- **Why**: Project names are nearly always typed literally, so verbatim hits should dominate ranking even when the embedding doesn't agree.

### Astro islands over a full SPA framework
- **Constraint**: Most of the site is static content (experience, projects, blog) but the chat and project cards need React-level interactivity.
- **Options**: Next.js, Remix, plain HTML+vanilla JS, Astro.
- **Choice**: Astro with `client:load`/`client:only="react"` for the islands that need hydration.
- **Why**: Zero JS on pages that don't need it (fast LCP, good Core Web Vitals); React is still available where it matters; one build pipeline.

### Build-time embeddings over runtime indexing
- **Constraint**: RAG search needs to be fast (<100ms) without burning compute on every visit.
- **Options**: Index portfolio docs at request time; cache an in-memory index; bake embeddings at build time.
- **Choice**: `scripts/generate-embeddings.ts` runs before `astro build` and writes `public/data/rag/embeddings.json`. The runtime only embeds the user's query.
- **Why**: Embeddings of the portfolio docs are deterministic per build, so there's no reason to recompute them per request. Updates ship with the next deploy.

## Frequently Asked Questions

### Q: How does the local AI chat work?

The chat uses WebLLM, which runs a quantized language model (SmolLM2-1.7B-Instruct) directly in your browser using WebGPU. After the initial model download (~1.7GB, cached for future visits), all inference happens locally. Your questions never leave your device.

### Q: Why do I see "Cloud Mode" instead of "Local Mode"?

Local mode requires WebGPU, which is only available in modern browsers (Chrome 113+, Edge 113+) on devices with compatible GPUs. Mobile devices and older browsers automatically use cloud mode, which sends questions to Claude API for processing.

### Q: How accurate are the AI's answers?

The AI uses RAG (Retrieval-Augmented Generation) to search through my actual project documentation before answering. This grounds responses in real information rather than generating plausible-sounding but potentially incorrect text. If the documentation doesn't contain relevant information, the AI will say so.

### Q: Can the AI answer questions not related to your portfolio?

The AI is specifically designed to answer questions about my background, projects, and experience. It won't engage in general conversation or answer questions outside this scope.

### Q: How is the theme preference saved?

Theme preference is stored in localStorage via Zustand's persist middleware. On first visit, the site respects your system's `prefers-color-scheme` setting.

### Q: What happens if I lose internet connection?

The main portfolio pages are static and may be cached by your browser. The AI chat requires either WebGPU (for local mode) or internet (for cloud mode). If you've previously loaded the WebLLM model, local chat works offline.

### Q: How are project details fetched?

Public projects are fetched from the GitHub API at build time. Private projects and featured projects with rich documentation come from curated JSON files. Portfolio markdown files provide architecture diagrams, tech stack details, and Q&A content.

### Q: Why Astro instead of Next.js?

Astro's island architecture is perfect for a mostly-static portfolio with a few interactive components. It ships zero JavaScript by default, only hydrating components that need interactivity. This results in faster page loads and better Core Web Vitals.

### Q: How do I contact you?

The Contact page has links to my email, GitHub, and LinkedIn. You can also ask the AI chat for contact information!

### Q: Is the source code available?

The portfolio site code demonstrates modern web development practices but the repository is private since it contains personal information and project documentation.
