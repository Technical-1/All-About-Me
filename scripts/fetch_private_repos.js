#!/usr/bin/env node
/**
 * Fetches private GitHub repos using a PAT and writes a JSON snapshot
 * with repo metadata plus language breakdown for use by the site.
 */
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'private_repos.json');
const GITHUB_API = 'https://api.github.com';
const TOKEN = process.env.GH_PRIVATE_TOKEN;

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

async function fetchAllPrivateRepos() {
  let page = 1;
  const perPage = 100;
  const repos = [];

  while (true) {
    const url = `${GITHUB_API}/user/repos?visibility=private&per_page=${perPage}&page=${page}&affiliation=owner`;
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

async function main() {
  console.log('Fetching private repos…');
  const repos = await fetchAllPrivateRepos();
  console.log(`Found ${repos.length} repos (after filtering forks/archived).`);

  const enriched = [];
  for (const repo of repos) {
    const langBytes = await fetchLanguagesForRepo(repo);
    const languages = Object.keys(langBytes);
    const primaryLanguage = computePrimaryLanguage(langBytes) || repo.language || null;

    enriched.push({
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
      primary_language: primaryLanguage
    });
  }

  // Write output JSON
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(enriched, null, 2), 'utf8');
  console.log(`Wrote ${enriched.length} records to ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
