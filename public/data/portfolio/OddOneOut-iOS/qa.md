# Project Q&A

## Overview

Odd One Out for iOS is the native iPhone client for the browser party game at
[oddoneout.games](https://oddoneout.games): everyone in a room is asked the same
question except one player, whose question lands on a similar answer, and nobody
is told who, including them. The app is a full SwiftUI port of the web client
that speaks the production server's existing protocol, so iOS and web players
share the same rooms in the same games. The interesting engineering constraint
is fidelity under independence: two clients on different release cadences have
to render the same game from the same wire without either being able to break
the other.

## Problem Solved

The web game already ran fine in mobile Safari, but a browser tab is a fragile
place for a party game: backgrounding kills the socket and the camera, home
screen installs handle permissions unpredictably, and there is no App Store
presence for the person in the group chat who asks "is there an app?". The
native client keeps a seat through suspensions, treats the call as a first-class
citizen, and adds the one thing a website cannot: a first-launch practice round
so a new player learns the game before their first real room.

## Target Users

- **Groups who already play on the web** and want the phone experience to
  survive being backgrounded mid-round
- **New players** who arrive from an App Store search and need to understand a
  fairly unusual game in one guided round

## Key Features

### A practice round before the first real game
On first launch the app offers one complete scripted round against three bots,
played through the real game screens: answer, see the reveal, vote, and get away
with being the odd one out. Skippable, replayable from settings, and it never
touches the network.

### The whole game, natively
Lobby with host settings, answering with the skip vote, the reveal, discussion,
voting, the blind-mode steal, results and scoring, all re-tinting the entire
screen as the phase changes, exactly like the site.

### Shared rooms with the web
A four-letter code is the only join mechanism. Friends without the app play from
a browser in the same room against the same server.

### Custom question rooms
Everyone writes questions in the lobby; the server generates each one's secret
counterpart and deals so an author is never their own question's imposter. The
app keeps question texts on the writer's device and shows other players only
counts.

### In-app voice and video
Publish with camera or voice only over Cloudflare's Realtime SFU, shared with
web callers, in a collapsible grid so faces do not crowd out the question.

## Technical Highlights

### A wire mirror that cannot be broken by a newer server
The server's schemas are TypeScript and the app ships through review on a
delay, so the Codable mirror in `OddOneOut/Protocol/` is tolerant by
construction: enums decode unknown values to a safe fallback, new fields are
optional, and a malformed frame parses to nil instead of throwing. The
regression that motivated this is pinned in a test: a strict enum once meant
one new server-side score reason silently discarded the entire result frame.

### A tutorial that is the game, not a copy of it
`PracticeScript` sits on the socket layer's send hook, swallows the player's
outbound messages, and answers with scripted server frames. The standard phase
screens run a complete round without knowing they are offline, so the tutorial
cannot drift from the real game and no onboarding UI exists to maintain.

### A hand-written SFU client in Swift
Cloudflare Realtime exposes an HTTP API rather than an iOS SDK, so publish,
pull and renegotiation live in `CallController` on raw peer connections.
Inbound tracks arrive on anonymous transceivers, so attribution to a player
hangs on the `mid` the SFU reports per pulled track. Teardown is sequenced,
camera stop before connection close, because frames delivered into a closing
connection are a crash vector in libwebrtc.

### Reconnection built for how iOS actually kills apps
A suspended app loses its socket silently. The connection layer combines
per-room seat tokens (seat, score and locked answer survive on the server), an
exponential backoff for network flaps, and a scene-phase hook that reconnects
immediately on foregrounding instead of waiting out the backoff.

## Engineering Decisions

### Native port over a WebView wrapper
- **Constraint**: The web client already worked in Safari; the port had to earn
  its cost.
- **Options**: A WKWebView shell; a cross-platform framework; a native port.
- **Choice**: Full SwiftUI with native WebRTC.
- **Why**: Camera permission flows and background behaviour inside a WebView
  read as broken to users, and the call is the feature that suffers. Native
  also enables the practice round and keeps the binary to one dependency.

### Mirror the protocol by hand instead of generating it
- **Constraint**: Two languages, one wire format, releases not in lockstep.
- **Options**: Codegen from the TypeScript schemas; a hand-written mirror.
- **Choice**: Hand-written, with tolerance rules and tests that pin the
  constants and copy against the server's.
- **Why**: Codegen guarantees freshness but inherits strictness, and strictness
  is the failure mode that actually bites a delayed client. The mirror is a few
  hundred lines and the tolerance rules are the deliberate part.

### One dependency, system frameworks for everything else
- **Constraint**: WebRTC is required and Apple does not provide it.
- **Options**: Larger networking or UI stacks; just libwebrtc.
- **Choice**: stasel/WebRTC alone; URLSession sockets, SwiftUI Observation and
  UserDefaults cover the rest.
- **Why**: Every package in an App Store binary is review surface, size and
  supply-chain exposure. Nothing else in the app needed one.

## Frequently Asked Questions

### Do iOS and web players really share the same games?
Yes. The app connects to the same production server, the same room codes and
the same rules engine. A mixed group needs nothing coordinated; whoever lacks
the app uses the browser.

### What happens if I get a call or switch apps mid-round?
Your seat, your score and any answer you already locked live on the server.
When the app comes back to the foreground it reconnects immediately and the
server replays the current phase. You rejoin where the room actually is.

### How does the practice round work without a server?
A scripted engine intercepts your actions at the socket layer and plays the
server's role for one round, through the same screens the real game uses. It
exists so the game's central trick, not being told you are the odd one out,
can be experienced once safely before it happens to you for real.

### Why iOS 17 and iPhone only?
iOS 17 brings the Observation framework the state layer is built on. The game
is designed around a phone held in one hand at a party; an iPad layout would
be a different design, not a bigger one.

### Does the app track anything?
No analytics, no ads, no accounts. It stores a nickname and per-room rejoin
tokens on the device, and deleting the app removes them. The optional feedback
flag sends the round context and nothing about answers or votes.

### Can I write my own questions on iOS?
Yes. When the host switches the room to custom questions, everyone writes up
to five in the lobby. Texts stay on your device until dealt; other players see
only how many you have written.
