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

## Development Story

- **Hardest Part**: Getting the link scraping to work reliably across different e-commerce sites — every site structures its metadata differently, and some render entirely client-side, which led to adding the Puppeteer fallback
- **Lessons Learned**: Server-side scraping is essential (CORS blocks client-side fetching), JSON-LD is by far the best metadata source when available, and retries with backoff are critical for flaky product sites
- **Future Plans**: Browser extension for one-click adding, price history tracking, drag-and-drop reordering, email notifications for price drops

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

### What would I improve?
A browser extension for one-click adding from any product page, price history charts with drop alerts, collaborative lists where multiple people can add items, and drag-and-drop reordering for priority management.
