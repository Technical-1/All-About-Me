# Project Q&A

## Overview

**All-About-Me** is my personal portfolio website built with Astro, React, and AI-powered features. It showcases my work experience, projects, skills, and includes an AI chat assistant that can answer questions about my background. The chat runs through the Claude API by default, and on capable desktops it can switch to a model running locally in the browser with WebLLM, so no question leaves the device. The site features a RAG (Retrieval-Augmented Generation) system that provides accurate, grounded answers by searching through my project documentation.

## Problem Solved

Traditional portfolio sites are static and one-directional - visitors read what's written but can't ask follow-up questions. This portfolio solves that by providing an interactive AI assistant that can answer specific questions about my experience, explain project details, and have natural conversations. The local-first approach respects privacy while the RAG system ensures accurate answers grounded in actual documentation rather than hallucinations.

## Target Users

- **Recruiters and hiring managers** researching my background
- **Potential collaborators** learning about my technical skills
- **Fellow developers** interested in my projects or implementation approaches
- **Anyone curious** who prefers asking questions over reading through pages

## Key Features

### AI Chat Assistant
An interactive chat interface that answers questions about my background, projects, and experience. Supports both cloud (Claude) and local (WebLLM) modes. The local option only appears when the device can actually run the model.

### RAG-Powered Responses
Semantic search over pre-computed embeddings ensures the AI provides accurate, grounded answers rather than making things up. Hybrid search combines vector similarity with keyword boosting for better accuracy.

### Project Showcase
Every repo is grouped into domain shelves (AI, Crypto & Fintech, Developer Tools, Automation, and so on). Repos without a preview image fall to a "Work in Progress" shelf so unfinished work never sits next to polished projects. Each project's detail page renders architecture diagrams (zoomable Mermaid), tech stack breakdowns, and Q&A pulled from that project's own `.portfolio/` docs. On mobile, a sticky pill bar filters to All, Featured, or a single shelf, and a tap reveals a card's details instead of navigating away.

### Technical Blog
A blog built on Astro content collections, authored in Markdown and MDX. MDX lets richer posts embed interactive React (for example a tabbed guide). Posts support scheduled publishing: a future-dated post builds its page but stays out of the listing (and is marked `noindex`) until its publish date arrives, which the nightly rebuild surfaces automatically.

### Dark/Light Theme
System-aware theme switching with no flash on load. Persists preference across sessions.

### Responsive Design
Fully responsive layout that works on mobile, tablet, and desktop with appropriate component adaptations.

### Privacy-First Local AI
The WebLLM option runs entirely in the browser - no data is sent to external servers. Perfect for visitors who prefer not to share their questions with cloud services.

## Technical Highlights

### Hybrid AI Architecture
I built a dual-mode chat system that checks for a desktop-width screen and a working WebGPU device before offering local inference. On those devices, the WebLLM model (SmolLM2-1.7B) is preloaded site-wide in the background once the page goes idle, and because the site navigates with View Transitions the loaded engine survives page changes, so it is usually ready before the visitor opens the chat.

### RAG Implementation
Pure semantic search struggled with exact matches like project names. I implemented hybrid search that boosts scores when query terms appear verbatim in content, which fixes questions like "Tell me about the AHSR project." The index is built from heading-aware chunks (`scripts/lib/chunker.ts`), so a retrieved chunk is a coherent section of a doc rather than an arbitrary window of text.

### Theme Synchronization
Coordinating theme state between an inline script (needed to prevent flash), React hydration, and Zustand persistence required careful handling. The solution reads initial state from DOM in the Zustand store initializer, then syncs on mount.

### Streaming Responses
Both local and cloud modes stream responses for a responsive feel. The cloud API relays Claude's text deltas as Server-Sent Events, while WebLLM uses async iteration over the completion stream, with tokens buffered and flushed to the UI every 150 ms so rendering doesn't stutter.

## Engineering Decisions

### Hybrid local + cloud chat over single-mode
- **Constraint**: Want a privacy-first chat experience but not at the cost of users on older devices losing the feature entirely.
- **Options**: Cloud-only (Claude API); local-only (WebLLM, which shuts out phones and any browser without WebGPU); hybrid with feature detection.
- **Choice**: Default to the Claude API for everyone, and offer WebLLM as a local option when the browser can create a WebGPU device on a desktop-width screen. Both paths use the same retrieval logic and streaming UX.
- **Why**: No visitor is locked out, and the people who can run it locally get true privacy. The cloud fallback also covers the warmup gap while the roughly 1 GB WebLLM model downloads on first visit.

### Hybrid semantic + keyword search over pure vector similarity
- **Constraint**: A visitor typing "Tell me about AHSR" should reliably retrieve the AHSR project even when its embedding is closer to a different project's vector.
- **Options**: Pure cosine similarity on MiniLM-L6-v2 embeddings; BM25 keyword search; hybrid scoring.
- **Choice**: Cosine similarity over chunked portfolio docs, with an additive boost (+0.15 for words over four characters, +0.08 otherwise, capped at 1.0) when query terms appear verbatim in the chunk.
- **Why**: Project names are nearly always typed literally, so verbatim hits should dominate ranking even when the embedding doesn't agree.

### Astro islands over a full SPA framework
- **Constraint**: Most of the site is static content (experience, projects, blog) but the chat and project cards need React-level interactivity.
- **Options**: Next.js, Remix, plain HTML+vanilla JS, Astro.
- **Choice**: Astro with `client:load`/`client:only="react"` for the islands that need hydration.
- **Why**: Zero JS on pages that don't need it (fast LCP, good Core Web Vitals); React is still available where it matters; one build pipeline.

### Build-time embeddings over runtime indexing
- **Constraint**: RAG search needs to be fast without burning compute on every visit.
- **Options**: Index portfolio docs at request time; cache an in-memory index; bake embeddings at build time.
- **Choice**: `scripts/generate-embeddings.ts` runs before `astro build` and writes `public/data/rag/embeddings.json`. The runtime only embeds the user's query.
- **Why**: Embeddings of the portfolio docs are deterministic per build, so there's no reason to recompute them per request. Updates ship with the next deploy, and the nightly repo sync guarantees one a day. Draft and future-dated blog posts are left out of the index until they publish. The cost is that local mode has to download the whole index (tens of megabytes of JSON) before its first answer.

## Frequently Asked Questions

### Q: How does the local AI chat work?

The chat uses WebLLM, which runs a 4-bit quantized language model (SmolLM2-1.7B-Instruct) directly in your browser using WebGPU. After the initial model download (about 1 GB, cached for future visits), all inference happens locally, and the search over my docs runs in the browser too. Your questions never leave your device.

### Q: Why do I see "Cloud Mode" instead of "Local Mode"?

Cloud mode is the default for everyone. The Local/Cloud toggle only appears when the window is at least 1024px wide and the browser can create a WebGPU device (for example recent Chrome or Edge on a compatible GPU). Phones, tablets, narrow windows and browsers without WebGPU stay on cloud mode, which sends questions to the Claude API.

### Q: How accurate are the AI's answers?

The AI uses RAG (Retrieval-Augmented Generation) to search through my actual project documentation before answering. This grounds responses in real information rather than generating plausible-sounding but potentially incorrect text. If the documentation doesn't contain relevant information, the AI will say so.

### Q: Can the AI answer questions not related to your portfolio?

Not really. Its instructions scope it to my background, projects, experience and interests, and it only sees context retrieved from my own docs, so it isn't a general-purpose assistant.

### Q: How is the theme preference saved?

Theme preference is stored in localStorage via Zustand's persist middleware. On first visit, the site respects your system's `prefers-color-scheme` setting.

### Q: What happens if I lose internet connection?

The site has no service worker, so it isn't built to work offline. Cloud mode needs a connection for every message. In local mode, once the model, the embedder and the index are loaded, generating an answer doesn't touch the network.

### Q: How are project details fetched?

A nightly GitHub Action snapshots every repo I own (public and private, minus forks and an exclusion list that is partly read from a repository secret, so hidden repo names stay out of this public code) into JSON, and copies each repo's `.portfolio/` docs and preview image into this site. That commit triggers a deploy, which also rebuilds the chat's embeddings, so a project's page and the AI's knowledge of it update the morning after its docs change. In the browser, the projects page also merges in GitHub's public repo listing.

### Q: Why Astro instead of Next.js?

Astro's island architecture is perfect for a mostly-static portfolio with a few interactive components. It ships zero JavaScript by default, only hydrating components that need interactivity. This results in faster page loads and better Core Web Vitals.

### Q: How are projects sorted into shelves?

A small pure function (`shelfFor` in `src/lib/projectSections.ts`) decides each repo's shelf. Academic coursework is an explicit category that always wins; any repo without a preview image is demoted to a "Work in Progress" shelf; everything else lands on its stored domain category. Within a shelf, projects sort featured → active → archived, newest push first. The logic is unit-tested so re-categorizing repos can't silently break placement.

### Q: How does scheduled blog publishing work?

Each post has a `pubDate` in its frontmatter. The listing query filters out any post whose `pubDate` is in the future, but the post's page is still built, so the URL can be shared ahead of time. Until a build runs after its date, the page carries `noindex` and the chat's index leaves it out. Because the site rebuilds nightly, a queued post appears on schedule with no manual deploy. A separate `draft` flag hides a post entirely (no page at all).

### Q: How do I contact you?

The Contact page has a form (delivered through Web3Forms) plus links to my email, GitHub, and LinkedIn. You can also ask the AI chat for contact information.

### Q: Is the source code available?

Yes. The repository is public on GitHub at [github.com/Technical-1/All-About-Me](https://github.com/Technical-1/All-About-Me). It aggregates the `.portfolio/` documentation from across my project repos, so the architecture, stack, and Q&A you read on each project detail page come straight from that project's own docs.
