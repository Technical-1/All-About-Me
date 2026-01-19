# Portfolio Redesign: Astro + WebLLM + Case Studies

**Date:** 2026-01-18
**Status:** Ready for Implementation
**Author:** Jacob Kanfer

---

## Overview

Complete redesign of jacobkanfer.com from vanilla HTML/CSS/JS to a modern Astro-based portfolio with:
- Retro-futuristic visual design
- Featured project case studies
- In-browser AI chat (WebLLM)
- MDX blog
- Vercel deployment

---

## Goals

| Goal | Metric |
|------|--------|
| Performance | 95+ Lighthouse score |
| Visual refresh | Distinctive, non-generic aesthetic |
| Better project showcase | Case study format with impact/story |
| New features | Blog, AI chat assistant |
| Resume value | Demonstrates Astro, WebLLM, modern stack |

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Astro** | Static-first, fast, React islands for interactivity |
| Styling | **Tailwind CSS** | Utility-first, works great with Astro |
| Blog | **MDX + Content Collections** | Type-safe, component-enabled markdown |
| AI Chat | **WebLLM** | Client-side Llama 3.2, no API costs, privacy |
| Deployment | **Vercel** | Easy Astro integration, global CDN |
| Domain | **jacobkanfer.com** | Migrate from GitHub Pages |

---

## Visual Design System

### Aesthetic Direction

**Primary:** Retro-Futuristic
**Secondary influences:** Dark Editorial, Brutalist/Raw

Terminal-inspired elements, grid overlays, monospace typography, subtle glow effects. Sophisticated and technical without being gimmicky.

### Color Palette

```
Background Layers:
  #0a0a0f   Deep void (base)
  #12121a   Elevated surfaces
  #1a1a24   Cards, modals

Primary Accent:
  #00ffcc   Cyan terminal glow (links, highlights)
  #00cc99   Cyan muted (hover states)

Secondary Accent:
  #ff6b35   Warm orange (CTAs, warnings)
  #ffaa00   Gold (special highlights)

Text:
  #e8e8e8   Primary text
  #888899   Secondary/muted text
  #00ffcc   Code/terminal text
```

### Typography

| Use | Font | Fallback |
|-----|------|----------|
| Display/Headings | Space Mono or JetBrains Mono | monospace |
| Body Text | Satoshi or General Sans | system-ui |
| Code | Fira Code or JetBrains Mono | monospace |

### Visual Elements

- Subtle background grid overlays
- Soft cyan glow on interactive elements
- Sharp corners (brutalist touch)
- Noise/grain texture overlay for depth
- Terminal-style labels and prompts

### Motion

- Smooth page transitions (fade + slight vertical shift)
- Staggered scroll reveal animations
- Subtle hover states (scale + glow)
- Terminal-style loading indicators

---

## Site Architecture

```
src/
├── components/
│   ├── global/           # Navbar, Footer, ThemeToggle
│   ├── home/             # Hero, About, Skills, Certificates
│   ├── projects/         # ProjectCard, ProjectGrid, AskAboutThis
│   ├── experience/       # TimelineCard, RoleDetails
│   ├── chat/             # ChatInterface, MessageBubble, ModelLoader
│   └── blog/             # PostCard, PostList, TableOfContents
├── content/
│   ├── blog/             # MDX posts
│   └── projects/         # Featured project case study data
├── layouts/
│   └── BaseLayout.astro  # Shared HTML shell
├── pages/
│   ├── index.astro       # Home
│   ├── experience.astro
│   ├── projects/
│   │   ├── index.astro   # Projects grid
│   │   └── [slug].astro  # Case study pages
│   ├── resume.astro
│   ├── contact.astro
│   ├── chat.astro        # Dedicated AI chat page
│   └── blog/
│       ├── index.astro   # Blog listing
│       └── [slug].astro  # Post pages
├── styles/
│   └── global.css        # Design tokens, base styles
└── lib/
    ├── github.ts         # Repo fetching logic
    └── webllm.ts         # LLM initialization & context
```

---

## Pages

### Home (`/`)
- Hero with animated typing effect (role descriptions)
- About section with photo
- Skills grid (languages, frameworks, platforms, AI specialties)
- Certificates
- CTA to projects and chat

### Experience (`/experience`)
- Professional timeline (Deloitte, WWT)
- Leadership roles
- Tech stack tags per role

### Projects (`/projects`)
- **Hero spotlight** — rotating/featured project, full-width
- **Featured grid** — 5 case study projects with thumbnails
- **Other work** — collapsible GitHub repos grid (existing functionality)
- Each featured project links to dedicated case study page

### Project Case Study (`/projects/[slug]`)
- Hero screenshot/video
- Problem → Role → Solution → Impact
- Technical highlights with architecture notes
- Contextual "Ask AI about this" widget
- Link to live demo and source (if public)

### Resume (`/resume`)
- Embedded PDF viewer
- Download button

### Contact (`/contact`)
- Contact form (keep Web3Forms or migrate)
- Social links

### Chat (`/chat`)
- Terminal-styled dedicated chat interface
- Model loading experience with progress
- Suggested questions
- Full conversation history

### Blog (`/blog`)
- Filterable post grid (technical, project-log, thoughts)
- Post cards with title, date, category, read time

### Blog Post (`/blog/[slug]`)
- Full MDX rendering
- Table of contents
- Related projects links
- Code syntax highlighting

---

## Featured Projects (Case Studies)

| Project | Live Demo | Showcase Angle |
|---------|-----------|----------------|
| Private Collab Whiteboard | private-collab-whiteboard.vercel.app | Real-time P2P, E2E encryption, CRDTs |
| BTC Explorer | btcexplorer.io | Data viz, 3D, live blockchain |
| Git-Archiver-Web | technical-1.github.io/Git-Archiver-Web | Serverless, Cloudflare Workers |
| quickforge | CLI tool | Developer tooling, modern Python |
| Easy-Time-Blocking | technical-1.github.io/Easy-Time-Blocking | Offline PWA, privacy-first |

### Case Study Template

Each case study page follows this structure:

1. **Hero** — Full-width screenshot or video
2. **Problem** — What gap or pain point does this solve?
3. **Role** — Solo dev? Team? What did you specifically do?
4. **Solution** — Technical approach, key decisions
5. **Technical Highlights** — Stack badges, architecture diagram, code snippets
6. **Impact** — Users, metrics, lessons learned
7. **Ask AI** — Contextual chat widget for questions

---

## WebLLM Chat Integration

### Technical Approach

```typescript
// lib/webllm.ts
import { CreateMLCEngine } from "@anthropic-ai/mlc-llm-web";

// Model: Llama-3.2-3B-Instruct (~1.8GB)
// - Small enough for browser download
// - Good instruction following
// - Cached after first load
```

### Context Injection

The LLM is given context about:
- All 5 featured projects (descriptions, tech stack, key features)
- Resume/experience data
- Blog post summaries
- Skills and certifications

### User Experience

1. **Dedicated page** (`/chat`) — Full terminal-style interface
2. **Contextual widgets** — "Ask about this" on project case study pages
3. **Loading state** — Progress bar, explanation of local AI, skip option
4. **Graceful degradation** — Fallback for no WebGPU support

### Fallbacks

| Scenario | Behavior |
|----------|----------|
| No WebGPU | Hide chat features, show message |
| Slow connection | Estimated time, skip option |
| Load failure | Static FAQ or contact form |

---

## Blog

### Content Types

| Category | Description | Example |
|----------|-------------|---------|
| `technical` | Deep dives, tutorials, how-I-built-X | WebLLM integration post |
| `project-log` | Updates, new features, progress | quickforge v2 release |
| `thoughts` | Industry takes, career reflections | Why I chose Astro |

### Frontmatter Schema

```yaml
---
title: "Post Title"
description: "Brief description for SEO and cards"
pubDate: 2026-01-15
category: "technical"
tags: ["webllm", "ai", "astro"]
readTime: 8
relatedProjects: ["private-collab-whiteboard"]
draft: false
---
```

### Content Collections Config

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    category: z.enum(['technical', 'project-log', 'thoughts']),
    tags: z.array(z.string()),
    readTime: z.number(),
    relatedProjects: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

---

## Launch Content

### Required Blog Post: "How I Built a Local LLM Into My Portfolio"

This post should be written during or after implementation. Outline:

```markdown
# How I Built a Local LLM Into My Portfolio

## The Problem
- Wanted visitors to ask questions about my projects
- Didn't want to maintain a static FAQ
- Didn't want API costs or server infrastructure

## Why WebLLM?
- Runs entirely in browser via WebGPU
- No data leaves the user's device
- Model cached after first download
- Works offline

## Technical Implementation
- Model selection (Llama-3.2-3B-Instruct)
- Context injection strategy
- Astro React island for the chat component
- Loading UX and progress indication

## Challenges & Solutions
- Model size vs quality tradeoff
- WebGPU browser support
- Context window limitations
- Graceful degradation

## Results
- [Performance metrics]
- [User feedback if any]
- [Lessons learned]

## Code Walkthrough
- Key snippets from lib/webllm.ts
- React component structure
- System prompt design
```

**This post serves double duty:**
1. Great content for the blog
2. Explains the unique feature to visitors
3. Demonstrates technical writing ability

---

## Migration Checklist

### From Current Site
- [ ] Migrate headshot.jpg (optimize/compress)
- [ ] Migrate Kanfer_Resume.pdf
- [ ] Migrate jk-logo.svg
- [ ] Port GitHub repo fetching logic
- [ ] Port private repos JSON sync (GitHub Action)
- [ ] Preserve dark mode preference logic

### New Setup
- [ ] Initialize Astro project
- [ ] Configure Tailwind with design tokens
- [ ] Set up content collections (blog, projects)
- [ ] Build base layout with navbar/footer
- [ ] Implement all pages
- [ ] Integrate WebLLM
- [ ] Deploy to Vercel
- [ ] Migrate domain from GitHub Pages
- [ ] Set up Vercel Analytics (optional)

---

## Deployment

### Vercel Setup
1. Connect GitHub repo to Vercel
2. Framework preset: Astro
3. Build command: `npm run build`
4. Output directory: `dist`

### Domain Migration
1. Add `jacobkanfer.com` to Vercel project
2. Update DNS records per Vercel instructions
3. Remove CNAME file from old repo
4. Verify SSL certificate

### GitHub Action (Private Repos Sync)
Keep existing workflow, update to commit to new repo structure:
- Output path: `src/data/private_repos.json`
- No other changes needed

---

## Future Enhancements (Post-Launch)

- [ ] RSS feed for blog
- [ ] Open Graph images auto-generation
- [ ] Reading progress indicator on blog posts
- [ ] "Copy link" for blog headings
- [ ] Search across blog posts
- [ ] Newsletter signup (if desired)
- [ ] View transitions API for page navigation

---

## Summary

This redesign transforms a solid vanilla portfolio into a modern, distinctive site that:

1. **Looks memorable** — Retro-futuristic aesthetic stands out from generic portfolios
2. **Tells stories** — Case studies show impact, not just tech stacks
3. **Demonstrates skills** — Astro, WebLLM, modern tooling visible in the site itself
4. **Engages visitors** — AI chat lets people explore your work conversationally
5. **Supports growth** — Blog for sharing knowledge, easy to maintain

Ready for implementation.
