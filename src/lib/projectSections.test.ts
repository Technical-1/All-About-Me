import { describe, it, expect } from 'vitest';
import { groupReposByCategory, sortWithinShelf, shelfFor, featuredFromShelves, SECTION_ORDER } from './projectSections';
import type { GitHubRepo } from './github';

// Repos have a preview image BY DEFAULT (so they land in their domain). Pass
// `screenshots: []` to simulate an imageless repo (→ work-in-progress).
function repo(partial: Partial<GitHubRepo> & { name: string }): GitHubRepo {
  return {
    full_name: `Technical-1/${partial.name}`,
    html_url: '', homepage: null, description: null,
    private: false, fork: false, archived: false,
    pushed_at: '2024-01-01T00:00:00Z',
    languages: [], primary_language: null,
    screenshots: partial.screenshots ?? ['/preview.png'],
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

describe('shelfFor', () => {
  it('routes a repo with an image to its stored domain', () => {
    expect(shelfFor(repo({ name: 'a', metadata: { category: 'games' } }))).toBe('games');
  });

  it('routes a repo with NO preview image to work-in-progress', () => {
    expect(shelfFor(repo({ name: 'b', metadata: { category: 'ai-ml' }, screenshots: [] }))).toBe('work-in-progress');
  });

  it('keeps academic repos on the academic shelf even with no image', () => {
    expect(shelfFor(repo({ name: 'c', metadata: { category: 'academic' }, screenshots: [] }))).toBe('academic');
  });

  it('routes unknown/missing category (with an image) to other', () => {
    expect(shelfFor(repo({ name: 'd' }))).toBe('other');
  });
});

describe('groupReposByCategory', () => {
  it('groups by shelf, drops empty shelves, preserves SECTION_ORDER', () => {
    const repos = [
      repo({ name: 'a', metadata: { category: 'games' } }),
      repo({ name: 'b', metadata: { category: 'ai-ml' } }),
      repo({ name: 'c', metadata: { category: 'ai-ml' } }),
    ];
    const shelves = groupReposByCategory(repos);
    expect(shelves.map((s) => s.category)).toEqual(['ai-ml', 'games']);
    expect(shelves[0].repos.map((r) => r.name).sort()).toEqual(['b', 'c']);
  });

  it('places imageless repos under work-in-progress, after the domains', () => {
    const repos = [
      repo({ name: 'shiny', metadata: { category: 'ai-ml' } }),
      repo({ name: 'wip', metadata: { category: 'crypto-fintech' }, screenshots: [] }),
    ];
    expect(groupReposByCategory(repos).map((s) => s.category)).toEqual([
      'ai-ml', 'work-in-progress',
    ]);
  });

  it('orders produced shelves exactly per SECTION_ORDER', () => {
    const repos = SECTION_ORDER
      .filter((c) => c !== 'work-in-progress')
      .map((c, i) => repo({ name: `r${i}`, metadata: { category: c } }));
    repos.push(repo({ name: 'wip', metadata: { category: 'games' }, screenshots: [] }));
    const got = groupReposByCategory(repos).map((s) => s.category);
    expect(got).toEqual(SECTION_ORDER.filter((c) => got.includes(c)));
  });
});

describe('featuredFromShelves', () => {
  it('collects featured repos across all shelves, newest-first', () => {
    const shelves = groupReposByCategory([
      repo({ name: 'ai-feat', metadata: { category: 'ai-ml', featured: true }, pushed_at: '2025-01-01T00:00:00Z' }),
      repo({ name: 'ai-plain', metadata: { category: 'ai-ml' } }),
      repo({ name: 'game-feat', metadata: { category: 'games', featured: true }, pushed_at: '2026-01-01T00:00:00Z' }),
    ]);
    expect(featuredFromShelves(shelves).map((r) => r.name)).toEqual(['game-feat', 'ai-feat']);
  });

  it('returns an empty array when nothing is featured', () => {
    const shelves = groupReposByCategory([repo({ name: 'a', metadata: { category: 'games' } })]);
    expect(featuredFromShelves(shelves)).toEqual([]);
  });
});
