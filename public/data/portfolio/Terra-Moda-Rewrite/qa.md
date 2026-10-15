# Project Q&A

## Overview

Terra Moda is a Shopify storefront rebuild for a family-owned sustainable fashion boutique in Frederick, Maryland. The store carries men's, women's, children's, and dog products from artisan vendors with Fair Trade, B-Corp, and GOTS credentials. We took the home page from two sections (a single cover photo and a 400-word text block) to a seven-section editorial storefront, added the brand's first social proof and a dedicated vendor-vetting page, and did it all on the existing Craft theme. The interesting technical angle is the line-drawing: the theme stays in place, every page is a JSON section composition the owner can edit, and the genuinely new components (a women's-collection band, a "Visit Us" map block, a vetting standards grid) ship as `custom-liquid` instances rather than new section files.

## Problem solved

The store had a strong physical presence and a real brand story, but the website was not converting any of it. The home page had exactly two sections, zero products visible above the fold, no social proof, an empty footer, and a dead 175 KB asset loading on every page. The brand's strongest differentiator — vendor vetting against real third-party standards — was completely invisible. The audit found the code was clean stock Craft; the problem was composition and configuration. The fix is a rebuilt seven-section homepage, customer testimonials, a "How we vet" transparency page, polished brand-story and contact templates, a custom nav, and a phased rollout of trust and conversion features that ship as theme code instead of paid apps.

## Target users

- **The boutique's online shoppers**: a homepage that actually shows what's for sale, real customer testimonials, a scannable founder story they can tap one click deeper, and a "Visit Us" section that turns the website into a door to the Frederick store.
- **The boutique owner**: a Shopify theme they can edit in the admin (every page section is a JSON entry they can reorder or hide), with no new monthly app subscriptions.
- **The boutique's in-store shoppers doing pre-purchase research**: a site that mirrors the in-store experience and explains the vetting they'd hear about on the floor. Research from Forrester and Criteo flags this research-online-buy-offline behavior at ~92% of in-store purchases.

## Key features

### A JSON-composed homepage (seven sections)
The home page is `templates/index.json`: an editorial hero with dual CTAs, a four-tile category grid, a featured-collection product grid, a three-column value strip with one "Read Our Full Story" door, a customer-testimonials block, a custom La Segreta band for the women's collection, and a Visit Us section with an embedded Google Map. Each section is a JSON entry the owner can reorder from the theme editor without code changes.

### Customer testimonials — the storefront's first social proof
The `testimonials` section carries three named, location-tagged quotes ("What they're saying," eyebrow "From our customers") from Frederick-area customers. It uses Craft's stock testimonials section, so it shipped immediately and the owner edits the quotes in the admin. This is curated social proof; the verified per-product star-rating system is a separate Phase 2 custom build.

### A "How we vet" transparency page
`templates/page.how-we-vet.json` makes the brand's vetting legible: an intro that frames Terra Moda as "a curator, not a certifier," a three-standard reference grid (Fair Trade Certified, Certified B Corporation, GOTS) with what each one verifies and a link to the certifying body, a forest-green stat band quantifying the catalog (100% of the baby line organic, 98% natural fibers, 9 credentialed vendors), and a Vustra vendor spotlight. It's linked from the footer Company menu, and it replaced a redundant inline "Trust" block in the footer.

### A localized "One Size" badge
`snippets/card-product.liquid` shows a forest-green "One Size" badge on any product card whose sizing option has exactly one value. It matches the option name against `size`, `taglia`, and `talla`, so it keeps working if the store ever runs in Italian or Spanish.

### Custom Our Story and contact pages
`templates/page.our-story.json` composes the brand narrative as founder copy plus image-with-text values (Fair Labor, Sustainability, Premium Craftsmanship, Small Business Always). `templates/page.contact.json` pairs a branded "Get in Touch" intro hero with the native Shopify `contact-form` section and drops the duplicate Formful app block.

### Self-sufficient mega menu
`assets/tm-nav.css` plus updates to `sections/header.liquid` and `snippets/header-mega-menu.liquid` add a theme-driven mega menu with category images and a compact button-anchored dropdown. It overrides Craft's default `.mega-menu__list display: grid` (which was squeezing menu items into six columns), opens on hover, uses locale-safe URLs, and needs no admin dependency on every change.

### Embedded Visit Us section
The "Visit Us" component is a `custom-liquid` band on the homepage and a standalone block on the contact page. It renders a Google Maps iframe (`?q=218+N+Market+St,+Frederick,+MD+21701&output=embed`) plus address, hours, and a "Get Directions" CTA. No paid map app, no JS SDK.

### Phased rollout
Phase 1 (homepage rebuild + quick wins) is shipped to the development theme. Phase 2 (testimonials, the How-we-vet page, the One Size badge, trust features, custom reviews built in code, nav redesign, product-card hover, footer overhaul) is in progress. Phase 3 (product-page polish, mobile, local SEO) is scheduled. Every phase ships to a dev theme first; the owner approves before publish.

## Technical highlights

### `templates/index.json` is the entire homepage
The home page is seven declarative section entries: `hero`, `categories`, `new_arrivals`, `why`, `testimonials`, `lasegreta`, `visit`. Each entry names a section type, supplies its settings, and (where applicable) defines blocks with their own settings. The whole composition is data, which means the owner can hide the value strip, edit a testimonial, or swap the order of categories and new-arrivals from the theme editor without a code change. This is the JSON-section pattern Shopify introduced in Online Store 2.0; the design tax is that custom components must fit either a stock section type or `custom-liquid`, both of which preserve admin editability.

### `custom-liquid` as a deliberate escape hatch
The La Segreta band, the Visit Us band, and the "How we vet" standards grid and stat band don't fit any stock Craft section. The natural impulse is to write new `sections/*.liquid` files with full schemas. Instead they live as `custom-liquid` section instances inside their JSON templates, with markup and scoped CSS embedded as a JSON string. This keeps each component inside its page template (one source of truth for "what's on this page") and lets the owner remove it from the editor as easily as any other section. The cost is that the embedded HTML is harder to read in JSON; the trade pays off because the components only vary by collection image and CTA link, both resolved at render time via `{{ collections[...] }}`.

### A locale-aware product badge with no metafield
The "One Size" badge in `snippets/card-product.liquid` could have been driven by a per-product metafield the owner toggles. Instead it's derived: the card loops `options_with_values`, downcases each option name, and matches `size`/`taglia`/`talla`; if that option has exactly one value, the badge renders. This means zero data entry — the badge appears automatically for genuinely one-size products — and it's resilient to a future locale switch because it checks the Italian and Spanish option names too.

### `?view=<suffix>` decouples preview from admin
Shopify Pages bind to templates via an admin-side field. New page templates (`page.our-story.json`, `page.how-we-vet.json`, `page.contact.json`) only render when the admin Page entity selects them, which means the rebuild can't be reviewed end to end until the owner clicks through every page in the admin. The `?view=<suffix>` query parameter overrides the template assignment at request time, so `/pages/how-we-vet?view=how-we-vet` renders the new template regardless of admin state. Combined with `?preview_theme_id=`, this gives a single shareable URL that previews any new page template inside any unpublished theme without touching admin.

### Single-purpose custom CSS file
All custom navigation CSS is in `assets/tm-nav.css`, loaded from `sections/header.liquid`. None of the vendor Craft stylesheets are touched, and section-specific styling stays scoped inside each `custom-liquid` block's own `<style>` tag. When Craft ships a base-theme update, the diff against the new vendor files stays clean. Removing the nav customization is `rm assets/tm-nav.css` plus one link tag.

## Engineering decisions

### Customize Craft, don't replace it
- **Constraint**: The store had two years of accumulated product metafields, redirects, app integrations, and Shopify-side detail tied to the existing theme.
- **Options**: Replace with a paid theme (Turbo, Impulse), migrate to Dawn, or customize Craft in place.
- **Choice**: Customize Craft in place.
- **Why**: Theme replacement on Shopify is non-trivial because every section ID, metafield reference, and template assignment is theme-coupled. Migrating would have meant rewriting product templates and reassigning every page. The audit found Craft's section library could compose the proposed home; only two genuinely new homepage components were needed, and both fit as `custom-liquid`.

### JSON section composition over hard-coded Liquid templates
- **Constraint**: The homepage needed seven distinct content blocks (and the vetting page four), several of which the owner should be able to reorder or edit without involving a developer.
- **Options**: Write a single hand-coded Liquid template per page, or compose each page from configurable section instances in JSON.
- **Choice**: JSON composition.
- **Why**: A JSON template makes every section a row in the theme editor. Marketing copy, category tile images, product collection selection, testimonial quotes, and value-strip text are all editable from the admin instead of requiring a code edit. The escape hatch for new components is `custom-liquid`, which preserves the editor pattern while allowing arbitrary HTML.

### Curated testimonials now, verified reviews in code later
- **Constraint**: The proposal cites social proof as the single highest-impact addition for purchase likelihood, and the audit found the storefront had none. Shopify's built-in reviews app is retired; every market alternative for verified per-product reviews is a paid monthly subscription.
- **Options**: Add a paid app (Judge.me $15+/mo, Yotpo, Loox), skip social proof entirely, or ship curated testimonials immediately and build verified reviews in custom code.
- **Choice**: Ship three curated testimonials now via Craft's stock section, build verified per-product reviews as a Phase 2 custom Liquid + JS component backed by Shopify metafields.
- **Why**: The curated testimonials close the "zero social proof" gap today with no new dependency. The recurring cost of a review app compounds against a small boutique's margin, so the deeper review system is built once in code. The trade-off is no built-in collection-email automation, which is solvable with a single Shopify Flow trigger.

### Make vetting a page, not a footer line
- **Constraint**: The brand's vendor vetting is its strongest differentiator and was invisible on the site; a scattered footer "Trust" block didn't carry the weight.
- **Options**: Leave the footer block, expand it inline, or build a dedicated page.
- **Choice**: A dedicated `page.how-we-vet.json` with a standards grid, a catalog stat band, and a vendor spotlight, linked from the footer; remove the redundant footer block.
- **Why**: A page can explain what each standard verifies and where it applies with depth a footer line can't, and gives the owner one URL to point partners and customers at.

### Embed Google Maps, don't use a map app
- **Constraint**: The Visit Us section needs an interactive map. Shopify has paid map-app options. Plain Google Maps Embed is free and requires no SDK.
- **Options**: Paid map app, Mapbox with a JS SDK, or Google Maps Embed iframe.
- **Choice**: Google Maps Embed iframe.
- **Why**: Zero JS, no API key, no monthly cost, lazy-loaded. The iframe is one line. The trade-off is no custom map styling, which Direction 3 didn't ask for.

## Frequently asked questions

### Why customize Craft instead of switching to a paid theme like Turbo or Impulse?
Theme replacement on Shopify is more expensive than it looks. Every section ID, metafield reference, page-template assignment, and admin-side configuration is bound to the current theme. The audit found Craft's stock section library could compose the proposed home without major gaps, and the new components (the La Segreta band, the Visit band, the vetting standards grid) fit cleanly as `custom-liquid` instances. The migration cost outweighed the customization friction.

### Why is the homepage a JSON file instead of Liquid?
Shopify's Online Store 2.0 lets templates be JSON files that compose section instances. That's how the homepage (`templates/index.json`) and the "How we vet" page (`templates/page.how-we-vet.json`) work. The benefit is that the owner can reorder, hide, or reconfigure any section — including editing testimonial quotes — from the theme editor without a code change. The constraint is that custom components need to fit a stock section type or use `custom-liquid`; both preserve admin editability.

### What's the difference between the homepage testimonials and the Phase 2 reviews?
The homepage `testimonials` section is curated social proof: three hand-picked customer quotes the owner manages in the admin, using Craft's stock section. It shipped immediately. The Phase 2 work is a verified, per-product review-and-rating system — the kind that normally requires a paid app — built as custom theme code so it carries no monthly fee. They solve different jobs: brand-level trust on the home page vs. product-level conversion on the PDP.

### How does the "One Size" badge know when to show?
It's derived, not toggled. `snippets/card-product.liquid` loops the product's `options_with_values`, downcases each option name, and checks whether it contains `size`, `taglia`, or `talla`. If that sizing option has exactly one value, the card renders the badge. No metafield, no per-product data entry, and it survives a switch to Italian or Spanish because it matches those locales' option names.

### How do I preview the new How We Vet or Our Story page before reassigning templates in admin?
Add `?view=<suffix>` to the URL. Shopify's `?view=<suffix>` query parameter overrides the admin's template assignment at request time, so `/pages/how-we-vet?view=how-we-vet` renders `templates/page.how-we-vet.json` regardless of what the admin says. Combined with `?preview_theme_id=`, this gives a shareable URL for any new page template in any unpublished theme without touching admin.

### Why no paid Shopify apps?
A monthly app subscription compounds against a small boutique's margin. Every recommendation in the redesign proposal that normally requires an app (verified reviews, embedded maps, branded newsletter capture, custom product-page features) has been or will be built as theme code in this repo. The trade-off is fewer "out of the box" automations; the boutique pays for them in custom build time once, not in a monthly fee forever.

### Why is there only one custom CSS file?
Putting all custom navigation CSS in `assets/tm-nav.css` instead of editing Craft's vendor stylesheets means the customization is greppable, removable, and survives a base-theme update without merge conflicts. The CSS load is one explicit link tag in `sections/header.liquid`. The custom-liquid bands keep their own styling scoped inside their `<style>` blocks, so they travel with the component.

### How is the "Visit Us" map rendered?
A Google Maps Embed iframe pointed at `/maps?q=218+N+Market+St,+Frederick,+MD+21701&output=embed`. No API key, no JS SDK, no map app. The iframe is one line in a `custom-liquid` section.

### How is the rebuild deployed?
Shopify CLI (`shopify theme push`) targeting a development theme on the store. The dev theme has a stable preview URL the owner can review at each phase. Publishing to live happens only after explicit owner approval; nothing in this repo auto-publishes.

### Why are there `before/` and `after/` screenshots in the repo?
The case study renders both the live theme and the rebuild side by side, so a visitor can follow the scope of the work without a meeting. The before/after home captures summarize it in one image: the home went from two sections to seven. The screenshots are excluded from theme uploads via `.shopifyignore` so they live in the repo for case-study purposes without being pushed to Shopify.
