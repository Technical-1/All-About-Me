# Q&A

## What is Happy Preview?

A CLI-to-mobile preview proxy. Send HTML snippets, images, or Markdown from Claude Code to a live Vercel URL, then check them on your phone before pushing to production. One URL, one preview — latest always wins.

## Key Features

- **HTML Preview** — Renders in a sandboxed iframe with full viewport
- **Image Preview** — Base64-encoded PNG, JPG, GIF, SVG, WEBP
- **Markdown Preview** — Server-side conversion with dark theme, GFM tables, code blocks
- **Bearer Token Auth** — API key on the POST endpoint
- **Auto-Cleanup** — 24-hour Redis TTL
- **Claude Code Skill** — Hands-free "send to preview" from the CLI

## Technical Highlights

- **41 tests** covering API validation, auth, storage, markdown conversion, component rendering, and edge cases
- **Security-focused** — iframe sandbox without `allow-same-origin`, 5MB payload limit, runtime type validation
- **Zero-config viewing** — Just open the URL on any device
- **Separated error handling** — JSON parse errors (400) vs Redis failures (500)

## Development Story

Built in a single session with Claude Code using TDD and iterative code review:

1. Scaffolded Next.js 15 project with App Router
2. Implemented API route with auth and validation
3. Built server/client component split for preview display
4. Two parallel code review agents identified 6 issues (security, reliability, validation)
5. All issues addressed: removed dangerous iframe permissions, added payload limits, TTL, runtime validation
6. Deployed to Vercel with Upstash Redis integration
7. Created Claude Code skill for CLI automation

## FAQ

**Why not just use a file sharing service?**
This is optimized for the developer workflow — send from CLI, view on phone, no extra steps. One command, one URL.

**Why single preview instead of a gallery?**
YAGNI. The use case is "check this before I push" — you only need the latest.

**Why base64 instead of file uploads?**
Keeps infrastructure simple — no blob storage, no signed URLs. Redis handles it all with automatic TTL cleanup.

**Why iframe sandbox without `allow-same-origin`?**
Prevents untrusted HTML from accessing the parent page's cookies, storage, or DOM. Scripts can still run for interactive previews, but in complete isolation.

**What's the size limit?**
5MB total payload. Images larger than ~3.7MB raw will exceed this after base64 encoding (~33% overhead).

**Why convert Markdown server-side instead of on the client?**
The viewer already knows how to render HTML in an iframe. Converting on the API side means zero new client dependencies and no changes to the display component — Markdown just becomes styled HTML before storage.
