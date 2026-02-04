import { useState } from 'react';
import type { GitHubRepo } from '../../lib/github';
import { getLanguageColor, getRepoSlug, categoryLabels } from '../../lib/github';

interface CaseStudyCardProps {
  repo: GitHubRepo;
  featured?: boolean;
}

export default function CaseStudyCard({ repo, featured = false }: CaseStudyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const slug = getRepoSlug(repo);

  const heroScreenshot = repo.screenshots?.[0] || `/screenshots/${slug}/hero.png`;
  const hasScreenshots = repo.screenshots && repo.screenshots.length > 0;

  return (
    <article
      className={`card card-hover overflow-hidden ${featured ? 'md:col-span-2' : ''}`}
      style={{ padding: 0 }}
    >
      {/* Hero Screenshot */}
      <div
        className="relative h-48 overflow-hidden group"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {hasScreenshots ? (
          <img
            src={heroScreenshot}
            alt={`${repo.name} screenshot`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              // Fallback to placeholder
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
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

        {/* Private Badge */}
        {repo.private && (
          <span
            className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium"
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

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Title & Description */}
        <div>
          <h3
            className="text-xl font-display font-bold mb-2"
            style={{ color: 'var(--text-heading)' }}
          >
            {repo.name.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </h3>
          <p
            className="text-sm line-clamp-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            {repo.description || 'No description available.'}
          </p>
        </div>

        {/* Tech Tags */}
        <div className="flex flex-wrap gap-2">
          {repo.languages.slice(0, 4).map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-muted)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getLanguageColor(lang) }}
              />
              {lang}
            </span>
          ))}
          {repo.languages.length > 4 && (
            <span
              className="px-2 py-1 rounded text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              +{repo.languages.length - 4} more
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

            {isExpanded && (
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
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          {repo.has_portfolio && (
            <a
              href={`/projects/${slug}`}
              className="btn-primary text-sm py-2 px-4"
            >
              View Details
            </a>
          )}
          {repo.homepage && (
            <a
              href={repo.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm py-2 px-4"
            >
              Live Demo
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
