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
 */
import { useState, useEffect } from 'react';
import { getShelfRepos } from '../../lib/github';
import { groupReposByCategory, type Shelf } from '../../lib/projectSections';
import CompactRepoCard from './CompactRepoCard';

type Density = 'roomy' | 'dense';

export default function ProjectShelves() {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [density, setDensity] = useState<Density>('roomy');
  const [bigHover, setBigHover] = useState(true);
  const [showFeatured, setShowFeatured] = useState(true);

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

  const containerClass =
    density === 'dense'
      ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div>
      {/* TEMPORARY prototype toggles — floating so they don't affect layout.
          Removed once these calls are made. */}
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

      {shelves.map((shelf) => (
        <section key={shelf.category} id={sectionId(shelf.label)} className="mb-12 scroll-mt-24">
          <h3 className="section-title">{shelf.label}</h3>
          <div className={containerClass}>
            {shelf.repos.map((repo) => (
              <CompactRepoCard key={repo.full_name} repo={repo} bigHover={bigHover} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
