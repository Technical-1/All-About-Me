# Project Q&A

## Overview

The Blackjack Card Counting Trainer is a web app for practicing advantage play — card counting, basic strategy, bet sizing, and risk management — against Vegas-accurate rules. The interesting part isn't the table UI; it's that every piece of feedback (the optimal play, the optimal bet, the projected win rate, the house edge for a given rule set) is computed from real blackjack math implemented as pure, unit-tested functions, not hard-coded charts.

## Problem Solved

Card counting only works if you count accurately, deviate at the right true counts, and size bets correctly — and you can't safely learn that at a casino. Existing trainers often drill one skill (counting speed) and either skip the money math or fake it. This app puts the full loop in one place: count a real shoe, get scored on each decision and each bet, then project what that play style earns and how likely it is to go bust, all under the exact rules you set.

## Target Users

- **Aspiring counters** — learn Hi-Lo and basic strategy, then graduate to deviations and multi-level systems.
- **Experienced players** — tune a bet spread and rule set, then read the EV/hour, risk of ruin, and N0 before risking real money.
- **Operators of a study group** — admins invite players, brand the table, and manage their roster through an in-app panel.

## Key Features

### Five counting systems
Hi-Lo, KO (unbalanced, no true-count conversion), Hi-Opt I, Hi-Opt II, and Omega II — each defined by its real card values in `src/utils/countingSystems.ts`, including multi-level counts and ace-neutral handling.

### Real-time decision and bet scoring
Every hand is graded against basic strategy and the Illustrious 18 deviations, and every bet is rated against the count-optimal bet. The feedback names your action, the best action, and why.

### Vegas-accurate house-edge calculator
Pick deck count, S17/H17, double rules, split/resplit/hit-split-aces, surrender, 3:2 vs 6:5, and dealer peek; the calculator returns a per-rule breakdown of how each setting moves the edge (`src/utils/houseEdge.ts`).

### Monte Carlo risk simulator
Project expected value, hourly win rate, standard deviation, percentile outcomes, max drawdown, and risk of ruin for your bankroll, bet spread, and rules — backed by both a sampled simulation and an analytic EV model.

### Invite-only multi-tenant access
Three roles (user/admin/dev) with server-enforced permissions, admin-scoped rosters, branding inheritance, and dev impersonation.

### Subscription billing with free and Pro tiers
The Hand Trainer and Edge Calculator are free; the table simulator, scenarios, speed drill, risk simulator, and stats unlock with Pro via Stripe Checkout (monthly/annual, 14-day trial) and a self-service portal. B2B team plans let an admin buy a tier whose invited seats inherit Pro. The whole paywall hides behind a single flag, so it can be switched on or off without a deploy.

### Demo magic links for sales
A pre-branded admin account is reachable through one `#demo=<key>` link — no signup or password — that signs the prospect straight in via a Firebase custom token while logging first/last access and visit count.

## Technical Highlights

### True count, deviations, and insurance computed from the live shoe
The trainer tracks the running count as cards leave a real shoe and converts to a true count using decks remaining, then gates the Illustrious 18 deviations and insurance decisions on that true count. This is the difference between a trainer that teaches a static strategy chart and one that teaches *count-dependent* play — the relevant logic lives in `src/utils/illustrious18.ts` and the game store's count tracking.

### Dual-path Monte Carlo simulator
`src/utils/simulator.ts` deals an actual shuffled shoe, tracks Hi-Lo, reshuffles at the configured penetration, and samples thousands of sessions to produce risk-of-ruin and percentile bands. In parallel, `calculateExpectedValue` weights a theoretical true-count distribution to return a deterministic EV/hour, hourly standard deviation, and dollar-weighted edge, and `calculateN0` reports how many hands are needed to overcome variance. The sampled path captures tail risk; the analytic path gives numbers that don't jitter run-to-run.

### Rule-driven house edge with a transparent breakdown
Rather than a single hard-coded edge, `houseEdge.ts` starts from a per-deck base and adds the measured impact of each rule variation (e.g. +0.22% for H17, +1.39% for 6:5 blackjack), returning the itemized list so the UI can show *why* a table is good or bad. Bet sizing then derives the player's edge per true count from that house edge.

### Quota-aware Firestore sync
Play generates constant settings/stats churn. `src/services/userState.ts` coalesces writes on a 60-second debounce, batch-loads all user state in parallel on login, and flushes immediately when the tab is hidden — with a per-user usage tracker so reads/writes stay visible. This keeps a continuously-interactive app inside Firestore's free tier.

### Tamper-proof entitlements behind a single flag
Paid status is written *only* by the signature-verified Stripe webhook (Admin SDK), and `firestore.rules` blocks clients from editing the `plan`/`subscriptionStatus` fields — so no client can grant itself Pro. The client never loads a Stripe SDK; it redirects to hosted Checkout/Portal and reads its plan from the live profile listener. Every access decision funnels through `src/utils/entitlements.ts`, which returns full access for everyone while `BILLING_ENABLED` is false — letting the entire billing system ship as inert code and be toggled on or rolled back without a deploy.

## Engineering Decisions

### Pure math functions vs. logic in components
- **Constraint**: Incorrect "optimal" feedback actively teaches users to lose money, so the math must be verifiable.
- **Options**: Embed strategy/EV logic in React components and the store, or isolate it as pure functions.
- **Choice**: All counting, strategy, betting, house-edge, and simulation logic lives in `src/utils/` with colocated Vitest suites.
- **Why**: Pure functions can be exhaustively tested without rendering; correctness regressions surface in CI, not in the UI.

### Server-enforced roles with Firestore rules as a backstop
- **Constraint**: Invites and role/disable operations are abuse-sensitive and must not trust the client.
- **Options**: Enforce in Firestore rules only, in Cloud Functions only, or both.
- **Choice**: Cloud Functions re-check the caller's role for every sensitive mutation, while rules independently block edits to protected fields and scope admin reads.
- **Why**: Defense in depth — multi-step operations like cascade-disable live in functions, while rules guard against any direct client write.

### Hosted Stripe Checkout vs. an embedded payment form
- **Constraint**: I needed subscriptions (with a trial, a management portal, and B2B price variants) without taking on card-data handling or a heavy client dependency.
- **Options**: Embed Stripe Elements/Payment Element on my own page, or redirect to Stripe-hosted Checkout and Portal.
- **Choice**: Redirect to hosted Checkout and the Customer Portal; the client carries no Stripe SDK and just navigates to a URL returned by a Cloud Function.
- **Why**: Hosted pages keep card data entirely off my surface, hand me trials/proration/cancel flows for free, and let me add team price tiers by passing a Price ID — at the cost of a redirect, which is a fine trade for a solo project.

### Vercel for frontend, Firebase for backend
- **Constraint**: A static SPA needs fast global hosting; auth/data/email need a managed backend.
- **Options**: All-Firebase (Hosting + Functions), all-Vercel (with serverless functions), or split.
- **Choice**: Vercel hosts the Vite SPA; Firebase handles Auth, Firestore, and callable Functions.
- **Why**: Vercel's Git-driven deploys and SPA rewrites are frictionless for the frontend, while Firebase's integrated auth + rules + callable functions fit the multi-tenant model better than rolling it on Vercel.

## Frequently Asked Questions

### How does the trainer know the "optimal" play and bet?
Decisions are checked against basic strategy plus the Illustrious 18 count deviations; bets are compared to the count-optimal bet from `src/utils/betting.ts`, which supports both fixed spreads (conservative/moderate/aggressive) and a Kelly-criterion sizing derived from the player edge at the current true count.

### Which counting systems are supported, and are the values real?
Five: Hi-Lo, KO, Hi-Opt I, Hi-Opt II, and Omega II. The card values — including the multi-level (+2/-2) counts and ace handling — are the standard published values, defined in `src/utils/countingSystems.ts`.

### Is the risk simulator just a formula, or does it deal cards?
Both. One path deals a real shuffled shoe, tracks the count, reshuffles at your penetration, and samples thousands of sessions for risk of ruin and percentiles; the other weights a theoretical true-count distribution to produce a stable EV/hour and N0. You get variance from the first and a noise-free headline number from the second.

### Why is signup invite-only?
The app is built for managed study groups. Admins invite players (and devs invite admins) through Cloud Functions that issue tokenized invites; there's no open registration, and roles can't be self-assigned.

### Can an admin customize the table for their players?
Yes. An admin sets a casino/brand name on their profile, and any user they invited inherits it through an `effectiveProfile`, so everyone under that admin sees consistent branding.

### Does playing constantly run up a Firebase bill?
No. Settings and stats writes are coalesced on a 60-second debounce and flushed when you leave the tab, state is batch-loaded in parallel on login, and a usage tracker keeps per-user reads/writes visible — all aimed at staying within the free tier.

### How is the house edge for my rules calculated?
`houseEdge.ts` starts from a base edge for the deck count and adds the measured impact of each rule you toggle (H17, 6:5 payouts, no DAS, no surrender, and so on), returning an itemized breakdown rather than a single opaque number.

### What's free and what needs Pro?
The Hand Trainer and Edge Calculator are free. Pro unlocks the full multi-seat table simulator, practice scenarios, the timed speed drill, the Monte Carlo risk simulator, and the stats/XP/achievements dashboard. The free-vs-Pro mapping lives in one place (`src/config/plans.ts`).

### Could a user just edit a request to unlock Pro for free?
No. The fields that decide plan status are written exclusively by the Stripe webhook through the Admin SDK, and Firestore security rules forbid clients from modifying them. The client only ever *reads* its plan, so there's no client-side path to a paid entitlement.

### How do team (B2B) plans work?
An admin subscribes to a Team, Group, or Academy tier. The webhook reads the price's `planType=org` metadata and writes an org entitlement (with a seat limit) to the admin's config doc. Their invited players inherit Pro by reading that doc, and `sendInvite` enforces the seat cap server-side — so one subscription covers a whole roster.

### What is the demo link, and how does it avoid signup?
A dev provisions a pre-branded admin account and shares a `#demo=<key>` link. Opening it calls the `demoLogin` function, which validates the key, logs the visit, and returns a Firebase custom token that signs the visitor straight in — no email, password, or signup step.

### Is billing always on?
It's controlled by a `BILLING_ENABLED` flag. While it's off, the app shows no paywalls and every signed-in user has full access; turning it on activates gating, and turning it back off restores open access instantly — no code change or migration.
