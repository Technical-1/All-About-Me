# Project Domain Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group the projects page's 116 repos into ~10 browsable domain shelves (hybrid domain + featured/archived status), driven by a durable, doc-derived category map.

**Architecture:** A single source-of-truth category map (`scripts/repo-categories.js`) stamps `metadata.category` onto each repo — both in the nightly sync and via a one-off apply script, so categories survive regeneration and render without the private token. Pure grouping/sort logic lives in `src/lib/projectSections.ts` (unit-tested). A new `ProjectShelves` React island renders the shelves plus a temporary toggle bar (nav × density × shelf-style) for choosing the final layout.

**Tech Stack:** Astro 5, React 19, TypeScript, Tailwind 3, vitest (new, for the logic tests).

---

## File Structure

- `scripts/repo-categories.js` — **new.** Single source of truth: `REPO_CATEGORIES` (name→slug map) + `categoryFor(name)`. Imported by the sync script and the apply script.
- `scripts/apply-categories.js` — **new.** One-off: stamps `metadata.category` into the existing `public/data/private_repos.json` + `featured_repos.json` so the prototype renders without re-running the token-gated sync.
- `scripts/fetch_private_repos.js` — **modify.** Import `categoryFor`; stamp `metadata.category` in `processRepo()`.
- `src/lib/github.ts` — **modify.** Replace the stub `category` enum with the ~10 domain slugs; update `categoryLabels`/`categoryIcons`; add `getShelfRepos()` (like `getAllRepos` but keeps featured in).
- `src/lib/projectSections.ts` — **new.** Pure logic: `CategorySlug`, `SECTION_ORDER`, `SECTION_LABELS`, `sortWithinShelf()`, `groupReposByCategory()`. Unit-tested.
- `src/lib/projectSections.test.ts` — **new.** vitest unit tests for the pure logic.
- `src/components/projects/CompactRepoCard.tsx` — **modify.** ★ badge when featured; dim when archived.
- `src/components/projects/ProjectShelves.tsx` — **new.** Fetches shelf repos, groups them, renders shelves + the temporary toggle bar.
- `src/pages/projects/index.astro` — **modify.** Replace the flat `GitHubReposWall` "All Repositories" section with `<ProjectShelves client:load />`. Hero/Featured band unchanged.
- `vitest.config.ts` — **new.** Minimal vitest config.

---

## Task 0: Add vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`
Expected: `vitest` added under devDependencies; exits 0.

- [ ] **Step 2: Add a test script to package.json**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `npm test`
Expected: vitest runs, reports "No test files found" (exit 0 or "no tests" — acceptable). Confirms the runner is wired.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "Add vitest for unit testing project section logic"
```

---

## Task 1: Produce the category mapping (doc-read fan-out + review gate)

**Files:**
- Create: `scripts/repo-categories.js`

This task produces the durable `name → domain` map by reading every repo's portfolio
docs. It is **gated**: the full mapping is presented to Jacob for approval before any
wiring (Tasks 2+) proceeds.

**Categorization rubric** — assign each of the 116 repos in `public/data/private_repos.json`
to exactly one slug. Read `public/data/portfolio/<repo>/{architecture,stack,qa}.md` where
present (91 repos); for the ~25 without docs, judge from the repo's `description` +
`languages` + (if needed) the repo itself. Slugs and their meaning:

| Slug | Shelf | Goes here when… |
|---|---|---|
| `ai-ml` | AI & ML | LLM/agents/ML/NLP/embeddings is the core (Orbit, MultiAgent, Resume-Local-LLM, Kendra-who, serverless-document-pipeline, CAP4770) |
| `crypto-fintech` | Crypto & Fintech | crypto, blockchain, tax-lots, budgeting, payments (BTC/ETH-Explorer, coinbasis/coinlytics/cryptolytics, Crypto-Price-Tracker, Personal-Budget-Tool, Claude-Tax-Toolkit) |
| `dev-tools` | Developer Tools & Infra | tools for developers / infra / CI / repos (Git-Archiver family, RepoLens, Project-Hub, Local-Hoster, pythonforge, homebrew-tap, Redis-Upstasher, Rust-Dashboard) |
| `automation` | Automation & Scraping | bots, scrapers, scheduled automation (EbayViews, redfin-scraper, Kanfer-D-Toolkit, Shopify-ATC, DailySMS, WebCrawler, Puppeteer-*) |
| `mobile` | iOS & Mobile | native iOS or React Native apps (PixScan, SnapDragon, Emailer, SmoothQueue, Flux, MasterCode, GimmeThat, Ascii-React-Native) |
| `creative` | Creative & Generative | generative art / visual toys (Differential-Growth, Pluribus, Signature-Studio, the ASCII family, NeoMatrix) |
| `games` | Games & Puzzles | games and puzzle apps (Blackjack-Trainer, Simple-Backgammon, Supernatural-Speed-Racer, Themed-Crossword-Gen, Snorlax-Tracker) |
| `security` | Security & Privacy | security, privacy, encryption, auth (QuickPass v1/v2, RepoGuard, EmailAnalyzer, email-archive-parser, Private-Collab-Whiteboard) |
| `client-sites` | Client & Commercial Sites | sites built for a client/business (Carmen, CSNY, E350-Transportation, emissary-risk-ops, restauranthub, FISH-THEME, Terra-Moda-Rewrite) |
| `web-utilities` | Web Apps & Utilities | consumer/productivity web apps not covered above (Easy-Time-Blocking, Limitimer-Pro, Kid-Talk-Translator) |
| `other` | Other | genuinely doesn't fit (last resort; flag these in the review) |

**Multi-fit tie-breakers:** classify by the repo's *primary purpose*, not its tech.
`EmailAnalyzer` → `security` (privacy is the pitch), `SmoothQueue` → `mobile` (it's a
native iOS app, even though it uses AI), `FISH-THEME`/`Terra-Moda` → `client-sites` (built
for a business, even though e-commerce). If a repo plausibly straddles two, note the
runner-up in the evidence column so the review can override.

- [ ] **Step 1: Read the docs and build the draft mapping**

Categorize all 116 repos per the rubric. For 116 repos this is best run as a fan-out of
parallel sub-agents over slices of the repo list (each returns `{name, slug, evidence}`),
then reconciled here into one consistent table. Produce a review table sorted by slug:

```
| repo | slug | evidence (one line; note runner-up if it straddles) |
```

- [ ] **Step 2: Present the full mapping to Jacob and get approval**

Post the complete table. **Do not proceed to Step 3 until Jacob approves or edits it.**
Apply any corrections he gives.

- [ ] **Step 3: Write the approved map to `scripts/repo-categories.js`**

Create `scripts/repo-categories.js` (ESM, matches the repo's `"type": "module"`). Fill
`REPO_CATEGORIES` with every repo from the approved table:

```js
// Single source of truth for repo → domain shelf assignment.
// Doc-derived and explicit. Imported by fetch_private_repos.js (nightly, durable)
// and apply-categories.js (one-off stamp of the existing JSON).
// A repo missing from this map falls to 'other'.

export const REPO_CATEGORIES = {
  // 'Repo-Name': 'slug',
  'Orbit': 'ai-ml',
  'BTC-Explorer': 'crypto-fintech',
  // …all 116 repos from the approved table…
};

export function categoryFor(name) {
  return REPO_CATEGORIES[name] || 'other';
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/repo-categories.js
git commit -m "Add doc-derived repo category map"
```

---

## Task 2: Wire categories into the data layer

**Files:**
- Modify: `scripts/fetch_private_repos.js`
- Create: `scripts/apply-categories.js`

- [ ] **Step 1: Import `categoryFor` in the sync script**

At the top of `scripts/fetch_private_repos.js`, after the existing imports (around line 22):

```js
import { categoryFor } from './repo-categories.js';
```

- [ ] **Step 2: Stamp `metadata.category` in `processRepo()`**

In `scripts/fetch_private_repos.js`, in `processRepo()`, the `result` object currently
sets `metadata` only when an override exists (line ~305). Replace the trailing
`if (metadata) result.metadata = metadata;` with a merge that always sets the category:

```js
  result.metadata = { ...(metadata || {}), category: categoryFor(repo.name) };
  return result;
}
```

(This keeps any override metadata like `role`/`duration`, and adds `category`. The
featured-marking loop later spreads `enriched[repoIndex].metadata`, so it is preserved.)

- [ ] **Step 3: Create the one-off apply script**

Create `scripts/apply-categories.js` — stamps the *existing* JSON so the prototype renders
without the token-gated sync:

```js
#!/usr/bin/env node
// One-off: stamp metadata.category onto the existing data files using the same
// source-of-truth map the nightly sync uses. Lets the projects page render
// categories locally without GH_PRIVATE_TOKEN. Safe to re-run (idempotent).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryFor } from './repo-categories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'public', 'data');

for (const file of ['private_repos.json', 'featured_repos.json']) {
  const p = path.join(DATA, file);
  const entries = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const e of entries) {
    e.metadata = { ...(e.metadata || {}), category: categoryFor(e.repo.name) };
  }
  fs.writeFileSync(p, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`Stamped ${entries.length} entries in ${file}`);
}
```

- [ ] **Step 4: Run the apply script**

Run: `node scripts/apply-categories.js`
Expected: prints "Stamped 116 entries in private_repos.json" and "Stamped 6 entries in featured_repos.json".

- [ ] **Step 5: Verify the stamp landed**

Run: `node -e "const d=require('./public/data/private_repos.json'); const n=d.filter(e=>e.metadata&&e.metadata.category).length; const other=d.filter(e=>e.metadata.category==='other').map(e=>e.repo.name); console.log('categorized:',n,'/',d.length); console.log('other:',other);"`
Expected: `categorized: 116 / 116`; the `other` list is small and matches what the review accepted.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch_private_repos.js scripts/apply-categories.js public/data/private_repos.json public/data/featured_repos.json
git commit -m "Stamp repo categories in sync and existing data"
```

---

## Task 3: Category types, labels, and shelf-repo fetch in github.ts

**Files:**
- Modify: `src/lib/github.ts`

- [ ] **Step 1: Replace the stub category enum**

In `src/lib/github.ts`, in `GitHubRepoMetadata`, change:

```ts
  category?: 'web' | 'mobile' | 'cli' | 'ai' | 'automation' | 'other';
```

to:

```ts
  category?:
    | 'ai-ml' | 'crypto-fintech' | 'dev-tools' | 'automation' | 'mobile'
    | 'creative' | 'games' | 'security' | 'client-sites' | 'web-utilities' | 'other';
```

- [ ] **Step 2: Update categoryLabels and categoryIcons**

Replace the existing `categoryIcons` and `categoryLabels` objects (near the bottom of the
file) with entries for the new slugs:

```ts
export const categoryIcons: Record<string, string> = {
  'ai-ml': 'brain',
  'crypto-fintech': 'bitcoin',
  'dev-tools': 'terminal',
  'automation': 'zap',
  'mobile': 'smartphone',
  'creative': 'sparkles',
  'games': 'gamepad-2',
  'security': 'shield',
  'client-sites': 'globe',
  'web-utilities': 'layout',
  'other': 'code',
};

export const categoryLabels: Record<string, string> = {
  'ai-ml': 'AI & ML',
  'crypto-fintech': 'Crypto & Fintech',
  'dev-tools': 'Developer Tools & Infrastructure',
  'automation': 'Automation & Scraping',
  'mobile': 'iOS & Mobile',
  'creative': 'Creative & Generative',
  'games': 'Games & Puzzles',
  'security': 'Security & Privacy',
  'client-sites': 'Client & Commercial Sites',
  'web-utilities': 'Web Apps & Utilities',
  'other': 'Other',
};
```

- [ ] **Step 3: Add `getShelfRepos()` (keeps featured in)**

`getAllRepos()` excludes featured repos; shelves must include them (repeated, badged).
Add a sibling export. After `getAllRepos()` in `src/lib/github.ts`:

```ts
/**
 * Like getAllRepos, but does NOT exclude featured repos — shelves repeat
 * featured cards (badged, sorted first). Still drops hidden repos. No cache
 * of its own; reuses the same fetches.
 */
export async function getShelfRepos(): Promise<GitHubRepo[]> {
  const [publicRepos, privateRepos] = await Promise.all([
    fetchPublicRepos(),
    fetchPrivateRepos(),
  ]);

  const repoMap = new Map<string, GitHubRepo>();
  for (const repo of publicRepos) repoMap.set(repo.full_name, repo);
  for (const repo of privateRepos) repoMap.set(repo.full_name, repo);

  return Array.from(repoMap.values())
    .filter((repo) => !HIDDEN_REPOS.includes(repo.name))
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());
}
```

- [ ] **Step 4: Type-check**

Run: `npx astro check`
Expected: no errors from `github.ts` (pre-existing unrelated warnings, if any, are fine).

- [ ] **Step 5: Commit**

```bash
git add src/lib/github.ts
git commit -m "Add domain category slugs, labels, and getShelfRepos"
```

---

## Task 4: Pure grouping/sort logic (TDD)

**Files:**
- Create: `src/lib/projectSections.ts`
- Test: `src/lib/projectSections.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/projectSections.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupReposByCategory, sortWithinShelf, SECTION_ORDER } from './projectSections';
import type { GitHubRepo } from './github';

function repo(partial: Partial<GitHubRepo> & { name: string }): GitHubRepo {
  return {
    full_name: `Technical-1/${partial.name}`,
    html_url: '', homepage: null, description: null,
    private: false, fork: false, archived: false,
    pushed_at: '2024-01-01T00:00:00Z',
    languages: [], primary_language: null,
    ...partial,
  } as GitHubRepo;
}

describe('sortWithinShelf', () => {
  it('orders featured first, then active by recency, then archived last', () => {
    const repos = [
      repo({ name: 'old-active', pushed_at: '2023-01-01T00:00:00Z' }),
      repo({ name: 'archived', archived: true, pushed_at: '2025-01-01T00:00:00Z' }),
      repo({ name: 'new-active', pushed_at: '2024-06-01T00:00:00Z' }),
      repo({ name: 'featured', metadata: { featured: true }, pushed_at: '2020-01-01T00:00:00Z' }),
    ];
    expect(sortWithinShelf(repos).map((r) => r.name)).toEqual([
      'featured', 'new-active', 'old-active', 'archived',
    ]);
  });

  it('keeps a featured repo first even when it is archived', () => {
    const repos = [
      repo({ name: 'active', pushed_at: '2025-01-01T00:00:00Z' }),
      repo({ name: 'featured-archived', archived: true, metadata: { featured: true } }),
    ];
    expect(sortWithinShelf(repos)[0].name).toBe('featured-archived');
  });
});

describe('groupReposByCategory', () => {
  it('groups by metadata.category, drops empty shelves, preserves SECTION_ORDER', () => {
    const repos = [
      repo({ name: 'a', metadata: { category: 'games' } }),
      repo({ name: 'b', metadata: { category: 'ai-ml' } }),
      repo({ name: 'c', metadata: { category: 'ai-ml' } }),
    ];
    const shelves = groupReposByCategory(repos);
    expect(shelves.map((s) => s.category)).toEqual(['ai-ml', 'games']);
    expect(shelves[0].repos.map((r) => r.name).sort()).toEqual(['b', 'c']);
  });

  it('routes repos with no/unknown category to "other"', () => {
    const shelves = groupReposByCategory([repo({ name: 'x' })]);
    expect(shelves.map((s) => s.category)).toEqual(['other']);
  });

  it('orders shelves exactly per SECTION_ORDER', () => {
    const repos = SECTION_ORDER.map((c, i) => repo({ name: `r${i}`, metadata: { category: c } }));
    expect(groupReposByCategory(repos).map((s) => s.category)).toEqual([...SECTION_ORDER]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `projectSections` module not found / exports missing.

- [ ] **Step 3: Implement projectSections.ts**

Create `src/lib/projectSections.ts`:

```ts
import type { GitHubRepo } from './github';

export type CategorySlug =
  | 'ai-ml' | 'crypto-fintech' | 'dev-tools' | 'automation' | 'mobile'
  | 'creative' | 'games' | 'security' | 'client-sites' | 'web-utilities' | 'other';

export const SECTION_ORDER: CategorySlug[] = [
  'ai-ml', 'crypto-fintech', 'dev-tools', 'automation', 'mobile',
  'creative', 'games', 'security', 'client-sites', 'web-utilities', 'other',
];

export const SECTION_LABELS: Record<CategorySlug, string> = {
  'ai-ml': 'AI & ML',
  'crypto-fintech': 'Crypto & Fintech',
  'dev-tools': 'Developer Tools & Infrastructure',
  'automation': 'Automation & Scraping',
  'mobile': 'iOS & Mobile',
  'creative': 'Creative & Generative',
  'games': 'Games & Puzzles',
  'security': 'Security & Privacy',
  'client-sites': 'Client & Commercial Sites',
  'web-utilities': 'Web Apps & Utilities',
  'other': 'Other',
};

export interface Shelf {
  category: CategorySlug;
  label: string;
  repos: GitHubRepo[];
}

function repoCategory(repo: GitHubRepo): CategorySlug {
  const c = repo.metadata?.category as CategorySlug | undefined;
  return c && SECTION_ORDER.includes(c) ? c : 'other';
}

/** featured (0) → active (1) → archived (2); ties broken by pushed_at desc. */
export function sortWithinShelf(repos: GitHubRepo[]): GitHubRepo[] {
  const rank = (r: GitHubRepo) => (r.metadata?.featured ? 0 : r.archived ? 2 : 1);
  return [...repos].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
  });
}

export function groupReposByCategory(repos: GitHubRepo[]): Shelf[] {
  const buckets = new Map<CategorySlug, GitHubRepo[]>();
  for (const repo of repos) {
    const c = repoCategory(repo);
    if (!buckets.has(c)) buckets.set(c, []);
    buckets.get(c)!.push(repo);
  }
  return SECTION_ORDER
    .filter((c) => buckets.has(c))
    .map((c) => ({ category: c, label: SECTION_LABELS[c], repos: sortWithinShelf(buckets.get(c)!) }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `sortWithinShelf` and `groupReposByCategory` tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projectSections.ts src/lib/projectSections.test.ts
git commit -m "Add tested shelf grouping and sort logic"
```

---

## Task 5: Featured ★ badge and archived dimming on the card

**Files:**
- Modify: `src/components/projects/CompactRepoCard.tsx`

- [ ] **Step 1: Add a featured badge and archived dimming**

In `CompactRepoCard.tsx`, derive the flags near the other `const`s in the component body:

```tsx
  const isFeatured = repo.metadata?.featured === true;
  const isArchived = repo.archived === true;
```

On the root `<a>`, add an archived dim via style (merge with the existing style object):

```tsx
      style={{ textDecoration: 'none', opacity: isArchived ? 0.55 : 1 }}
```

Inside the image-box container (the element that holds the OG preview image), add the
badge as the first child so it overlays the top-left corner:

```tsx
      {isFeatured && (
        <span
          className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: 'var(--accent-primary)', color: '#fff' }}
        >
          ★ Featured
        </span>
      )}
```

(The image box is already `relative`/`group`; if the immediate container isn't positioned,
add `position: relative` to it so the absolute badge anchors correctly.)

- [ ] **Step 2: Type-check**

Run: `npx astro check`
Expected: no new errors from `CompactRepoCard.tsx`.

- [ ] **Step 3: Visual check**

Run: `npm run dev`, open `/projects`. A featured card (e.g. Orbit) shows the ★ badge; an
archived card renders dimmed. Stop the dev server when confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/components/projects/CompactRepoCard.tsx
git commit -m "Add featured badge and archived dimming to repo card"
```

---

## Task 6: ProjectShelves component (shelves + temporary toggle bar)

**Files:**
- Create: `src/components/projects/ProjectShelves.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/projects/ProjectShelves.tsx`:

```tsx
/**
 * ProjectShelves
 *
 * Client island: fetches all shelf repos (featured included), groups them into
 * domain shelves, and renders each shelf. Includes a TEMPORARY toggle bar to
 * explore layout variants live (nav × density × shelf-style). Once a winning
 * combination is chosen, the toggle bar and the unused branches are stripped
 * (see the cleanup task).
 */
import { useState, useEffect } from 'react';
import { getShelfRepos } from '../../lib/github';
import { groupReposByCategory, type Shelf } from '../../lib/projectSections';
import CompactRepoCard from './CompactRepoCard';

type Density = 'roomy' | 'dense';
type ShelfStyle = 'grid' | 'scroll';

export default function ProjectShelves() {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState(true);
  const [density, setDensity] = useState<Density>('roomy');
  const [style, setStyle] = useState<ShelfStyle>('grid');

  useEffect(() => {
    getShelfRepos()
      .then((repos) => setShelves(groupReposByCategory(repos)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="card animate-pulse h-64" />;
  }

  const sectionId = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const containerClass =
    style === 'scroll'
      ? 'flex gap-4 overflow-x-auto pb-4 snap-x'
      : density === 'dense'
        ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3';

  const itemClass = style === 'scroll' ? 'min-w-[280px] snap-start' : '';

  return (
    <div>
      {/* TEMPORARY prototype toggle bar — removed once a layout is chosen */}
      <div className="card mb-8 flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold">Prototype:</span>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={nav} onChange={(e) => setNav(e.target.checked)} />
          jump-nav
        </label>
        <label className="flex items-center gap-1">
          density
          <select value={density} onChange={(e) => setDensity(e.target.value as Density)}>
            <option value="roomy">roomy</option>
            <option value="dense">dense</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          shelf
          <select value={style} onChange={(e) => setStyle(e.target.value as ShelfStyle)}>
            <option value="grid">grid</option>
            <option value="scroll">scroll-row</option>
          </select>
        </label>
      </div>

      {nav && (
        <nav className="sticky top-16 z-20 mb-8 flex flex-wrap gap-2 py-2"
             style={{ background: 'var(--bg-base)' }}>
          {shelves.map((s) => (
            <a key={s.category} href={`#${sectionId(s.label)}`}
               className="btn-secondary text-xs px-3 py-1">
              {s.label} <span className="opacity-60">{s.repos.length}</span>
            </a>
          ))}
        </nav>
      )}

      {shelves.map((shelf) => (
        <section key={shelf.category} id={sectionId(shelf.label)} className="mb-12 scroll-mt-24">
          <h3 className="section-title flex items-center gap-3">
            {shelf.label}
            <span className="text-sm opacity-60">{shelf.repos.length}</span>
          </h3>
          <div className={containerClass}>
            {shelf.repos.map((repo) => (
              <div key={repo.full_name} className={itemClass}>
                <CompactRepoCard repo={repo} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx astro check`
Expected: no errors from `ProjectShelves.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/projects/ProjectShelves.tsx
git commit -m "Add ProjectShelves with prototype toggle bar"
```

---

## Task 7: Wire ProjectShelves into the projects page

**Files:**
- Modify: `src/pages/projects/index.astro`

- [ ] **Step 1: Swap the flat wall for shelves**

In `src/pages/projects/index.astro`:

1. Replace the import `import GitHubReposWall from '../../components/projects/GitHubReposWall';`
   with `import ProjectShelves from '../../components/projects/ProjectShelves';`.
2. In the "All Repositories" `<section>`, replace `<GitHubReposWall client:load />` with
   `<ProjectShelves client:load />`, and change the `<h2>` text from "All Repositories" to
   "Projects by Domain".

The "Featured Projects" hero section above it stays exactly as-is.

- [ ] **Step 2: Build to verify it compiles and renders**

Run: `npm run build`
Expected: build succeeds (note: `build` also runs `generate-embeddings`; if that step
fails for unrelated env reasons, run `npx astro build` instead to validate the page).

- [ ] **Step 3: Visual check across all 8 combinations**

Run: `npm run dev`, open `/projects`. Confirm: ~10 shelves appear in `SECTION_ORDER`;
featured repos show ★ and lead their shelf; archived repos are dimmed and last. Flip every
toggle (jump-nav on/off, roomy/dense, grid/scroll-row) and confirm all 8 combinations
render correctly. Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/pages/projects/index.astro
git commit -m "Render projects grouped into domain shelves"
```

---

## Task 8: Choose the winning layout and strip the toggles (after Jacob picks)

**Files:**
- Modify: `src/components/projects/ProjectShelves.tsx`
- Possibly remove: `src/components/projects/GitHubReposWall.tsx` (if now unused)

**Gated:** do this only after Jacob has flipped through the prototype and named the winning
combination (nav?, density, shelf-style).

- [ ] **Step 1: Hard-code the chosen combination**

In `ProjectShelves.tsx`, remove the toggle bar JSX and the `nav`/`density`/`style`
`useState` hooks. Replace their reads with the chosen constants (e.g. if the pick is
"jump-nav on, roomy, grid": always render the nav, and set `containerClass` to the roomy
grid). Delete the unused branches.

- [ ] **Step 2: Remove GitHubReposWall if unused**

Run: `grep -rn "GitHubReposWall" src/`
If no references remain, delete `src/components/projects/GitHubReposWall.tsx`.

- [ ] **Step 3: Type-check and build**

Run: `npx astro check && npx astro build`
Expected: both succeed; no references to removed symbols.

- [ ] **Step 4: Final visual check**

Run: `npm run dev`, open `/projects`, confirm the final layout matches the chosen
combination and the toggle bar is gone. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Finalize chosen projects layout and remove prototype toggles"
```

---

## Self-Review Notes

- **Spec coverage:** taxonomy/grouping → Tasks 1,4; durable category data plane → Tasks 1–3; featured hero + in-shelf badge/sort-first → Tasks 4,5,7; archived in-domain/last/dimmed → Tasks 4,5; toggle-driven 8-variant prototype → Tasks 6,7; pick + strip → Task 8. All spec sections map to a task.
- **Review gates honored:** Task 1 Step 2 (mapping approval) and Task 8 (layout pick) are explicit human gates, matching the spec's "review the full mapping first" and "pick the winner" decisions.
- **Type consistency:** `CategorySlug`, `SECTION_ORDER`, `SECTION_LABELS`, `Shelf`, `getShelfRepos`, `categoryFor`, `groupReposByCategory`, `sortWithinShelf` are used consistently across Tasks 3–7; the `metadata.category` union in `github.ts` (Task 3) matches the `CategorySlug` union in `projectSections.ts` (Task 4).
