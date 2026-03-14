# Claude Code Guide — Design Spec

## Overview

A comprehensive, tabbed blog post within the All-About-Me portfolio site that teaches a non-developer how to use Claude Code. The guide serves as a before, during, and after resource for an in-person teaching session.

**Target audience:** Casual tech user — comfortable with apps, not a developer.
**Tone:** Clean and professional, approachable.
**URL:** `/blog/claude-code-guide`

## Architecture

**Approach:** Pure MDX with a React Tab Component.

**Files to create:**

| File | Purpose |
|------|---------|
| `src/components/blog/TabbedGuide.tsx` | React component — horizontal tab switching with sticky bar, URL hash support, mobile scroll |
| `src/content/blog/claude-code-guide.mdx` | The guide content — MDX file using the tab component |

**How it works:** The MDX file imports `TabbedGuide` and wraps each section's content in tab panels. The component uses React state to toggle which panel is visible. Astro hydrates it as a React island via `client:load`. No new pages, layouts, or config changes needed — everything fits within the existing blog system.

**Dependencies:** None new. The project already has `@astrojs/mdx`, `@astrojs/react`, and React 19.

## TabbedGuide Component

### Props

```tsx
interface TabbedGuideProps {
  tabs: string[];        // Tab labels, e.g. ["Getting Started", "Your First Project", ...]
  children: React.ReactNode;  // Tab panels as children with slot attributes
}
```

### Usage in MDX

```jsx
<TabbedGuide client:load tabs={["Getting Started", "Your First Project", "Skills & Tools", "Real Examples", "Quick Reference"]}>
  <div slot="getting-started">
    ...markdown/JSX content...
  </div>
  <div slot="your-first-project">
    ...
  </div>
  <div slot="skills-tools">
    ...
  </div>
  <div slot="real-examples">
    ...
  </div>
  <div slot="quick-reference">
    ...
  </div>
</TabbedGuide>
```

### Behavior

- **Tab switching:** Only one panel visible at a time, toggled by React state.
- **Sticky tab bar:** Tabs stick to the top of the viewport when scrolling through content.
- **URL hash support:** Clicking a tab updates the URL hash (e.g., `#your-first-project`). On page load, if a hash is present, the matching tab opens automatically.
- **Browser history:** Tab changes push to history so back/forward buttons navigate between tabs.
- **SEO:** All tab content renders in the DOM (hidden with CSS `display: none`), so search engines index everything.
- **Astro View Transitions:** Component re-hydrates properly when navigating to/from the post.

### Mobile Behavior

- Tab bar gets `overflow-x: auto` with horizontal scrolling.
- Scroll snap on tab items for clean swipe behavior.
- Subtle gradient fade on the right edge to indicate more tabs are available.

## Styling

Uses existing CSS custom properties from the portfolio — no new variables or colors.

### Tab Bar

- Bottom border: `2px solid var(--border-color)`
- Active tab border: `var(--accent-secondary)` (teal)
- Sticky position with `background-color: var(--bg-primary)` and `z-index` to layer above content

### Tab Text

- Inactive: `color: var(--text-muted)`
- Hover: `color: var(--text-secondary)`
- Active: `color: var(--accent-secondary)`
- Font: `var(--font-display)` (DM Sans), `font-weight: 500`

### Content Area

- Inherits existing `.prose` styles from the blog layout
- Code blocks get the same treatment as other blog posts (surface background, mono font, accent color)
- Spacing consistent with `prose-lg`

## Content Outline

### Tab 1 — Getting Started

- What is Claude Code? Plain English explanation — "an AI that lives in your terminal"
- What can it actually do? Read files, write code, run commands, build things
- Prerequisites: what you need (a computer, Node.js, an Anthropic account)
- Installation: step-by-step with exact terminal commands
- Your first conversation: launching `claude` and asking it something
- How to talk to it: prompting tips for non-developers

### Tab 2 — Your First Project

- Walkthrough: building a simple personal website from scratch with Claude Code
- How to describe what you want in natural language
- Watching Claude Code work — it reads, writes, and runs commands
- Previewing your site locally
- Making changes and iterating ("make the header blue", "add a contact page")

### Tab 3 — Skills & Tools

- What are slash commands? (`/help`, `/commit`, etc.)
- What are skills? Pre-built workflows that make Claude smarter
- What are MCP servers? Plain English — tools that connect Claude to other services
- CLAUDE.md files: teaching Claude about your project
- Permission modes: what they mean and which to use

### Tab 4 — Real Examples

- Build a website or landing page
- Automate file organization on your computer
- Work with spreadsheet data (CSV parsing, formatting)
- Create a simple script (rename photos, clean up downloads folder)
- Each example includes: what to say, what happens, what you get

### Tab 5 — Quick Reference

- Cheat sheet of essential commands
- Prompting tips: do's and don'ts
- Common error messages and what they mean
- "What to say when..." — common scenarios mapped to example prompts
- Links to official docs for deeper dives

## Edge Cases

- **Deep linking:** `/blog/claude-code-guide#real-examples` opens the correct tab on load
- **Browser back/forward:** Tab changes push to history, back button works as expected
- **Mobile scroll:** Tab bar scrolls horizontally with snap and fade hint
- **SEO:** All content in DOM, hidden panels use `display: none`
- **View Transitions:** Component re-hydrates on navigation via Astro View Transitions
- **No JS fallback:** All content is in the DOM, so if JS fails to hydrate, content is still accessible (just all panels visible)

## Out of Scope

- Video or animated content
- Interactive code playgrounds
- User accounts or progress tracking
- Multi-page guide (everything is one post)
- New design system or colors
