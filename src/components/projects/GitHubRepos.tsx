/**
 * GitHubRepos Component
 *
 * Displays a grid of all GitHub repositories in the "All Repositories" section.
 * Fetches data client-side from GitHub API + local JSON, with localStorage caching.
 * Featured repos are excluded (shown in their own section above).
 * Uses CaseStudyCard for consistent rich card display with hero images.
 */
import { useState, useEffect } from 'react';
import { getAllRepos, type GitHubRepo } from '../../lib/github';
import CaseStudyCard from './CaseStudyCard';

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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="card animate-pulse overflow-hidden"
            style={{ padding: 0 }}
          >
            {/* Hero image skeleton */}
            <div className="h-48 bg-border" />
            {/* Content skeleton */}
            <div className="p-6 space-y-4">
              <div className="h-6 bg-border rounded w-3/4" />
              <div className="space-y-2">
                <div className="h-4 bg-border rounded w-full" />
                <div className="h-4 bg-border rounded w-2/3" />
              </div>
              <div className="h-3 bg-border rounded w-1/3" />
              <div className="flex gap-2">
                <div className="h-6 bg-border rounded w-16" />
                <div className="h-6 bg-border rounded w-16" />
              </div>
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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {repos.map((repo) => (
        <CaseStudyCard key={repo.full_name} repo={repo} featured={false} />
      ))}
    </div>
  );
}
