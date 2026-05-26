# Project Q&A

## Overview

Limitimer Pro is a real-time speaker timer and audience-voting web app for boards, conferences, HOAs, and any meeting that needs a visible countdown and a credible way to take a vote. It replaces dedicated countdown hardware (DSAN Limitimer and similar, typically $900–$2,350) and per-event electronic voting kits (often $18K+) with a browser-based tool that runs on any device in the room. The interesting technical angle is that all room state lives in a Y.js CRDT replicated peer-to-peer through a stateless PartyKit relay — there is no authoritative application server, and clients keep working through brief disconnects via IndexedDB.

## Problem solved

Speaker timers and meeting voting are well-served at the high end and badly served at the low end. A small board, a community meeting, or a regional conference rarely wants to rent a $20K vote-clicker rig but still needs:

- a timer the entire room can see, color-coded by urgency
- votes that can be opened, closed, and tallied without the chair walking around with a clipboard
- an auditable log of who started what and when, that a secretary can attach to the minutes

Limitimer Pro covers that whole stack in one URL.

## Target users

- **Meeting chairs / board secretaries** — need a vote opened, closed, and tallied with a record of the result.
- **Conference / event hosts** — need a visible speaker timer with named presets (5 min talk, 2 min Q&A, etc.).
- **Speakers and panelists** — need to glance at a phone or laptop and instantly know "green, fine — yellow, wrap up — red, stop."
- **Audience members / voting participants** — open a URL, pick an option, see confirmation.

## Key features

### Real-time collaborative timer
Start, pause, resume, and reset are reflected on every connected device within a fraction of a second. Named presets are stored in the room's Y.js document, so the controller's preset list shows up on the speaker's screen too. Color-coded thresholds (green → yellow → red → black) are configurable per timer.

### Voting with quorum, weighted votes, and proxy
Create a motion, list 2–10 options, choose anonymous (SHA-256 hashed voter ID) or recorded mode, and set an optional quorum percentage. Participants tap their choice on a phone; the controller sees the tally update live with a quorum indicator.

### Audit log with hash chain
Every meaningful event — room join, timer start/pause/reset, vote opened/closed/cast — is appended to a per-room Y.js array. Each entry's SHA-256 includes the previous entry's hash, so any later edit breaks the chain. Controllers can export the log as CSV for the minutes.

### Four role-based views
The same app serves four screens chosen at join time: **Controller** (full management), **Speaker** (timer + status), **Participant** (cast votes), **Display** (full-screen color-changing timer for a projector or back-of-room TV).

### Offline-tolerant
Y.js writes go to IndexedDB first and sync when the WebSocket reconnects. A controller can keep running the timer through a flaky hotel Wi-Fi blip and everyone catches up automatically.

### Subscription tiers
Free tier covers timer + anonymous voting + small rooms. Pro / Organization tiers unlock recorded voting, quorum enforcement, CSV export, and larger rooms — gated client-side via `subscription.js#enforceFeature` with Firestore as the trusted source of the user's tier.

## Technical highlights

### Y.js + PartyKit instead of an application server
All room state — the timer, the votes, the audit log, the participant list — lives in a single Y.js document per room. The PartyKit handler in `party/index.ts` only broadcasts binary sync frames between connected clients; it never decodes them. This means the relay is stateless and trivially horizontally scalable, and the app works through brief disconnects because IndexedDB (`y-indexeddb`) keeps a local mirror that syncs on reconnect.

### Tamper-evident audit log
`app/js/audit-logger.js` builds an append-only chain where each entry's SHA-256 includes the previous entry's hash, anchored to a genesis value of `"0"`. A controller (or anyone they email the export to) can re-hash the chain to detect insertion, deletion, or reordering after the fact. It's not on-chain notarization, but it's enough to make "who edited the minutes?" answerable for boards and HOAs.

### Stripe webhook is the only source of the user's tier
Firestore rules in `firestore.rules` explicitly block clients from writing the `tier`, `stripeCustomerId`, or `subscriptionStatus` fields on their own user doc. The Stripe webhook in `functions/index.js` is the only thing that updates them, using the Firebase Admin SDK. The client reads the tier once and gates features locally, so toggles and modal opens stay snappy without per-action server checks.

### Anonymous voting via salted hash, not "we promise not to look"
Anonymous mode stores `hashVote(voteId, deviceId, optionIndex)` in `voteResponses` instead of the raw voter ID. The controller sees the tally update in real time but cannot reverse the hash to attribute a vote, and the audit log records a `VOTE_CAST` event without the voter ID for anonymous votes.

## Engineering decisions

### Y.js CRDT with peer-to-peer relay (vs. authoritative server)
- **Constraint**: A live meeting can't tolerate "the server is down" the way a SaaS dashboard can; the timer has to keep counting.
- **Options**: Authoritative WebSocket server with replicated state, Firestore real-time, or a Y.js CRDT through a relay.
- **Choice**: Y.js documents synced via PartyKit, mirrored to IndexedDB locally.
- **Why**: CRDTs merge conflict-free without arbitration, IndexedDB makes refreshes and short outages invisible to users, and PartyKit lets me serve thousands of simultaneous rooms from a free-tier relay because it never touches application state.

### Vanilla JS in the PWA (vs. React/Vue/Svelte)
- **Constraint**: The UI is four screens dominated by Y.js observers; users will load this on phones and shared conference-room laptops.
- **Options**: A SPA framework with state management, or vanilla ES modules.
- **Choice**: Vanilla JS with Vite for dev/build.
- **Why**: Y.js observers already are the state management. A framework would add bundle size, ceremony, and reactive abstractions that fight Y.js rather than help it.

### Tier gating in the client with Firestore as source of truth
- **Constraint**: Most paid features (recorded voting, quorum, CSV export) need to feel instantaneous; the user must not be able to forge their own tier.
- **Options**: Re-check entitlements server-side on every gated action, or read the tier once and gate locally.
- **Choice**: `subscription.js#enforceFeature` does local checks; Firestore rules prevent the client from changing its own tier.
- **Why**: It keeps the UX fast, the trust boundary is at the Firestore rule, and the worst case of a stale read is that a downgraded user sees one extra feature for the rest of their session.

### Four role-specific screens (vs. one adaptive UI)
- **Constraint**: A controller, a participant, a speaker, and a back-of-room display want very different layouts; the display screen sits on a TV that nobody touches.
- **Options**: One responsive UI with role-based hide/show, or four discrete screens.
- **Choice**: Four screens declared in `app/index.html`, with `main.js#showScreen` switching between them.
- **Why**: Each role's screen stays small and reviewable, the wrong UI never leaks across roles, and the projector-display screen is reduced to just the giant timer and color background.

## FAQ

### How does the timer stay in sync across devices?
The controller writes timer state (`status`, `duration_seconds`, `remaining_seconds`, `color`) into a Y.js map. Every other client observes that map and re-renders. The Y.js update flows through `sync-provider.js` → PartyKit → all other peers in the same room, usually within a few hundred ms.

### What happens if the network drops mid-meeting?
Each client keeps writing to its local Y.js document, which is mirrored to IndexedDB by `y-indexeddb`. When the WebSocket reconnects, Y.js merges the local and remote changes automatically — CRDT semantics guarantee no conflicts, just a deterministic merge. The user usually only notices a brief "Disconnected" indicator.

### How does anonymous voting actually work?
In anonymous mode the client computes `hashVote(voteId, deviceId, optionIndex)` (SHA-256) and writes that hash into `voteResponses` instead of the voter ID. The controller can still count votes by option but cannot map a response back to a participant. The audit log records `VOTE_CAST` without the voter ID for anonymous votes.

### Is the audit log legally binding?
No — it's tamper-evident, not notarized. The SHA-256 chain means anyone with the exported CSV can verify that the log wasn't edited after the meeting, which is what boards and HOAs usually need for minutes. If you need court-grade evidence, you'd want a notarization service on top.

### How do I run my own instance?
Clone the repo, `npm install` at the root and in `app/`, fill in `app/.env.local` with your Firebase project's web config, set `VITE_PARTYKIT_HOST` (or default to `localhost:1999`), then `npm run dev` to run the app and PartyKit concurrently. Stripe is optional until you want to enable paid tiers.

### Why both Firebase and PartyKit?
They solve different problems. Firebase Auth and Firestore handle user identity and the subscription tier (where I need server-trusted state). PartyKit handles the per-room WebSocket fan-out for Y.js sync (where I need fast, stateless broadcast). Trying to do real-time CRDT sync on Firestore alone was painful — too many small writes and no native binary protocol.

### Can a participant join without an account?
Yes. Participants just open the room URL (`/r/<ROOMCODE>`) and pick a display name. Only the controller needs to be signed in, because that's where billing tier is checked. The participant's device gets its own deviceId and shows up in the Y.js `participants` map.

### What's the room-size limit?
PartyKit's free tier handles plenty of concurrent connections per room for the meetings I've tested. The Free product tier intentionally caps room size to a small number (e.g., 10) via `room_meta` and the Stripe-tier gates raise that. The technical ceiling is a Y.js + WebSocket fan-out question, not a backend-load one, since the relay never touches the document.

### Where does the alarm sound come from?
The expired-timer alarm is an HTML5 `<audio>` element with both OGG and MP3 sources for browser compatibility (`main.js#handleTimerExpired`). It's optional and will fail gracefully if the browser blocks autoplay.
