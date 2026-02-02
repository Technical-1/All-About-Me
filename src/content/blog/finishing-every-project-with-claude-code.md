---
title: "My Mission to Finish Every Project I've Ever Started (Using Claude Code)"
description: "After 11 years of programming, I consolidated every unfinished project from every computer into one directory. Now I'm using Claude Code to finally ship them all."
pubDate: 2026-01-15
tags: ["Claude Code", "Productivity", "AI-Assisted Development", "Project Management"]
---

I have a confession: I'm a serial project starter. Over 11 years of programming, I've accumulated hundreds of half-finished ideas scattered across old laptops, external drives, and forgotten GitHub repos. Side projects that excited me for a weekend, prototypes that "just needed a few more features," and ambitious ideas that fizzled out when the initial dopamine wore off.

A few months ago, I decided to do something about it. I went through every folder on every computer I own—my current MacBook, two old Windows laptops, a Linux desktop I hadn't touched in years, and multiple backup drives. I consolidated everything into a single directory and made a commitment: **I will finish every single one of these projects.**

The secret weapon? Claude Code.

## The Great Consolidation

The archaeology was both nostalgic and slightly embarrassing. I found:

- A cryptocurrency trading bot from 2019 (never worked)
- Three separate attempts at building a personal finance app
- A half-implemented chess engine in Rust
- Multiple "hello world" projects in languages I was learning
- A bot for just about every major sales website
- Countless CLI tools that solved problems I no longer remember having

After aggressive pruning (goodbye, tutorial projects), I was left with about 100 projects worth reviving. Some were 90% complete, abandoned because I got stuck on one annoying bug. Others were just README files and grand architectural plans.

## Why Claude Code Changes Everything

I've tried AI coding assistants before. GitHub Copilot is great for autocomplete. ChatGPT can explain concepts. But Claude Code is different—it's an *agent* that can actually work on projects.

The key differences:

1. **It reads your entire codebase.** Not just the file you're working on, but the whole project structure, configs, dependencies, and documentation.

2. **It runs commands.** Tests, builds, linting—Claude Code executes them and iterates based on the results.

3. **It remembers context.** Within a session, it builds understanding of your project's patterns, conventions, and goals.

4. **It's extensible.** Custom skills, plugins, and MCP servers let you teach it new capabilities.

This means I can pick up a project I haven't touched in years, point Claude Code at it, and get meaningful help immediately.

## My Setup: Plugins and Custom Skills

I've built a workflow around Claude Code that maximizes productivity:

### Custom Skills

I use several custom skills that standardize my development process:

- **`superpowers:brainstorming`** - Before any creative work, I explore requirements and design with Claude
- **`superpowers:writing-plans`** - Creates detailed implementation plans with specific file paths and test cases
- **`superpowers:systematic-debugging`** - Structured approach to bugs instead of random changes
- **`frontend-design`** - Generates polished, production-ready UI components that avoid the generic "AI look"—clean interfaces with real design sensibility

These skills aren't just prompts—they're workflows that keep me (and Claude) disciplined.

### E2E Testing with Playwright

Every web project gets Playwright tests. I've found that writing E2E tests early forces clarity about what the project actually *does*. When I tell Claude "add a test for the login flow," it has to understand:

- What pages exist
- What the user journey looks like
- What success and failure states look like

The tests become living documentation. When I return to a project after months, I run the tests and immediately understand what's working and what's broken.

```typescript
test('user can create and complete a todo', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="new-todo"]', 'Buy groceries');
  await page.click('[data-testid="add-todo"]');
  await expect(page.locator('[data-testid="todo-item"]')).toContainText('Buy groceries');
  await page.click('[data-testid="complete-todo"]');
  await expect(page.locator('[data-testid="todo-item"]')).toHaveClass(/completed/);
});
```

## The Three-Document System

Every project I start now begins with three markdown files:

### 1. `architecture.md`

High-level system design. What are the components? How do they interact? What are the boundaries? I include Mermaid diagrams for visual clarity.

```markdown
## System Overview

The application follows a layered architecture:

- **Presentation Layer**: React components, routing, state management
- **Business Logic**: Domain services, validation, transformations
- **Data Layer**: API clients, caching, persistence

## Data Flow

[Mermaid diagram here]

## Key Decisions

- Why we chose X over Y
- Trade-offs we accepted
- Constraints we're working within
```

### 2. `features.md`

What does this thing actually do? User stories, acceptance criteria, edge cases. This document answers "what" without getting into "how."

```markdown
## User Authentication

**As a user, I want to:**
- Sign up with email and password
- Log in to my existing account
- Reset my password if forgotten
- Stay logged in across browser sessions

**Acceptance Criteria:**
- Passwords must be at least 8 characters
- Email verification required before access
- Sessions expire after 30 days of inactivity
```

### 3. `implementation-plan.md`

The actual roadmap. Phases, milestones, specific tasks. This is where I break down the work into Claude-sized chunks.

```markdown
## Phase 1: Foundation (Week 1)

### Task 1.1: Project Setup
- [ ] Initialize Vite + React + TypeScript
- [ ] Configure ESLint and Prettier
- [ ] Set up Tailwind CSS
- [ ] Create basic folder structure

### Task 1.2: Authentication Infrastructure
- [ ] Install and configure Auth.js
- [ ] Create login/signup pages
- [ ] Implement protected routes
```

## The Handwritten Advantage

Here's something I didn't expect: **projects where I wrote documentation by hand before involving Claude go much faster.**

When I sit down and write the architecture document myself—thinking through components, drawing diagrams, making decisions—I build genuine understanding. When I then bring Claude into the project, we're collaborating. I can evaluate its suggestions against my mental model. I can catch when it's going in the wrong direction.

Contrast this with projects that start as vague ideas. "I want to build a budget tracker." Okay, but what kind? What features? What's the data model? When I don't have clear answers, Claude and I end up in cycles of exploration that feel productive but don't ship features.

The best workflow I've found:

1. **Brainstorm solo first.** Spend 30 minutes to an hour writing your three documents by hand. Don't optimize for completeness—optimize for clarity.

2. **Review with Claude.** Share your documents and ask for feedback. Are there gaps? Contradictions? Better approaches?

3. **Execute with Claude.** Now you have a shared understanding and a plan. Implementation becomes much more directed.

For my old projects, this means I often spend more time *reading and documenting* the existing code than writing new code. But that investment pays off dramatically.

## Fresh Ideas vs. Old Projects

The dynamic is different depending on the project's state:

### Reviving Old Projects

These are actually easier in some ways. The code exists. I can read it, run it (sometimes), and understand what past-me was trying to do. The challenge is usually:

- Outdated dependencies
- Missing documentation
- Forgotten context ("why did I do it this way?")

Claude excels here. It can analyze the codebase, infer patterns, and help me pick up where I left off. Often, the "one annoying bug" that made me abandon the project takes 10 minutes to fix with fresh eyes and AI assistance.

### Fresh Ideas

These require much more upfront work. The idea feels clear in my head, but translating it into something buildable takes time. I've learned to resist the urge to "just start coding" and instead:

1. Write the three documents (even rough drafts)
2. Build a prototype manually to validate assumptions
3. *Then* bring in Claude for acceleration

The prototype phase is crucial. Twenty minutes of hacking helps me discover what I don't know. "Oh, this API doesn't work how I expected." "Oh, this UI pattern is awkward." Those discoveries inform much better documentation.

## Current Progress

Of my 101 revival projects:

- **22 completed** - Shipped, deployed, or explicitly marked "good enough"
- **35 in active development** - Regular sessions with Claude
- **26 documented and queued** - Three docs written, waiting for bandwidth
- **18 abandoned (intentionally)** - After honest evaluation, not worth finishing

The "abandoned intentionally" category is important. Not every project deserves completion. Some were learning exercises. Some solved problems that no longer exist. Some were just bad ideas. Giving myself permission to formally close them was liberating.

## What I've Learned

After months of this process:

**AI doesn't replace thinking.** Claude Code is incredibly powerful, but it amplifies your direction. If you don't know where you're going, it can't get you there.

**Documentation is leverage.** Time spent writing clear docs pays back 10x in faster implementation. This is true with or without AI, but especially true with it.

**Finishing is a skill.** Starting projects is easy. The last 20% is hard. Having a systematic approach—and an AI partner that doesn't get bored—helps push through the tedious parts.

**Old code isn't as bad as you remember.** Past-me made different decisions, but usually for reasons. Reading old code with curiosity instead of judgment revealed patterns and ideas worth preserving.

---

*If you're drowning in unfinished projects, I recommend trying this approach. Consolidate, document, and systematically work through the backlog. It's surprisingly satisfying to finally ship something you started years ago.*
