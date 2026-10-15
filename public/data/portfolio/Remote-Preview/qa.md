# Project Q&A

## Overview

Happy Preview is a CLI-to-mobile preview proxy. A developer sends HTML, an image, or a Markdown file from their terminal (via a Claude Code skill or plain `curl`) and a single Vercel URL on their phone shows the latest result. The interesting bit is how aggressively simple it is: one Redis key, one HTML page, one POST endpoint, sandboxed iframe rendering, and a 24-hour TTL so nothing accumulates.

## Problem Solved

Generating something on a laptop and wanting to see it on a real phone is a fiddly round-trip — push to a branch, open a preview URL, refresh, or worse, AirDrop the file and open it in Safari. Happy Preview collapses that loop into one command: send from CLI, refresh phone, done. It's specifically tuned for the moment between "I just produced this artifact" and "I want to see it on the device it'll actually be viewed on."

## Target Users

- **Developers using Claude Code** — A bundled skill file (`skill/SKILL.md`) maps "send to preview" / "preview this" to the right `curl` shape, so the tool can preview artifacts it just generated.
- **Anyone with a CLI and an API key** — The endpoint is plain JSON over HTTPS with a bearer token; the skill is a convenience, not a requirement.

## Key Features

### HTML preview
Posted HTML renders in a sandboxed iframe (`allow-scripts` only — no same-origin) with a viewport meta tag, so it behaves exactly like it would on a real mobile page.

### Image preview
Base64-encoded PNG / JPG / GIF / SVG / WEBP show as a centered `<img>`. The mime type rides along in the payload so SVGs and animated GIFs render correctly.

### Markdown preview
Markdown payloads are converted server-side with `marked`, sanitized with `sanitize-html`, and stored as a self-contained HTML document (dark theme, GFM tables, fenced code, task lists). The viewer doesn't need to know anything about Markdown.

### Bearer-token auth and a hard payload cap
A single `PREVIEW_API_KEY` env var gates the POST endpoint, and `content-length > 5MB` is rejected before the body is even read.

### 24-hour TTL — no admin surface
Redis evicts the key automatically; there's no delete endpoint, no admin page, no cleanup cron.

## Technical Highlights

### Server-side Markdown sanitization, not client-side rendering
`src/lib/markdown.ts` runs `marked` → `sanitize-html` and wraps the result in a self-contained `<!DOCTYPE html>` document with inline CSS. The viewer (`PreviewDisplay.tsx`) never needs a Markdown library — it always receives HTML, so the client renderer has one code path. This trades a small amount of CPU on the POST path for a much simpler client bundle and a single sandboxed-iframe render path.

### iframe sandbox tuned for "preview untrusted HTML on my own page"
`PreviewDisplay.tsx` sets `sandbox="allow-scripts"` and deliberately omits `allow-same-origin`. Scripts in the previewed HTML run (so interactive demos work) but cannot reach the parent page's cookies, storage, or DOM. Combined with the `content-length` check in `route.ts`, this keeps the attack surface tight without losing the "real mobile render" experience.

### Single-key Redis schema
`src/lib/redis.ts` exports one constant — `KV_KEY = "current-preview"` — and that's the entire data model. `route.ts` does `redis.set(KV_KEY, preview, { ex: 86400 })`; `page.tsx` does `redis.get<PreviewData>(KV_KEY)`. No IDs, no lists, no migration story. The 24-hour TTL is the entire lifecycle policy.

### `force-dynamic` server component instead of an API fetch
`src/app/page.tsx` is a server component with `export const dynamic = "force-dynamic"` that reads Redis directly and passes the payload as props. There's no client-side loading state and no second round-trip after the HTML lands — the phone gets the preview as part of the initial response.

## Engineering Decisions

### One preview vs. preview history
- **Constraint**: The workflow is "I just produced X, look at it on the phone." Old previews are noise, not value.
- **Options**: Multi-key with IDs and a list page; single key with overwrite semantics.
- **Choice**: Single key (`current-preview`), latest write wins.
- **Why**: Zero schema, zero UI for listing, automatic eviction via TTL. The "feature" of multi-preview history would create more work to ignore than to build.

### Bearer token vs. OAuth/session auth
- **Constraint**: Single developer, single CLI, single deployment.
- **Options**: Vercel-managed auth, a session cookie, a short-lived JWT, or a static bearer token.
- **Choice**: Static bearer token compared literally against `PREVIEW_API_KEY`.
- **Why**: The auth check is two lines (`authHeader !== \`Bearer ${apiKey}\``) and there's no rotation surface to manage. The key lives in `~/.zshrc` next to the URL.

### Base64 in Redis vs. blob storage with signed URLs
- **Constraint**: The CLI needs to push images without provisioning a second service.
- **Options**: Vercel Blob with signed PUT URLs; S3-compatible storage; raw base64 strings in Redis.
- **Choice**: Base64 in Redis, with a 5MB total payload cap.
- **Why**: One service, one auth model, one TTL. The cap covers screenshots and OG image previews, which are the real workloads.

### Server-side Markdown conversion vs. client-side
- **Constraint**: Markdown support was added after the viewer was built around "render whatever's in the key."
- **Options**: Ship a Markdown renderer in the client bundle; convert on the POST path and store HTML.
- **Choice**: Convert in `route.ts` and store the resulting HTML.
- **Why**: The viewer stays a one-branch render (HTML iframe or image). Adding `marked` to the client would have bloated the bundle for a feature only some payloads use.

## Frequently Asked Questions

### How do I send something from my own scripts (no skill)?
`curl -X POST $HAPPY_PREVIEW_URL/api/preview -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"type":"html","content":"<h1>hi</h1>"}'`. The skill is a convenience wrapper around exactly that shape.

### Why is the iframe sandbox so restrictive?
`allow-scripts` without `allow-same-origin` means scripts in the preview can't read cookies, `localStorage`, or the parent DOM of `happy-preview.vercel.app`. Interactive demos still work; XSS against the parent doesn't.

### What happens to old previews?
Nothing — Redis evicts them after 24 hours. Every new POST overwrites `current-preview`, so the "newest wins" semantics fall out of using a single key.

### Why 5MB?
That's the `content-length` cap in `route.ts`. Base64 adds ~33% overhead, so the practical ceiling for raw image bytes is roughly 3.7MB — comfortably above screenshots and OG image previews, well below anything that would stress the free tier.

### How does Markdown styling work?
`src/lib/markdown.ts` wraps the sanitized HTML in a full `<!DOCTYPE html>` document with an inline `<style>` block. That document is what gets stored in Redis and what the iframe renders, so the viewer never needs to know it was Markdown.

### Can two people use the same deployment?
Technically yes, but they'd race for the single key. The design assumes one developer per deployment — spin up a second Vercel project (free) if you need isolation.

### Why Next.js for something this small?
The server component + API route split makes `force-dynamic` server-side Redis reads trivial — no client loading state, no separate framework for the POST endpoint, and the Vercel KV integration ships configured.
