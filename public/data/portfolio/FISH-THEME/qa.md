# Project Q&A

## Overview

This is the custom Shopify storefront for FISH Apparel, a Gainesville, FL college hat brand. It runs on the commercial Turbo theme (9.5.0), and I added Liquid, vanilla JS and CSS that replace paid apps and add the business features the theme lacks:
- variant-accurate product galleries
- a gated wholesale order portal
- native pre-orders
- a campaign system that drives every promotion from one place
- a team inventory-record form

The most technically interesting part is how form submissions are delivered. A theme cannot run server code, and Shopify's mailer re-wraps every email it sends. So every form attaches a compact, encoded, contract-pinned block that a downstream reader can parse exactly.

## Problem Solved

A small Shopify brand quickly accumulates app subscriptions, one each for variant images, wholesale, pre-orders and a shipping bar, and each app adds its own script to every page. On top of that, its operational data (wholesale orders, back-in-stock requests, hats given away by the team) arrives as free-form contact-form emails that are hard to process reliably. This theme brings those features into code the brand owns, and turns form email into structured data.

## Target Users

- **Shoppers**: a gallery that shows the colour they picked, clear pre-order ship dates, one-tap add-ons and a free-shipping nudge in the cart.
- **Wholesale retailers**: a catalog at wholesale prices with per-variant quantities and a running total, reachable in one tap from a business-card QR code.
- **The team**: a login-gated page for recording a hat given away or sold for cash, plus email that can be processed without retyping.

## Key Features

### Colourway-filtered galleries
Picking a colour shows only that colour's photos, angle shot first, on the product page and inside the quick-view modal. It replaces a $14.90/month app.

### Wholesale portal
Every product and variant is listed at wholesale pricing, with quantity steppers, a live summary and an order form that emails the store. Access is by password or QR link, with an optional server-side customer-tag gate.

### Campaign registry
New colourway launches, restocks and pre-orders are each defined once. The announcement bar, the popup's drop list and the NEW / RESTOCK / PRE-ORDER chips on collection cards all read from that one definition, and each campaign ends on its own when the stock behind it runs out.

### Native pre-orders
Tagging a product `preorder:YYYY-MM-DD` adds a ship-date note and a `Pre-Order` line-item property, and the cart and confirmation email carry it through.

### Team give-away record
A page visible only to tagged team accounts, where a team member taps a hat's photo, picks whose stock it came from and the date, and submits.

### Faster homepage and collection pages
- Images are served at their displayed size.
- The photo strip loads tiles as they approach the screen instead of all 24 at once.
- Blur-up placeholders became CSS skeletons.
- The collection page was rebuilt as an edge-to-edge grid.

## Technical Highlights

### A form payload that survives the mailer
Shopify's contact mailer hard-wraps plain-text values at a space after about 60 characters. The theme controls only field names, values and their order, and the first item-row format arrived cut in two. `snippets/fish-form-block.liquid` now writes a versioned block where:
- every value is percent-encoded UTF-8, cut into chunks of at most 36 characters and never split inside a `%XX`;
- each value carries a `len=` so truncation is detectable;
- no line contains a space or runs past 40 characters.

Fields come from `FormData` at submit time (capture phase), so a newly added field is picked up automatically. If the script throws, the form still sends.

### Testing the exact code the store runs
The block builder and the wholesale and team body builders are pure functions inside Liquid files, between `// <fish-builder>` markers. `tools/forms-proposal/builder.js` extracts that text and evaluates it with `new Function`, and `check-block.js` runs 322 assertions on it. The block grammar comes from `tests/contracts/form-block.json`, whose SHA-256 is pinned in `form-block.pin`. The tests therefore cannot drift from the shipped code or from the contract. `check-reader.js` covers hand-written and malformed blocks, and `check-browser.js` runs the real snippet in headless Chrome to prove the field exists before the form is serialized.

### Fixing a cached-index race in a theme I don't own
After the variant filter removes cells, Turbo's `sections.js` still selects a slide by the media's original index, read through jQuery's `.data('index')`. That index is out of range after filtering, so Flickity clamped it to the wrong photo, and the result depended on which handler ran last. `assets/fish-variant-images.js` renumbers every remaining cell in both the DOM attribute and jQuery's data cache. jQuery caches on first read and never re-reads the attribute, so writing the cache is what makes the theme's own call land correctly.

### Campaigns that cannot outlive their stock
`snippets/fish-campaign.liquid` gives each mode an inventory gate:
- `preorder`: tracked, depleted and still sellable;
- `restock`: real units on hand;
- `launch`: the restock test, applied only to the named new variants.

Date windows are a backstop, not the main control. Any copy that counts drops is derived from the gates, so the popup can never announce stock that has sold out.

## Engineering Decisions

### Theme code over paid apps
- **Constraint**: Each gap had a $5–$49/month app, adding roughly $1,000 a year in total plus a third-party script per app.
- **Options**: Stack the apps, build a custom Shopify app with a backend, or build the features in theme Liquid and JS.
- **Choice**: Theme code in `fish-`-prefixed files.
- **Why**: There is nothing to host and nothing recurring to pay, and no third-party scripts. The prefix keeps the custom work separate from Turbo's files during theme updates.

### Encoded block over a nicely formatted email
- **Constraint**: The mailer's layout and wrapping cannot be changed from a theme.
- **Options**: Parse the human-readable body heuristically, route forms through an external form service, or attach a machine-readable block in its own field.
- **Choice**: A versioned, encoded block in `contact[fish_form]`, pinned to a JSON contract.
- **Why**: It keeps Shopify's native contact pipeline, leaves the human-readable email unchanged, and makes parsing exact rather than best-effort.

### Server-side tag gates where it matters
- **Constraint**: The wholesale password check runs in the browser, and anyone can post to a store's contact endpoint.
- **Options**: Treat the password as security, pay for a B2B app, or gate the markup on a customer tag in Liquid.
- **Choice**: The password stays as a convenience. A customer-tag gate is available for wholesale and required for the team form, and the reader re-prices wholesale items from the catalogue by variant id.
- **Why**: A submission is treated as a claim rather than a fact. The tag gate keeps the page out of the HTML for anyone else, without any backend.

### Deploy only what changed
- **Constraint**: `config/settings_data.json` is edited live in the theme editor, so the repo copy goes stale.
- **Options**: A full `theme push`, or pushes scoped with `--only` per file.
- **Choice**: Scoped pushes. Before pushing, I pull the live copies to check for admin edits; after pushing, I pull again to confirm production matches the commit.
- **Why**: A full push would quietly roll back months of merchandising changes made in the admin.

## Frequently Asked Questions

### How does the gallery know which photos belong to which colour?
By filename. A photo for the "Gator White" variant must be named `gator-white-…`. The script handleizes the selected colour and keeps the slides whose `data-media-filename` starts with it. If nothing matches, it shows every photo rather than an empty gallery.

### Does the variant filter work in quick view?
Yes. Quick view builds a second gallery when it opens. A `MutationObserver` triggers a short burst of re-scans after DOM changes, and each gallery is tied to the swatches nearest to it, so the modal and the page do not drive each other.

### Is the wholesale password secure?
It is a convenience gate, not a security boundary. The browser compares a SHA-256 of the input with a hash that Liquid renders from a page metafield. When a real boundary is needed, the section's `require_customer_tag` setting keeps the catalog out of the page for anyone not logged in with that tag.

### What happens if JavaScript fails on a form?
The form still submits normally. The email simply has no FISH-FORM block, and the contract defines how a reader treats a submission recognized only by the mailer's layout.

### How is a pre-order kept from being bought without its ship date?
The `Pre-Order` property is added in the product form. Quick Add posts straight to `/cart/add.js` with no properties, so it detects pre-order variants (tracked, depleted, continue-selling) and links to the product page instead.

### Why does the photo strip control its own image loading?
Tiles are moved with a CSS transform, not scrolled, so native lazy loading and lazysizes never see them come into view. The animation loop already knows every tile's position, so it unveils each one 900 px before it reaches the edge. At the strip's fixed speed, that is a predictable lead time.

### How do I run the tests?
`node tools/forms-proposal/check-block.js` and `node tools/forms-proposal/check-reader.js` need only Node. `check-browser.js` needs `npm install` for Puppeteer.
