# Claude Code Guide Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive tabbed blog post that teaches a non-developer how to use Claude Code.

**Architecture:** One React component (`TabbedGuide.tsx`) hydrated as an island in a single MDX blog post. Children mapped to tabs by index. URL hash sync for deep linking.

**Tech Stack:** React 19, Astro MDX, Tailwind CSS, CSS custom properties from existing design system.

---

## Chunk 1: TabbedGuide Component

### Task 1: Create the TabbedGuide React component

**Files:**
- Create: `src/components/blog/TabbedGuide.tsx`

- [ ] **Step 1: Create the component file**

Create `src/components/blog/TabbedGuide.tsx` with:
- `tabs` prop (string array of tab labels)
- `children` prop mapped by index to tabs
- `slugify` helper: lowercase, spaces to hyphens, strip non-alphanumeric (e.g., "Skills & Tools" → "skills-tools")
- `useState` for active tab index, initialized from URL hash on mount
- `useEffect` for `popstate` and `astro:after-swap` listeners
- `history.pushState` on tab click
- Scroll to top of tab content on switch
- Inline styles using CSS variables (`--accent-secondary`, `--border-color`, `--text-muted`, `--bg-primary`, `--font-display`)
- Sticky tab bar with `position: sticky`, `top: 0`, `z-index: 20`
- Mobile: `overflow-x: auto`, `scroll-snap-type: x mandatory` on tab container
- Right-edge gradient fade mask on mobile via CSS mask-image
- All panels in DOM, inactive panels get `display: none`

- [ ] **Step 2: Verify component renders in dev**

Run: `cd /Users/jacobkanfer/Desktop/Code/All-About-Me && npm run dev`
Create a minimal test MDX file or verify with the full content file in Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/components/blog/TabbedGuide.tsx
git commit -m "feat: add TabbedGuide React component for tabbed blog posts"
```

## Chunk 2: Guide Content

### Task 2: Create the MDX blog post with all 5 tabs of content

**Files:**
- Create: `src/content/blog/claude-code-guide.mdx`

- [ ] **Step 1: Create the MDX file with frontmatter and all tab content**

Frontmatter: title, description, pubDate (2026-03-14), tags. Import and use `TabbedGuide` with `client:load`. Five `<div>` children corresponding to the 5 tabs:
1. Getting Started — what Claude Code is, prerequisites, installation, first conversation, prompting tips
2. Your First Project — walkthrough building a website, describing what you want, iterating
3. Skills & Tools — slash commands, skills, MCP servers, CLAUDE.md, permissions
4. Real Examples — website, automation, data, scripts with example prompts
5. Quick Reference — commands cheat sheet, prompting do's/don'ts, common errors, scenario prompts

- [ ] **Step 2: Verify the full post renders in dev**

Run: `cd /Users/jacobkanfer/Desktop/Code/All-About-Me && npm run dev`
Navigate to `/blog/claude-code-guide` and verify:
- All 5 tabs render and switch correctly
- URL hash updates on tab click
- Deep link (e.g., `#skills-tools`) opens correct tab
- Back button navigates between tabs
- Mobile horizontal scroll works
- Light/dark mode both look correct
- Content renders with prose styles

- [ ] **Step 3: Commit**

```bash
git add src/content/blog/claude-code-guide.mdx
git commit -m "feat: add comprehensive Claude Code guide blog post"
```

## Chunk 3: Build Verification

### Task 3: Verify production build

- [ ] **Step 1: Run production build**

Run: `cd /Users/jacobkanfer/Desktop/Code/All-About-Me && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Commit plan**

```bash
git add docs/superpowers/plans/2026-03-14-claude-code-guide.md
git commit -m "docs: add implementation plan for Claude Code guide"
```
