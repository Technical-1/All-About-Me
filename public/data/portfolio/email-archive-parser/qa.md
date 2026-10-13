# Q&A

## Overview

`@technical-1/email-archive-parser` is a TypeScript library that parses OLM and MBOX email archives into typed `Email` objects and then extracts structured signal from them — the services someone signed up for, what they purchased, what they subscribe to, and which senders are newsletters. It runs in both Node.js and the browser and ships as CommonJS and ESM with full type declarations.

## Problem Solved

Email archive exports are messy. Gmail Takeout, Thunderbird, Apple Mail, and Outlook for Mac each emit slightly different formats; bodies arrive base64- or quoted-printable-encoded in a grab-bag of charsets; multipart MIME nests arbitrarily; and a single export can run to multiple gigabytes. On top of all that, the *interesting* information — accounts, receipts, recurring charges, newsletter senders — is buried in unstructured text. This library does the unglamorous parsing and decoding work, then turns the result into typed records a developer can actually query.

## Target Users

- Developers building email or inbox-analysis tools who need a reliable parser rather than reinventing MBOX/OLM handling.
- Data-export and privacy tooling that lets people see what services and subscriptions are tied to their email.
- Archivists and researchers working with large historical email exports.

## Key Features

- **Two parsers** — OLM (Outlook for Mac ZIP archives) and MBOX (Gmail Takeout, Thunderbird, Apple Mail), with streaming for large MBOX files.
- **Account detection** — recognizes 150+ known service domains across streaming, e-commerce, social, banking, development, communication, and more.
- **Purchase detection** — finds order/receipt/invoice emails, screens out promotional noise, and extracts amounts in 8 currencies.
- **Subscription detection** — identifies recurring services, infers billing frequency, and normalizes prices to a monthly figure when — and only when — a billing cadence is found.
- **No invented data** — unknown dates are `null`, unknown cadences are left unset, and `Email.size` is a real UTF-8 byte count, so downstream code can tell "unknown" apart from a real value.
- **Newsletter detection** — flags newsletter and promotional senders, pulls out unsubscribe links, and estimates sending frequency.

## Technical Highlights

### Charset-aware MIME and RFC 2047 decoding (`src/utils.ts`)
`decodeQuotedPrintable` and `decodeHeaderValue` accumulate raw bytes from `=XX` sequences, base64, and literal characters, then decode them together through `TextDecoder` using the charset declared in the header or encoded-word. Surrogate pairs are detected and encoded as a unit, so emoji and other astral code points survive instead of getting corrupted by a naive per-character byte mask. Unknown charset labels degrade gracefully to UTF-8.

### Boundary-safe domain matching (`src/detectors/domainMatch.ts`)
Every detector resolves a sender domain through `matchKnownDomain`, which matches only on exact equality or a true subdomain suffix (`domain.endsWith('.' + key)`) behind a `hasOwnProperty` guard. This is what keeps `fedex.com` from matching `x.com`, `amazonaws.com` from matching `amazon.com`, and `gmail.com`/`hotmail.com` from being flagged as promotional senders.

### Locale-aware multi-currency amount parsing (`src/utils.ts`, `src/detectors/purchase.ts`)
`parseMoney` resolves the decimal separator from its position and the currency rather than assuming a format, so `1.234,56` (European), `1,234.56` (US), and `1'234.56` (Swiss) all parse to the right number. It is shared by the purchase and subscription detectors, so a fix to money handling lands in both. In `PurchaseDetector`, context patterns prefer amounts that sit next to "order total"/"amount charged" wording across USD, EUR, GBP, JPY, CAD, AUD, INR, and CHF.

### Robust MBOX message splitting (`src/parsers/mbox.ts`)
Messages are split on `From ` lines, but only when a three-letter weekday token follows the sender — accepting both the ctime (`Mon Jan  1`) and RFC 2822 (`Thu, 15 Jan`) forms — so prose body lines are never mistaken for boundaries. Body lines are mboxrd-unescaped (`>From ` loses one `>`), and chunked reads carry a leftover tail across boundaries so no message is dropped while streaming a multi-gigabyte file. The streaming and large-buffer paths finish with the same contact extraction and id assignment as the in-memory path, so the result shape does not depend on file size.

## Engineering Decisions

### Unknown is `null`, not "now"
- **Constraint:** Real archives contain messages with missing or garbled `Date:` headers, and several detectors reason about time (earliest signup, last renewal, newsletter cadence).
- **Options:** Fill in `new Date()` so the field is always a `Date`, or type it `Date | null` and make callers handle the gap.
- **Choice:** `Date | null` across `Email`, `Contact`, `Account`, `Subscription`, and `Newsletter`, with detectors skipping undated emails in time-based math. The same principle leaves `monthlyAmount`/`frequency` unset when no billing cadence is found.
- **Why:** A fabricated timestamp looks exactly like a real one, so it silently made undated mail the "latest" and dragged signup and renewal dates toward today. I took the breaking change (v3.0.0, documented in `CHANGELOG.md` and the README migration notes) because the old values were wrong in a way no consumer could detect.

### Parsing vs. detection
- **Constraint:** Multiple archive formats feed multiple kinds of extraction, and detectors need to be runnable on already-parsed emails too.
- **Options:** Detect inline during parsing, or keep parsing and detection as separate layers over a shared `Email` model.
- **Choice:** Separate layers. Parsers emit plain `Email` objects; stateless detectors consume them via `detect`/`detectBatch`.
- **Why:** A new format gets all four detectors for free, and a detector can run standalone over any email list. Deduplication and grouping live in `detectBatch`, out of the parse loop.

### Handling non-UTF-8 mail
- **Constraint:** Real archives carry many charsets and emoji, not just clean UTF-8.
- **Options:** Assume UTF-8 and mask bytes, or decode through `TextDecoder` with the declared charset.
- **Choice:** Byte accumulation plus `TextDecoder`, with surrogate-pair handling and a UTF-8 fallback.
- **Why:** The naive path corrupts non-UTF-8 bodies and breaks multi-byte characters and emoji; honoring the declared charset keeps international mail intact.

### Streaming large archives
- **Constraint:** Exports can exceed Node's string-size limit and overwhelm browser memory.
- **Options:** Read the whole file into one string, or process in chunks.
- **Choice:** Chunked reads (file streams in Node, sliced reads in the browser) that carry a leftover tail between chunks.
- **Why:** Memory stays flat regardless of file size, and the leftover carry guarantees a message split across a chunk boundary is never lost or duplicated.

## Frequently Asked Questions

### How does it tell a real receipt from a marketing email?
The purchase detector scores strong receipt/invoice signals (subjects like "order confirmation", body phrases like "amount charged: $…") and simultaneously counts promotional anti-patterns ("up to 40% off", "free shipping", "shop now"). When several anti-patterns fire, the email is rejected outright; otherwise it needs a high combined confidence — including an extractable amount — before it counts as a purchase. The newsletter detector handles the inverse, scoring promotional language separately so marketing mail lands there instead.

### How are international currency formats handled?
`parseAmount` looks at where the `.`, `,`, or `'` separators sit. The last separator before a one- or two-digit tail is treated as the decimal point, so `1.234,56` and `1,234.56` resolve correctly, and the apostrophe used in Swiss formatting (`1'234.56`) is stripped as a thousands separator. Detection covers USD, EUR, GBP, JPY, CAD, AUD, INR, and CHF, including a few localized cue words like German "Betrag" and French "Montant".

### Does it work in the browser or only Node?
Both. The convenience entry point accepts a browser `File`, a Node `Buffer`, or an `ArrayBuffer`. Encoding and decoding are built on platform primitives (`TextDecoder`, `TextEncoder`, `atob`) with `Buffer` fallbacks, and HTML stripping uses `DOMParser` when available and a regex fallback otherwise — so the same code runs in either environment. The package ships both ESM and CommonJS builds.

### Why are parsing and detection separate?
So each can evolve independently. Parsers only need to produce `Email` objects; detectors only need an email list. Adding a new archive format gives you all four detectors at no extra cost, and you can run any detector on emails you parsed elsewhere. It also keeps the deduplication and grouping logic in `detectBatch` rather than tangled into the parse loop.

### How does it avoid flagging gmail.com, or a shipping notice from mail.example.com, as a newsletter?
Two rules. First, matching is boundary-safe: a substring check like `domain.includes('mail.')` would flag `gmail.com` and `hotmail.com`, so full domains go through `matchKnownDomain` (exact or true subdomain suffix only), and prefixes like `newsletter.` or `mail.` are matched only at the *start* of a domain. Second, those prefixes are weak evidence: they add to the score only when the body also matches marketing patterns (unsubscribe footers, "view in browser", copyright lines). A transactional email from a `mail.` subdomain with no marketing signals stays out of the newsletter bucket.

### What happens to emails with no usable date?
They are kept, with `date: null`. Parsers never substitute the current time, and detectors leave undated emails out of time-based results: `AccountDetector` keeps the earliest *known* signup date, and `NewsletterDetector` computes sending frequency only from dated messages. One exception to be aware of: `Purchase.purchaseDate` is still typed as a plain `Date`, so an undated receipt falls back to the parse time there.

### How does it handle multi-gigabyte MBOX files?
It streams them. In Node, `MBOXParser.parseFile` reads through a file stream in large chunks; in the browser, large `File` inputs are read in slices. Each chunk is parsed, and any partial message at its end is carried into the next chunk before splitting on `From ` lines, so memory stays flat and no message is dropped at a boundary. Progress is reported through an optional `onProgress` callback.

### How does it decode emoji and accented characters in subjects?
Subjects and addresses are run through `decodeHeaderValue`, which understands RFC 2047 encoded-words (`=?charset?B?...?=` and `=?charset?Q?...?=`). It collects the decoded bytes and runs them through `TextDecoder` with the declared charset, and it encodes surrogate pairs together so emoji and other astral characters come through intact rather than as mojibake.

### Can I run a single detector without parsing an archive?
Yes. Each detector is a standalone class — `AccountDetector`, `PurchaseDetector`, `SubscriptionDetector`, `NewsletterDetector` — exposing `detect(email)` for one email and `detectBatch(emails)` for a deduplicated set. If you already have `Email` objects from another source, you can construct a detector and call `detectBatch` directly.
