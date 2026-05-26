# Project Q&A

## Overview

Terra Moda is a Shopify storefront fix-up for a family-owned sustainable fashion boutique in Frederick, Maryland. The store carries men's, women's, children's, and dog products from artisan vendors with Fair Trade, B-Corp, and GOTS credentials. The interesting technical angle is the line-drawing: the existing Craft theme stays in place, the homepage is rebuilt as a JSON section composition, and two new components (a women's-collection band and a "Visit Us" map block) ship as `custom-liquid` instances inside the homepage template rather than as new section files.

## Problem solved

The store had a strong physical presence and a real brand story, but the website was not converting any of it. The home page had exactly two sections (a single cover photo of the store interior and a 400-word text block), zero products visible above the fold, no social proof, an empty footer, and a dead 175 KB asset loading on every page. The audit found the code was clean stock Craft; the problem was composition and configuration. The fix is a rebuilt homepage, polished templates for the brand-story and contact pages, a custom nav, and a phased rollout of trust and conversion features that ship as theme code instead of paid apps.

## Target users

- **The boutique's online shoppers**: a homepage that actually shows what's for sale, a scannable founder story they can tap into one click deeper, and a "Visit Us" section that turns the website into a door to the Frederick store.
- **The boutique owner**: a Shopify theme they can edit in the admin (every homepage section is a JSON entry they can reorder or hide), with no new monthly app subscriptions.
- **The boutique's in-store shoppers doing pre-purchase research**: a site that mirrors the in-store experience. Research from Forrester and Criteo flags this behavior at ~92% of in-store purchases.

## Key features

### A JSON-composed homepage
The home page is `templates/index.json`, six sections in order: an editorial hero with dual CTAs, a four-tile category grid, a featured-collection product grid, a three-column value strip with one "Read Our Full Story" door, a custom La Segreta band promoting the women's collection, and a Visit Us section with an embedded Google Map. Each section is a JSON entry the owner can reorder from the theme editor without code changes.

### Custom Our Story page
`templates/page.our-story.json` composes the brand narrative as a heading + founder paragraph (the Dulany family story) followed by four image-with-text values: Fair Labor, Sustainability, Premium Craftsmanship, Small Business Always. The page renders via Shopify's `?view=our-story` query parameter while it's still in preview, before the admin Page entity is reassigned to the new template.

### Custom contact page
`templates/page.contact.json` pairs a branded "Get in Touch / We'd love to hear from you" intro hero with the native Shopify `contact-form` section. Drops the duplicate Formful app block that was on the live page.

### Self-sufficient mega menu
`assets/tm-nav.css` plus updates to `sections/header.liquid` and `snippets/header-mega-menu.liquid` add a theme-driven mega menu with category images and a compact button-anchored dropdown. Overrides Craft's default `.mega-menu__list display: grid` (which was squeezing menu items into six columns). Opens on hover. Locale-safe URLs; no admin dependency on every change.

### Embedded Visit Us section
The "Visit Us" component is a `custom-liquid` band on the homepage and a standalone block on the contact page. Renders a Google Maps iframe (`?q=218+N+Market+St,+Frederick,+MD+21701&output=embed`) plus address, hours, and a "Get Directions" CTA. No paid map app, no JS SDK.

### Phased rollout
Phase 1 (homepage rebuild + quick wins) is shipped to the development theme. Phase 2 (trust, custom reviews built in code, nav redesign, product-card hover, footer overhaul) is in progress. Phase 3 (product-page polish, mobile, local SEO) is scheduled. Every phase ships to a dev theme first; the owner approves before publish.

## Technical highlights

### `templates/index.json` is the entire homepage
The home page is six declarative section entries: `hero`, `categories`, `new_arrivals`, `why`, `lasegreta`, `visit`. Each entry names a section type, supplies its settings, and (where applicable) defines blocks with their own settings. The whole composition is data, which means the owner can hide the value strip or swap the order of categories and new-arrivals from the theme editor without a code change. This is the JSON-section pattern Shopify introduced in Online Store 2.0; the design tax is that custom components need to fit into either a stock section type or `custom-liquid`, both of which preserve admin editability.

### `custom-liquid` as a deliberate escape hatch
The La Segreta band and the Visit Us band don't fit any stock Craft section. The natural impulse is to write `sections/lasegreta.liquid` and `sections/visit.liquid` with full schemas. Instead they live as `custom-liquid` section instances inside `templates/index.json`, with their markup embedded as a JSON string. This keeps both components inside the homepage template (one source of truth for "what's on the home page") and lets the owner remove them from the editor as easily as any other section. The cost is that the embedded HTML is harder to read in JSON; the trade pays off because the components only vary by collection image and CTA link, both resolved at render time via `{{ collections['la-segreta'] }}`.

### `?view=<suffix>` decouples preview from admin
Shopify Pages bind to templates via an admin-side field. New page templates (`page.our-story.json`, `page.contact.json`) only render when the admin Page entity selects them, which means the rebuild can't be reviewed end to end until the owner clicks through every page in the admin. The `?view=<suffix>` query parameter overrides the template assignment at request time, so `/pages/our-story?view=our-story` renders the new template regardless of admin state. Combined with `?preview_theme_id=`, this gives a single shareable URL that previews any new page template inside any unpublished theme without touching admin.

### Single-purpose custom CSS file
All custom CSS is in `assets/tm-nav.css`, loaded from `sections/header.liquid`. None of the vendor Craft stylesheets are touched. When Craft ships a base-theme update, the diff against the new vendor files stays clean. Removing the customization is `rm assets/tm-nav.css` plus one link tag.

## Engineering decisions

### Customize Craft, don't replace it
- **Constraint**: The store had two years of accumulated product metafields, redirects, app integrations, and Shopify-side detail tied to the existing theme.
- **Options**: Replace with a paid theme (Turbo, Impulse), migrate to Dawn, or customize Craft in place.
- **Choice**: Customize Craft in place.
- **Why**: Theme replacement on Shopify is non-trivial because every section ID, metafield reference, and template assignment is theme-coupled. Migrating would have meant rewriting product templates and reassigning every page. The audit found Craft's section library could compose the proposed home; only two genuinely new components were needed, and both fit as `custom-liquid`.

### JSON section composition over hard-coded `index.liquid`
- **Constraint**: The homepage needed six distinct content blocks, several of which the owner should be able to reorder or edit without involving a developer.
- **Options**: Write a single `templates/index.liquid` with all six blocks hand-coded, or compose the page in `templates/index.json` from configurable section instances.
- **Choice**: JSON composition.
- **Why**: A JSON template makes every section a row in the theme editor. Marketing copy, category tile images, product collection selection, and value-strip text are all editable from the admin instead of requiring a code edit. The escape hatch for new components is `custom-liquid`, which preserves the editor pattern while allowing arbitrary HTML.

### Build reviews in code, don't add an app
- **Constraint**: The redesign proposal cites verified reviews as the single highest-impact addition for purchase likelihood. Shopify's built-in reviews app is retired. Every market alternative is a paid monthly subscription.
- **Options**: Add a paid app (Judge.me $15+/mo, Yotpo, Loox), skip reviews entirely, or build a custom Liquid + JS implementation backed by Shopify product metafields.
- **Choice**: Build it in code as part of Phase 2.
- **Why**: The recurring cost of an app compounds against a small boutique's margin. A custom implementation handles the storefront side with no monthly fee. The trade-off is no built-in collection-email automation, which is solvable with a single Shopify Flow trigger.

### Embed Google Maps, don't use a map app
- **Constraint**: The Visit Us section needs an interactive map. Shopify has paid map-app options. Plain Google Maps Embed is free and requires no SDK.
- **Options**: Paid map app, Mapbox with a JS SDK, or Google Maps Embed iframe.
- **Choice**: Google Maps Embed iframe.
- **Why**: Zero JS, no API key, no monthly cost, lazy-loaded. The iframe is one line. The trade-off is no custom map styling, which Direction 3 didn't ask for.

## Frequently asked questions

### Why customize Craft instead of switching to a paid theme like Turbo or Impulse?
Theme replacement on Shopify is more expensive than it looks. Every section ID, metafield reference, page-template assignment, and admin-side configuration is bound to the current theme. The audit found Craft's stock section library could compose the proposed home without major gaps, and the two custom components (the La Segreta band, the Visit band) fit cleanly as `custom-liquid` instances. The migration cost outweighed the customization friction.

### Why is the homepage a JSON file instead of Liquid?
Shopify's Online Store 2.0 lets templates be JSON files that compose section instances. That's how the homepage in this repo (`templates/index.json`) works. The benefit is that the owner can reorder, hide, or reconfigure any section from the theme editor without a code change. The constraint is that custom components need to fit a stock section type or use `custom-liquid`; both preserve admin editability.

### How do I preview the new Our Story page when the admin Page entity is still on the default template?
Add `?view=our-story` to the URL. Shopify's `?view=<suffix>` query parameter overrides the admin's template assignment at request time, so `/pages/our-story?view=our-story` renders `templates/page.our-story.json` regardless of what the admin says. Combined with `?preview_theme_id=146853724220`, this gives a shareable URL for any new page template in any unpublished theme without touching admin.

### Why no paid Shopify apps?
A monthly app subscription compounds against a small boutique's margin. Every recommendation in the redesign proposal that normally requires an app (verified reviews, embedded maps, branded newsletter capture, custom-product page features) has been or will be built as theme code in this repo. The trade-off is fewer "out of the box" automations; the boutique pays for them in custom build time once, not in a monthly fee forever.

### Why is there only one custom CSS file?
Putting all custom navigation CSS in `assets/tm-nav.css` instead of editing Craft's vendor stylesheets means the customization is greppable, removable, and survives a base-theme update without merge conflicts. The CSS load is one explicit link tag in `sections/header.liquid`.

### How is the "Visit Us" map rendered?
A Google Maps Embed iframe pointed at `/maps?q=218+N+Market+St,+Frederick,+MD+21701&output=embed`. No API key, no JS SDK, no map app. The iframe is one line in a `custom-liquid` section.

### How is the rebuild deployed?
Shopify CLI (`shopify theme push`) targeting a development theme on the store. The dev theme has a stable preview URL (`https://theterramoda.com/?preview_theme_id=146853724220`) the owner can review at each phase. Publishing to live happens only after explicit owner approval; nothing in this repo auto-publishes.

### Why are there `before/` and `after/` screenshots in the repo?
The case study renders both the live theme and the rebuild side by side. The before/after home full-page captures (`screenshots/before/home-full.png` at 2538 px tall vs `screenshots/after/home-full.png` at 4729 px tall) summarize the rebuild scope in one image: the home went from two sections to six. The screenshots are excluded from theme uploads via `.shopifyignore` so they live in the repo for case-study purposes without being pushed to Shopify.
