# Project Q&A

## Overview

TradeSlate is a multi-tenant management platform for field-service businesses — jobs, customers, scheduling, invoicing, and card payments in one real-time dashboard. The most interesting part is the payments layer: each business connects its own Stripe account and customer card payments are charged directly on that account, so money settles to the business and the platform never touches the funds.

## Problem Solved

Small service businesses (HVAC, plumbing, electrical, cleaning) juggle scheduling, a CRM, invoicing, and a separate payment processor — often across spreadsheets and disconnected tools. TradeSlate puts the operation in one place, and lets a non-technical owner accept card payments that land in their own bank without learning Stripe.

## Target Users

- **Business owners** — run the whole operation, connect payments, see balances and payouts.
- **Managers** — configurable access to jobs, customers, scheduling, and team management.
- **Technicians** — a focused view of their assigned jobs and schedule.

## Key Features

### Card payments that settle to the business

Owners take card payments on any invoice. Charges are created on the owner's own Stripe connected account, so funds deposit to their bank; the platform takes no fee. Balance, recent payouts, and refunds are all available in-app.

### Embedded payment onboarding

Connecting Stripe happens inside the app via Stripe's embedded onboarding component — no redirect and no separate Stripe dashboard to learn. The platform pre-fills business details so setup is short.

### Role-based access control

Owner / manager / technician roles are enforced consistently in route middleware, in the UI via a `usePermission()` hook, and in every API route via a `withRbacAuth()` wrapper.

### Real-time operations

Firestore listeners keep jobs, customers, and schedules live across everyone signed in to a tenant.

## Technical Highlights

### Direct charges on per-tenant connected accounts

The payment intent is created on the tenant's connected account (`stripe.paymentIntents.create(params, { stripeAccount })`), and the browser initializes Stripe.js with that same account so confirmation targets it. The charge amount is always derived server-side from the authoritative job record — the client never supplies an amount. Code lives in `app/lib/integrations/stripe/` and `app/api/payments/create-intent`.

### Idempotent, fail-closed payment webhook

A job is marked `paid` only by the Stripe `payment_intent.succeeded` webhook (`app/api/payments/webhook`), not by a client callback. The endpoint verifies the signature, refuses to run if the signing secret is missing (so an unsigned payload can never be processed), and claims each event id once so Stripe's retries are safe.

### Server-side Firestore uses the Admin SDK to avoid serverless hangs

The Firebase client SDK has no auth context server-side and can block until a function times out (30s → 504). Every server-side Firestore access uses the Admin SDK, lazy-imported so `firebase-admin` never enters a client bundle — which removed intermittent timeouts on the payment endpoint.

### Permissions carried in the JWT

Role, tenant owner id, and permissions are stored as Firebase custom claims and synced by Cloud Functions on role changes. Checks read from the verified token instead of hitting Firestore on every request, while remaining centralized and revocable.

## Engineering Decisions

### Stripe Connect Express vs. Standard

- **Constraint**: owners are non-technical and must keep their own money, but shouldn't have to manage Stripe.
- **Options**: Standard accounts (owner manages a full Stripe dashboard) vs. Express (platform-managed, lightweight) vs. pooling funds on the platform account.
- **Choice**: Express accounts with direct charges and embedded onboarding.
- **Why**: pooling funds makes the platform a money transmitter; Standard pushes Stripe complexity onto the owner. Express keeps the money the owner's while hiding the dashboard, and embedded onboarding keeps them in the app.

### Webhook as the source of truth for payment state

- **Constraint**: money state must be correct even if the browser drops after payment.
- **Options**: trust the client confirmation result, or rely on the server webhook.
- **Choice**: only the signature-verified, idempotent webhook flips a job to `paid`.
- **Why**: the database matches Stripe's ledger regardless of client behavior, and retried deliveries don't double-apply.

### One environment variable to switch test/live

- **Constraint**: validate everything in Stripe test mode, then go live without re-adding credentials.
- **Options**: swap the single set of keys at cutover, or keep both sets and select at runtime.
- **Choice**: keep `*_TEST` and `*_LIVE` keys side by side and resolve them by a single `STRIPE_ENV` value (defaults to test).
- **Why**: switching is one variable, nothing gets re-entered, and a freshly provisioned environment defaults to test so it can't accidentally charge real cards.

## Frequently Asked Questions

### Where does the money go when a customer pays?

Directly to the business owner's own Stripe account and bank. Charges are created on their connected account; the platform isn't in the flow of funds and takes no fee beyond standard processing.

### Does an owner need to understand Stripe?

No. They connect through an embedded onboarding step inside the app (a one-time identity + bank verification, which Stripe requires of everyone) and never open a Stripe dashboard. Balances, payouts, and refunds are surfaced in the app.

### How is the dashboard protected per tenant and role?

Permissions live in the Firebase auth token as custom claims. Middleware guards routes, a `usePermission()` hook gates UI, and `withRbacAuth()` enforces action/resource checks plus tenant ownership on API routes.

### How are refunds handled?

A `manage`-level user hits a Refund action on a paid job; the server refunds the original payment intent on the tenant's connected account and marks the job `refunded`. The amount and account are derived server-side from the job record.

### Why is the dashboard served from `/hub`?

It's the app's authenticated workspace. The route segment is `/hub`; some internal identifiers retain an older name on purpose to avoid migrating stored permission/claim data, which would change access control for no user benefit.

### Can it integrate with accounting tools?

Yes — QuickBooks Online and Google Calendar via OAuth, with credentials environment-switched between sandbox and production.
