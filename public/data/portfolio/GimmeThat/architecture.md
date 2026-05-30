# Architecture Overview

## System Diagram

```mermaid
flowchart TD
    subgraph Client["Frontend (React SPA)"]
        Router["TanStack Router<br/>File-based routes"]
        Query["TanStack Query<br/>Server state cache"]
        Realtime["Realtime Layer<br/>onSnapshot listeners"]
        Auth["AuthProvider<br/>Firebase Auth context"]
        UI["UI Components<br/>WishCard, Modals, Dialogs"]
        Notif["Notification Layer<br/>FCM token + prompt"]
    end

    subgraph Firebase["Firebase Backend"]
        FAuth["Firebase Auth<br/>Google sign-in"]
        Firestore["Cloud Firestore<br/>wishlists + items + users"]
        Functions["Cloud Functions v2<br/>scrapeUrl, refreshAllItems"]
        Triggers["Firestore Triggers<br/>onItemClaimed"]
        FCM["Cloud Messaging<br/>Push notifications"]
    end

    subgraph External["External"]
        Google["Google OAuth"]
        ProductSites["Product Websites"]
        Puppeteer["Headless Chrome<br/>(Puppeteer fallback)"]
    end

    Router --> Query
    Router --> Auth
    Router --> UI
    Auth --> FAuth
    FAuth --> Google
    Query --> Firestore
    Realtime --> |"live updates"| Firestore
    UI --> Query
    UI --> Realtime
    Notif --> FCM
    Functions --> ProductSites
    Functions --> Puppeteer
    Query --> Functions
    Triggers --> FCM
    Firestore --> |"Security Rules"| Firestore
```

## Component Descriptions

### TanStack Router (File-based Routes)
- **Purpose**: Client-side routing with type-safe params
- **Location**: `src/routes/`
- **Key responsibilities**: Page rendering, route guards via AuthGuard, URL param extraction ($listId, $shareSlug)

### TanStack Query (Server State)
- **Purpose**: Async data fetching, caching, and mutation with automatic invalidation
- **Location**: `src/hooks/`
- **Key responsibilities**: One-shot Firestore reads via query hooks (e.g. bounded dashboard reads), write operations via mutations, cache invalidation on create/update/delete

### Realtime Layer
- **Purpose**: Keep open list views in sync as items are claimed or edited from other devices
- **Location**: `subscribeToWishlistItems` in `src/lib/firestore.ts`, consumed by `useLiveWishlistItems` in `src/hooks/useWishlistItems.ts`
- **Key responsibilities**: Open a Firestore `onSnapshot` listener scoped to a wishlist's `items` subcollection, validate each document, push the array into React state, and unsubscribe on unmount — so a claim made on the shared view appears on the owner's list without a refresh

### Affiliate Link Helper
- **Purpose**: Monetize outbound product links without polluting stored data
- **Location**: `src/lib/affiliate.ts`
- **Key responsibilities**: At render time, append the Amazon Associates tag to `amazon.com` URLs only (other hosts pass through unchanged); stored item URLs stay canonical so re-scrapes and URL validation always run against the untagged URL, and the tag lives in exactly one place

### AuthProvider
- **Purpose**: Wraps the app in Firebase Auth context, exposes user state and signInWithGoogle
- **Location**: `src/lib/auth.tsx`
- **Key responsibilities**: `onAuthStateChanged` listener, Google popup sign-in with error handling, user object distribution via React context

### Firestore CRUD Helpers
- **Purpose**: Thin abstraction over Firestore SDK calls
- **Location**: `src/lib/firestore.ts`
- **Key responsibilities**: 11 functions — createWishlist, getUserWishlists, getWishlistBySlug, updateWishlist, deleteWishlist, addItemToWishlist, addManualItemToWishlist, getWishlistItems, updateItemMetadata, updateItem, deleteItem

### Cloud Functions
- **Purpose**: Server-side operations that can't run in the browser
- **Location**: `functions/src/`
- **Key functions**:
  - `scrapeUrl` — URL validation, fetch with retries + exponential backoff, HTML parsing via Cheerio, Puppeteer headless browser fallback for JS-rendered pages
  - `refreshAllItems` — Bulk re-scrape all items across a user's wishlists, batched in groups of 10
  - `onItemClaimed` — Firestore trigger that sends push notifications when an item is claimed

### Notification Layer
- **Purpose**: FCM push notification setup and token management
- **Location**: `src/lib/notifications.ts` + `src/components/NotificationPrompt.tsx`
- **Key responsibilities**: Request permission, obtain FCM token, store tokens in Firestore `users` collection, handle foreground messages, iOS PWA install guidance

### UI Components
- **Purpose**: Reusable presentation components
- **Location**: `src/components/`
- **Key components**: WishCard (full product card), ItemMiniCard (compact horizontal scroll card), ItemDetailModal (full detail view on click), AddItemModal (URL input + manual entry + scrape preview), ClaimItemDialog (claim with anonymity + notes), StarRating (5-star priority), ShareDialog (public toggle + copy link), NotificationPrompt (push opt-in), CreateListDialog, Navbar, EmptyState, AuthGuard

## Data Flow

### Adding an Item (URL)
1. User pastes a product URL into AddItemModal
2. `useScrapeUrl` mutation calls the `scrapeUrl` Cloud Function via `httpsCallable`
3. Cloud Function fetches the page HTML with retries + exponential backoff
4. Cheerio parses HTML (JSON-LD > OG > meta > CSS selectors > URL fallback); if no title found, falls back to Puppeteer headless browser
5. Modal displays scraped preview; user confirms
6. `useAddItem` mutation calls `addItemToWishlist` which writes to Firestore subcollection `wishlists/{id}/items`
7. TanStack Query invalidates the items cache, triggering a re-fetch

### Adding an Item (Manual)
1. User switches to manual entry tab in AddItemModal
2. Enters title, price, store name, notes, and optional image URL
3. `useAddManualItem` mutation calls `addManualItemToWishlist` (url: null, scrapedAt: null)
4. Cache invalidation triggers re-fetch

### Sharing a List
1. Owner toggles `isPublic` via ShareDialog, which calls `updateWishlist`
2. Dialog shows the shareable URL: `/shared/{shareSlug}`
3. Visitors hit the shared route, which calls `getWishlistBySlug`
4. Firestore security rules allow read access when `isPublic == true`

### Claiming an Item (Gift Surprise)
1. Viewer on shared page clicks "I'll get this" on an item, opening ClaimItemDialog
2. Viewer optionally toggles anonymous mode and adds a note
3. `updateItem` writes `isPurchased`, `purchasedBy`, `purchasedByName`, `purchasedByPhoto`, `purchasedAnonymously`, and `purchaseNote`
4. Security rules restrict shared viewers to only updating claim-related fields
5. The `onItemClaimed` Firestore trigger fires, sending a push notification to the list owner via FCM
6. The owner sees claim details (name/photo/note) unless the claimer chose anonymity
7. Because the owner's list view subscribes via `onSnapshot`, the claimed state appears live without a refresh

### Push Notifications
1. On dashboard load, `NotificationPrompt` checks if user has granted notification permission
2. If not, prompts the user; on iOS Safari, shows a guide to install the PWA first
3. On enable: requests permission, gets FCM token, stores token in `users/{uid}` document
4. When an item is claimed, the `onItemClaimed` trigger reads the owner's FCM tokens and sends a web push
5. The trigger guards against duplicate sends: a Firestore transaction atomically stamps `notifiedAt`, and a re-delivered event that finds it already set bails out — so an at-least-once trigger never double-notifies
6. Stale tokens are automatically cleaned up on send failure

### Item Refresh
1. Owner clicks refresh on a WishCard, triggering `useRefreshItem`
2. Re-scrapes the URL via the `scrapeUrl` Cloud Function
3. Updates only changed fields via `updateItemMetadata`
4. Bulk refresh via `refreshAllItems` is bounded: a global cap (200 items) is divided into a per-list `limit()` so a user with many large lists can't trigger an unbounded read fan-out, then processed in batches

## External Integrations

| Service | Purpose |
|---------|---------|
| Firebase Auth | Google OAuth sign-in |
| Cloud Firestore | Document database for wishlists, items, and user FCM tokens |
| Cloud Functions v2 | Server-side link scraping, bulk refresh, claim notifications |
| Cloud Messaging (FCM) | Web push notifications for item claims |
| Headless Chrome (`puppeteer-core` + `@sparticuz/chromium` + stealth) | Fallback render for JS-rendered product pages |
| Amazon Associates | Affiliate tag appended to `amazon.com` outbound links at render time |
| Vercel | Frontend hosting with SPA rewrites |
| Vercel Analytics | Usage tracking |
| GitHub Actions + GCP Workload Identity Federation | CI checks and keyless Cloud Functions / rules deploy |
| Google Fonts | Playfair Display + DM Sans |

## Key Architectural Decisions

### Subcollection for Items
- **Context**: Items belong to a specific wishlist
- **Decision**: Store items as a subcollection (`wishlists/{id}/items`) rather than a top-level collection
- **Rationale**: Natural hierarchy, simpler security rules, queries scoped to parent automatically

### Server-Side Scraping with Puppeteer Fallback
- **Context**: Need to extract product info from arbitrary URLs, including JS-rendered pages
- **Decision**: Cloud Function with Cheerio as primary parser, Puppeteer headless browser as fallback when no title is extracted
- **Rationale**: Cheerio is fast and lightweight for most pages; Puppeteer handles SPAs and JS-heavy sites. Fetch includes retries with exponential backoff for resilience

### Share Slug Instead of Document ID
- **Context**: Need shareable URLs for public wishlists
- **Decision**: Generate a random 8-character slug stored on the wishlist document
- **Rationale**: Short, human-friendly URLs; doesn't expose Firestore document IDs; easy to query by slug

### Multi-Tier Scraping Fallback
- **Context**: Product pages have inconsistent metadata formats
- **Decision**: JSON-LD structured data > Open Graph tags > Twitter cards > standard meta tags > CSS price selectors > URL hostname heuristic
- **Rationale**: JSON-LD is the richest source when available; OG is widely supported; CSS selectors catch prices missed by metadata; URL parsing provides a baseline for any page

### FCM for Push Notifications
- **Context**: Want to notify list owners when items are claimed
- **Decision**: Firebase Cloud Messaging with Firestore trigger (`onDocumentUpdated`) on item claim
- **Rationale**: Integrates natively with Firebase stack, supports web push, Firestore triggers eliminate polling, stale token cleanup keeps the system healthy

### Dashboard Horizontal Scroll with Expand
- **Context**: Users may have many lists with many items; need a compact overview
- **Decision**: Show mini-cards in a horizontal scroll per list, with a "View all" toggle to expand into a full card grid
- **Rationale**: Compact by default so you can scan all lists quickly; expandable for when you need the full view with actions

### Realtime Listeners on List Views, One-Shot Reads on the Dashboard
- **Context**: A claim made on a shared link should appear on the owner's open list immediately, but the dashboard renders every list and shouldn't open a listener per list
- **Decision**: List/shared views use a Firestore `onSnapshot` subscription (`useLiveWishlistItems`); the dashboard uses bounded one-shot reads (`useWishlistItems` with a `limitCount`)
- **Rationale**: Live sync where the surprise-collision risk is real (two people claiming the same item), and cheap bounded reads where dozens of simultaneous listeners would otherwise add cost and connection overhead

### Idempotent Claim Trigger
- **Context**: Firestore triggers deliver at-least-once, so `onItemClaimed` can fire more than once for a single claim and would otherwise send duplicate push notifications
- **Decision**: A pure predicate gates the false→true claim transition (and skips self-claims), then a Firestore transaction atomically stamps `notifiedAt`; a re-delivery that finds it set returns early
- **Rationale**: Moves the de-dupe into a single atomic check-and-set rather than relying on best-effort flags, so concurrent re-deliveries can't both pass

### Render-Time Affiliate Tagging
- **Context**: Want Amazon Associates revenue without corrupting the stored URL that re-scrapes and SSRF validation depend on
- **Decision**: Store canonical URLs; append the `tag` query param only when rendering an outbound `amazon.com` link, in one helper (`affiliateUrl`)
- **Rationale**: Re-scrapes and URL validation always see the clean URL, the tag can change in a single place, and non-Amazon hosts pass through untouched — a site-wide disclosure in `__root.tsx` satisfies the Associates agreement

### Bounded Server-Side Reads
- **Context**: `refreshAllItems` could fan out to an unbounded number of document reads for a user with many large lists
- **Decision**: Cap the total at 200 items, divide that into a per-list `limit()`, then cap again across lists before processing
- **Rationale**: Keeps the function's read cost and runtime predictable regardless of how much data a single user accumulates
