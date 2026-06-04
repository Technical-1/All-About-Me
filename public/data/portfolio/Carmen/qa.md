# Project Q&A

## Overview

Blues Brothers Live is a single-page promotional and booking site for a long-running musical tribute act. It walks a visitor through the act's track record, performance videos, a photo gallery, and a venue technical rider, then funnels them into a booking form. The interesting technical angle is that it does all of this as a pure static React bundle — no backend — while still handling email delivery, spam, media playback, and accessibility correctly on the client. Built for a client.

## Problem Solved

A working act needs a credible web presence that converts interest into booking inquiries, and it needs to be cheap to host and trivial to keep online. This site gives venues and event planners everything they need to evaluate and book the act — proof of experience, video, technical specs, and a contact path — without anyone having to run or maintain a server.

## Target Users

- **Event planners and venue bookers** — get the act's credentials, see live footage, download the technical rider, and submit a booking request in one place.
- **Production / sound engineers** — pull the backline and audio specs and the stage plot PDF before a show.
- **Casual visitors and fans** — browse photos and videos.

## Key Features

### Booking form without a backend
The form collects event details and emails them through a serverless form endpoint. A hidden honeypot field catches automated submissions and discards them silently, so the act gets real inquiries without a bot-mail problem and without any server to operate.

### Interaction-gated video showcase
Embedded YouTube performances stay paused on page load, then begin playing immediately when a visitor selects a thumbnail — achieved by conditionally building the embed URL rather than pulling in the YouTube player SDK.

### Keyboard-navigable photo lightbox
The gallery opens into a full-screen viewer that supports arrow-key navigation and Escape-to-close, presents itself as an `aria-modal` dialog, and locks background scroll while open.

### Technical rider for venues
An accordion lays out audio, drums, bass/guitar, keyboard, and horn-section requirements, alongside a downloadable PDF rider and a stage-plot image — the practical artifacts a venue's production team actually asks for.

## Technical Highlights

### Reference-counted body-scroll lock
Two unrelated surfaces — the mobile nav menu and the gallery lightbox — both need to freeze background scrolling. `src/hooks/useBodyScrollLock.js` solves the composition problem with a module-level lock counter and a saved "previous overflow" value: the first lock sets `overflow: hidden`, and only the last release restores the original. A per-component boolean would let one closing overlay unlock scroll while another was still open; the counter makes the hook correct regardless of open/close order.

### Autoplay driven by a URL parameter, not a player SDK
`VideoShowcase.jsx` tracks a `hasInteracted` flag and only appends `&autoplay=1` to the embed `src` once the user has chosen a video (`VideoShowcase.jsx:58`). This delivers a quiet initial load plus one-click playback without adding the YouTube IFrame Player API and its async player lifecycle — the behavior comes entirely from how the iframe URL is constructed.

### App-wide reduced-motion support
The whole tree is wrapped in `<MotionConfig reducedMotion="user">` (`App.jsx:15`), so every Framer Motion animation across every section honors the OS "reduce motion" preference from a single declaration. New sections inherit the behavior automatically instead of each having to check the preference themselves.

### Client-side spam filtering on a public endpoint
Because the form's access key is necessarily visible in a static client, the booking form (`BookingForm.jsx`) includes an off-screen honeypot `botcheck` input. Real users never see or fill it; a populated value short-circuits to a fake success state so bots get no signal that they were caught, and the real submission never goes out.

## Engineering Decisions

### Static site over a server-backed app
- **Constraint**: The only dynamic need is emailing one booking form; everything else is presentational.
- **Options**: A Node/serverless API to relay the form, a CMS-backed app, or a fully static build with a third-party form service.
- **Choice**: Static React build plus Web3Forms for delivery.
- **Why**: It removes hosting, secrets, and uptime concerns for what is fundamentally a brochure. Deployment is "upload static files," and the form still reaches an inbox.

### One global stylesheet over a CSS-in-JS or utility framework
- **Constraint**: A handful of distinct sections with bespoke layouts, edited by hand.
- **Options**: CSS modules, a utility framework, a styling library, or a single global stylesheet.
- **Choice**: One global `index.css` with section-scoped class names.
- **Why**: For a site this size, scoped class naming is enough to avoid collisions, and a single file keeps the styling easy to scan and tweak without a build-time styling toolchain.

### Local state only, no state library
- **Constraint**: No data is shared across sections — each manages its own open/active flags.
- **Options**: A global store (Redux/Zustand) or plain React state.
- **Choice**: `useState`/`useRef` per component.
- **Why**: There is no cross-cutting state to justify a store; co-locating state with the component that owns it keeps each section self-contained.

## Frequently Asked Questions

### How does the booking form send email without a server?
The form POSTs its fields as JSON to the Web3Forms API from the browser. Web3Forms relays the submission to the configured inbox. The site itself stays static — there is no API route or server process involved.

### How does the spam protection work if there's no backend to validate against?
A hidden honeypot field (`botcheck`) sits off-screen and is skipped by `tabIndex={-1}` and `aria-hidden`. Humans never fill it; bots that auto-fill every field do. When it's populated, the handler returns a fake "success" without sending anything — so the bot sees no failure to retry against.

### Why do the performance videos not autoplay when the page loads?
By design. The embed URL omits the autoplay parameter until the visitor clicks a thumbnail, which both respects browser autoplay policies and avoids a noisy landing experience. Once a video is chosen, it plays right away.

### Can a venue get the technical requirements without contacting anyone?
Yes. The Technical Requirements section has an expandable breakdown of audio and backline specs and a "Download Full Technical Rider (PDF)" button, plus a stage-plot image.

### Does the site work with reduced-motion accessibility settings?
Yes. A single `MotionConfig reducedMotion="user"` at the app root disables animations for visitors whose OS requests reduced motion, across every section.

### Is the photo gallery usable with a keyboard?
Yes. With the lightbox open, the left/right arrow keys move between photos and Escape closes it; the overlay is exposed as a modal dialog for assistive technology.

### What happens if the form submission fails?
The UI shows an error message asking the visitor to try again or use the direct phone/email contact shown alongside the form, and the message auto-clears after a few seconds.
