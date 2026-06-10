/**
 * ProjectShelves
 *
 * Client island: fetches all shelf repos (featured included), groups them into
 * domain shelves, and renders each shelf as a wrapping grid. Navigation and
 * shelf-style were decided (no jump-nav, wrapping grid). A small TEMPORARY
 * toggle row remains for the still-open calls: card density (roomy vs dense),
 * desktop hover size (original vs 2× OG float), and whether to show the
 * Featured band above. The big-hover float is passed only to shelf cards, never
 * the featured band. These toggles get removed once the calls are made.
 *
 * On mobile (< sm) a sticky pill bar lets the visitor filter to All, Featured,
 * or a single shelf, so they don't have to scroll the whole single-column list.
 * Filtering is gated on a matchMedia check; desktop always renders every shelf.
 */
import { useState, useEffect } from 'react';
import { getShelfRepos } from '../../lib/github';
import { groupReposByCategory, featuredFromShelves, type Shelf, type CategorySlug } from '../../lib/projectSections';
import CompactRepoCard from './CompactRepoCard';

type Density = 'roomy' | 'dense';

/** A mobile filter selection: everything, the cross-shelf featured set, or one shelf. */
type ActiveFilter = 'all' | 'featured' | CategorySlug;

/** Tracks a CSS media query, re-rendering on change. Client-only (matchMedia). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

/**
 * Mobile-only sticky pill bar: All, Featured (when present), then one pill per
 * shelf in SECTION_ORDER. Hidden on >= sm via `sm:hidden`; horizontally
 * scrollable so a long category list never wraps.
 */
function ShelfFilterBar({
  shelves,
  featuredCount,
  active,
  onSelect,
}: {
  shelves: Shelf[];
  featuredCount: number;
  active: ActiveFilter;
  onSelect: (f: ActiveFilter) => void;
}) {
  const pills: { key: ActiveFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    ...(featuredCount > 0 ? [{ key: 'featured' as ActiveFilter, label: 'Featured' }] : []),
    ...shelves.map((s) => ({ key: s.category as ActiveFilter, label: s.label })),
  ];
  return (
    <div
      className="sm:hidden sticky top-16 z-30 -mx-4 mb-6 overflow-x-auto border-b px-4 py-2"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex w-max gap-2">
        {pills.map((p) => {
          const isActive = p.key === active;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onSelect(p.key)}
              aria-pressed={isActive}
              className="whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition-colors"
              style={
                isActive
                  ? { background: 'var(--accent-primary)', color: '#fff', borderColor: 'var(--accent-primary)' }
                  : { color: 'var(--text-primary)', borderColor: 'var(--border-color)' }
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ProjectShelves() {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [density, setDensity] = useState<Density>('dense');
  const [bigHover, setBigHover] = useState(true);
  const [showFeatured, setShowFeatured] = useState(false);
  // Controls stay wired in but hidden by default — append ?controls to the URL to
  // reveal the floating toggle bar (density / OG hover / featured band).
  const [showControls, setShowControls] = useState(false);

  // Mobile-only category filter. The pill bar is hidden >= sm, and filtering is
  // gated on isMobile so desktop always renders every shelf regardless of state.
  const [active, setActive] = useState<ActiveFilter>('all');
  const isMobile = useMediaQuery('(max-width: 639px)');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('controls')) setShowControls(true);
  }, []);

  useEffect(() => {
    getShelfRepos()
      .then((repos) => setShelves(groupReposByCategory(repos)))
      .finally(() => setLoading(false));
  }, []);

  // The Featured band lives in the Astro page (id="featured-section"), outside
  // this island — toggle its visibility directly so the prototype can compare.
  useEffect(() => {
    const el = document.getElementById('featured-section');
    if (el) el.style.display = showFeatured ? '' : 'none';
  }, [showFeatured]);

  if (loading) {
    return <div className="card animate-pulse h-64" />;
  }

  const sectionId = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Featured is a cross-shelf group; build it once so the bar can show/hide its
  // pill and the filter can render it as a synthetic shelf.
  const featured = featuredFromShelves(shelves);
  const visibleShelves: Shelf[] =
    !isMobile || active === 'all'
      ? shelves
      : active === 'featured'
        ? [{ category: 'featured' as CategorySlug, label: 'Featured', repos: featured }]
        : shelves.filter((s) => s.category === active);

  const containerClass =
    density === 'dense'
      ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div>
      {/* Prototype toggles — wired in but hidden unless ?controls is in the URL.
          Floating so they don't affect layout. */}
      {showControls && (
      <div className="fixed bottom-4 right-4 z-50 card flex flex-wrap items-center gap-3 text-sm shadow-xl">
        <label className="flex items-center gap-2">
          density
          <select value={density} onChange={(e) => setDensity(e.target.value as Density)}>
            <option value="roomy">roomy</option>
            <option value="dense">dense</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          OG hover
          <select value={bigHover ? '2x' : 'original'} onChange={(e) => setBigHover(e.target.value === '2x')}>
            <option value="2x">2× float</option>
            <option value="original">original size</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showFeatured} onChange={(e) => setShowFeatured(e.target.checked)} />
          show featured band
        </label>
      </div>
      )}

      <ShelfFilterBar
        shelves={shelves}
        featuredCount={featured.length}
        active={active}
        onSelect={setActive}
      />

      {visibleShelves.map((shelf) => (
        <section key={shelf.category} id={sectionId(shelf.label)} className="mb-12 scroll-mt-24">
          <h3 className="section-title">{shelf.label}</h3>
          <div className={containerClass}>
            {shelf.repos.map((repo) => (
              <CompactRepoCard key={repo.full_name} repo={repo} bigHover={bigHover} dense={density === 'dense'} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
