# Comprehensive Site Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all high, medium, and low priority issues identified in the comprehensive site audit across accessibility, security, performance, and visual consistency.

**Architecture:** This plan is organized into 6 phases, ordered by priority. Each phase can be completed independently and committed separately. Tasks within each phase follow TDD principles where applicable.

**Tech Stack:** Astro 5, React 19, TypeScript, Tailwind CSS, Node.js API routes

**Exclusions (per owner's request):**
- RAG thresholds - carefully tuned, do not modify
- Portfolio documentation - owner generates these manually
- Personal content markdown files - redundancy is intentional for LLM embeddings
- GitHub username - hardcoded to owner's account, not configurable

---

## Phase 1: Critical Accessibility Fixes

### Task 1.1: Add Focus Indicators to Global CSS

**Files:**
- Modify: `src/styles/global.css:170-208` (after button styles)

**Step 1: Add focus-visible styles for interactive elements**

Add after line 208 (after `.btn-ghost:hover`):

```css
/* Focus indicators for accessibility */
.btn:focus-visible,
button:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

.btn-secondary:focus-visible {
  outline-color: var(--accent-secondary);
}

a:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  border-radius: 2px;
}

input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent-secondary);
  outline-offset: 0;
  border-color: var(--accent-secondary);
}

/* Remove default focus outline since we're using focus-visible */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Step 2: Verify changes**

Run: `npm run dev`
Expected: Navigate site with Tab key, see clear focus rings on all interactive elements.

**Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(a11y): add focus-visible indicators for keyboard navigation"
```

---

### Task 1.2: Add Skip Navigation Link

**Files:**
- Modify: `src/layouts/BaseLayout.astro:98-103`

**Step 1: Add skip link and main id**

Replace lines 98-103:

```astro
</head>
<body>
  <!-- Skip to main content link for keyboard users -->
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:font-medium"
    style="background-color: var(--accent-primary); color: white;"
  >
    Skip to main content
  </a>

  <Navbar />

  <main id="main-content">
    <slot />
  </main>
```

**Step 2: Add sr-only utility if not present**

Check `src/styles/global.css` for sr-only class. If missing, add to `@layer utilities`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

**Step 3: Verify**

Run: `npm run dev`
Expected: Press Tab on page load, see "Skip to main content" link appear.

**Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro src/styles/global.css
git commit -m "feat(a11y): add skip navigation link for keyboard users"
```

---

### Task 1.3: Add Prefers-Reduced-Motion Support

**Files:**
- Modify: `src/styles/global.css:50-53` (scroll-behavior)
- Modify: `src/styles/global.css:344-384` (animations)

**Step 1: Wrap smooth scroll in media query**

Replace lines 50-53:

```css
@layer base {
  @media (prefers-reduced-motion: no-preference) {
    html {
      scroll-behavior: smooth;
    }
  }
```

**Step 2: Add reduced motion override at end of file**

Add after line 431 (end of file):

```css
/* Respect user's motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Step 3: Verify**

Run: `npm run dev`
Test in Chrome DevTools: Rendering > Emulate CSS media feature prefers-reduced-motion
Expected: Animations disabled when reduced motion is enabled.

**Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(a11y): respect prefers-reduced-motion for animations"
```

---

### Task 1.4: Fix Color Contrast Issues

**Files:**
- Modify: `src/styles/global.css:6-47` (CSS variables)

**Step 1: Update light mode muted text color**

Change line 13 from `--text-muted: #9CA3AF;` to:

```css
--text-muted: #5C6370;
```

**Step 2: Update dark mode muted text color**

Change line 37 from `--text-muted: #6B7280;` to:

```css
--text-muted: #A0A8B4;
```

**Step 3: Verify contrast ratios**

Use Chrome DevTools or WebAIM Contrast Checker:
- Light: #5C6370 on #FAF8F5 should be ~5.5:1 ✓
- Dark: #A0A8B4 on #0A0A0C should be ~6.5:1 ✓

**Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "fix(a11y): improve text contrast ratios for WCAG AA compliance"
```

---

### Task 1.5: Add ARIA Labels to Chat Interface

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx:357-404`

**Step 1: Add aria-live region for messages**

Replace the messages container (around line 357):

```tsx
{/* Messages */}
<div
  className="flex-1 overflow-y-auto p-4 space-y-4"
  role="log"
  aria-label="Chat messages"
  aria-live="polite"
  aria-relevant="additions"
>
```

**Step 2: Add roles to individual messages**

Replace the message div (around line 359-368):

```tsx
{messages.map((message, index) => (
  <div
    key={index}
    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    role="article"
    aria-label={message.role === 'user' ? 'Your message' : 'Assistant response'}
  >
    <div
      className={message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
    >
      <p className="whitespace-pre-wrap">{message.content}</p>
    </div>
  </div>
))}
```

**Step 3: Add label to input field**

Replace the input (around line 389-396):

```tsx
<input
  type="text"
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder="Ask about Jacob's experience, projects, skills..."
  aria-label="Type your message to chat with Jacob's AI assistant"
  className="flex-1 px-4 py-3 bg-surface border border-border rounded-lg text-primary placeholder-muted focus:outline-none focus:border-cyan/50 transition-colors font-code text-sm"
  disabled={isLoading}
/>
```

**Step 4: Add status for loading indicator**

Replace loading indicator (around line 371-381):

```tsx
{isLoading && (
  <div className="flex justify-start" role="status" aria-label="Assistant is typing">
    <div className="chat-bubble-ai">
      <div className="flex items-center gap-2">
        <span className="sr-only">Loading response...</span>
        <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" aria-hidden="true" />
        <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} aria-hidden="true" />
        <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} aria-hidden="true" />
      </div>
    </div>
  </div>
)}
```

**Step 5: Verify with screen reader**

Run: `npm run dev`
Test with VoiceOver (Mac) or NVDA (Windows).
Expected: Messages announced as they appear, input has clear label.

**Step 6: Commit**

```bash
git add src/components/chat/ChatInterface.tsx
git commit -m "feat(a11y): add ARIA labels and live regions to chat interface"
```

---

## Phase 2: Security Fixes

### Task 2.1: Remove Error Details from API Response

**Files:**
- Modify: `src/pages/api/chat.ts:135-162`

**Step 1: Create production-safe error responses**

Replace the entire catch block (lines 135-162):

```typescript
} catch (error) {
  console.error('Chat API error:', error);

  // Handle specific Anthropic API errors
  if (error instanceof Anthropic.APIError) {
    // Log full error server-side for debugging
    console.error('Anthropic API error details:', {
      status: error.status,
      message: error.message,
    });

    // Return generic message to client (don't leak internal details)
    const statusCode = error.status || 500;
    const clientMessage = statusCode === 429
      ? 'Too many requests. Please wait a moment and try again.'
      : statusCode === 401
        ? 'Service temporarily unavailable.'
        : 'Unable to process your request. Please try again.';

    return new Response(
      JSON.stringify({ error: clientMessage }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Handle general errors - never expose internal details
  return new Response(
    JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

**Step 2: Verify error handling**

Test by temporarily setting an invalid API key.
Expected: Client sees generic error, server logs show full details.

**Step 3: Commit**

```bash
git add src/pages/api/chat.ts
git commit -m "fix(security): remove internal error details from API responses"
```

---

### Task 2.2: Add Input Validation to Chat API

**Files:**
- Modify: `src/pages/api/chat.ts:44-58`

**Step 1: Add validation constants at top of file**

Add after line 42 (after ChatRequest interface):

```typescript
// Validation limits
const MAX_MESSAGE_LENGTH = 4000; // ~1000 tokens
const MAX_MESSAGES_COUNT = 20;   // Reasonable conversation length
const MAX_TOTAL_CHARS = 32000;   // Prevent massive context
```

**Step 2: Add comprehensive validation**

Replace the validation block (lines 49-58):

```typescript
// Validate request structure
if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
  return new Response(
    JSON.stringify({ error: 'Invalid request: messages array is required' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}

// Validate message count
if (body.messages.length > MAX_MESSAGES_COUNT) {
  return new Response(
    JSON.stringify({ error: `Conversation too long. Maximum ${MAX_MESSAGES_COUNT} messages allowed.` }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}

// Validate individual messages and total length
let totalChars = 0;
for (const msg of body.messages) {
  // Check message structure
  if (!msg.content || typeof msg.content !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Invalid message format' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check message length
  if (msg.content.length > MAX_MESSAGE_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters per message.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check role is valid
  if (msg.role !== 'user' && msg.role !== 'assistant') {
    return new Response(
      JSON.stringify({ error: 'Invalid message role' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  totalChars += msg.content.length;
}

// Check total conversation length
if (totalChars > MAX_TOTAL_CHARS) {
  return new Response(
    JSON.stringify({ error: 'Conversation too long. Please start a new chat.' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}
```

**Step 3: Test validation**

Use curl or Postman to send:
- Empty messages array → 400
- 25 messages → 400
- Single 5000-char message → 400
- Valid request → 200

**Step 4: Commit**

```bash
git add src/pages/api/chat.ts
git commit -m "feat(security): add input validation and limits to chat API"
```

---

### Task 2.3: Add Basic Rate Limiting

**Files:**
- Modify: `src/pages/api/chat.ts`

**Step 1: Add simple in-memory rate limiter**

Add after imports (around line 4):

```typescript
// Simple in-memory rate limiting
// Note: This resets on server restart. For production, use Redis or similar.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute per IP

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 1000);
```

**Step 2: Apply rate limit check at start of handler**

Add at the beginning of the POST handler (after line 44):

```typescript
export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Rate limiting
  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a minute and try again.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  try {
    // ... existing code
```

**Step 3: Add rate limit headers to successful responses**

Add to the success response headers (around line 131):

```typescript
return new Response(
  JSON.stringify({
    message: {
      role: 'assistant',
      content: assistantMessage.text,
    },
  }),
  {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    }
  }
);
```

**Step 4: Test rate limiting**

Send 21 rapid requests.
Expected: First 20 succeed, 21st returns 429.

**Step 5: Commit**

```bash
git add src/pages/api/chat.ts
git commit -m "feat(security): add basic rate limiting to chat API"
```

---

## Phase 3: Content Fixes

### Task 3.1: Fix Blog "Coming Soon" Message

**Files:**
- Modify: `src/pages/blog/index.astro:14-32`

**Step 1: Verify posts exist**

```bash
ls -la src/content/blog/
```

**Step 2: Update the empty state message to be accurate**

Replace lines 14-32:

```astro
{posts.length === 0 ? (
  <div class="card">
    <div class="py-16 text-center">
      <div
        class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style="background-color: rgba(74, 155, 155, 0.2);"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-secondary);">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </div>
      <h2 class="text-xl font-display font-bold mb-3" style="color: var(--text-heading);">No Posts Yet</h2>
      <p class="max-w-md mx-auto" style="color: var(--text-muted);">
        Blog posts are in the works. In the meantime, check out the <a href="/projects" class="underline">Projects</a> page
        or <a href="/chat" class="underline">chat with the AI assistant</a> to learn more about my work.
      </p>
    </div>
  </div>
) : (
```

**Step 3: Debug if posts aren't loading**

If posts exist but aren't showing, check `src/content.config.ts` for proper collection setup.

**Step 4: Commit**

```bash
git add src/pages/blog/index.astro
git commit -m "fix(content): update blog empty state message to be accurate"
```

---

## Phase 4: Performance Improvements

### Task 4.1: Fix GitHub API N+1 Problem

**Files:**
- Modify: `src/lib/github.ts:65-108`

**Step 1: Simplify to use primary language only (eliminate N+1 calls)**

Replace `fetchPublicRepos` function:

```typescript
export async function fetchPublicRepos(): Promise<GitHubRepo[]> {
  const response = await fetch(
    'https://api.github.com/users/Technical-1/repos?per_page=100&sort=pushed'
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 403) {
      console.warn('GitHub API rate limited. Using cached data or returning empty.');
      return [];
    }
    throw new Error(`GitHub API error: ${status}`);
  }

  const repos = await response.json();

  // Map repos without making individual language requests
  // The primary_language from the API is sufficient for display
  const mappedRepos: GitHubRepo[] = repos
    .filter((repo: any) => !repo.fork && !repo.archived)
    .map((repo: any) => ({
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      homepage: repo.homepage,
      description: repo.description,
      private: repo.private,
      fork: repo.fork,
      archived: repo.archived,
      pushed_at: repo.pushed_at,
      languages: repo.language ? [repo.language] : [], // Use primary language only
      primary_language: repo.language,
    }));

  return mappedRepos;
}
```

**Step 2: Commit**

```bash
git add src/lib/github.ts
git commit -m "perf: eliminate N+1 GitHub API calls for language data"
```

---

### Task 4.2: Add Scrollbar Gutter Stability

**Files:**
- Modify: `src/styles/global.css:50-53`

**Step 1: Add scrollbar-gutter to html**

```css
@layer base {
  html {
    scrollbar-gutter: stable;
  }

  @media (prefers-reduced-motion: no-preference) {
    html {
      scroll-behavior: smooth;
    }
  }
```

**Step 2: Commit**

```bash
git add src/styles/global.css
git commit -m "fix: prevent layout shift from scrollbar appearance"
```

---

## Phase 5: Visual Consistency Fixes

### Task 5.1: Standardize Border Radius

**Files:**
- Modify: `tailwind.config.mjs:106-113`

**Step 1: Add consistent border radius scale**

Add to the extend section:

```javascript
borderRadius: {
  'none': '0',
  'sm': '0.375rem',   // 6px - small elements
  'DEFAULT': '0.5rem', // 8px - buttons, inputs
  'md': '0.75rem',    // 12px - cards
  'lg': '1rem',       // 16px - large cards
  'xl': '1.5rem',     // 24px - modals, featured
  'full': '9999px',   // pills
},
```

**Step 2: Commit**

```bash
git add tailwind.config.mjs
git commit -m "style: standardize border radius scale across components"
```

---

### Task 5.2: Make Mermaid Diagrams Theme-Aware

**Files:**
- Modify: `src/styles/global.css:386-431`

**Step 1: Use CSS variables in Mermaid overrides**

Replace the entire `.mermaid` block:

```css
/* Mermaid Diagram Overrides - theme-aware */
.mermaid {
  /* Node backgrounds */
  .node rect,
  .node polygon,
  .node circle,
  .node ellipse {
    fill: var(--bg-card) !important;
    stroke: var(--accent-secondary) !important;
  }

  /* Node labels */
  .node .label,
  .nodeLabel,
  .node text,
  .label text,
  text.nodeLabel,
  span.nodeLabel {
    fill: var(--text-primary) !important;
    color: var(--text-primary) !important;
  }

  /* Subgraph/cluster backgrounds */
  .cluster rect {
    fill: var(--bg-surface) !important;
    stroke: var(--accent-primary) !important;
  }

  /* Cluster labels */
  .cluster text,
  .cluster-label text {
    fill: var(--text-heading) !important;
  }

  /* Edge labels */
  .edgeLabel {
    background-color: var(--bg-primary) !important;
    color: var(--text-primary) !important;
  }

  /* Edge label text */
  .edgeLabel text {
    fill: var(--text-primary) !important;
  }

  /* Flowchart links */
  .flowchart-link {
    stroke: var(--text-muted) !important;
  }

  /* Arrow markers */
  marker path {
    fill: var(--text-muted) !important;
    stroke: var(--text-muted) !important;
  }
}
```

**Step 2: Verify in both themes**

Run: `npm run dev`
Toggle between light and dark mode.
Expected: Diagrams readable in both themes.

**Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "fix: make Mermaid diagrams respect theme colors"
```

---

## Phase 6: Minor UX Fixes

### Task 6.1: Add Proper GitHub API Types

**Files:**
- Modify: `src/lib/github.ts:59-108`

**Step 1: Add GitHub API response interface**

Add after line 59 (after PrivateRepoEntry interface):

```typescript
// GitHub API response types (subset of fields we use)
interface GitHubAPIRepo {
  name: string;
  full_name: string;
  html_url: string;
  homepage: string | null;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  language: string | null;
  languages_url: string;
}
```

**Step 2: Update fetchPublicRepos to use typed response**

```typescript
export async function fetchPublicRepos(): Promise<GitHubRepo[]> {
  const response = await fetch(
    'https://api.github.com/users/Technical-1/repos?per_page=100&sort=pushed'
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 403) {
      console.warn('GitHub API rate limited. Using cached data or returning empty.');
      return [];
    }
    throw new Error(`GitHub API error: ${status}`);
  }

  const repos: GitHubAPIRepo[] = await response.json();

  const mappedRepos: GitHubRepo[] = repos
    .filter((repo) => !repo.fork && !repo.archived)
    .map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      homepage: repo.homepage,
      description: repo.description,
      private: repo.private,
      fork: repo.fork,
      archived: repo.archived,
      pushed_at: repo.pushed_at,
      languages: repo.language ? [repo.language] : [],
      primary_language: repo.language,
    }));

  return mappedRepos;
}
```

**Step 3: Commit**

```bash
git add src/lib/github.ts
git commit -m "refactor: add proper TypeScript types for GitHub API responses"
```

---

### Task 6.2: Add Link Underlines for Accessibility

**Files:**
- Modify: `src/styles/global.css:113-120`

**Step 1: Add underline to links**

Update the `a` styles:

```css
a {
  color: var(--accent-primary);
  transition: color 0.2s ease, text-decoration-color 0.2s ease;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
}

a:hover {
  color: var(--accent-primary-light);
  text-decoration-color: currentColor;
}

/* Remove underline from nav links and buttons */
nav a,
.btn,
.card a {
  text-decoration: none;
}
```

**Step 2: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(a11y): add visible underlines to text links"
```

---

### Task 6.3: Fix Mobile Hero Text Sizing

**Files:**
- Modify: `src/styles/global.css:101-103`

**Step 1: Add smaller breakpoint for h1**

Replace the h1 styles:

```css
h1 {
  @apply text-3xl sm:text-4xl md:text-5xl lg:text-6xl;
}
```

**Step 2: Commit**

```bash
git add src/styles/global.css
git commit -m "fix: prevent hero text overflow on small mobile screens"
```

---

## Summary Checklist

### Phase 1: Critical Accessibility (5 tasks)
- [ ] Task 1.1: Focus indicators
- [ ] Task 1.2: Skip navigation link
- [ ] Task 1.3: Prefers-reduced-motion support
- [ ] Task 1.4: Fix color contrast
- [ ] Task 1.5: Chat ARIA labels

### Phase 2: Security (3 tasks)
- [ ] Task 2.1: Remove error details from API
- [ ] Task 2.2: Add input validation
- [ ] Task 2.3: Add rate limiting

### Phase 3: Content (1 task)
- [ ] Task 3.1: Fix blog empty state

### Phase 4: Performance (2 tasks)
- [ ] Task 4.1: Fix GitHub N+1 problem
- [ ] Task 4.2: Add scrollbar-gutter

### Phase 5: Visual Consistency (2 tasks)
- [ ] Task 5.1: Standardize border radius
- [ ] Task 5.2: Theme-aware Mermaid

### Phase 6: Minor UX (3 tasks)
- [ ] Task 6.1: GitHub API types
- [ ] Task 6.2: Link underlines
- [ ] Task 6.3: Mobile hero text

**Total: 16 tasks across 6 phases**

---

## Execution Notes

- Each phase can be completed and committed independently
- Phases 1 and 2 are highest priority and should be done first
- Run `npm run dev` and verify changes after each task
- Run `npm run build` after completing all phases to ensure no build errors
