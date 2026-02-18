# Project Q&A Knowledge Base

## Overview

Ours is a multi-tenant couples web app I built as a digital space for partners to share their lives together. It solves the problem of couples having their shared memories, plans, and inside jokes scattered across a dozen different apps. Each couple gets a completely isolated private space with a shared calendar, photo gallery, love coupons, wishlists, and more -- all with a warm, customizable aesthetic that feels personal rather than generic.

## Key Features

- **Multi-Tenant Isolation**: Every couple's data is fully isolated using Firebase custom claims. Firestore security rules enforce `coupleId` match on every read/write, and Cloud Functions exclusively read tenant identity from immutable auth tokens.
- **Film Camera Mode**: A nostalgic photo feature that locks uploads behind a 3-5 day "developing" period. Photos gradually reveal through progressive blur and sepia CSS effects, and an hourly Cloud Function notifies couples when photos are ready.
- **Real-Time Everything**: Firestore realtime listeners power live updates across the app -- love messages appear instantly, coupon redemptions trigger push notifications, and calendar changes sync between partners immediately.
- **Dynamic Theming**: 4 theme presets with per-user color customization. Theme values are cached in localStorage and applied via a blocking inline script before React loads, eliminating the flash of default colors.
- **PWA with Offline Support**: Service worker caches all app assets and Firebase Storage images. The app works offline with Firestore's persistent local cache and syncs when connectivity returns.

## Technical Highlights

### Multi-Tenant Security Architecture
I implemented defense-in-depth for data isolation: Firestore rules check `request.auth.token.coupleId` on every operation, Cloud Functions read `coupleId` exclusively from the JWT (never from mutable user documents), and the client always injects `coupleId` into queries and writes. An immutability guard (`coupleIdUnchanged()`) prevents field mutation attacks on document updates. Firebase App Check with reCAPTCHA v3 adds request attestation on top.

### Flash-Free Loading Pipeline
The loading experience went through several iterations to eliminate every visible flash. Authenticated users skip the landing page via a synchronous localStorage check. Theme colors are applied from cache in a blocking `<head>` script before any HTML renders. The React app renders `null` behind a static CSS spinner until both auth and couple data have loaded, so the first frame users see is the fully-populated page.

### Thumbnail Pipeline
I built a thumbnail system using Firebase's Resize Images extension that auto-generates WebP thumbnails regardless of input format. A Cloud Function (`onThumbnailCreated`) uses a prefix range query on the `storagePath` field to handle the format mismatch between original uploads and `.webp` thumbnails. Display components use `thumbnailUrl || url` so thumbnails auto-activate without any migration.

### Stripe Integration with Graceful Degradation
The billing system handles subscription lifecycle through Stripe webhooks. Rather than hard-locking users immediately on payment failure, I implemented a `useSubscription()` hook that derives access levels with a 7-day grace period after cancellation, allowing users to continue reading their data while resolving billing issues.

## Development Story

- **Timeline**: Built incrementally over several months, starting as a Valentine's Day gift and evolving into a full SaaS product
- **Hardest Part**: Getting multi-tenant data isolation right. The initial single-tenant architecture required a careful migration to add `coupleId` scoping to every collection, query, and security rule without breaking existing data.
- **Lessons Learned**: Test security rules with malicious intent, not just happy paths. The security audit revealed that Firestore update rules need to check both `resource.data` (before) and `request.resource.data` (after) to prevent field mutation attacks.
- **Future Plans**: Expanding the platform to support more couples as a SaaS product, adding more theme presets, and building out the social features between couples.

## Frequently Asked Questions

### How does the multi-tenant isolation work?
Every couple gets a `coupleId` set as a custom claim on their Firebase Auth token during onboarding. This claim is embedded in the JWT and cannot be modified by clients. Firestore security rules check `request.auth.token.coupleId` against the document's `coupleId` field on every read and write. Cloud Functions also read from the auth token, never from user documents.

### Why Astro instead of a pure React SPA?
I needed both a public marketing landing page (SEO-friendly, fast-loading static HTML) and a fully interactive authenticated app. Astro's island architecture lets the landing page at `/` be pure static HTML while the app at `/home` loads React via `client:only="react"`. The landing page doesn't ship any React JavaScript.

### How does the Film Camera mode work?
When a user uploads a photo in film mode, it gets a `developingUntil` timestamp 3-5 days in the future. The display component calculates blur (0-40px) and sepia (0-100%) values inversely proportional to remaining development time. An hourly Cloud Function scans for newly-developed photos and sends a push notification to the couple.

### How do you prevent one couple from accessing another's data?
Three layers: (1) Firestore security rules require `coupleId` match on every operation, (2) the client's `useFirestoreCollection` hook always adds a `where('coupleId', '==', coupleId)` filter, and (3) Cloud Functions read the `coupleId` from the immutable auth token. Even if a client were compromised, the security rules would block cross-tenant access.

### Why cache theme colors in localStorage?
CSS custom properties set via React `useEffect` only apply after the component mounts, which happens after the browser has already painted the default colors from the stylesheet. By caching all computed theme values and reading them in a synchronous `<script>` tag in `<head>`, the correct colors are applied before the first paint -- no flash.

### How does the notification system work?
Firebase Cloud Messaging tokens are saved to each user's Firestore document. When events occur (love message sent, coupon redeemed, film photo developed), Cloud Functions send FCM pushes to the recipient's token list. Stale tokens are automatically cleaned up when FCM returns invalid-registration errors. The service worker handles background notifications, and the `FCMManager` component handles foreground ones.

### What happens when a subscription expires?
The `useSubscription()` hook checks the couple's `subscriptionStatus` and `subscriptionEndDate`. Active and trialing statuses get full access. Past due or recently canceled (within 7 days) get read-only access. Beyond the grace period, access is locked. Users can manage their subscription through the Stripe Customer Portal linked from Settings.
