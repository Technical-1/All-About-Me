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
