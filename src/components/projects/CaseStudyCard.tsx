/**
 * CaseStudyCard Component
 *
 * Rich card display for featured projects in the "Featured Projects" section.
 * Shows hero image with animated GIF preview on hover (desktop) or scroll (mobile).
 * Includes category badge, languages, expandable highlights, and action buttons.
 * Used on the projects index page for curated/highlighted work.
 */
import { useState } from 'react';
import type { GitHubRepo } from '../../lib/github';
import { getLanguageColor, getRepoSlug, categoryLabels } from '../../lib/github';
import { useAnimatedPreview } from '../../hooks/useAnimatedPreview';

interface CaseStudyCardProps {
  repo: GitHubRepo;
  featured?: boolean;
}

export default function CaseStudyCard({ repo, featured = false }: CaseStudyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const slug = getRepoSlug(repo);

  // Format last updated date
  const lastUpdated = new Date(repo.pushed_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Paths for preview images (convention-based)
  const pngPath = `/screenshots/${slug}/preview.png`;
  const gifPath = `/screenshots/${slug}/preview.gif`;

  // Animated preview hook handles desktop hover and mobile scroll
  const {
    isAnimating,
    containerRef,
    onMouseEnter,
    onMouseLeave,
    gifExists,
  } = useAnimatedPreview({ pngPath, gifPath });

  // Check if project has screenshots defined in data
  const hasScreenshots = repo.screenshots && repo.screenshots.length > 0;

  return (
    <article
      className={`card card-hover overflow-hidden flex flex-col ${featured ? 'md:col-span-2' : ''}`}
      style={{ padding: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hero Screenshot with Animated Preview */}
      <div
        ref={containerRef}
        className="relative h-48 overflow-hidden group"
        style={{ backgroundColor: 'var(--bg-surface)' }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {hasScreenshots ? (
          <>
            {/* Static PNG - base layer */}
            <img
              src={pngPath}
              alt={`${repo.name} screenshot`}
              className={`
                w-full h-full object-cover
                transition-all duration-500
                ${!isAnimating && !gifExists ? 'group-hover:scale-105' : ''}
                ${isAnimating ? 'opacity-0' : 'opacity-100'}
              `}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />

            {/* Animated GIF - overlay when animating */}
            {gifExists && (
              <img
                src={isAnimating ? gifPath : undefined}
                alt=""
                aria-hidden="true"
                className={`
                  absolute inset-0 w-full h-full object-cover
                  transition-opacity duration-300
                  ${isAnimating ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
              />
            )}
          </>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            <div
              className="text-6xl font-display font-bold opacity-20"
              style={{ color: 'var(--accent-primary)' }}
            >
              {repo.name.substring(0, 2).toUpperCase()}
            </div>
          </div>
        )}

        {/* Category Badge */}
        {repo.metadata?.category && (
          <span
            className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--accent-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            {categoryLabels[repo.metadata.category] || repo.metadata.category}
          </span>
        )}

      </div>

      {/* Content */}
      <div className="p-6 space-y-4 flex-1 flex flex-col">
        {/* Title & Private Badge */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-xl font-display font-bold mb-2 line-clamp-1"
            style={{ color: 'var(--text-heading)' }}
          >
            {repo.name.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </h3>
          {repo.private && (
            <span
              className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: 'rgba(196, 30, 58, 0.1)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(196, 30, 58, 0.3)',
              }}
            >
              Private
            </span>
          )}
        </div>
          {/* Mobile: no clamp, Desktop: min 3-line height, expands smoothly on hover */}
          <div
            className="md:min-h-[3.9rem] overflow-hidden transition-[max-height] duration-500 ease-in-out"
            style={{
              maxHeight: isHovered ? '12rem' : '3.9rem',
            }}
          >
            <p
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {repo.description || 'No description available.'}
            </p>
          </div>
        </div>

        {/* Last Updated */}
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Last updated: {lastUpdated}
        </p>

        {/* Tech Tags - wrap to next line if needed */}
        <div className="flex flex-wrap gap-2">
          {repo.languages.slice(0, 5).map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-muted)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: getLanguageColor(lang) }}
              />
              {lang}
            </span>
          ))}
          {repo.languages.length > 5 && (
            <span
              className="px-2 py-1 rounded text-xs whitespace-nowrap"
              style={{ color: 'var(--text-muted)' }}
            >
              +{repo.languages.length - 5}
            </span>
          )}
        </div>

        {/* Impact / Highlights */}
        {repo.metadata?.impact && (
          <p
            className="text-sm italic"
            style={{ color: 'var(--accent-secondary)' }}
          >
            {repo.metadata.impact}
          </p>
        )}

        {/* Expandable Highlights */}
        {repo.metadata?.highlights && repo.metadata.highlights.length > 0 && (
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm font-medium flex items-center gap-2 transition-colors"
              style={{ color: 'var(--accent-primary)' }}
            >
              {isExpanded ? 'Hide Details' : 'Show Details'}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <div
              className="overflow-hidden transition-[max-height] duration-500 ease-in-out"
              style={{
                maxHeight: isExpanded ? '20rem' : '0',
              }}
            >
              <ul className="mt-3 space-y-2">
                {repo.metadata.highlights.map((highlight, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span style={{ color: 'var(--accent-secondary)' }}>-</span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Spacer to push actions to bottom */}
        <div className="flex-1" />

        {/* Actions - sticky to bottom, full width split */}
        <div className="flex gap-3 pt-2 mt-auto">
          {repo.has_portfolio && (
            <a
              href={`/projects/${slug}`}
              className="btn-primary text-sm py-2 px-4 flex-1 text-center"
            >
              View Details
            </a>
          )}
          {repo.homepage && (
            <a
              href={repo.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm py-2 px-4 flex-1 text-center"
            >
              Live Demo
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
