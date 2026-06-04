# Project Q&A

## Overview

Emissary Risk Ops is the website for an Ohio Class A licensed security and investigative services firm in the Cincinnati area. Beyond the usual brochure pages, it ships an interactive crime heatmap that reads the visitor's approximate location from their IP and plots recent reported crimes and police activity nearby, pulled live from city open-data APIs. The interesting engineering is in turning three inconsistent public datasets into one trustworthy map and doing all third-party I/O safely from the server. Built for a client.

## Problem Solved

A security firm's prospects want a quick, concrete sense of crime in their own area — not a national average or a static brochure claim. The site answers that directly with a live, location-aware heatmap, then routes interested visitors into a validated assessment-request flow. For the business, the map is both a credibility signal and a lead magnet.

## Target Users

- **Prospective clients (homeowners, HOAs, businesses)** — See real recent incidents around their address and request a security assessment.
- **The firm** — Gets qualified leads through a spam-resistant intake form and a tool that demonstrates domain seriousness.

## Key Features

### Location-aware crime heatmap
A Leaflet heatmap centered on the visitor's IP-derived location, plotting incidents within roughly ten miles. Where the city publishes it, a toggle switches between reported crimes (last 90 days) and police calls-for-service (last 7 days).

### Multi-city open-data aggregation
Cincinnati, Chicago, and San Francisco are wired in, each via its Socrata SODA API. Three different record shapes are normalized into one heatmap point format, with a graceful "coverage" message for locations outside the supported metros.

### Spam-resistant lead intake
The assessment form validates with Zod on both the client and the server, traps bots with a honeypot, and rate-limits by IP before forwarding anything to the email provider.

### Brand intro that stays out of the way
A digital-camo dissolve animation plays once per session, is capped for large displays, and is skipped entirely for visitors who prefer reduced motion.

## Technical Highlights

### Per-dataset spatial queries instead of citywide scraping
Each SODA dataset returns at most 1000 rows, so fetching 1000 citywide records and filtering to a radius client-side produces a sparse, unrepresentative map. The crime-data route pushes the radius filter into the SoQL query — but not uniformly: Chicago and San Francisco expose a geo column, so they use `within_circle()`; Cincinnati's calls-for-service dataset has numeric coordinate columns, so it uses a cosine-scaled bounding box. One Cincinnati dataset stores coordinates as *text* with no geo column, where a SoQL `between` would compare strings and silently break on negative longitudes — so it deliberately keeps a recency-ordered citywide pull plus the JavaScript radius filter that backs up every dataset. See `src/app/api/crime-data/route.ts`.

### Graceful degradation on every external dependency
Geolocation, crime data, and email delivery all depend on third parties. A `fetchWithTimeout` helper (`src/lib/fetch-with-timeout.ts`) bounds each call so a slow upstream can't hang a serverless request; geolocation falls primary→secondary→default; crime fetchers fall back to an empty layer with an explanatory message; and the contact route returns an honest 503 (with a phone number) in production when the email key is missing rather than silently dropping a lead.

### Strict-Mode-safe Leaflet integration
Leaflet is imperative and React 19 Strict Mode double-invokes effects, a combination that classically throws "map container is already initialized" and leaks instances. `CrimeMap` (`src/components/crime/CrimeMap.tsx`) initializes the map exactly once behind a container guard, then pans and updates markers imperatively, and manages the heat-layer lifecycle so stale points clear even when a layer switch returns nothing.

### Security headers scoped to real resource loads
`next.config.ts` ships an enforcing Content-Security-Policy plus HSTS, `X-Frame-Options: DENY`, and friends. The policy is deliberately tight — `script-src 'self'`, `frame-ancestors 'none'` — and only as loose as the app actually needs (`style-src 'unsafe-inline'` for Tailwind and Leaflet's inline marker style; `img-src`/`connect-src` scoped to OpenStreetMap tiles and the specific data providers).

## Engineering Decisions

### All third-party I/O on the server
- **Constraint**: The site needs IP geolocation, city crime data, and email delivery, plus a secret email key.
- **Options**: Call providers directly from the browser, or proxy through Next.js Route Handlers.
- **Choice**: Proxy everything server-side.
- **Why**: Keeps the email key off the client, centralizes schema normalization, and limits the browser to same-origin requests so the CSP `connect-src` stays narrow.

### Honeypot + in-memory rate limiting instead of a CAPTCHA
- **Constraint**: A public contact endpoint will attract bots and could exhaust the email provider's quota.
- **Options**: Add a third-party CAPTCHA, or use a frictionless honeypot plus per-IP throttling.
- **Choice**: Hidden honeypot field (read outside react-hook-form so the validator can't strip it) plus a fixed-window limiter keyed on the trusted client IP.
- **Why**: Zero added friction or third-party script for legitimate users, and enough to stop naive abuse. The limiter is written behind a store-agnostic interface so it can move to a shared store (e.g. Redis) if a global limit is ever needed.

### IP geolocation with a guaranteed fallback
- **Constraint**: IP geolocation providers fail, rate-limit, and can't resolve private/loopback addresses.
- **Options**: Single provider with an error state, or layered providers with a default.
- **Choice**: Primary provider, secondary provider, then a hardcoded Cincinnati default — and private IPs short-circuit straight to the default.
- **Why**: The map should always render something useful; an unresolved location never becomes a dead page.

## Frequently Asked Questions

### How does the map know where I am?
It reads the approximate location from your IP address on the server (never GPS), via `/api/geolocation`. That's coarse by design — city-level — and the location isn't stored.

### Where does the crime data come from?
Directly from city open-data portals (Socrata/SODA) for Cincinnati, Chicago, and San Francisco. It's public government data and may have reporting delays or gaps; the map says as much in its disclaimers.

### What happens if I'm not in a supported city?
The map falls back to the Cincinnati coverage area and shows a message explaining that direct data isn't available for your region yet — it never errors out.

### Why only those three cities?
Each city requires wiring up its specific dataset and mapping its unique schema. Cincinnati is the firm's home market; Chicago and San Francisco are included to demonstrate the multi-city aggregation pattern.

### Is the contact form safe to use / spam-resistant?
Submissions are validated on the server, screened by a honeypot, and rate-limited by IP before anything is sent. If email delivery isn't configured, the site tells you to call rather than pretending it sent.

### Why does the intro animation only play sometimes?
It plays once per browser session (tracked in `sessionStorage`) and is skipped entirely if your OS is set to "reduce motion." On large displays the number of animated tiles is capped to keep it smooth.

### Can I run it locally without the email key?
Yes. Without `WEB3FORMS_ACCESS_KEY`, the contact API logs submissions in development instead of delivering them, so the rest of the app works normally.
