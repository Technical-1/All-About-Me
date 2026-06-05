#!/usr/bin/env node
// One-off: stamp metadata.category onto the existing data files using the same
// source-of-truth map the nightly sync uses. Lets the projects page render
// categories locally without GH_PRIVATE_TOKEN. Safe to re-run (idempotent).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryFor } from './repo-categories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'public', 'data');

for (const file of ['private_repos.json', 'featured_repos.json']) {
  const p = path.join(DATA, file);
  const entries = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const e of entries) {
    e.metadata = { ...(e.metadata || {}), category: categoryFor(e.repo.name) };
  }
  fs.writeFileSync(p, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`Stamped ${entries.length} entries in ${file}`);
}
