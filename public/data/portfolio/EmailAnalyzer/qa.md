# Project Q&A

## Overview

Email Archive Explorer is a privacy-first web application that lets users analyze their email archives entirely in the browser. It parses exports from Outlook (.olm), Gmail/Thunderbird (.mbox), and Gmail Takeout (.zip), automatically detecting account signups, purchases, subscriptions, and newsletters. The application stores all data locally in IndexedDB, ensuring no email content ever leaves the user's device. It's designed for anyone who wants to understand their digital footprint, audit their online accounts, track spending from receipts, or manage newsletter subscriptions.

## Key Features

### Universal Email Import
Supports the three most common email export formats: Outlook for Mac (.olm), standard MBOX (Gmail export, Thunderbird), and Gmail Takeout ZIP archives. The parsers handle format-specific quirks like OLM's XML structure and MBOX's header conventions.

### Smart Account Detection
Automatically identifies account signup emails from 100+ services (Netflix, Amazon, GitHub, etc.) using pattern matching on subjects, bodies, and sender domains. Creates a consolidated view of all online accounts with signup dates.

### Purchase Tracking
Extracts purchase information from receipt emails including merchant, amount, currency, and order numbers. Detects duplicates to prevent double-counting. Includes spending analytics over time.

### Subscription Management
Identifies recurring service charges (streaming, software, etc.) and tracks renewal patterns. Groups related billing emails together to show subscription history.

### Newsletter Detection
Finds newsletters and promotional emails, extracting unsubscribe links where available. Helps users identify and clean up unwanted subscriptions.

### Advanced Search
Supports Gmail-style search syntax including `from:`, `to:`, `subject:`, `date:`, `has:attachment`, `is:unread`, and more. Results update instantly thanks to in-memory indexing.

### Conversation Threading
Groups related emails into conversation threads using explicit thread IDs or normalized subject matching. Shows conversation context when viewing individual messages.

### Analytics Dashboard
Visualizes email patterns with volume charts, top senders, spending trends, and activity heatmaps. Filterable by year to see trends over time.

### Virtual Scrolling
Handles archives with tens of thousands of emails by only rendering visible items. Maintains smooth 60fps scrolling regardless of dataset size.

### Drag-and-Drop Organization
Enables organizing emails into folders via drag and drop. Includes system folders (Inbox, Archive, Trash) and custom user-created folders.

### Dark Mode
Toggle between light and dark themes using the built-in theme toggle. Preference is persisted across sessions.

### Mobile-Responsive Navigation
A slide-out sidebar overlay optimized for mobile devices, with a hamburger menu that slides out navigation without disrupting the content area.

### Custom Filtering Rules
User-defined email filtering rules (stored in localStorage) let users create automated categorization beyond the built-in detectors.

### Saved Searches
Frequently used search queries can be saved and reused, avoiding the need to retype complex search syntax.

### Undo Actions
Destructive actions like deleting or archiving emails show an undo toast notification, giving users a window to reverse the action.

## Technical Highlights

### Parsing three email formats through a common interface

OLM files are ZIP archives containing Outlook-flavored XML. MBOX files are plain text with header-based message separation. Gmail Takeout wraps MBOX in a ZIP with its own folder layout. Each parser lives in its own module under `web/src/services/parsers/` and emits a normalized `Email` object so the rest of the app stays format-agnostic. Format-specific edge cases (malformed headers, missing fields) log warnings rather than aborting the import.

### Detection pipeline runs during import, not on-demand

Account, purchase, subscription, and newsletter detection all run inside the parser worker as each email is ingested. Front-loading the work into the moment users already expect waiting (the import progress bar) makes every subsequent navigation instant, and enables cross-email passes like duplicate-purchase detection and subscription grouping that would be awkward to do per-view.

### Gmail-style search syntax over an in-memory index

Rather than a wall of filter dropdowns, the search bar accepts queries like `from:amazon type:purchase after:2024-01-01`. The tokenizer in `web/src/services/searchParser.ts` resolves operators against the Zustand store, which holds the full dataset in memory after first load — results update on every keystroke without hitting IndexedDB.

### HTML email rendering with DOMPurify

Email HTML is hostile by default — scripts, tracking pixels, JavaScript URLs, exfiltration via `<form>`. Every rendered body passes through DOMPurify with a tightened allow-list before reaching the DOM, so a malicious archive can't escape the iframe-less viewer.

## Engineering Decisions

### Storage: IndexedDB via Dexie
- **Constraint**: Need persistent local storage for tens of thousands of emails, including attachments, without server round-trips.
- **Options**: localStorage, raw IndexedDB, OPFS, server-backed Postgres.
- **Choice**: IndexedDB with Dexie.js as the wrapper.
- **Why**: localStorage tops out at ~10MB and is synchronous, so it would freeze the UI on import. Raw IndexedDB's callback API is painful to write against. OPFS isn't available everywhere yet. Dexie gives Promise-based access, compound indexes, schema versioning, and bulk inserts — all of which the import path leans on.

### State: Zustand instead of Redux or Context
- **Constraint**: A single, denormalized cache of emails/accounts/purchases needs to feed many list and chart views without re-rendering them all on every change.
- **Options**: Redux Toolkit, React Context, Zustand, Jotai.
- **Choice**: Zustand.
- **Why**: No provider wrapper, no action/reducer ceremony, and its selector model only re-renders subscribers whose slice actually changed. Redux's tooling wasn't worth the boilerplate for a single-user offline app.

### No backend at all
- **Constraint**: Users won't upload personal email to a stranger's server, and I don't want to host or be subpoenaed for one.
- **Options**: Node API with encrypted-at-rest storage, serverless functions for detection only, fully client-side.
- **Choice**: Fully client-side static deployment.
- **Why**: Trust is the product. There's nothing on the network to leak, no GDPR boundary to manage, and hosting is a static bundle on Vercel's free tier. The cost is losing server-side search and shared accounts, both of which I judged out of scope.

### Web Worker for parsing
- **Constraint**: Parsing a multi-gigabyte mbox blocks the main thread for tens of seconds, freezing the import UI and progress bar.
- **Options**: Chunked parsing on the main thread via `setTimeout` yields, a Web Worker, WebAssembly.
- **Choice**: Dedicated Web Worker (`web/src/workers/parserWorker.ts`).
- **Why**: Workers give a true second thread with clean message-passing semantics — progress events flow back at full rate, and the UI stays at 60fps. `setTimeout` yielding works but is fiddly and bursts the event loop; WASM was overkill since the bottleneck is JS string processing, not crypto.

## Frequently Asked Questions

### How accurate is the account and purchase detection?

Pattern matching with per-service rules. For known senders (Netflix, Amazon, GitHub, and ~100 others) accuracy is high because the detector keys off specific sender domains and subject templates. For unknown services it falls back to generic signup/receipt heuristics, which occasionally miss unconventional formats. The defaults favor precision over recall — I'd rather miss a purchase than show a phantom one in the spending chart.

### How does threading work without server-side message IDs?

Two-tier. First pass looks for explicit `Thread-Topic` / `References` / `In-Reply-To` headers, which well-behaved clients include. Second pass normalizes subjects (strips `Re:`, `Fwd:`, locale prefixes, list tags) and groups remaining messages by the cleaned subject plus participant set. Not perfect — long-running threads that drift subjects will fragment — but it covers the common case for export-only data.

### Can I export everything back out?

Yes. The backup page emits a single JSON archive containing emails, detected accounts, purchases, subscriptions, newsletters, contacts, and folder structure. Optionally encrypted with a passphrase via AES-GCM + PBKDF2 (Web Crypto). The same page can restore from a backup or wipe IndexedDB entirely.

### What happens if I open the same archive twice?

The importer hashes each email's `Message-ID` + date + sender on insert. Re-importing a file you've already loaded is a no-op for duplicates; only new messages are added. This makes "import last month's incremental export" safe.

### Why no AI categorization?

In-browser LLMs would inflate the bundle by tens of MB and ship slow inference to every user, most of whom just want to see their spending. The deterministic rule pipeline is fast, debuggable, and easy to extend with a new sender pattern. If categorization ever needs fuzzier matching I'd add a local WebAssembly model behind an opt-in toggle rather than send email content to a hosted API.

### How big an archive can it handle?

Tested up to ~50,000 messages and ~2GB of attachments on a mid-range laptop. The bottleneck is import time (a few minutes for 50k), not steady-state browsing — once the Zustand store is populated, list scroll and search stay smooth thanks to TanStack Virtual.

### Adding a new export format — what's involved?

Add a parser module under `web/src/services/parsers/` that implements the parser interface (returns an async iterable of normalized `Email` objects), then register it in the file-type dispatch in `parserWorker.ts`. The detection pipeline and UI are format-agnostic, so nothing downstream changes. EML and PST would be the natural next additions.

### Is HTML email rendered safely?

Yes. Every HTML body goes through DOMPurify with a strict allow-list before insertion, stripping scripts, iframes, event handlers, and JavaScript URLs. Remote images load only after an explicit user click per-message, so tracking pixels don't fire on archive browse.
