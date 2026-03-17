# Technology Stack

## Core Technologies

| Category | Technology | Purpose |
|----------|-----------|---------|
| Platform | Shopify | E-commerce hosting, checkout, payments |
| Base Theme | Turbo Seoul (Out of the Sandbox) | Starting point — heavily customized |
| Templating | Liquid | Server-side rendering for all custom features |
| Custom CSS | fish-apparel.css (2,200 lines) | Complete brand reskin + custom component styles |
| Custom JS | ~500+ lines across 6 snippets | Variant filtering, scroll header, gallery marquee |

## What's Custom vs. What's Theme

The Turbo Seoul theme handles the basics — product pages, collections, checkout. Everything interesting is custom code I wrote:

| Feature | Built With | Paid App It Replaces | App Cost (2026) |
|---------|-----------|---------------------|----------------|
| Variant image filtering | Vanilla JS + Flickity API | SA Variant Image Automator (4.9★) | $14.90/month |
| Wholesale ordering system | Liquid + SHA-256 JS + Shopify contact form | Wholesale Pricing Discount B2B (4.8★) | $24.99/month |
| Infinite scroll photo gallery | requestAnimationFrame JS + DOM duplication | Theme's static grid | N/A |
| Free shipping progress bar | Pure Liquid (no JS) | Hextom Free Shipping Bar Premium (4.9★, 3k+ reviews) | $9.99/month |
| Quick Add to Cart | fetch('/cart/add.js') | EZ Quick Buy & Quick View | $4.99–$8.99/month |
| Scroll-aware header | requestAnimationFrame JS | N/A (feature didn't exist) | — |
| Mega menu product grid | Liquid collection loop | N/A (theme only supported links) | — |
| Newsletter + Instagram section | Shopify native `{% form 'customer' %}` | Klaviyo Email (~$30/mo at 1k contacts) | $20–$30/month |

## Frontend

- **Fonts**: Google Dosis (logo/nav/headlines), Arial/Helvetica Neue (body)
- **Colors**: Electric blue `#56bdec`, dark `#16161d`, gold accent `#c79f5c`
- **Carousel**: Flickity (theme-included, I hook into its API for variant filtering)
- **Lightbox**: Fancybox (theme-included)
- **No additional JS libraries** — all custom code is vanilla JavaScript

## Infrastructure

- **Hosting**: Shopify (managed)
- **Domain**: fuckitshithappens.org
- **CDN**: Shopify's built-in CDN for all assets
- **Email**: Shopify native contact forms (no third-party email service)

## Development Tools

- **CLI**: Shopify CLI (`shopify theme dev`, `shopify theme push`)
- **Local Dev**: http://127.0.0.1:9202 with hot reload
- **Linting**: `shopify theme check`
- **Version Control**: Git
- **OG Image Generation**: Puppeteer (HTML template → PNG screenshot)

## Business Tools (Non-Shopify)

| Tool | Built With | Purpose |
|------|-----------|---------|
| Business card generator | HTML + CSS + QR code library | Interactive card designer with 4 layouts, print specs |
| Social media strategy | HTML + CSS + JS tabs | 4-tab report: posting schedule, campaigns, AI content, B2B collabs |
| OG image template | HTML + CSS + Puppeteer | Branded 1200x630 social preview image |

## Key Technical Decisions

### Vanilla JS Over Libraries
Every custom feature uses vanilla JavaScript — no React, no jQuery beyond what the theme includes. Keeps the site fast and avoids dependency bloat on a platform where every millisecond of load time affects conversion.

### requestAnimationFrame for Animations
Both the gallery marquee and scroll header use `requestAnimationFrame` instead of CSS animations or `setInterval`. This gives 60fps performance and avoids the sub-pixel rounding errors that caused the gallery's white flash glitch with CSS `@keyframes`.

### Client-Side Over Server-Side
The wholesale password check uses client-side SHA-256 hashing instead of a server proxy. Since we can't run custom backend code on Shopify without an app, and the wholesale page is just a contact form (not actual checkout), client-side validation is the pragmatic choice.
