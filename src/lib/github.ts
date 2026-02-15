/**
 * GitHub Repository Data Layer
 *
 * This module handles fetching and managing repository data from multiple sources:
 * 1. GitHub API - for public repos (client-side, with rate limiting)
 * 2. private_repos.json - pre-fetched repo data with enriched metadata
 * 3. featured_repos.json - curated list of featured projects
 * 4. Portfolio markdown files - detailed project documentation
 *
 * Data is cached in localStorage (2 hours) to reduce API calls and improve UX.
 * The nightly GitHub Action (sync-private-repos.yml) refreshes the JSON files.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Extended metadata for featured/highlighted projects */
export interface GitHubRepoMetadata {
  featured?: boolean;
  category?: 'web' | 'mobile' | 'cli' | 'ai' | 'automation' | 'other';
  highlights?: string[];
  impact?: string;
  role?: string;
  duration?: string;
}

export interface PortfolioData {
  architecture?: string;  // Mermaid diagrams & system overview
  stack?: string;         // Technology stack details
  qa?: string;            // Q&A knowledge base for AI
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  homepage: string | null;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  languages: string[];
  primary_language: string | null;
  // Extended fields for case studies
  screenshots?: string[];
  readme?: string;
  metadata?: GitHubRepoMetadata;
  // Portfolio documentation
  has_portfolio?: boolean;
  portfolio_files?: string[];
  portfolio?: PortfolioData;
}

interface PrivateRepoEntry {
  repo: {
    name: string;
    full_name: string;
    html_url: string;
    homepage: string | null;
    description: string | null;
    private: boolean;
    fork: boolean;
    archived: boolean;
    pushed_at: string;
  };
  languages: string[];
  primary_language: string | null;
  // Extended fields
  screenshots?: string[];
  readme?: string;
  metadata?: GitHubRepoMetadata;
  // Portfolio fields
  has_portfolio?: boolean;
  portfolio_files?: string[];
}

// GitHub API response types (subset of fields we use)
interface GitHubAPIRepo {
  name: string;
  full_name: string;
  html_url: string;
  homepage: string | null;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  language: string | null;
  languages_url: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Cache settings for localStorage (client-side only)
// Bump version when featured repos list changes to invalidate stale caches
const CACHE_KEY = 'github_repos_cache_v9';
const CACHE_TIMESTAMP_KEY = 'github_repos_timestamp_v9';
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

// Repos to exclude from the public projects page
const HIDDEN_REPOS = ['Work-Files', 'Valentines'];

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

/**
 * Fetches public repositories from the GitHub API.
 * Filters out forks and archived repos.
 * Note: Subject to GitHub API rate limits (60 req/hour unauthenticated).
 */
export async function fetchPublicRepos(): Promise<GitHubRepo[]> {
  const response = await fetch(
    'https://api.github.com/users/Technical-1/repos?per_page=100&sort=pushed'
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 403) {
      console.warn('GitHub API rate limited. Using cached data or returning empty.');
      return [];
    }
    throw new Error(`GitHub API error: ${status}`);
  }

  const repos: GitHubAPIRepo[] = await response.json();

  // Map repos without making individual language requests
  // The primary_language from the API is sufficient for display
  const mappedRepos: GitHubRepo[] = repos
    .filter((repo) => !repo.fork && !repo.archived)
    .map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      homepage: repo.homepage,
      description: repo.description,
      private: repo.private,
      fork: repo.fork,
      archived: repo.archived,
      pushed_at: repo.pushed_at,
      languages: repo.language ? [repo.language] : [],
      primary_language: repo.language,
    }));

  return mappedRepos;
}

/**
 * Fetches repository data from a local JSON file.
 * Works in both server (SSG build) and client (browser) environments.
 * Used for private_repos.json and featured_repos.json.
 */
async function fetchReposFromJson(filename: string): Promise<GitHubRepo[]> {
  try {
    let data: PrivateRepoEntry[];

    // Check if we're in a Node.js environment (SSG build) or browser
    if (typeof window === 'undefined') {
      // Server-side: import JSON directly
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public', 'data', filename);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      data = JSON.parse(fileContent);
    } else {
      // Client-side: fetch from URL
      const response = await fetch(`/data/${filename}`, { cache: 'no-cache' });
      if (!response.ok) return [];
      data = await response.json();
    }

    if (!Array.isArray(data)) return [];

    return data.map((entry) => ({
      name: entry.repo.name,
      full_name: entry.repo.full_name,
      html_url: entry.repo.html_url,
      homepage: entry.repo.homepage,
      description: entry.repo.description,
      private: entry.repo.private,
      fork: entry.repo.fork,
      archived: entry.repo.archived,
      pushed_at: entry.repo.pushed_at,
      languages: entry.languages,
      primary_language: entry.primary_language,
      screenshots: entry.screenshots,
      readme: entry.readme,
      metadata: entry.metadata,
      has_portfolio: entry.has_portfolio,
      portfolio_files: entry.portfolio_files,
    }));
  } catch (error) {
    console.error(`Error fetching ${filename}:`, error);
    return [];
  }
}

export async function fetchPrivateRepos(): Promise<GitHubRepo[]> {
  return fetchReposFromJson('private_repos.json');
}

export async function fetchFeaturedRepos(): Promise<GitHubRepo[]> {
  return fetchReposFromJson('featured_repos.json');
}

/**
 * Fetches portfolio documentation (architecture.md, stack.md, qa.md) for a project.
 * Portfolio files provide detailed project info for the detail pages.
 */
export async function fetchPortfolioData(repoName: string): Promise<PortfolioData | null> {
  const files = ['architecture.md', 'stack.md', 'qa.md'];
  const portfolio: PortfolioData = {};

  try {
    if (typeof window === 'undefined') {
      // Server-side: read from file system
      const fs = await import('fs');
      const path = await import('path');
      const portfolioDir = path.join(process.cwd(), 'public', 'data', 'portfolio', repoName);

      if (!fs.existsSync(portfolioDir)) return null;

      for (const file of files) {
        const filePath = path.join(portfolioDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const key = file.replace('.md', '') as keyof PortfolioData;
          portfolio[key] = content;
        }
      }
    } else {
      // Client-side: fetch from URL
      for (const file of files) {
        try {
          const response = await fetch(`/data/portfolio/${repoName}/${file}`);
          if (response.ok) {
            const content = await response.text();
            const key = file.replace('.md', '') as keyof PortfolioData;
            portfolio[key] = content;
          }
        } catch {
          // File doesn't exist, skip
        }
      }
    }

    return Object.keys(portfolio).length > 0 ? portfolio : null;
  } catch {
    return null;
  }
}

export async function fetchFeaturedReposWithPortfolio(): Promise<GitHubRepo[]> {
  const repos = await fetchFeaturedRepos();

  // Fetch portfolio data for each repo
  const reposWithPortfolio = await Promise.all(
    repos.map(async (repo) => {
      const portfolio = await fetchPortfolioData(repo.name);
      return {
        ...repo,
        portfolio,
        has_portfolio: !!portfolio,
      };
    })
  );

  return reposWithPortfolio;
}

export async function fetchAllReposWithPortfolio(): Promise<GitHubRepo[]> {
  // Fetch both private and featured repos (which contain portfolio docs)
  const [privateRepos, featuredRepos] = await Promise.all([
    fetchPrivateRepos(),
    fetchFeaturedRepos(),
  ]);

  // Combine and dedupe by full_name
  const repoMap = new Map<string, GitHubRepo>();
  for (const repo of [...privateRepos, ...featuredRepos]) {
    if (!repoMap.has(repo.full_name)) {
      repoMap.set(repo.full_name, repo);
    }
  }

  // Fetch portfolio data for repos that have portfolio files
  const reposWithPortfolio = await Promise.all(
    Array.from(repoMap.values())
      .filter(repo => repo.has_portfolio || repo.portfolio_files?.length)
      .map(async (repo) => {
        const portfolio = await fetchPortfolioData(repo.name);
        return {
          ...repo,
          portfolio,
          has_portfolio: !!portfolio,
        };
      })
  );

  return reposWithPortfolio.filter(repo => repo.has_portfolio);
}

/**
 * Main function to get all repositories for the projects page.
 * Combines public repos (GitHub API) with private repos (JSON).
 * - Deduplicates by full_name, preferring enriched JSON data
 * - Filters out featured repos (shown separately) and hidden repos
 * - Caches results in localStorage for 2 hours
 */
export async function getAllRepos(useCache = true): Promise<GitHubRepo[]> {
  // Check cache first
  if (useCache && typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cached && timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      if (age < CACHE_DURATION) {
        return JSON.parse(cached);
      }
    }
  }

  // Fetch fresh data
  const [publicRepos, privateRepos] = await Promise.all([
    fetchPublicRepos(),
    fetchPrivateRepos(),
  ]);

  // Merge repos, preferring privateRepos (from JSON) over publicRepos (from API)
  // since JSON has enriched metadata like has_portfolio, screenshots, etc.
  const repoMap = new Map<string, GitHubRepo>();

  // Add public repos first
  for (const repo of publicRepos) {
    repoMap.set(repo.full_name, repo);
  }

  // Override with private/enriched repos (these have portfolio data)
  for (const repo of privateRepos) {
    repoMap.set(repo.full_name, repo);
  }

  // Convert to array, filter out featured and hidden repos, and sort by pushed_at descending
  // Featured repos are shown in their own section, so exclude them from "All Repositories"
  const allRepos = Array.from(repoMap.values())
    .filter(repo => repo.metadata?.featured !== true)
    .filter(repo => !HIDDEN_REPOS.includes(repo.name))
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());

  // Cache the results
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CACHE_KEY, JSON.stringify(allRepos));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  }

  return allRepos;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Filters repos to only those marked as featured */
export function getFeaturedRepos(repos: GitHubRepo[]): GitHubRepo[] {
  return repos.filter((repo) => repo.metadata?.featured === true);
}

export function getReposByCategory(repos: GitHubRepo[], category: GitHubRepoMetadata['category']): GitHubRepo[] {
  return repos.filter((repo) => repo.metadata?.category === category);
}

export function getRepoSlug(repo: GitHubRepo): string {
  return repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// ============================================================================
// DISPLAY CONSTANTS
// ============================================================================

/** GitHub-style colors for programming languages */
export const languageColors: Record<string, string> = {
  python: '#3572A5',
  javascript: '#f1e05a',
  typescript: '#3178c6',
  html: '#e34c26',
  css: '#563d7c',
  go: '#00ADD8',
  rust: '#dea584',
  java: '#b07219',
  'c++': '#f34b7d',
  c: '#555555',
  swift: '#F05138',
  shell: '#89e051',
  bash: '#89e051',
  makefile: '#427819',
  ros2: '#22314E',
  opencv: '#5C3EE8',
  pyqt5: '#41CD52',
  glsl: '#5686A5',
};

export function getLanguageColor(language: string): string {
  return languageColors[language.toLowerCase()] || '#6b7280';
}

export const categoryIcons: Record<string, string> = {
  web: 'globe',
  mobile: 'smartphone',
  cli: 'terminal',
  ai: 'brain',
  automation: 'zap',
  other: 'code',
};

export const categoryLabels: Record<string, string> = {
  web: 'Web Application',
  mobile: 'Mobile App',
  cli: 'CLI Tool',
  ai: 'AI / ML',
  automation: 'Automation',
  other: 'Other',
};
