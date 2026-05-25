# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | Python | 3.12 | Data fetching, caching, SVG generation, HTML→PNG pipeline |
| API | GitHub GraphQL v4 | — | All user/repo/contribution queries |
| CI/CD | GitHub Actions | Node.js 24 majors | Daily cron + push + manual dispatch |
| Markup | SVG (XML) | 1.1 | Animated profile widgets with theme support |
| Rendering | Playwright + Chromium | 1.x | OG preview PNG snapshot from HTML |

## Infrastructure

- **Hosting**: GitHub (the repo IS the deployment target — pushing to `main` updates the live profile)
- **CI/CD**: GitHub Actions, daily cron (`0 4 * * *` UTC), push trigger on `main`, `workflow_dispatch` for manual runs
- **Action versions** (bumped May 2026 ahead of the June 2 Node 24 cutoff):
  - `actions/checkout@v6`
  - `actions/setup-python@v6`
  - `actions/cache@v5`
- **Caching**: File-based, SHA-256-hash keyed caches under `cache/`, committed to the repo:
  - `<hash>.txt` — per-repo LOC (commit count, my_commits, additions, deletions)
  - `<hash>_langs.txt` — top-10 languages sidecar (rank, name, hex color, additions)
  - `<hash>_commits.txt` — 12-month contributions sidecar (yyyy_mm, count)
- **Secrets**: GitHub Actions secrets for `ACCESS_TOKEN` (fine-grained PAT) and `USER_NAME`

## Development Tools

- **Package Manager**: pip
- **Python Version**: 3.12 (set via `actions/setup-python@v6`)
- **CI Cache**: `actions/cache@v5` for pip dependencies, keyed by `cache/requirements.txt` hash

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `requests` | HTTP client for GitHub GraphQL API calls |
| `python-dateutil` | Calendar math for monthly contribution windows and age-since-birthday |
| `lxml` | XML/SVG parsing and `etree`-based stats-widget updates |
| `Pillow` | Image processing for the ASCII art generator script |
| `playwright` | Headless Chromium for rendering `og-preview.html` to `.portfolio/preview.png` |

## SVG Rendering Stack

- **Font**: Consolas with custom `ConsolasFallback` `@font-face` declaration
- **Theming**: CSS classes (`.key`, `.value`, `.addColor`, `.delColor`, `.cc`) with mode-specific fill colors swapped at render time
- **Animation**: SVG `<animate>` elements with staggered `begin` times for the ASCII-art cascading pulse
- **Layouts**:
  - `full/` — 1050×515px, neofetch-inspired full card with language/framework/tool lists
  - `compact/*_simple.svg` — 850×255px, ASCII logo + contact + GitHub stats
  - `compact/*_languages.svg` — 850×255px split layout: 12-month contributions sparkline (left) + top-10 languages by LOC (right)
- **Language colors**: Bars in the languages widget use GitHub's official `primaryLanguage.color` per language (Python `#3572A5`, Go `#00ADD8`, etc.). Other bucket uses mode-appropriate `.cc` gray.
- **Cache-busting**: README references include a `?v=N` query string so browsers and GitHub's image proxy pick up new SVG content immediately after a layout change.
