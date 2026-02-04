/**
 * GitHubRepos Component
 *
 * Displays a grid of all GitHub repositories in the "All Repositories" section.
 * Fetches data client-side from GitHub API + local JSON, with localStorage caching.
 * Featured repos are excluded (shown in their own section above).
 */
import { useState, useEffect } from 'react';
import { getAllRepos, getLanguageColor, getRepoSlug, type GitHubRepo } from '../../lib/github';

export default function GitHubRepos() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllRepos()
      .then(setRepos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="card animate-pulse"
          >
            <div className="h-5 bg-border rounded w-3/4 mb-3" />
            <div className="h-4 bg-border rounded w-full mb-2" />
            <div className="h-4 bg-border rounded w-2/3 mb-4" />
            <div className="flex gap-2">
              <div className="h-6 bg-border rounded w-16" />
              <div className="h-6 bg-border rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="mb-4" style={{ color: 'var(--accent-primary)' }}>Failed to load repositories</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {repos.map((repo) => (
        <RepoCard key={repo.full_name} repo={repo} />
      ))}
    </div>
  );
}

/**
 * Individual repository card with name, description, languages, and action buttons.
 * Links to GitHub (public) or homepage (private) on card click.
 * Shows "View Details" button if portfolio documentation exists.
 */
function RepoCard({ repo }: { repo: GitHubRepo }) {
  const href = repo.private ? repo.homepage : repo.html_url;
  const lastUpdated = new Date(repo.pushed_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const Tag = href ? 'a' : 'div';
  const linkProps = href
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <Tag
      {...linkProps}
      className="card card-hover group transition-all duration-300 cursor-pointer flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          className="font-mono font-bold transition-colors"
          style={{ color: 'var(--text-heading)' }}
        >
          {repo.name}
        </h3>
        {repo.private && (
          <span
            className="text-xs px-2 py-0.5 rounded"
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

      <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
        {repo.description || 'No description provided.'}
      </p>

      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Last updated: {lastUpdated}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {repo.languages.slice(0, 5).map((lang) => (
          <span
            key={lang}
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getLanguageColor(lang) }}
            />
            {lang}
          </span>
        ))}
      </div>

      {/* Action buttons for repos with portfolio documentation */}
      {repo.has_portfolio && (
        <div className="flex gap-2 mt-auto pt-2 border-t border-border/50">
          <a
            href={`/projects/${getRepoSlug(repo)}`}
            className="btn-secondary text-xs py-1.5 px-3 flex-1 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            View Details
          </a>
          {repo.homepage && (
            <a
              href={repo.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs py-1.5 px-3 flex-1 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              Live Demo
            </a>
          )}
        </div>
      )}
    </Tag>
  );
}
