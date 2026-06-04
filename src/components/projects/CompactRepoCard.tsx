/**
 * CompactRepoCard
 *
 * Archive-tier card. The resting state is the full OG preview image at its
 * native 1.91:1 ratio with a gradient title overlay (an image wall). On hover:
 *   - the image box lifts (scale 1.04×, accent border, soft shadow) and the
 *     image zooms 1.05× inside its frame,
 *   - a popover slides down below the box with the description, language pills,
 *     last-updated date, optional Live Demo button, and the View CTA.
 *
 * The box (image) is the "top", the popover is the "rest after". Pure CSS hover,
 * no JS state.
 */
import { useState } from 'react';
import type { GitHubRepo } from '../../lib/github';
import { getLanguageColor, getRepoSlug } from '../../lib/github';

interface CompactRepoCardProps {
  repo: GitHubRepo;
}

export default function CompactRepoCard({ repo }: CompactRepoCardProps) {
  const [revealed, setRevealed] = useState(false);
  const slug = getRepoSlug(repo);
  const hasScreenshot = repo.screenshots && repo.screenshots.length > 0;
  const pngPath = `/screenshots/${slug}/preview.png`;

  // A private repo's GitHub URL 404s for anyone but the owner, so it's never a
  // valid public destination. Detail pages are internal; only public repos
  // without a portfolio page fall back to linking out to GitHub. Private
  // repos without a portfolio link to their live demo if they have one, else
  // they're just an info card (hover popover only, no navigation).
  const canViewGitHub = !repo.has_portfolio && !repo.private;
  const href = repo.has_portfolio
    ? `/projects/${slug}`
    : canViewGitHub
      ? repo.html_url
      : repo.homepage || undefined;
  const external = !!href && !repo.has_portfolio;

  const titleCase = repo.name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const lastUpdated = new Date(repo.pushed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const initials = repo.name.substring(0, 2).toUpperCase();

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="group relative block"
      style={{ textDecoration: 'none' }}
      onClick={(e) => {
        // No-hover (touch) devices have no way to see the hover popover, so a
        // tap on the card toggles it instead of navigating — tap to reveal,
        // tap again to hide. The "View details"/"Live Demo" actions inside the
        // popover handle navigation. Pointer devices keep click-to-navigate.
        if (window.matchMedia('(hover: none)').matches) {
          e.preventDefault();
          setRevealed((v) => !v);
        }
      }}
    >
      {/* Resting state: the OG image IS the card */}
      <div
        className="card overflow-hidden relative aspect-[1200/630]
                   transition-[transform,box-shadow,border-color] duration-300 ease-out
                   group-hover:scale-[1.04] group-hover:z-20
                   group-hover:border-[color:var(--accent-secondary)]
                   group-hover:shadow-[0_15px_35px_-12px_rgba(0,0,0,0.3)]"
        style={{ padding: 0, transformOrigin: 'center top', backgroundColor: 'var(--bg-surface)' }}
      >
        {hasScreenshot ? (
          <img
            src={pngPath}
            alt={`${repo.name} preview`}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-4xl font-display font-bold opacity-25"
            style={{ color: 'var(--accent-primary)' }}
          >
            {initials}
          </div>
        )}

        {/* Title overlay — only for the no-screenshot fallback. Real OG previews
            already bake the project name into the image, so the overlay would
            just double up on it. */}
        {!hasScreenshot && (
          <div
            className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-8"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.35) 55%, transparent)',
            }}
          >
            <h4 className="text-white font-display font-bold text-sm leading-tight line-clamp-1 drop-shadow">
              {titleCase}
            </h4>
          </div>
        )}

        {/* Status badges — Archived and/or Private, same top-right spot. A repo
            can be both, so they share one flex row instead of stacking. */}
        {(repo.archived || repo.private) && (
          <div className="absolute top-2 right-2 flex gap-1">
            {repo.archived && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(180,120,20,0.7)', color: 'white' }}
              >
                Archived
              </span>
            )}
            {repo.private && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
              >
                Private
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover popover — the "description and rest", below the image box */}
      <div
        className={`absolute top-full left-0 right-0 mt-2 z-30
                   ${revealed ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}
                   group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto
                   transition-all duration-300 ease-out
                   rounded-lg p-3 space-y-2.5`}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--accent-secondary)',
          boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.35)',
        }}
      >
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {repo.description || 'No description available.'}
        </p>

        {repo.languages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {repo.languages.slice(0, 6).map((lang) => (
              <span
                key={lang}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-muted)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getLanguageColor(lang) }}
                />
                {lang}
              </span>
            ))}
            {repo.languages.length > 6 && (
              <span className="text-[10px] self-center" style={{ color: 'var(--text-muted)' }}>
                +{repo.languages.length - 6}
              </span>
            )}
          </div>
        )}

        <div
          className="flex items-center justify-between gap-2 pt-2 border-t"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Updated {lastUpdated}
          </span>
          <div className="flex items-center gap-2">
            {repo.homepage && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(repo.homepage!, '_blank', 'noopener,noreferrer');
                }}
                className="btn-secondary text-[11px] py-1 px-2.5"
              >
                Live Demo
              </button>
            )}
            {(repo.has_portfolio || canViewGitHub) && (
              <span
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-medium inline-flex items-center gap-1 transition-transform duration-300 group-hover:translate-x-0.5"
                style={{ color: 'var(--accent-secondary)' }}
              >
                {repo.has_portfolio ? 'View details' : 'View on GitHub'} →
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
