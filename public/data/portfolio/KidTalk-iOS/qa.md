# Project Q&A

## Overview

Kid Talk is a native iOS slang dictionary for parents: paste something your kid said and get it
explained in plain English, or go the other way and have your own sentence rewritten as kid-speak.
It's a port of an existing React web app, and the interesting constraint was that the two had to
behave *identically* — not just look alike. The term-matching engine, the cache eviction policy and
the profanity filter were all reimplemented in Swift against the same observable behaviour, down to
reproducing JavaScript's ASCII regex word boundaries instead of using Swift's Unicode-aware ones.

## Problem Solved

Slang moves faster than any dictionary ships. A parent hearing "that's lowkey bussin no cap" has no
practical way to decode it — searching each word individually gives crowd-sourced definitions of
wildly varying quality, and most of them assume you already know the register. Kid Talk decodes a
whole sentence at once against a curated set, works offline, and tells you not just what a term
means but how *not* to use it in front of your kid's friends.

## Target Users

- **Parents and grandparents** — decode a group chat without asking and being told "it's nothing"
- **Teachers** — keep up with classroom vocabulary that changes every term
- **Anyone out of the loop** — the Encode direction is mostly used for entertainment, which is fine

## Key Features

### Decode
Paste a term, a sentence, or a multi-line chat. Matched slang is highlighted inline and explained
underneath, with pronunciation and a wrong-usage warning. Every term resolves offline from the built-in
dictionary; anything unmatched shows "No slang detected" and makes no network request.

### Encode
Type what you'd normally say and get it back at three intensity levels, from "Lightly Seasoned" to
"Full Gen Alpha", plus a glossary of every slang term the model used — with curated definitions
preferred over the model's own wherever the term exists in the dictionary.

### Browse
The whole dictionary, searchable, filterable by era and type. Filter options are derived from the
live data rather than hardcoded, so community-added terms and new eras appear automatically.

### Community
Submit new terms and vote on them. Submissions are screened by a fail-closed profanity filter,
capped at five per user per UTC day, and deduplicated by slug — all enforced server-side.
Community is age-gated at 13 through Apple's Declared Age Range API on iOS 26 and later: a user
whose shared age range is under 13 sees "Community is for ages 13 and up" instead of the feed,
voting and submitting, while the rest of the app works as normal. Declining to share, an
unavailable API, or an older iOS does not lock it.

### First-run tutorial
Three cards, where the middle one runs a real decode on a real sentence using the real matcher, so
the value is visible in about five seconds rather than described in a paragraph.

## Technical Highlights

### Reproducing JavaScript regex semantics in Swift
The matcher had to return the same results as the web implementation for any input.
`NSRegularExpression`'s `\b` is Unicode-aware while JavaScript's is ASCII-only, so they disagree
next to accented characters: `rizz` matches inside "caférizz" in the browser but not with a direct
Swift translation. `TermMatcher.swift` uses explicit ASCII lookarounds instead, and a test pins the
exact case so the divergence can't creep back.

### Longest-first range claiming
Naive substring matching reports both `no cap` and `no` for the same three characters. The matcher
sorts candidates by length descending and records the character ranges it has already claimed, so a
longer term suppresses shorter ones that overlap it — while a genuinely separate `no` elsewhere in
the sentence still matches. Adding `aura farming` alongside the existing `aura` exercised this for
real, and there's a regression test for that specific pair.

### Keychain access requires a signed simulator build
Firebase Auth stores the signed-in user in the keychain. An unsigned simulator build carries no
application identifier, so there's no keychain access group to derive and every read fails with
`errSecMissingEntitlement` — sign-in appears to work, then the session silently disappears on
relaunch. The dev script signs by default because of this; the difference was measured at one
keychain error per launch unsigned versus zero signed.

### Tests that can actually fail
Two UI tests asserted that the tab bar existed after dismissing the tutorial. The tab bar stays in
the accessibility tree *behind* a `fullScreenCover`, so those assertions were already true before
the dismissal — the dismissal could have been deleted entirely and the suite would have stayed
green. They now assert that the tutorial's own content disappears, and both were verified by
mutation: break the code, watch exactly those tests fail, revert.

## Engineering Decisions

### Generated dictionary over a copied one
- **Constraint**: 126 terms have to stay identical across a JavaScript app and a Swift app, and
  they change often.
- **Options**: hand-maintain a Swift file; fetch the dictionary at runtime; generate at build time.
- **Choice**: a Node script that imports the web module and writes JSON into the iOS bundle.
- **Why**: hand-maintaining guarantees drift — the web repo already had two copies of this file
  that had silently diverged. Fetching at runtime would break the offline guarantee, which is the
  app's main advantage over a web search. Generating also validates every field's type, and a unit
  test asserts the term count so a botched regeneration fails loudly instead of shipping short.

### Firebase SDK over the Firestore REST API
- **Constraint**: the community layer needs transactions, live updates and token refresh.
- **Options**: REST with hand-rolled polling and token handling; the full Firebase SDK.
- **Choice**: the SDK, via Swift Package Manager.
- **Why**: REST supports transactions, but reimplementing snapshot listeners and auth refresh is a
  lot of subtle code to own. The SDK also ships the privacy manifests Apple now requires.

### iOS-only onboarding, recorded as a deliberate divergence
- **Constraint**: the port was held to strict parity with the website, and the website has no
  tutorial.
- **Options**: skip onboarding; build it on both platforms; build it on iOS and document the gap.
- **Choice**: iOS only, written into the parity spec as an intentional deviation.
- **Why**: first-run tutorials are a native convention and a web visitor can simply leave, but an
  app that opens on a blank text box with a tab labelled "Encode" needs a moment of explanation.
  Recording it in the spec matters as much as building it — an undocumented divergence reads as
  drift the next time someone compares the two.

### Server-side integrity rather than client validation
- **Constraint**: vote counts and submission caps have to hold against a modified client.
- **Options**: validate in the app; validate in a backend service; validate in Firestore rules.
- **Choice**: Firestore security rules, with the client transaction as a convenience layer.
- **Why**: both clients (web and iOS) would otherwise need to be trusted and kept in step. The
  rules bound each vote delta to ±1, require `netScore == upvotes − downvotes` after the write, and
  enforce the daily cap on a UTC boundary — so a hostile client can't inflate anything regardless
  of platform.

## Frequently Asked Questions

### Does it work without a connection?
Decode and Browse do, fully — a 126-term dictionary ships in the bundle as a first-launch seed,
the app syncs any newer published version once per launch and caches it to disk, and matching is
local against whichever of those is current. Encode and
the AI Insight panel call an API and show an error offline. The Community feed falls back to sample
content when Firestore is unreachable.

### What happens when a term isn't in the dictionary?
Decode shows "No slang detected" and Browse shows a no-results card, with no network request. The
AI Insight panel still explains the input, and the term can be submitted to Community. The app used
to fall back to Urban Dictionary here; that was removed because Urban Dictionary's API terms require
express permission, which the project never had.

### How does the under-13 check work?
`AgeGate` calls Apple's Declared Age Range API with a single age gate at 13 the first time
Community opens. Only a shared range whose upper bound is below 13 locks Community; a definite
answer is stored in `UserDefaults` so the system sheet doesn't reappear. The status can be pinned
by a launch argument, so UI tests cover both the locked and unlocked screens.

### Why does "rizz" not match inside "rizzler"?
Word-boundary matching. Substring matching would report "rizz" inside "drizzle" and "rizzler",
which is worse than missing it. The trade-off is that plurals and tenses don't match either —
"vibes" won't match "vibe" — which is the single biggest accuracy gap in the matcher today.

### How does the app avoid shipping a list of slurs in the binary?
The blacklist is 17 SHA-256 hashes. Submitted text is normalized first — Unicode NFKC, cross-script
confusable folding so a Cyrillic "а" can't smuggle a word past, leet substitution, separator
stripping, and collapsing repeated characters — then each word and the whole string are hashed and
compared. It fails closed: if hashing errors, the submission is blocked.

### What stops someone spamming the community dictionary?
A five-per-UTC-day cap per user, enforced in a Firestore transaction alongside the submission
write, so two rapid submissions can't both pass. Submissions are keyed by a slug of the term, so
duplicates collide at the primary key rather than racing.

### Why is the tab bar visible in accessibility tools while the tutorial is showing?
That's how `fullScreenCover` works — the presenting hierarchy stays in the tree. It matters because
it makes "the tab bar exists" a useless test assertion, which is exactly the bug that was found and
fixed in the UI tests.

### Are the iOS and web dictionaries ever out of sync?
Only for the bundled seed, and only if someone forgets to regenerate it — the live dictionary is
served from Firestore, so the two apps cannot drift from each other. The web repo owns the seed
data; `node scripts/export-dictionary.mjs` rewrites the bundled JSON, and a unit test pins the seed
term count so a stale or truncated
bundle fails the suite rather than shipping quietly.
