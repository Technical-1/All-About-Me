# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | Python | 3.12 | Main scripting language for data fetching, caching, and SVG manipulation |
| API | GitHub GraphQL v4 | - | Query GitHub for stats (commits, stars, repos, LOC, followers) |
| CI/CD | GitHub Actions | v4 | Automated daily pipeline with cron scheduling |
| Markup | SVG (XML) | 1.1 | Dynamic profile banners with animations |

## Infrastructure

- **Hosting**: GitHub (repository doubles as the deployment target -- pushing SVGs to `main` updates the live profile)
- **CI/CD**: GitHub Actions with daily cron (`0 4 * * *`), push trigger, and manual dispatch
- **Caching**: File-based SHA-256 hash cache stored in `cache/` directory, committed to the repo
- **Secrets Management**: GitHub Actions secrets for `ACCESS_TOKEN` and `USER_NAME`

## Development Tools

- **Package Manager**: pip
- **Python Version**: 3.12 (set via `actions/setup-python@v5`)
- **CI Cache**: `actions/cache@v4` for pip dependencies

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `requests` | HTTP client for GitHub GraphQL API calls |
| `python-dateutil` | Date math for calculating time since birthday/account creation |
| `lxml` | XML/SVG parsing and manipulation via etree |
| `Pillow` | Image processing for the ASCII art generator script (image to grayscale, resize, pixel mapping) |

## SVG Rendering Stack

- **Font**: Consolas with `ConsolasFallback` custom `@font-face`
- **Theming**: CSS classes (`.key`, `.value`, `.addColor`, `.delColor`, `.cc`) for syntax-highlight-style coloring
- **Animation**: SVG `<animate>` elements with staggered `begin` times for cascading pulse effect
- **Layout**: Two variants per theme -- `compact/` (850x255px) and `full/` (1050x515px)
