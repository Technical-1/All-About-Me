# Project Q&A

## Overview

E350 Transportation is the marketing and booking website for a luxury ground-transportation company in the Cincinnati / Northern Kentucky area. It showcases the fleet and services and converts visitors into leads through a single booking form that emails the business and auto-replies to the customer. The interesting technical angle is how much reliability and spam resistance is packed into one serverless endpoint — no database, no third-party form service, just a carefully ordered request pipeline.

## Problem Solved

A small transportation business needs a professional web presence and a dependable way to capture booking requests. Off-the-shelf form widgets add monthly cost and a third-party dependency, while a full backend is overkill for a workflow that ultimately just sends an email. This site threads that needle: static marketing pages for speed and SEO, plus one self-contained API route that validates, filters spam, and delivers booking emails.

## Target Users

- **Prospective customers** — People who want a quote for airport transfers, group transport, or a luxury ride, and can submit a booking request in under a minute.
- **The business owner** — Receives a cleanly formatted booking email with every detail and the customer's address set as reply-to, so responding is one click.

## Key Features

### Per-service marketing pages
Separate pages for the Yukon XL, Mercedes Sprinter, and airport-transfer services, each with its own metadata layout so search results and link previews are tuned to the specific offering.

### Booking form with dual email delivery
A single submission triggers two emails: a formatted notification to the business inbox and a friendly confirmation auto-reply to the customer, both rendered as HTML and plain text.

### Built-in spam protection
A hidden honeypot field plus a per-IP rate limiter sit in front of email delivery, so automated submissions are dropped without any CAPTCHA friction for real visitors.

### Scroll-aware navigation
The header is transparent over the homepage hero and turns solid once the user scrolls or visits an interior page — and it paints the right state even on a hard reload mid-page.

## Technical Highlights

### One Zod schema, validated on both client and server
The contact form's shape lives once in `src/lib/validations.ts`. `BookingForm.tsx` feeds it to React Hook Form through `zodResolver` for instant client feedback, and `api/contact/route.ts` re-runs the same schema with `safeParse` so nothing untrusted reaches the email layer. Because `ContactFormData` is inferred from the schema and consumed by `email.ts`, a change to the rules surfaces as a type error rather than a runtime surprise. The passenger field is a good example: it stays a string (matching the raw input value) but is refined to a whole number between 1 and 20, rejecting `"0"`, `"-5"`, and `"abc"` in one place.

### A four-stage request pipeline with status-code-aware failure handling
The contact route (`src/app/api/contact/route.ts`) runs honeypot → rate limit → validation → email in a deliberate order, cheapest check first. The honeypot path returns a `200` with no email so bots get no signal; rate-limit returns `429`; bad input returns `400` with field errors; a failed business email returns `500`. The customer confirmation is sent in its own try/catch so a bouncing customer address can't fail a request whose business notification already succeeded.

### Scroll state that survives a mid-page reload
`Header.tsx` debounces the scroll listener to keep the handler cheap, but it also reads `window.scrollY` once on mount. Without that initial read, a hard refresh part-way down a page would briefly render the transparent hero header over solid content; the explicit read paints the correct solid/transparent state on first frame.

### HTML email with escaped, structured output
`email.ts` builds both text and HTML bodies and runs every user-supplied value through an `escapeHtml` helper before interpolating it into the markup, so a booking message can't inject markup into the business's inbox. The business notification sets `replyTo` to the customer's address, making the owner's reply land directly with the customer.

## Engineering Decisions

### Honeypot + rate limiter instead of a CAPTCHA
- **Constraint**: A public form needs spam protection, but a luxury brand wants a frictionless experience and minimal third-party dependencies.
- **Options**: reCAPTCHA / hCaptcha, a paid form service, or homegrown filtering.
- **Choice**: An off-screen honeypot field combined with a per-IP sliding-window rate limiter, both enforced server-side.
- **Why**: Zero friction and zero external services for real users; bots that trip the honeypot are silently accepted so they don't learn to adapt.

### Required vs. best-effort emails
- **Constraint**: A booking should notify the business and reassure the customer, but those two emails differ in importance.
- **Options**: Send both and fail the request if either fails, or fire-and-forget both.
- **Choice**: Make the business notification required (`500` on failure) and the customer confirmation best-effort (caught and logged).
- **Why**: The business must never lose a lead because a customer typo'd their email; the priority is encoded in the route's control flow.

### In-memory rate limiter with the limitation written down
- **Constraint**: Proper serverless rate limiting needs shared state (a KV store), but that's infrastructure the current traffic doesn't justify.
- **Options**: Ship nothing, ship a KV-backed limiter now, or ship a simple limiter with a documented upgrade path.
- **Choice**: A small in-memory sliding-window limiter, with a module-level note that it must be swapped for Upstash / Vercel KV before relying on it under real serverless load.
- **Why**: It deters casual abuse today at no cost, and the known limitation is documented at the source rather than hidden.

### SMTP via Nodemailer rather than an email SaaS
- **Constraint**: Booking emails must be delivered reliably without locking the business into a vendor.
- **Options**: SendGrid/Resend/Postmark SDKs, or plain SMTP.
- **Choice**: Nodemailer pointed at any SMTP host, configured purely through environment variables.
- **Why**: The business can use its existing Gmail (with an App Password) or any provider, and swapping providers is a config change, not a code change.

## Frequently Asked Questions

### How does the booking form prevent spam without a CAPTCHA?
Two layers. A hidden `company` field (the honeypot) is included in the form but positioned off-screen and marked `aria-hidden`; humans never fill it, bots usually do, and the server silently `200`s any submission that has it filled. Separately, a per-IP sliding-window rate limiter caps how many requests one address can send in a ten-minute window.

### What happens if the customer's email address is invalid?
Nothing breaks for the business. The booking notification to the business inbox is sent first and, if it fails, returns a `500`. The customer confirmation is sent afterward inside its own try/catch — if that address bounces, the error is logged but the request still succeeds.

### Why is the same validation defined only once?
The Zod schema in `src/lib/validations.ts` is imported by both the form and the API route, so client-side and server-side rules can never drift apart. The `ContactFormData` type is inferred from it and used by the email builder, which means a schema change is caught at compile time across the whole flow.

### Does the site need a database?
No. Every page is statically rendered and the only server-side logic is the contact endpoint, which validates input and sends email. There's no persistence layer to operate or secure.

### How is the email configured?
Through four environment variables — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. The transport infers a secure connection when the port is 465. `.env.example` documents the Gmail App Password setup as the default path.

### Why does the header look different on the homepage versus other pages?
The header is transparent so it can sit over the homepage hero image, then becomes solid white once you scroll past the top or navigate to any interior page. It also checks the scroll position on load, so refreshing part-way down a page shows the solid state immediately instead of flashing the transparent version.

### Can I deploy this somewhere other than Vercel?
Yes. It's a standard Next.js app — `npm run build` produces the static pages and the serverless function. It runs on Vercel or any Node-capable host. The one thing to revisit for a high-traffic serverless deployment is the in-memory rate limiter, which should be moved to a KV store so its state is shared across function instances.
