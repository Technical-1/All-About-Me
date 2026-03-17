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

## Development Story

- **Hardest Part**: The gallery infinite scroll. CSS animations seem like the obvious approach, but percentage-based transforms accumulate sub-pixel rounding errors across dozens of images. Had to switch to a JS pixel-measurement approach to get a truly seamless loop.
- **Most Satisfying**: Replacing the SA Variant Image Automator ($14.90/month, $178.80/year). 160 lines of vanilla JS does the same thing. The custom version is actually faster because it doesn't load a third-party script.
- **Lessons Learned**: On Shopify, custom Liquid/JS almost always beats paid apps. The apps add bloat, cost money monthly, and you can't customize them. Writing it yourself is a one-time effort with permanent savings.
- **Future Plans**: Continue replacing paid apps with custom code wherever the ROI makes sense. Looking at custom upsell features and possibly a loyalty/referral system.

## Frequently Asked Questions

### How does the variant image filtering work?
When a customer selects a color swatch, JavaScript handleizes the color name ("Gators Corduroy" → "gators-corduroy") and checks every gallery image filename for that prefix. Non-matching images are hidden, matching ones are shown, and the Flickity carousel reinitializes with the filtered set. "Angle" shots get prioritized to the front.

### Why custom code instead of Shopify apps?
The real apps we'd be paying for: SA Variant Image Automator ($14.90/month), Wholesale Pricing Discount B2B ($24.99/month), Hextom Free Shipping Bar Premium ($9.99/month), Klaviyo Email (~$30/month at 1k contacts), EZ Quick Buy ($4.99–$8.99/month). That adds up to $1,000+/year — and each app injects its own JavaScript that slows the site. Custom Liquid/JS is a one-time dev effort, loads faster (no third-party scripts), and is fully under our control.

### How does the wholesale system handle authentication?
The password is SHA-256 hashed client-side and compared against a hash stored in a Shopify page metafield. This isn't a security boundary — the wholesale page is a contact form that emails us the order, not an actual checkout with different prices. The hash just prevents casual password discovery in source code.

### How does the infinite scroll gallery work without glitching?
All gallery images are duplicated in the DOM. A `requestAnimationFrame` loop continuously translates the container left. When the offset reaches the exact pixel width of the original image set, it snaps back. Because it measures real pixel widths (not percentages), there are no sub-pixel rounding errors and no white flash at the seam.

### What was the most challenging part?
The gallery marquee loop. CSS `@keyframes` with `translateX(-50%)` seems like it should work, but across 48 images, sub-pixel rounding accumulates and creates a visible glitch at the reset point. The fix was switching to JavaScript that measures exact pixel widths and uses integer math for the reset threshold.

### How do the business cards connect to the wholesale system?
The business card designs include QR codes that link directly to the wholesale portal URL with the password pre-filled as a URL parameter (`/pages/wholesale?pass=fishwholesale2026`). Retailers scan the QR code and land directly in the authenticated wholesale catalog — no password entry needed.

### What's the fish- prefix convention?
All custom files are prefixed with `fish-` (e.g., `fish-variant-images.liquid`, `fish-wholesale.liquid`). The Turbo Seoul theme has 50+ built-in snippets and sections. The prefix makes it instantly clear which files are custom vs. theme defaults, and theme updates won't overwrite `fish-*` files.
