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
import { useState, useRef } from 'react';
import type { GitHubRepo } from '../../lib/github';
import { getLanguageColor, getRepoSlug } from '../../lib/github';

interface CompactRepoCardProps {
  repo: GitHubRepo;
  /** When true, the OG image enlarges on desktop hover. Off for the featured band. */
  bigHover?: boolean;
  /** Dense grids use smaller cards, so they float to 2×; roomy cards float to 1.6×. */
  dense?: boolean;
}

export default function CompactRepoCard({ repo, bigHover = false, dense = false }: CompactRepoCardProps) {
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

  // Pin to UTC so the server (Vercel = UTC) and the client (viewer's timezone)
  // always format the same string — otherwise repos pushed near midnight UTC
  // produce a hydration text mismatch (React #418).
  const lastUpdated = new Date(repo.pushed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const initials = repo.name.substring(0, 2).toUpperCase();

  const isFeatured = repo.metadata?.featured === true;

  // Desktop hover float grows the card's real size (crisp), so retina images stay
  // sharp. Roomy cards are already large, so they float to 1.6× (-inset-30%); the
  // smaller dense cards float to 2× (-inset-50%). Popover sits below the grown image.
  const growClass = bigHover
    ? dense
      ? 'lg:group-hover:-inset-[50%]'
      : 'lg:group-hover:-inset-[30%]'
    : '';
  const popoverGrowOffset = bigHover
    ? dense
      ? 'lg:group-hover:top-[155%]'
      : 'lg:group-hover:top-[135%]'
    : '';
  // The popover under the image matches the grown image's width (2× dense / 1.6× roomy).
  const popoverWidthClass = bigHover
    ? dense
      ? 'lg:group-hover:w-[200%]'
      : 'lg:group-hover:w-[160%]'
    : '';

  // Edge-aware nudge: when a card near the viewport edge floats, shift the whole
  // card (image + popover) just enough to stay fully on-screen. Only edge cards
  // move; middle cards compute a shift of 0. Desktop (lg, hover-capable) only.
  const growFactor = dense ? 2 : 1.6;
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const [hoverShift, setHoverShift] = useState(0);

  const handleEnter = () => {
    if (!bigHover) return;
    if (!window.matchMedia('(min-width: 1024px) and (hover: hover)').matches) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const extra = r.width * (growFactor - 1);
    const grownLeft = r.left - extra / 2;
    const grownRight = r.right + extra / 2;
    const margin = 12;
    let shift = 0;
    if (grownLeft < margin) shift = margin - grownLeft;
    else if (grownRight > window.innerWidth - margin) shift = window.innerWidth - margin - grownRight;
    setHoverShift(Math.round(shift));
  };
  const handleLeave = () => setHoverShift(0);

  return (
    <a
      ref={anchorRef}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="group relative block transition-transform duration-300 ease-out hover:z-40"
      style={{ textDecoration: 'none', transform: hoverShift ? `translateX(${hoverShift}px)` : undefined }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
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
      {/* Resting state: the OG image IS the card. A fixed-aspect spacer reserves
          the grid cell so the card can grow into it on hover. The big-hover float
          grows the card's REAL size via `inset` (the <img> re-samples crisply from
          the 1200px source) instead of a blurry transform upscale, and overlays
          neighbors without reflowing them. */}
      <div className="relative aspect-[1200/630]">
      <div
        className={`card overflow-hidden absolute inset-0
                   transition-all duration-300 ease-out
                   group-hover:scale-[1.04] group-hover:z-30
                   ${bigHover ? 'lg:group-hover:scale-100' : ''} ${growClass}
                   group-hover:border-[color:var(--accent-secondary)]
                   group-hover:shadow-[0_15px_35px_-12px_rgba(0,0,0,0.3)]`}
        style={{ padding: 0, transformOrigin: 'center top', backgroundColor: 'var(--bg-surface)' }}
      >
        {isFeatured && (
          <span
            className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: 'var(--accent-primary)', color: '#fff' }}
            aria-label="Featured"
            title="Featured"
          >
            ★
          </span>
        )}
        {hasScreenshot ? (
          <img
            src={pngPath}
            alt={`${repo.name} preview`}
            className={`w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${bigHover ? 'lg:group-hover:scale-100' : ''}`}
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
      </div>

      {/* Hover popover — the "description and rest", below the image box */}
      <div
        className={`absolute top-full left-1/2 -translate-x-1/2 w-full ${popoverWidthClass} mt-2 z-40 ${popoverGrowOffset}
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
