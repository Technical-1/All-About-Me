#!/usr/bin/env node
/**
 * Fetches GitHub repos (both private and public) and writes JSON snapshots:
 * - featured_repos.json: Curated list of featured projects
 * - private_repos.json: All repos (private + public with portfolio docs)
 * - portfolio/[repo-name]/: Portfolio documentation files for each repo
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');
const PRIVATE_REPOS_PATH = path.join(OUTPUT_DIR, 'private_repos.json');
const FEATURED_REPOS_PATH = path.join(OUTPUT_DIR, 'featured_repos.json');
const PORTFOLIO_DIR = path.join(OUTPUT_DIR, 'portfolio');
const GITHUB_API = 'https://api.github.com';
const TOKEN = process.env.GH_PRIVATE_TOKEN;

// Portfolio files to fetch from each repo's .portfolio/ directory
const PORTFOLIO_FILES = ['architecture.md', 'stack.md', 'qa.md'];

// List of repo names that should be featured
const FEATURED_REPO_NAMES = [
  'AHSR',
  'Git-Archiver-Web',
  'Blackjack-Trainer',
  'BTC-Explorer',
  'Differential-Growth',
  'Private-Collab-Whiteboard'
];

// Manual entries for external repos not in the user's GitHub account
// These are projects like university senior design that live elsewhere
const MANUAL_REPOS = [
  {
    repo: {
      name: 'AHSR',
      full_name: 'UF-Senior-Design/AHSR',
      html_url: '',
      homepage: null,
      description: 'Autonomous Hospital Stretcher Robot - Senior Design Project at University of Florida. A 2-year engineering effort to create a self-navigating hospital stretcher using ROS2, computer vision, and SLAM.',
      private: true,
      fork: false,
      archived: false,
      pushed_at: '2024-12-15T00:00:00Z'
    },
    languages: ['Python', 'C++', 'ROS2'],
    language_bytes: { Python: 50000, 'C++': 30000 },
    primary_language: 'Python',
    metadata: {
      featured: true,
      category: 'ai',
      role: 'Software Lead',
      duration: 'Jan 2023 - Dec 2024',
      highlights: [
        'Led software architecture for autonomous navigation system',
        'Implemented computer vision safety system using OpenCV',
        'Integrated ROS2 navigation stack with custom SLAM algorithms',
        'Coordinated 6-person engineering team across hardware and software'
      ],
      impact: 'Successfully demonstrated autonomous hospital navigation with 95% path completion rate'
    }
  }
];

if (!TOKEN) {
  console.error('Missing GH_PRIVATE_TOKEN env var. Set it in the workflow/repo secrets.');
  process.exit(1);
}

const headers = {
  'Authorization': `token ${TOKEN}`,
  'User-Agent': 'private-repo-sync',
  'Accept': 'application/vnd.github+json'
};

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function fetchFileContent(owner, repo, filePath) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 404) return null; // File doesn't exist
      return null;
    }
    const data = await res.json();
    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf8');
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function fetchPortfolioFiles(repo) {
  const [owner, repoName] = repo.full_name.split('/');
  const portfolioData = {};

  for (const fileName of PORTFOLIO_FILES) {
    const content = await fetchFileContent(owner, repoName, `.portfolio/${fileName}`);
    if (content) {
      portfolioData[fileName] = content;
    }
  }

  return Object.keys(portfolioData).length > 0 ? portfolioData : null;
}

async function savePortfolioFiles(repoName, portfolioData) {
  if (!portfolioData) return;

  const repoDir = path.join(PORTFOLIO_DIR, repoName);
  fs.mkdirSync(repoDir, { recursive: true });

  for (const [fileName, content] of Object.entries(portfolioData)) {
    const filePath = path.join(repoDir, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  console.log(`  Saved portfolio files for ${repoName}`);
}

async function fetchAllRepos(visibility) {
  let page = 1;
  const perPage = 100;
  const repos = [];

  while (true) {
    const url = `${GITHUB_API}/user/repos?visibility=${visibility}&per_page=${perPage}&page=${page}&affiliation=owner`;
    const batch = await fetchJson(url);
    repos.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  // Keep only active, non-fork repos
  return repos.filter(r => !r.fork && !r.archived);
}

async function fetchLanguagesForRepo(repo) {
  try {
    const langData = await fetchJson(repo.languages_url);
    return langData;
  } catch (err) {
    console.error(`Failed to fetch languages for ${repo.full_name}: ${err.message}`);
    return {};
  }
}

function computePrimaryLanguage(langBytes) {
  const entries = Object.entries(langBytes || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

async function processRepo(repo) {
  const langBytes = await fetchLanguagesForRepo(repo);
  const languages = Object.keys(langBytes);
  const primaryLanguage = computePrimaryLanguage(langBytes) || repo.language || null;

  // Fetch portfolio documentation files
  const portfolioData = await fetchPortfolioFiles(repo);
  if (portfolioData) {
    await savePortfolioFiles(repo.name, portfolioData);
  }

  return {
    repo: {
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      homepage: repo.homepage,
      description: repo.description,
      private: repo.private,
      fork: repo.fork,
      archived: repo.archived,
      pushed_at: repo.pushed_at
    },
    languages,
    language_bytes: langBytes,
    primary_language: primaryLanguage,
    has_portfolio: !!portfolioData,
    portfolio_files: portfolioData ? Object.keys(portfolioData) : []
  };
}

async function main() {
  // Fetch both private and public repos
  console.log('Fetching private repos…');
  const privateRepos = await fetchAllRepos('private');
  console.log(`Found ${privateRepos.length} private repos.`);

  console.log('Fetching public repos…');
  const publicRepos = await fetchAllRepos('public');
  console.log(`Found ${publicRepos.length} public repos.`);

  // Combine and deduplicate by name
  const allRepos = [...privateRepos];
  const privateNames = new Set(privateRepos.map(r => r.name));
  for (const repo of publicRepos) {
    if (!privateNames.has(repo.name)) {
      allRepos.push(repo);
    }
  }
  console.log(`Total unique repos: ${allRepos.length}`);

  // Ensure portfolio directory exists
  fs.mkdirSync(PORTFOLIO_DIR, { recursive: true });

  const enriched = [];
  let portfolioCount = 0;

  for (const repo of allRepos) {
    console.log(`Processing ${repo.name}${repo.private ? '' : ' (public)'}...`);
    const processed = await processRepo(repo);
    enriched.push(processed);
    if (processed.has_portfolio) {
      portfolioCount++;
    }
  }

  console.log(`\nFetched portfolio docs from ${portfolioCount} repos.`);

  // Add manual repos (external projects not in user's GitHub)
  for (const manualRepo of MANUAL_REPOS) {
    // Check if portfolio files exist for manual repos
    const portfolioData = {};
    for (const fileName of PORTFOLIO_FILES) {
      const filePath = path.join(PORTFOLIO_DIR, manualRepo.repo.name, fileName);
      if (fs.existsSync(filePath)) {
        portfolioData[fileName] = fs.readFileSync(filePath, 'utf8');
      }
    }

    enriched.push({
      ...manualRepo,
      has_portfolio: Object.keys(portfolioData).length > 0,
      portfolio_files: Object.keys(portfolioData)
    });
    console.log(`Added manual repo: ${manualRepo.repo.name}`);
  }

  // Separate featured repos from all repos
  const featuredRepos = [];

  // Add featured repos in the order specified in FEATURED_REPO_NAMES
  // Also mark them as featured in the enriched list
  for (const featuredName of FEATURED_REPO_NAMES) {
    const repoIndex = enriched.findIndex(r => r.repo.name === featuredName);
    if (repoIndex !== -1) {
      // Mark as featured in the main list
      enriched[repoIndex] = {
        ...enriched[repoIndex],
        metadata: {
          ...enriched[repoIndex].metadata,
          featured: true
        }
      };
      featuredRepos.push(enriched[repoIndex]);
    } else {
      console.warn(`Featured repo "${featuredName}" not found in fetched repos`);
    }
  }

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write all repos (for backward compatibility, keep the filename)
  fs.writeFileSync(PRIVATE_REPOS_PATH, JSON.stringify(enriched, null, 2), 'utf8');
  console.log(`Wrote ${enriched.length} records to ${PRIVATE_REPOS_PATH}`);

  // Write featured repos
  fs.writeFileSync(FEATURED_REPOS_PATH, JSON.stringify(featuredRepos, null, 2), 'utf8');
  console.log(`Wrote ${featuredRepos.length} featured records to ${FEATURED_REPOS_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
