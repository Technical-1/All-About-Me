import type { GitHubRepo } from './github';

export type CategorySlug =
  | 'ai-ml' | 'crypto-fintech' | 'dev-tools' | 'automation' | 'mobile'
  | 'creative' | 'games' | 'security' | 'client-sites' | 'web-utilities'
  | 'academic' | 'work-in-progress' | 'other';

// Domains first; then the two status shelves and 'other' at the bottom.
export const SECTION_ORDER: CategorySlug[] = [
  'ai-ml', 'crypto-fintech', 'dev-tools', 'automation', 'web-utilities',
  'mobile', 'creative', 'games', 'security', 'client-sites',
  'other', 'academic', 'work-in-progress',
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
  'academic': 'Academic Coursework',
  'work-in-progress': 'Work in Progress',
  'other': 'Other',
};

export interface Shelf {
  category: CategorySlug;
  label: string;
  repos: GitHubRepo[];
}

const CATEGORY_SET = new Set<CategorySlug>(SECTION_ORDER);

function hasPreviewImage(repo: GitHubRepo): boolean {
  return !!(repo.screenshots && repo.screenshots.length > 0);
}

/**
 * Which shelf a repo lands on:
 *   - 'academic' is an explicit stored category — it always wins (even featured AHSR).
 *   - Any other repo WITHOUT a preview image → 'work-in-progress'.
 *   - Otherwise its stored domain category (or 'other' if unknown).
 */
export function shelfFor(repo: GitHubRepo): CategorySlug {
  const stored = repo.metadata?.category as CategorySlug | undefined;
  const category = stored && CATEGORY_SET.has(stored) ? stored : 'other';
  if (category === 'academic') return 'academic';
  if (!hasPreviewImage(repo)) return 'work-in-progress';
  return category;
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
    const c = shelfFor(repo);
    if (!buckets.has(c)) buckets.set(c, []);
    buckets.get(c)!.push(repo);
  }
  return SECTION_ORDER
    .filter((c) => buckets.has(c))
    .map((c) => ({ category: c, label: SECTION_LABELS[c], repos: sortWithinShelf(buckets.get(c)!) }));
}
