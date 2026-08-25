# Project Q&A

## Overview

Odd One Out is a browser party game for three to twelve people. Everyone is asked
the same question except one player, who is asked a different one that lands on a
similar answer, and nobody is told who — including the person who got it. Everyone
answers, the answers are revealed at once, the group argues, then votes. The
interesting engineering problem is that the entire game is one secret held on a
server: any client that could discover the imposter would break it, so disclosure
is a function of game phase enforced in a single place and verified by a test
suite that inspects every frame each socket receives.

## Problem Solved

Party games that work over a video call are mostly card decks with a website
bolted on, and the ones that involve a hidden role usually tell the hidden player
who they are. That produces acting rather than confusion. Here the imposter
answers their question completely sincerely, watches everyone react strangely to a
perfectly reasonable answer, and has to work out mid-argument that something is
wrong. It needs no download, no accounts, and each player's question stays private
on their own phone.

## Target Users

- **A group already on a call** — FaceTime, Discord or Zoom, wanting something to
  do that is talking rather than watching. In-app voice and video means the call
  is optional.
- **People around a table** — everyone still needs their own phone so the
  questions stay private, but no call is required.

## Key Features

### Two questions, one secret
A round draws one topic set and two of its questions. Each device receives only
its own. The pair is never assembled client-side.

### Two reveal modes
*Open*, the default, puts the question most of the room was given on screen with
the answers, so the argument has something concrete to push against and the
imposter discovers mid-argument that they never had it. *Blind* shows nothing
until the result, which is much harder and unlocks a steal phase where a caught
imposter gets one guess at what everyone else was asked.

### In-app voice and video
Join with video or voice only, with mute and camera toggles reflected on everyone
else's tile, and a collapsible grid so faces do not crowd out the question.

### A vote to bin a dud question
Any player can vote to throw out the current question. A strict majority redeals
it, twice per round. The tally is public; who voted is not.

### Three decks
Safe, Party and Unhinged, cumulative so a spicy room still gets variety. Unhinged
requires the host to acknowledge what is in it.

## Technical Highlights

### Disclosure is a phase function, and a test suite watches the wire
Every competitor that assigns roles client-side is defeated with devtools. Here
the imposter's identity and both questions exist only inside the Durable Object;
each socket receives one question; answers and votes are buffered server-side and
released in a single broadcast. `apps/game/test/anticheat.test.ts` drives real
sockets against a real Durable Object, captures every frame each one receives, and
asserts none of that appears before its phase. The suite was validated by
deliberately changing the server to broadcast questions instead of whispering
them, and confirming five of its tests failed.

### Rules that need no runtime to test
`apps/game/worker/game.ts` holds every rule and imports nothing from Cloudflare;
`room.ts` holds sockets, storage and alarms and holds no rules. Scoring, tie
handling and the imposter cooldown are exercised as plain functions, and only the
genuinely runtime-dependent behaviour needs workerd. The split also made a
security property easy to state: `publicPlayers()` and `publicSkip()` are the only
functions that produce anything broadcast, so reviewing what may leak means
reading two functions.

### Pairing rules encoded rather than trusted to the author
A round only works if both questions draw from the same answer space. Sentiment
sets ask one subject from opposing poles, and the compatibility matrix rules out
combinations that produce dead rounds — "favourite car" against "dream car"
returns the same answer from both. Subject sets came out of playtesting and are
stronger: every variant asks about something different but returns one declared
unit, so the answer carries no information at all and the only tell is the
defence. "How many times have you said thank you this month" against "how many
times have you said fuck" is the same number either way.

### Track attribution in a hand-written SFU client
Cloudflare Realtime exposes an HTTPS API rather than a browser SDK, so publish,
subscribe and renegotiation are written by hand in `apps/game/src/useCall.ts`.
Inbound media arrives on anonymous transceivers, so the only reliable link between
a video element and a player is the `mid` the SFU reports for each pulled track.
The app secret never leaves the Worker; clients receive session and track ids
only, which are useless without it.

## Engineering Decisions

### An SFU rather than peer-to-peer video
- **Constraint**: Up to twelve players, mostly on phones, and it has to stay free
  at the scale a group of friends plays at.
- **Options**: Full-mesh WebRTC with STUN and a TURN fallback; a hosted SFU; a
  self-hosted SFU.
- **Choice**: Cloudflare Realtime SFU, on the same account as the rest of the app.
- **Why**: In a mesh, six players means each phone encoding and uploading five
  streams, which drains batteries. An SFU keeps the upload constant. Peer-to-peer
  also does not avoid the metered path, because the minority of networks that
  block UDP still need a TURN relay. Normalised to a six-player half-hour session,
  the free allowance here works out roughly ten times larger than the
  minute-based free tiers of comparable services.

### No accounts, seats held by a scoped token
- **Constraint**: Phones drop sockets constantly, and a player who backgrounds the
  app must not lose their seat, their locked answer or their score.
- **Options**: Full accounts; a session cookie; a signed token in local storage.
- **Choice**: An HMAC token over room and player id, stored client-side.
- **Why**: No sign-up friction for a game someone joins from a group chat, and no
  session table to keep. Scoping it to one room means a token is worthless
  anywhere else. Browsers evict local storage, so rejoining by code and nickname
  always works as a fallback.

### Four-character room codes, with rooms that expire
- **Constraint**: Codes get read aloud over a call, so they need to be short and
  unambiguous. That caps the space at about a million.
- **Options**: Longer codes; a code space that is never reclaimed; expiry.
- **Choice**: Four characters from an alphabet with `0/O` and `1/I` removed, plus
  a six-hour inactivity sweep that deletes the room.
- **Why**: Without expiry, a small space fills permanently. The Durable Object
  already needs an alarm for phase timers, so the sweep shares it.

### One Worker for the app, the API and the socket
- **Constraint**: A stateful realtime server and a static site are usually
  deployed separately.
- **Options**: Static host plus a separate realtime service; one Worker for both.
- **Choice**: One Worker, with Durable Objects behind it.
- **Why**: Deep links, the WebSocket upgrade and the request-time Open Graph
  rewrite all work without CORS or a second deploy. The rewrite in particular
  depends on serving the document ourselves, which is what makes the social card
  correct on any domain with no build-time configuration.

## Frequently Asked Questions

### If the imposter is not told, how do they ever find out?
In the default mode they find out from the reveal: the question most of the room
was given appears alongside the answers, and they realise they never saw it. From
that point they are arguing for an answer they already gave in good faith, which
is the part that makes the game funny.

### Could someone open devtools and see who the imposter is?
No. Their device never receives it. The imposter's identity and the other question
stay inside the Durable Object until the result frame, and answers and votes are
withheld until everyone has submitted. There is a test suite whose only job is
inspecting every frame to confirm that.

### What stops two questions producing obviously different answers?
The pairing rules. Sentiment sets may only pair across different sentiment poles;
subject sets must declare the unit every answer shares. Both are enforced in code
and audited over the whole corpus in the test suite, so a set that could not
produce a good round fails the build rather than reaching a game.

### Why is the steal phase only in blind mode?
It asks the accused which question the room had. Open mode has already printed
that on screen, so the guess would be free.

### What happens if my phone drops the connection mid-round?
Your seat, your locked answer and your score are all held on the server. The
client reconnects with backoff, immediately on returning to the foreground, and
replays only what you were already entitled to see for the current phase.

### Does the in-app call work on restrictive networks?
Usually. Most clients reach the SFU over plain STUN, and for networks that block
UDP the Worker mints short-lived TURN credentials including a TLS relay on port
443, which is indistinguishable from ordinary HTTPS traffic.

### Can I play with people on Android and desktop?
Yes. It is a browser app with no downloads, installable to a home screen if you
want it to behave like one.

### How do you know a question is any good?
Whether the imposter gets caught is recorded per pairing. A pairing sitting near a
fifty percent catch rate is working; above eighty-five percent the answers give it
away, below twenty percent there is no signal to read. Tracking it per pairing
rather than per topic matters, because one subject can produce a great round in
one combination and a dead one in another.
