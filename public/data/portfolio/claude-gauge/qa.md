# Project Q&A

## Overview

A macOS menubar meter that shows quota for several Claude Code accounts at once.
Each account has its own separate quota pool, and nothing in the product shows
them together — the in-session status line only ever knows about the account
whose session it is drawing. This sits in the menubar and answers the question
you actually have: **which account has room right now.** The interesting part is
that it is deliberately read-only against a credential store it does not own, and
that most of what it displays costs no network requests at all.

## Problem Solved

Running several accounts in parallel means quota exhaustion arrives without
warning: you find out you are out of headroom when work stops, and you have no
idea which of your other accounts to move to. The information exists — it is just
scattered across separate Keychain entries and only visible one account at a time
from inside a session. This puts all of it in one glance.

## Target Users

- **Anyone running more than one Claude Code account** — sees at a glance which
  account has headroom, and which is about to run out
- **Anyone running many concurrent sessions** — sees how many sessions are on each
  account, and can jump straight to the one they want

## Key Features

### One field per account in the menubar
`⑴ 22%  ⑵ 100%  ⑶ 6%` — the worst gauged window for each account. Every failure is
a distinct readout with a different fix: `--` means not signed in, `429` means
rate-limited, `7%~` means the meter is serving the last good value while it backs
off. An expired token shows its last reading rather than an error, because the
accounts whose tokens lapse are the idle ones whose numbers have not moved.

### A session list per account, with click-to-focus
Each account opens a submenu of its running sessions, named by project directory
and session title, with a live working/idle indicator. Clicking one brings its
terminal window to the front.

### Burn rate with a reset-aware projection
When the five-hour window is measurably filling, the menu shows
`▲ 24%/hr on 5-hour · full in 2h 55m`. A percentage tells you where you are; a
rate tells you whether the account survives the next two hours. The projection is
withheld when the window resets before the projected exhaustion — quoting a wall
that gets cancelled by a reset is worse than quoting nothing.

### A lifetime token odometer
A running total of every token ever processed across all accounts — data the usage
endpoint does not expose at all. Deliberately the *only* token figure in the UI: a
per-account token count is a magnitude with no decision attached, so it was
removed in favour of the burn rate, which answers an actual question.

## Technical Highlights

### Telling an expired token apart from a rate limit
The usage endpoint returns **429 for an expired access token**, not 401. Handled
naively, every account with a stale credential reads as "rate limited", and you
switch away from an account that was actually fine. `poll()` in `src/accounts.rs`
checks the token's `expiresAt` *before* spending a request, which is the only way
to tell the two apart — and it only works in that order.

Knowing which it is then changes what gets shown. Tokens live about eight hours
and the CLI only refreshes its own while running, so an expired token means the
account is idle, and its last reading is still true. It is displayed rather than
replaced by an error. The exception is a window whose reset has passed: that one
has refilled, so it reads 0%, which is the single number the app shows without
having measured it.

### Surviving rate limits instead of amplifying them
The first version polled every 60 seconds per account with no backoff, so a single
429 triggered a retry every 60 seconds and sustained the condition indefinitely.
`src/cache.rs` now holds a per-account freshness floor shared by every caller, an
exponential backoff that honours `Retry-After`, and the last good reading so a
transient refusal never blanks the display. The Refresh menu item deliberately
bypasses the freshness floor but **not** the backoff.

### Naming and reaching sessions through the tty
Listing sessions with meaningful names, and raising the right window on click,
means matching a running process to a terminal tab. `src/sessions.rs` and
`src/terminal.rs` join on tty: `ps -o tty=` gives one per process, and Terminal
exposes a title per tab keyed by the same tty. Every alternative I measured
fails — transcripts are appended and closed rather than held open, so `lsof`
reveals nothing, and matching a process to a transcript by start time is clean
for an isolated session (5s versus 11,765s to the runner-up) but a coin flip for
three concurrent sessions in one directory (55s versus 70s).

Two details make it correct and cheap. Processes are matched on `comm` being
exactly the CLI's name: matching the command line instead counts shell wrappers
that inherit the account environment variable, which over-reported eleven
sessions as thirteen. And the AppleScript fetches every tab's tty and title in
two bulk property reads rather than a nested loop — a nested loop costs one Apple
Event round-trip *per property access*, which measured 362ms against 75ms for
byte-identical output.

### An odometer that is incremental and never rewinds
A lifetime token total cannot re-parse a gigabyte of transcripts every five
minutes. `src/odometer.rs` exploits the fact that transcripts are append-only:
it records a byte offset per file and reads only what is new, taking 5.4s on the
first pass and 0.6s afterwards. Two details matter — reading stops at the last
*complete* line, because a file being written can end mid-line and advancing past
it would drop those tokens permanently; and a deleted transcript keeps its
contribution, because an odometer measures what was spent, not what still exists.

## Engineering Decisions

### Read-only against a credential store I do not own
- **Constraint**: The stored credential contains a refresh token, and expired
  access tokens are common.
- **Options**: Refresh transparently; refresh and write the new pair back; or
  refuse to refresh at all.
- **Choice**: Never write to the Keychain, never refresh.
- **Why**: Refresh tokens rotate. Spending one without persisting the new pair
  invalidates the credential its owner holds — a read-only status display would
  silently sign you out of the account it reports on. Writing it back instead
  means racing another process for its own credential store. A meter is not worth
  either risk, so expiry became a displayed state with a one-step fix.

### Polling on a timer rather than consuming a push feed
- **Constraint**: The tool being measured hands live quota data to its status line
  on every render, for free. Consuming that would eliminate all network requests.
- **Options**: Register as a status-line command and cache what gets pushed; keep
  polling on a timer; or do both.
- **Choice**: Keep polling.
- **Why**: The push only fires while a session is actively rendering. An idle
  account would stop reporting and its cached value would silently rot — and an
  idle account is exactly when you most need to know it has room. A menubar meter
  is ambient: it must be correct when nobody is looking, which is the one thing a
  render-triggered feed cannot promise. The measured cost of polling is 36
  requests an hour.

### A config file seeded by discovery, rather than continuous discovery
- **Constraint**: Accounts are directories on disk, and retired ones often remain
  after they stop being used.
- **Options**: Discover every candidate on each run; hardcode a list; or discover
  once and hand the result to the user.
- **Choice**: Discovery seeds a JSON config on first run, and never touches it
  again.
- **Why**: A meter that lists dead accounts trains you to ignore it. Continuous
  discovery cannot tell a retired root from an active one, but a human can — so
  the program makes the guess once and the user owns the answer.

### An icon authored in HTML, and judged at 32px
- **Constraint**: The app needed an icon. The artwork is a gauge — an arc, ten
  tick positions and a needle, all placed trigonometrically — and it has to hold
  up from 1024px down to 32.
- **Options**: Hand-write SVG path data; use a vector editor; or generate it.
- **Choice**: An HTML file that computes the geometry in JavaScript, rasterised
  at 2048px by headless Chrome and downsampled into an `.iconset`.
- **Why**: The arc endpoints and tick positions are calculated, not drawn, so
  writing them as code means changing the needle position is editing one
  constant — an SVG with the same content is a wall of precomputed coordinates
  that cannot be adjusted without recomputing them. Cheap iteration also made the
  real lesson findable: the first icon was dark elements on a dark ground with
  4px strokes, which have no silhouette below 128px, and a mark with no
  silhouette cannot carry a personality however it is styled. Inverting to
  dark-on-cream is what fixed it. Candidates must be compared by *rendering* at
  32px rather than downscaling a large bitmap — downscaling blurs a thin stroke,
  rendering drops it, so a bitmap comparison flatters designs that will not
  survive.

## Frequently Asked Questions

### Does this ever change my sign-in state?
No. It reads Keychain entries and never writes them, and it never performs a token
refresh. The worst it can do to an account is spend a rate-limited read.

### Why does an account show `429` when its quota is nearly empty?
Because the usage endpoint rate-limits on how often you *ask*, independently of
how much quota you have consumed. Seeing `429` at 1% utilisation means too many
requests, not too little headroom — which is why the app enforces a shared
freshness floor and backs off rather than retrying.

### How does it know which account a session belongs to?
Each session inherits an environment variable naming its config directory, which
the app reads from the process table. An unset variable means the default account
— that is how the tool itself addresses it.

### Why do the token counts not match the quota percentage?
They measure different things and one cannot be derived from the other. Quota is
weighted by model and caching in ways the transcripts do not expose. The token
figures also deliberately exclude cache reads, which outnumber everything else by
roughly 150× and would otherwise produce a number that mostly tracks cache hits.

### Can I click a session that is not in a terminal window?
No, and it is shown greyed out rather than hidden. Sessions started without a
controlling terminal still consume quota, so hiding them would make the submenu
disagree with the account's session count.

### What happens if I run two copies?
The second one notices the first holds a lock file and exits with a notification
instead of adding a duplicate menubar item. The lock is an advisory `flock` rather
than a PID file, so it cannot go stale — the kernel releases it even if the app is
force-quit.

### How do I add or remove an account?
Edit `~/.config/claude-gauge/roots.json`. It is seeded on first run from whatever
config directories exist and is never rewritten afterwards, so entries you delete
stay deleted.
