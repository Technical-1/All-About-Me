# Project Q&A

## Overview

Deja Vu is the official website for a 7-piece Crosby, Stills, Nash & Young tribute band. It's a React single-page app with a retro-70s aesthetic that presents the band's bios, performance videos and photos, show calendar, and a booking form. The interesting technical angle is how little it needs to run: all content lives in a small data layer, the only dynamic feature talks to a third-party API, and the whole thing deploys as static files. Built for a client.

## Problem Solved

A working tribute band needs a professional web presence that books gigs and shows off performances — without the band hiring a developer to maintain a CMS or a server. This site gives them a fast, good-looking marketing page where updating bios, videos, or shows is a small data edit, and inquiries arrive straight to an inbox.

## Target Users

- **Event bookers / venue owners** — evaluate the band via bios, video, and testimonials, then submit a booking inquiry.
- **Fans** — watch performance clips, browse photos, and check the show calendar.
- **The band** — update content (bios, videos, shows) by editing one data file, no markup changes.

## Key Features

### Band bios with a supporting-members section
The About page renders full bios for the four frontmen and a separate "Rhythm Section" list for the supporting players, all from `src/data/members.js`.

### Media gallery
A selectable YouTube player (thumbnail strip swaps the active video, iframe lazy-loaded) plus a photo grid that opens a zoom lightbox. The lightbox closes on Escape and the photo tiles are real focusable buttons, so the gallery works without a mouse.

### Show calendar
Upcoming and past shows render from data with timezone-safe date badges; "Get Tickets" buttons only appear when a show has a real ticket link.

### Booking form
A contact form that posts to Web3Forms and reports submitting/success/error states — email delivery with no backend.

## Technical Highlights

### Keyboard-accessible photo lightbox
The photo gallery originally used clickable `<div>`s and a mouse-only overlay, which trapped keyboard users. The tiles are now `<button>` elements and a scoped `keydown` listener (bound only while the lightbox is open) closes it on Escape — see `src/pages/Media.jsx`. This makes the most interactive part of the site operable without a pointer.

### Timezone-safe show dates
Show dates are stored as `YYYY-MM-DD` strings. `new Date('2025-01-15')` parses as UTC midnight, so `getDate()` returns the prior day for any US visitor. `ShowCard` (`src/components/ShowCard/ShowCard.jsx`) splits the string and builds a local-time `Date`, so the rendered day always matches the intended calendar date — without adding a date library.

### Defensive rendering on the Media page
The active video is initialized as `videos[0] ?? null` and the player block only renders when a video exists, with a graceful fallback otherwise. This removes a latent crash if the video list is ever empty.

### Lint that understands JSX
The ESLint config pairs `no-unused-vars` (with an uppercase-component ignore pattern) with `eslint-plugin-react`'s `jsx-uses-vars`, so identifiers used only inside JSX — like `motion` in `<motion.div>` — aren't false-flagged as unused. A GitHub Actions workflow runs lint and build on every PR.

## Engineering Decisions

### Static site over a CMS or server
- **Constraint**: A band, not a tech team, owns the content; the budget for maintenance is effectively zero.
- **Options**: A headless CMS, a small server with an admin UI, or static content in the repo.
- **Choice**: Static React app with content in `src/data/*.js`.
- **Why**: No infrastructure to maintain, instant deploys, and content edits are trivial diffs. A CMS would add hosting, auth, and a moving part the band would never log into.

### Third-party form API instead of a backend
- **Constraint**: The site needs to accept booking inquiries but is otherwise static.
- **Options**: A serverless function, a full backend, or a hosted form service.
- **Choice**: Post directly to Web3Forms from the client.
- **Why**: Email delivery with zero server code. The access key is public by design but still read from an env var so it can be rotated without a code change.

### Plain CSS with design tokens over a UI/CSS framework
- **Constraint**: A specific, custom retro-70s look across a handful of components.
- **Options**: A component library (Material/Chakra), a utility framework (Tailwind), or hand-written CSS.
- **Why**: The visual identity is bespoke, so a framework's defaults would be fought more than used. CSS custom properties in `global.css` keep the palette consistent at no runtime cost.

## Frequently Asked Questions

### How do I add or change a show?
Edit `src/data/shows.js` — add a record with date, venue, city/state, time, and an optional `ticketUrl`. The "Get Tickets" button only appears when the URL is a real link, so leaving it out simply hides the button.

### How does the contact form work without a backend?
`ContactForm` posts the form fields plus a Web3Forms access key as JSON to the Web3Forms API, which emails the submission to the band. The key comes from `VITE_WEB3FORMS_KEY`.

### Why is the Web3Forms key in the client bundle — isn't that a leak?
Web3Forms access keys are intended to be used client-side; they only allow form submissions to a configured destination. It's still kept in an environment variable rather than hardcoded so it can be rotated independently of the code.

### How are the band members managed?
All member data lives in `src/data/members.js` (`mainMembers`, `supportingMembers`, `bandDescription`). The About and Home pages map over those arrays, so adding a member or editing a bio never requires touching component code.

### Is the site usable on a keyboard / with a screen reader?
The interactive Media gallery is: photo tiles are buttons, the lightbox closes on Escape, and navigation uses semantic links. Footer contact details are plain text/links rather than dead anchors.

### How does it get deployed?
Vercel builds and deploys on every push to `main`. A GitHub Actions workflow independently runs lint and build on pull requests so regressions are caught before merge.

### Why React Router for a small site?
It gives clean, shareable URLs per section (`/about`, `/shows`, `/media`, `/contact`) and a single layout shell, which is simpler to reason about than ad-hoc show/hide logic — and the routes feed straight into the sitemap for SEO.
