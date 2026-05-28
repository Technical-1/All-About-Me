/**
 * GitHubReposWall
 *
 * Image-wall list of every repo, rendered as CompactRepoCards (the OG image IS
 * the card, with a pure-CSS hover popover). Flat grid, no highlight/archive
 * split. Fetches client-side like the other repo lists.
 *
 * `dense` switches the grid from a roomy 3-col image grid (Option 1) to a
 * tighter 4-col archive (Option 2).
 */
import { useState, useEffect } from 'react';
import { getAllRepos, type GitHubRepo } from '../../lib/github';
import CompactRepoCard from './CompactRepoCard';

interface GitHubReposWallProps {
  dense?: boolean;
}

export default function GitHubReposWall({ dense = false }: GitHubReposWallProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllRepos()
      .then(setRepos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const gridClass = dense
    ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3';

  if (loading) {
    return (
      <div className={gridClass}>
        {[...Array(dense ? 8 : 6)].map((_, i) => (
          <div
            key={i}
            className="card animate-pulse overflow-hidden aspect-[1200/630] bg-border"
            style={{ padding: 0 }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="mb-4" style={{ color: 'var(--accent-primary)' }}>
          Failed to load repositories
        </p>
        <button onClick={() => window.location.reload()} className="btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {repos.map((repo) => (
        <CompactRepoCard key={repo.full_name} repo={repo} />
      ))}
    </div>
  );
}
