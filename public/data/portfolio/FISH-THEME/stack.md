# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Platform | Shopify Online Store 2.0 | — | Hosting, checkout, payments and customer accounts are handled by Shopify; JSON templates and section groups keep the layout editable in the theme editor |
| Base theme | Turbo by Out of the Sandbox | 9.5.0 (`config/settings_schema.json`) | A mature commercial theme with product pages, quick view, mega menu and popup already built, so the custom work goes into what it lacks |
| Templating | Liquid | Shopify-hosted | The only server-side code a theme can run; it is where the access gates, pricing and campaign logic live |
| Client JS | Vanilla JavaScript | ES5-style, plus `FormData`, Web Crypto and `MutationObserver` | Hooks into what the theme already ships, with no added framework or bundle |
| Styling | CSS | `assets/fish-apparel.css`, 2,920 lines | A single custom sheet layered over Turbo's `styles.css.liquid` |

## Frontend

- **Framework**: none. Server-rendered Liquid, enhanced with vanilla JS.
- **Theme-bundled libraries I build on** (`assets/vendors.js`, `assets/jquery.min.js`):
  - jQuery 3.7.1
  - Flickity 2.1.2 (product galleries)
  - lazysizes 5.2.2 (image loading)
  - fancyBox 3.5.6 (lightbox and quick view)
- **State management**: none needed. Per-page state lives in the DOM. The wholesale unlock is kept in `sessionStorage`, and dismissals in cookies (the announcement-bar cookie name is derived from the campaign).
- **Styling**: one custom stylesheet with CSS custom properties (`--fish-blue: #2563eb`, red for restocks) and CSS-only loading skeletons.
- **Typography**: Oswald for every role (`config/settings_data.json` font settings, preloaded in `layout/theme.liquid`).
- **Build tool**: none. Shopify compiles the theme's `.js.liquid` and `.css.liquid` assets on its side, and their compiled outputs are gitignored.

## Backend

- **Runtime**: Shopify's Liquid renderer. A theme cannot run any other server code.
- **API style**: Shopify AJAX Cart API (`/cart/add.js`) for Quick Add, and native `{% form 'contact' %}` / `{% form 'customer' %}` posts for orders, records and signups.
- **Auth**: Shopify customer accounts and customer tags, checked in Liquid for the team form and, optionally, for wholesale. The wholesale password is a client-side SHA-256 comparison and only a convenience gate.

## Infrastructure

- **Hosting**: Shopify (managed, with assets on Shopify's CDN)
- **CI/CD**: none. Deploys are manual Shopify CLI pushes, limited to the changed files with `--only`, so the admin-edited `settings_data.json` is never overwritten.
- **Monitoring**: none beyond Shopify's admin.

## Development Tools

- **CLI**: Shopify CLI (`shopify theme dev`, `theme check`, `theme push`, `theme pull`)
- **Package manager**: npm (`package.json` holds a single devDependency)
- **Linting**: `shopify theme check`
- **Formatting**: none enforced
- **Testing**:
  - `tools/forms-proposal/check-block.js` checks the form-block writer against the pinned contract (322 assertions passing at the time of writing).
  - `check-reader.js` checks the block reader on hand-written edge cases (44 assertions, plus 5 cases the contract leaves open).
  - `check-browser.js` runs the real snippet in headless Chrome.
  - Both Node checks run with plain `node` and no dependencies.
- **Scripting**: Python 3 (standard library only) for the order-confirmation patcher and the notify-me address extractor in `tools/preorder-email/`.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `puppeteer` ^24.39.1 (locked 24.39.1) | Headless Chrome for `check-browser.js` and for rendering 300 dpi business-card prints (`tools/business-cards/generate-print.js`) |
| Flickity 2.1.2 (theme-bundled) | The product gallery carousel that `fish-variant-images.js` filters through `Flickity.data()`, `remove`, `append` and `select` |
| jQuery 3.7.1 (theme-bundled) | The theme's variant handler reads slide indices through `.data()`, so the filter writes jQuery's cache too |
| lazysizes 5.2.2 (theme-bundled) | Image loading; the photo-strip marquee calls `lazySizes.loader.unveil` itself |
| `qrcode-generator` 1.4.4 (CDN, tools only) | QR codes on the business-card designer (`tools/business-cards/index.html`) |
