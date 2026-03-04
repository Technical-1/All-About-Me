# Project Q&A Knowledge Base

## Overview

WishList is a Progressive Web App that turns product URLs into organized, shareable wishlists. I paste any product link, the app scrapes the title, image, price, and store info from the page, and displays it as a rich card. I can organize items into multiple wishlists, share them with friends and family via a public link, and gift-givers can mark items as purchased — without me seeing who bought what.

## Key Features

- **Automatic Link Scraping**: Paste a URL and the Cloud Function extracts product metadata using a three-tier strategy (JSON-LD > Open Graph > meta tags)
- **Multiple Wishlists**: Create separate lists for birthdays, holidays, tech gear — each with its own share link
- **Gift Surprise Purchase Tracking**: Shared viewers can mark items as "I'll buy this" but the list owner never sees who is buying what
- **PWA**: Installable on mobile and desktop with service worker caching for offline access

## Technical Highlights

### Three-Tier Scraping Strategy
The scraping Cloud Function doesn't just look at one metadata source. It cascades through JSON-LD structured data (the richest), then Open Graph tags (widely supported), then standard meta tags, and finally falls back to extracting the store name from the URL hostname. This means it works reasonably well on most e-commerce sites, even ones with minimal metadata.

### Firestore Security Rules for Gift Privacy
The trickiest security requirement was letting shared viewers mark items as purchased while hiding that info from the list owner. The Firestore rules use `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isPurchased', 'purchasedBy'])` to restrict shared viewers to only those two fields — they can't modify titles, prices, or anything else.

### Tailwind CSS v4 CSS-Native Configuration
Instead of a JavaScript config file, the entire theme (colors, fonts, animations) is defined using `@theme` in `src/index.css`. This is Tailwind v4's new approach — the theme lives in CSS, not in `tailwind.config.ts`.

## Development Story

- **Hardest Part**: Getting the link scraping to work reliably across different e-commerce sites — every site structures its metadata differently
- **Lessons Learned**: Server-side scraping is essential (CORS blocks client-side fetching), and JSON-LD is by far the best metadata source when available
- **Future Plans**: Better scraping coverage, item notes/comments, drag-and-drop reordering, price drop notifications

## Frequently Asked Questions

### How does the link scraping work?
When you paste a URL, the React app calls a Firebase Cloud Function (`scrapeUrl`) via `httpsCallable`. The function fetches the page HTML with a browser-like User-Agent, then uses Cheerio to parse it. It tries JSON-LD structured data first (common on major retailers), falls back to Open Graph meta tags, then standard meta tags, and extracts the store name from the URL hostname if nothing else is found.

### Why Firebase instead of a custom backend?
Firebase provides auth, database, hosting, and serverless functions in one platform with generous free tiers. For a personal project like this, it eliminates the need to manage servers, set up databases, or build an auth system from scratch.

### How does purchase tracking stay hidden from the list owner?
The shared view shows a "Mark as purchased" button that writes `isPurchased` and `purchasedBy` to the item document. The owner's view of the list simply doesn't display these fields. Firestore security rules ensure shared viewers can only update those two specific fields and nothing else.

### Why TanStack Router instead of React Router?
TanStack Router provides fully type-safe route params and search params out of the box. The file-based routing convention (e.g., `list.$listId.tsx`) generates typed params automatically, eliminating runtime type errors from URL parsing.

### Why is this a PWA?
A wishlist app is something you pull up while browsing on your phone. PWA support means you can install it on your home screen and it loads instantly, even with a spotty connection. The service worker caches the app shell so subsequent visits are near-instant.

### What would I improve?
Better scraping coverage for niche sites, a browser extension for one-click adding, price history tracking, and email notifications when items go on sale. The scraping function could also benefit from a headless browser fallback for JavaScript-rendered pages.
