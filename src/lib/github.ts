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
}

const CACHE_KEY = 'github_repos_cache';
const CACHE_TIMESTAMP_KEY = 'github_repos_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchPublicRepos(): Promise<GitHubRepo[]> {
  const response = await fetch(
    'https://api.github.com/users/Technical-1/repos?per_page=100&sort=pushed'
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const repos = await response.json();

  const reposWithLanguages: GitHubRepo[] = await Promise.all(
    repos
      .filter((repo: any) => !repo.fork && !repo.archived)
      .map(async (repo: any) => {
        let languages: string[] = [];
        try {
          const langResponse = await fetch(repo.languages_url);
          if (langResponse.ok) {
            const langData = await langResponse.json();
            languages = Object.keys(langData);
          }
        } catch {
          // Ignore language fetch errors
        }

        return {
          name: repo.name,
          full_name: repo.full_name,
          html_url: repo.html_url,
          homepage: repo.homepage,
          description: repo.description,
          private: repo.private,
          fork: repo.fork,
          archived: repo.archived,
          pushed_at: repo.pushed_at,
          languages,
          primary_language: repo.language,
        };
      })
  );

  return reposWithLanguages;
}

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
      private: true,
      fork: entry.repo.fork,
      archived: entry.repo.archived,
      pushed_at: entry.repo.pushed_at,
      languages: entry.languages,
      primary_language: entry.primary_language,
      screenshots: entry.screenshots,
      readme: entry.readme,
      metadata: entry.metadata,
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

  // Combine and sort by pushed_at descending
  const allRepos = [...publicRepos, ...privateRepos].sort(
    (a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
  );

  // Cache the results
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CACHE_KEY, JSON.stringify(allRepos));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  }

  return allRepos;
}

export function getFeaturedRepos(repos: GitHubRepo[]): GitHubRepo[] {
  return repos.filter((repo) => repo.metadata?.featured === true);
}

export function getReposByCategory(repos: GitHubRepo[], category: GitHubRepoMetadata['category']): GitHubRepo[] {
  return repos.filter((repo) => repo.metadata?.category === category);
}

export function getRepoSlug(repo: GitHubRepo): string {
  return repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

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
