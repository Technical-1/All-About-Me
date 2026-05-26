# Project Q&A Knowledge Base

## Overview

FISH Apparel is a college hat brand ("Fuck It, Shit Happens") based in Gainesville, FL. I built and maintain the custom Shopify storefront, writing Liquid/JS code that replaces paid extensions and adds features the theme doesn't support out of the box. The custom code saves the business an estimated $700-1,800/year in app subscriptions.

## Key Features

- **Variant Image Filtering**: Filters product gallery photos by selected color — replaced SA Variant Image Automator ($14.90/month on Shopify Basic)
- **Wholesale Ordering System**: Password-protected B2B catalog with 50% pricing, quantity selectors, and order form — replaces apps like Wholesale Pricing Discount B2B ($24.99/month) and SparkLayer ($49/month)
- **Infinite Scroll Photo Gallery**: Smooth, seamless marquee of 24 lifestyle images using requestAnimationFrame — replaced the theme's static grid
- **Free Shipping Progress Bar**: "Add X more hats for FREE SHIPPING" visual fill that drives higher average order value
- **Quick Add to Cart**: One-click add on the cart page — reduces friction from 3 clicks to 1 for impulse add-ons
- **Business Card Generator**: Interactive HTML tool with 4 card designs, team member toggle, and QR codes linking to the wholesale portal
- **Social Media Strategy Report**: 4-tab interactive report covering posting schedule, ad budget, UGC campaigns, AI content plan, and B2B partnership tracking

## Technical Highlights

### Replacing a $178/Year Extension with 160 Lines of JavaScript
We were paying for **SA Variant Image Automator** ($14.90/month on Shopify Basic, 4.9★ on the App Store) to filter product images by color variant. The cheaper alternative, **Variant Image Wizard + Swatch**, still runs $4.99–$7.99/month. I wrote `fish-variant-images.liquid` — it hooks into the theme's Flickity carousel, reads image filenames (e.g., "gators-corduroy-angle.jpg"), matches them against the selected variant's handleized color name, and reorders the gallery. Same functionality, zero ongoing cost. The key insight was that Shopify already encodes variant info in image filenames — you just need to parse it.

### Building a Wholesale System Without a Backend
Shopify doesn't let you run custom server code without building a full app. I needed a password-protected wholesale page. The solution: SHA-256 hash the password client-side and compare it against a Shopify page metafield. Since the wholesale page is just a contact form (not actual checkout with different prices), client-side auth is perfectly fine. The hash prevents casual password discovery in view-source. This replaces wholesale apps like **Wholesale Pricing Discount B2B** ($24.99/month), **B2B Wholesale Hub** ($39/month), or **SparkLayer** ($49/month with a 50-order/month cap on the starter tier). That's $300–$588/year saved.

### Fixing the Gallery White Flash
The homepage photo gallery was glitching — a white flash every time the infinite scroll looped. The original CSS `@keyframes` approach used `translateX(-50%)` which causes sub-pixel rounding errors across 48 images. I replaced it with a JavaScript `requestAnimationFrame` loop that measures exact pixel widths of the original image set and resets the transform offset at the precise threshold. No percentage-based math, no rounding errors, no flash.

### Business Tools Beyond the Storefront
Built standalone HTML tools for the business: an interactive business card generator with 4 design approaches (toggleable between team members) with QR codes linking to the wholesale portal, and a comprehensive social media strategy report with posting schedules, ad budget breakdowns, UGC campaign ideas, AI content plans, and B2B partnership tracking.

## Engineering Decisions

### Custom Liquid/JS over paid Shopify apps
- **Constraint**: Each feature gap (variant filtering, wholesale catalog, shipping bar, newsletter) had an off-the-shelf app costing $5–$49/month, and each app injects its own third-party script into every page load.
- **Options**: Stack paid apps (~$1,000+/year, slower site), build a custom Shopify app with a backend, or write the features directly in Liquid/JS inside the theme.
- **Choice**: Write the features directly in Liquid/JS with a `fish-` filename prefix.
- **Why**: One-time dev effort vs. perpetual subscription. No third-party scripts means a faster storefront and full control over behavior. The `fish-` prefix keeps custom files clearly separated from the 50+ Turbo Seoul defaults so theme updates don't clobber them.

### JS pixel-measurement marquee over CSS keyframes
- **Constraint**: The homepage marquee loops 48 lifestyle photos. CSS `@keyframes` with `translateX(-50%)` produced a visible white flash at every reset because percentage-based transforms accumulate sub-pixel rounding errors across that many images.
- **Options**: Live with the flash, mask it with a faked fade overlay, or measure pixel widths in JS and reset at an exact integer threshold.
- **Choice**: `requestAnimationFrame` loop that measures the exact pixel width of the original image set and snaps the transform on integer boundaries.
- **Why**: Truly seamless loop with no visual artifact, 60fps performance, and no dependence on a library. Costs ~60 lines of vanilla JS instead of a third-party carousel plugin.

### Client-side SHA-256 for wholesale gating
- **Constraint**: Wholesale catalog needs a "password" but Shopify doesn't allow custom backend code without building a full app, and the page itself is a contact form (not a real checkout with different prices).
- **Options**: Pay for a wholesale app ($24.99–$49/month), build a custom Shopify app with server-side auth, or hash the password client-side and compare against a page metafield.
- **Choice**: Client-side SHA-256 hash comparison against a Shopify page metafield, with the password also accepted via URL parameter for QR code links from business cards.
- **Why**: Password isn't a security boundary — the worst case is someone seeing wholesale prices on a contact form. The hash just prevents casual discovery in view-source, and the URL-parameter mode turns the printed QR codes into one-tap retailer onboarding.

## Frequently Asked Questions

### How does the variant image filtering work?
When a customer selects a color swatch, JavaScript handleizes the color name ("Gators Corduroy" → "gators-corduroy") and checks every gallery image filename for that prefix. Non-matching images are hidden, matching ones are shown, and the Flickity carousel reinitializes with the filtered set. "Angle" shots get prioritized to the front.

### Why custom code instead of Shopify apps?
The real apps we'd be paying for: SA Variant Image Automator ($14.90/month), Wholesale Pricing Discount B2B ($24.99/month), Hextom Free Shipping Bar Premium ($9.99/month), Klaviyo Email (~$30/month at 1k contacts), EZ Quick Buy ($4.99–$8.99/month). That adds up to $1,000+/year — and each app injects its own JavaScript that slows the site. Custom Liquid/JS is a one-time dev effort, loads faster (no third-party scripts), and is fully under our control.

### How does the wholesale system handle authentication?
The password is SHA-256 hashed client-side and compared against a hash stored in a Shopify page metafield. This isn't a security boundary — the wholesale page is a contact form that emails us the order, not an actual checkout with different prices. The hash just prevents casual password discovery in source code.

### How does the infinite scroll gallery work without glitching?
All gallery images are duplicated in the DOM. A `requestAnimationFrame` loop continuously translates the container left. When the offset reaches the exact pixel width of the original image set, it snaps back. Because it measures real pixel widths (not percentages), there are no sub-pixel rounding errors and no white flash at the seam.

### How does the shipping progress bar know when a customer is close to free shipping?
`fish-shipping-progress.liquid` reads `cart.item_count` directly in Liquid and compares it against the 3-hat threshold. The progress bar width is computed server-side, so it renders correctly on first paint with no JS flicker. When the threshold is hit, a CSS class flips the bar green. There's no JavaScript at all in this snippet — pure Liquid math.

### How do the business cards connect to the wholesale system?
The business card designs include QR codes that link directly to the wholesale portal URL with the password pre-filled as a URL parameter (`/pages/wholesale?pass=fishwholesale2026`). Retailers scan the QR code and land directly in the authenticated wholesale catalog — no password entry needed.

### What's the fish- prefix convention?
All custom files are prefixed with `fish-` (e.g., `fish-variant-images.liquid`, `fish-wholesale.liquid`). The Turbo Seoul theme has 50+ built-in snippets and sections. The prefix makes it instantly clear which files are custom vs. theme defaults, and theme updates won't overwrite `fish-*` files.
