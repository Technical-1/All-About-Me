# Project Q&A Knowledge Base

## Overview

This is my dynamic GitHub profile README -- the special `Technical-1/Technical-1` repository that GitHub renders as my profile page. Instead of a static markdown file, it features an animated SVG banner that automatically updates every day with my real GitHub statistics (commits, stars, lines of code, repositories, and followers) fetched from the GitHub GraphQL API.

## Key Features

- **Auto-Updating GitHub Stats**: A GitHub Actions workflow runs daily at 4 AM UTC, queries the GitHub GraphQL API for my latest stats, and writes them directly into SVG files that are committed back to the repo.
- **Animated ASCII Art Logo**: A custom ASCII art portrait rendered in SVG with cascading opacity pulse animations, giving the banner a dynamic terminal-aesthetic feel.
- **Dark/Light Theme Support**: Four SVG variants (compact dark, compact light, full dark, full light) automatically switch based on the viewer's GitHub theme via the `<picture>` element's `prefers-color-scheme` media query.
- **Intelligent LOC Caching**: To avoid hitting GitHub's API rate limits, the system caches lines-of-code data per-repository using SHA-256 hashes and only re-queries repos whose commit count has changed.
- **Resilient API Calls**: Exponential backoff retry logic (up to 5 retries with 3s-48s delays) handles GitHub's occasional 502/503/504 gateway errors gracefully.

## Technical Highlights

### SVG as a Dynamic Data Display
GitHub profile READMEs can't run JavaScript or render custom HTML, but they do render SVG images. I use this to my advantage by treating the SVG files as templates -- lxml's etree parser finds elements by their `id` attribute (e.g., `commit_data`, `star_data`, `loc_data`) and overwrites their text content with freshly fetched numbers. The dot-leader justification system (`justify_format`) even adjusts the spacing dots between labels and values so everything stays neatly aligned regardless of how many digits the numbers have.

### Hash-Based Caching Strategy
Counting lines of code requires paginating through every commit in every repository (50 at a time via the GraphQL API). For 80+ repos, this could mean hundreds of API calls. The caching system stores a SHA-256 hash of each repo name alongside its last-known commit count, additions, and deletions. On each run, it compares the current commit count to the cached value -- if they match, it skips the expensive LOC re-count for that repo. This typically reduces a full run from 10+ minutes and hundreds of API calls to under a minute.

### Cascading ASCII Art Animation
The ASCII art logo uses SVG `<animate>` elements with staggered `begin` times (each line starts 0.1s after the previous one) to create a cascading wave effect. The animation smoothly oscillates `fill-opacity` between 0.5 and 1.0 over 3 seconds, giving the impression of a pulsing terminal display.

## Development Story

- **Inspiration**: Adapted from Andrew Grant's (Andrew6rant) dynamic GitHub profile README project
- **Hardest Part**: Getting the LOC caching system to handle edge cases -- empty repos, deleted repos, repos with no default branch, and gateway timeouts mid-pagination all needed special handling
- **Lessons Learned**: GitHub's GraphQL API is powerful but has undocumented rate limits beyond the official ones. Adding delays between paginated requests (750ms) and retry logic with exponential backoff was essential for reliability.
- **Future Plans**: Potentially adding contribution streak tracking, language breakdown stats, or a contribution graph rendered in ASCII art

## Frequently Asked Questions

### How do the stats update automatically?
A GitHub Actions workflow (`.github/workflows/build.yaml`) runs on a daily cron schedule at 4 AM UTC. It checks out the repo, runs `scripts/today.py` which fetches fresh stats from the GitHub GraphQL API, updates the four SVG files, and commits the changes back to `main`. Since this is the profile README repo, any push to `main` immediately updates what visitors see on my GitHub profile.

### Why use SVG instead of a plain markdown README?
SVGs allow styled text, custom fonts (Consolas monospace), CSS-based theming (syntax-highlight-style coloring), and most importantly, animations. None of these are possible in plain markdown. GitHub renders SVGs inline, making them indistinguishable from static images to the viewer.

### How does the dark/light mode switching work?
The README uses HTML's `<picture>` element with a `<source>` tag that has `media="(prefers-color-scheme: dark)"`. GitHub respects this media query, so users with dark mode enabled see `dark_mode_simple.svg` and everyone else sees `light_mode_simple.svg`. Each SVG has appropriate background and text colors.

### How does the LOC cache work?
Each repository is identified by the SHA-256 hash of its `owner/name` string. The cache file stores one line per repo: `hash commit_count my_commits additions deletions`. When the script runs, it compares each repo's current commit count (from a lightweight GraphQL query) against the cached count. Only repos with new commits get the expensive per-commit LOC re-count.

### What happens if the GitHub API goes down during a run?
The script has retry logic for 502, 503, and 504 gateway errors with exponential backoff (3s, 6s, 12s, 24s, 48s). If all 5 retries fail, `force_close_file()` saves whatever partial cache data was collected so the next run can pick up where it left off rather than starting from scratch.

### What's the difference between compact and full layouts?
The compact layout (`compact/`) is 850x255px and shows the ASCII logo (scaled to 50%), contact info, and GitHub stats. The full layout (`full/`) is 1050x515px and additionally lists programming languages, frameworks, platforms, and AI specialties in a neofetch-inspired terminal card format.
