# Project Q&A

## Overview

RestaurantHub is a multi-tenant restaurant website template I built on React and Firebase. A single deployment serves many restaurants — each one maps to a subdomain (`tela.restauranthub.com`), pulls its own settings, menu overrides, translations, reservations, and reviews from Firestore, and renders with its own theme via runtime CSS variables. The first tenant is Tela, a Honduran restaurant in Gainesville, FL.

## Problem Solved

Most restaurant websites are one-off builds: every location gets its own codebase, its own deploy, and its own slow update cycle when the menu changes. RestaurantHub treats a restaurant as data, not code — a new location is a Firestore document and a DNS record, not a fork. Owners get a real back office (menu, reservations, events, reviews, newsletter, QR codes, analytics) without me building bespoke software per restaurant.

## Target Users

- **Restaurant owners** — Manage menu, reservations, events, contact inquiries, reviews, newsletter subscribers, and QR-code campaigns from a single admin panel
- **Restaurant customers** — Browse the menu (with dietary filters and translations), request a reservation, RSVP to events, contact the restaurant, and click through to online ordering
- **Me, when onboarding a new restaurant** — Seed a fresh tenant from a template, pick a theme preset, point a subdomain, ship

## Key Features

### Subdomain-routed multi-tenancy
`src/lib/locationResolver.js` reads the hostname and returns a `locationId`. The provider loads brand defaults plus that location's overrides and merges them. The same React bundle serves every tenant.

### Brand-default + per-location settings merge
Two Firestore documents per tenant: `settings/config` for cross-tenant defaults, `locations/{id}/settings/config` for the tenant's overrides. Merged one level deep so a location can override theme, contact info, or feature flags without copying the full config.

### Runtime theming via CSS variables
Five preset palettes plus custom overrides. `applyTheme()` writes colors to CSS custom properties on `:root`; Tailwind classes reference those variables. Theme changes from the admin panel are instant — no rebuild, no per-tenant bundle.

### Demo mode for previews
Appending `?demo=tela` swaps every Firestore call for in-memory fixtures from `src/data/demoTela.js`. The whole site renders without a Firebase project — useful for screenshots, sales demos, and styling work.

### Admin back office
Protected dashboards for menu, contact inquiries, reservations, events, reviews, newsletter, QR codes, and analytics — all backed by `AuthenticationGuard` on the client and `isActiveAdmin()` / `isAdminForLocation()` in Firestore rules.

### Cloud Function automations
`onContactInquiryCreated` sends transactional email via Resend when a contact form is submitted. `syncGoogleReviews` (scheduled + callable) pulls reviews from the Google Places API for each configured location. Newsletter unsubscribe links use HMAC-signed tokens.

## Technical Highlights

### Subdomain resolver that gracefully degrades
`src/lib/locationResolver.js` validates the subdomain against `^[a-z0-9-]{1,64}$` and falls back to a `?location=` query param on localhost. `www` and bare apex domains return `null`, which renders the cross-tenant landing page instead of crashing. Every Firestore query downstream is keyed off the resolved `locationId`, so the whole multi-tenant story is anchored in one function.

### Settings merge that keeps tenant config minimal
`FirebaseContext` keeps `brandSettings` and `locationSettings` separate, then computes `effectiveSettings` with a one-level-deep merge. Object values (e.g. `branding.theme`, `contact`) merge field-by-field; primitives and arrays replace. The result: a location override only needs to specify the keys that differ from the brand default.

### Menu overrides via lookup-map merge
`mergeMenuWithOverrides` builds a `Map` from the per-location overrides and produces a new menu array where any item with an override is shallow-merged with it. This lets a tenant change price or availability for one base item without forking the whole menu.

### Firestore-driven i18n
On location load, `FirebaseProvider` checks `data.languages.available`, fetches each non-English translation document from `locations/{id}/translations/{lang}`, and registers it with i18next at runtime. New languages do not require a code change — only a Firestore document.

## Engineering Decisions

### Multi-tenant in one codebase vs per-restaurant deploys
- **Constraint**: I wanted to serve multiple restaurants without forking or maintaining N codebases
- **Options**: Per-tenant Git branches, a monorepo with per-tenant configs at build time, or runtime tenant resolution
- **Choice**: Runtime resolution via subdomain → Firestore documents
- **Why**: Adding a tenant is a DNS record plus a Firestore document. No rebuild, no redeploy, no merge conflicts when I touch shared code. The trade-off is one bundle has to be flexible enough for every tenant; the brand+override merge pattern keeps that manageable.

### Firebase vs a custom Node/Postgres backend
- **Constraint**: One developer, multiple tenants, real-time-ish admin tools, and a need for transactional email and scheduled reviews sync
- **Options**: Express on Render with Postgres + Stripe-style migrations; Supabase; Firebase
- **Choice**: Firebase
- **Why**: Auth, Firestore, Functions, Storage, and Analytics in one project. Functions v2 has the trigger primitives I need (`onDocumentCreated`, `onSchedule`, `onCall`). Free tier comfortably covers low-volume restaurant sites. Trade-off: query model is more rigid than SQL, so per-location filtering is enforced by structure (subcollections) rather than joins.

### Runtime CSS variables vs Tailwind theme rebuilds
- **Constraint**: Each tenant needs its own brand colors but I want one shared CSS bundle
- **Options**: Build Tailwind per tenant, inline a `<style>` per tenant, or use CSS custom properties referenced from Tailwind utilities
- **Choice**: CSS custom properties + `applyTheme()`
- **Why**: Switching themes is instant from the admin panel, the CSS bundle stays small, and Tailwind utilities work normally. Cost is that arbitrary value composition (e.g., `text-[var(--primary)]/50`) needs care, but the preset palette covers 95% of the use cases.

### Firestore rules as the security boundary
- **Constraint**: Public pages need to read menus and settings; admin operations must be locked down, and admins can be scoped to a single location
- **Options**: Trust the client + `AuthenticationGuard`, route everything through Cloud Functions with a custom auth layer, or push authorization into Firestore rules
- **Choice**: Firestore rules with `isActiveAdmin()` and `isAdminForLocation()` helpers
- **Why**: Authorization is enforced at the database, not the client. The guard component is UX only. Per-location scoping is a single field on `adminUsers`, which keeps rule expressions readable.

## Frequently Asked Questions

### How does a new restaurant get added?
Three steps: create a `locations/{id}` document with settings and overrides, point a subdomain at the deployment (Firebase Hosting or Vercel), and create an `adminUsers` entry granting that location to the restaurant owner. No code change required.

### How does the subdomain resolver work on localhost?
`locationResolver.js` checks the hostname. On `localhost` or `127.0.0.1`, it falls back to the `?location=` query parameter so I can preview any tenant locally (`localhost:4028?location=tela`). On a production hostname with at least three labels, it returns the first label after stripping `www`.

### Can a location override individual menu items without copying the whole menu?
Yes — that is the point of the override merge. `menuItems` holds the base catalog; `locations/{id}/menuItemOverrides` holds per-location patches keyed by item id. `mergeMenuWithOverrides` shallow-merges only the items that have an override, so a tenant can change one price or hide one item without duplicating the rest.

### How do translations work?
Default English strings ship in `src/data/translations/en.json`. Per-location translations live as documents at `locations/{id}/translations/{lang}` (e.g. `es`). On location load, the provider reads `settings.languages.available` and registers each non-English translation document with i18next.

### How are contact form emails actually sent?
The browser writes a document to `contactInquiries`. A v2 Firestore trigger (`onContactInquiryCreated` in `functions/index.js`) fires server-side, reads the restaurant name and recipient from `settings/config`, formats an HTML email, and sends it via Resend. Success or failure is written back onto the inquiry document.

### Where do the Google reviews come from?
A location stores a `googlePlacesId` in `settings.features`. A scheduled Cloud Function calls the Google Places API for each configured location and writes the reviews into Firestore. Admins can also trigger an ad-hoc sync from the Reviews Management dashboard via a callable function.

### Why a separate "Demo mode" with in-memory data?
Demo mode (`?demo=tela`) lets the site render without any Firebase project — useful for screenshots, share links, and styling work. `useDemoMode` switches the data source from Firestore to fixtures in `src/data/demoTela.js`. The visible UI is identical.

### Is the online ordering custom-built?
No — the "Order Now" button links out to Toast Tab, the restaurant's existing POS-integrated ordering page. Building custom ordering would duplicate POS, payments, and kitchen workflow integration that Toast already solves.

### How is admin access scoped per location?
`adminUsers/{uid}` has a `role` (`super` or `admin`) and a `locationIds` array. Firestore rules use `isAdminForLocation(locationId)` for per-location collections — super admins pass everywhere, regular admins only pass if the location id is in their array.
