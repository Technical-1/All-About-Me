# Project Q&A Knowledge Base

## Overview

GimmeThat is a Progressive Web App that turns product URLs into organized, shareable wishlists. I paste any product link, the app scrapes the title, image, price, and store info from the page, and displays it as a rich card. I can also add items manually without a URL. Items are organized into multiple wishlists, shared with friends and family via a public link, and gift-givers can claim items — with optional anonymity and notes — while I get notified via push notifications.

## Key Features

- **Automatic Link Scraping**: Paste a URL and the Cloud Function extracts product metadata using a multi-tier strategy (JSON-LD > Open Graph > Twitter cards > meta tags > CSS selectors), with a Puppeteer headless browser fallback for JS-rendered pages
- **Manual Item Entry**: Add items without a URL — just enter the title, price, store, and notes
- **Multiple Wishlists**: Create separate lists for birthdays, holidays, tech gear — each with its own share link and inline renaming
- **Gift Claiming with Notes**: Shared viewers can claim items with optional anonymity and personalized notes, with claim details visible to the list owner
- **Push Notifications**: FCM-powered web push alerts when someone claims an item, with automatic stale token cleanup and iOS PWA install guidance
- **5-Star Priority Rating**: Rate items from 1 to 5 stars with an interactive StarRating component
- **Item Refresh**: Re-scrape individual items or bulk refresh all items to get updated prices and availability
- **Dashboard Overview**: Horizontal mini-card scroll per list with expand/collapse to full card grid
- **PWA**: Installable on mobile and desktop with service worker caching for offline access

## Technical Highlights

### Multi-Tier Scraping with Browser Fallback
The scraping Cloud Function cascades through JSON-LD structured data (the richest), then Open Graph tags, Twitter cards, standard meta tags, CSS price selectors (common e-commerce patterns like `.price`, `[data-price]`), and finally the URL hostname for store name. If Cheerio fails to extract a title, the function falls back to Puppeteer — launching headless Chrome to render the page fully before re-parsing with Cheerio. Fetch requests use retries with exponential backoff and specific HTTP status handling (403, 404, 429, 5xx).

### Firestore Security Rules for Gift Privacy
The trickiest security requirement was letting shared viewers mark items as purchased while hiding that info from the list owner. The Firestore rules use `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isPurchased', 'purchasedBy', ...])` to restrict shared viewers to only claim-related fields — they can't modify titles, prices, or anything else.

### FCM Push Notification Pipeline
When an item is claimed, a Firestore `onDocumentUpdated` trigger detects the `isPurchased` flip from false to true. It looks up the list owner's FCM tokens from the `users` collection and sends a web push. Stale tokens (unregistered devices) are automatically pruned from the array. The client-side `NotificationPrompt` handles the full flow: permission check, iOS detection (prompts to install PWA first since iOS Safari can't do push), token retrieval via Firebase Installations + Messaging, and 7-day dismiss-and-re-prompt logic.

### Dashboard Horizontal Scroll Pattern
The dashboard shows each list as a card section with items rendered as compact `ItemMiniCard` components in a horizontal scroll strip using CSS snap scrolling. Clicking "View all" expands to a full responsive grid of `WishCard` components with all actions (delete, refresh, priority, unclaim). This gives a scannable overview by default while preserving full functionality on expand.

### Tailwind CSS v4 CSS-Native Configuration
Instead of a JavaScript config file, the entire theme (colors, fonts, animations) is defined using `@theme` in `src/index.css`. This is Tailwind v4's new approach — the theme lives in CSS, not in `tailwind.config.ts`.

## Engineering Decisions

### Server-side scraping with Puppeteer fallback
- **Constraint**: Product pages span static HTML, JS-rendered SPAs, and aggressive bot protection — and the browser can't fetch arbitrary domains due to CORS
- **Options**: Client-side scraping (blocked by CORS), a paid scraping API (cost + lock-in), or a self-hosted Cloud Function with cascading parsers
- **Choice**: A Cloud Function that tries Cheerio first (JSON-LD → OG → Twitter → meta → CSS price selectors → hostname), then falls back to Puppeteer headless Chrome only when Cheerio can't pull a title
- **Why**: Cheerio handles ~90% of pages in <500ms with minimal cold-start cost; Puppeteer's slow startup is only paid for the JS-rendered minority. Fetches use retries with exponential backoff and specific handling for 403/404/429/5xx so flaky retailer sites don't break the UX

### Items as a Firestore subcollection
- **Constraint**: Items always belong to exactly one wishlist; the security rules need to keep shared viewers out of items they shouldn't see
- **Options**: Top-level `items` collection with a `wishlistId` field, or a `wishlists/{id}/items` subcollection
- **Choice**: Subcollection
- **Why**: Security rules can inherit the parent's `isPublic` and ownership state in one match block, queries are naturally scoped, and bulk operations like `refreshAllItems` iterate parents then children without extra indexes

### Field-level Firestore rules for the gift surprise
- **Constraint**: Shared viewers must be able to mark an item as claimed without being able to edit titles, prices, or anyone else's claim
- **Options**: Trust the client, route all writes through a Cloud Function, or use field-level diff rules
- **Choice**: Firestore rules using `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` to limit shared writes to claim fields only
- **Why**: Keeps the write path direct (no extra function hop, no cold start), enforces invariants at the data layer where they can't be bypassed by a malicious client, and avoids the cost of a callable function for what is otherwise a single document write

### Tailwind v4 CSS-native theme
- **Constraint**: Wanted a single source of truth for design tokens (fonts, colors, animations) without a JS config that drifts from CSS
- **Options**: Classic `tailwind.config.ts`, CSS variables alongside a JS config, or Tailwind v4's `@theme` block
- **Choice**: Tailwind v4 with the entire theme defined via `@theme` in `src/index.css`
- **Why**: One file owns the design system, tokens are available as CSS variables for non-Tailwind contexts, and there's no build-time JS layer to debug when a token isn't applying

## Frequently Asked Questions

### How does the link scraping work?
When you paste a URL, the React app calls a Firebase Cloud Function (`scrapeUrl`) via `httpsCallable`. The function fetches the page HTML with browser-like headers, retrying up to 3 times with exponential backoff on failures. It then uses Cheerio to parse the HTML, trying JSON-LD structured data first, then Open Graph tags, Twitter cards, standard meta tags, and CSS selectors for prices. If no title is found, it falls back to Puppeteer — launching headless Chrome to render JS-heavy pages before re-parsing. The store name is extracted from the URL hostname as a final fallback.

### Why Firebase instead of a custom backend?
Firebase provides auth, database, hosting, serverless functions, and push messaging in one platform with generous free tiers. For a personal project like this, it eliminates the need to manage servers, set up databases, or build an auth system from scratch.

### How do push notifications work?
When you enable notifications, the app requests browser permission, obtains an FCM token via Firebase Messaging, and stores it in your Firestore `users` document. When someone claims an item from your list, a Firestore trigger (`onItemClaimed`) fires server-side, reads your FCM tokens, and sends a web push notification. On iOS, the app detects Safari and guides you to install the PWA first (iOS requires PWA context for push).

### How does claiming work for gift-givers?
On the shared view, clicking "I'll get this" opens a dialog where you can optionally stay anonymous and add a note (e.g., "Getting the blue one!"). The claim writes your identity, anonymity preference, and note to the item. The list owner sees claim details — your name and photo (or "Anonymous gift") plus your note — but this information is intentionally hidden from the owner's default view to preserve the surprise.

### Why TanStack Router instead of React Router?
TanStack Router provides fully type-safe route params and search params out of the box. The file-based routing convention (e.g., `list.$listId.tsx`) generates typed params automatically, eliminating runtime type errors from URL parsing.

### Why is this a PWA?
A wishlist app is something you pull up while browsing on your phone. PWA support means you can install it on your home screen and it loads instantly, even with a spotty connection. The service worker caches the app shell so subsequent visits are near-instant. On iOS, PWA installation is also required for push notification support.

### How does item refresh work?
Individual items can be re-scraped by clicking the refresh button on a WishCard. The `useRefreshItem` hook calls the same `scrapeUrl` Cloud Function and writes only the fields that changed via `updateItemMetadata`. There's also a `refreshAllItems` Cloud Function that processes all items across a user's wishlists in batches of 10 to avoid overwhelming external sites.

### Why does the shared view hide claim details from the list owner by default?
The whole point of a wishlist is the surprise. The owner can see *that* an item is claimed (so it doesn't get bought twice), but the claimer's identity, anonymity flag, and note live in fields the owner's default view doesn't surface — they're available, just not in the face of someone who'd rather not know who's getting what.

### How does the app deal with retailer sites that block scrapers?
The Cloud Function sets a browser-like User-Agent and retries up to 3 times with exponential backoff. Specific status codes are handled distinctly: 429 (rate limit) backs off longer, 403 retries with the Puppeteer fallback in case the block is JS-based, and 404 fails fast without retrying. If everything fails, the user can still add the item manually with whatever info they have.
