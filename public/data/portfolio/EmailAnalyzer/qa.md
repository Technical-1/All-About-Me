# Project Q&A

## Project Overview

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

## Technical Highlights

### Challenge: Parsing Multiple Email Formats

Each email format (OLM, MBOX, Gmail Takeout) has different structures and quirks. OLM files are ZIP archives containing XML files with Outlook-specific element names. MBOX files are plain text with header-based message separation. Gmail Takeout wraps MBOX in a ZIP with specific folder structures.

I solved this by creating isolated parser modules for each format, each implementing a common interface that produces normalized Email objects. The parsers handle format-specific edge cases (like malformed headers or missing fields) gracefully, logging warnings rather than failing entirely.

### Challenge: Performance with Large Archives

Email archives can contain tens of thousands of messages. Loading all this data and rendering it in the DOM would freeze the browser.

I addressed this through multiple strategies:
- **Bulk database operations**: Batch inserts during import instead of individual writes
- **In-memory caching**: The Zustand store holds all data after initial load for instant access
- **Virtual scrolling**: TanStack Virtual renders only visible rows
- **Lazy loading**: Email bodies are loaded on-demand when viewing individual messages
- **Pre-computed threading**: Threads are built once during initialization, not on each view

### Challenge: Privacy-First Architecture

Users are understandably hesitant to upload personal emails to any server. Making the app trustworthy required a fundamentally different architecture.

I built everything to run client-side:
- Parsing happens in the browser using JSZip and DOMParser
- Storage uses IndexedDB, which browsers sandbox per-origin
- There's no backend server at all - it's deployed as static files
- The only network requests are for loading the app itself

### Innovative Approach: Detection Pipeline

Rather than analyzing emails on-demand, I run all detectors (accounts, purchases, subscriptions, newsletters) during the import phase. This front-loads computation when users expect waiting, making subsequent browsing instant.

The pipeline also enables cross-email analysis like duplicate purchase detection and subscription grouping that wouldn't be possible with per-email analysis.

### Innovative Approach: Unified Search Syntax

Instead of separate filter dropdowns, I implemented a Gmail-style search parser that supports complex queries like `from:amazon type:purchase after:2024-01-01`. The parser tokenizes the query and applies filters efficiently against the in-memory dataset.

## FAQ

### Q: Why did you build this as a client-side application instead of using a backend?

A: Privacy was the top priority. People are rightly hesitant to upload their personal emails to any server. By running everything in the browser and storing data in IndexedDB, users can trust that their emails never leave their device. This also eliminates hosting costs and GDPR compliance concerns.

### Q: How does the application handle very large email archives?

A: I implemented several optimization strategies: bulk database operations during import, virtual scrolling that only renders visible rows, pre-computed email threading, and lazy loading of email bodies. These techniques let the app handle archives with tens of thousands of emails while maintaining smooth performance.

### Q: Why did you choose Zustand over Redux for state management?

A: Zustand offers a much simpler API with less boilerplate while providing the same capabilities. It doesn't require Provider wrappers, has excellent TypeScript support, and its built-in selector system prevents unnecessary re-renders. For this project's needs, Redux's additional complexity wasn't justified.

### Q: How accurate is the account and purchase detection?

A: The detection uses pattern matching with confidence thresholds. For known services (Netflix, Amazon, GitHub, etc.), accuracy is very high because I match against specific sender domains and subject patterns. For unknown services, I rely on common signup/receipt email patterns which may occasionally miss unconventional formats. I prioritized precision over recall to avoid false positives.

### Q: Can users export their analyzed data?

A: Yes, the backup page allows exporting all data as JSON. This includes emails, detected accounts, purchases, subscriptions, newsletters, and contacts. Users can also clear all data and re-import if needed.

### Q: Why IndexedDB instead of a simpler storage solution?

A: LocalStorage has a 5-10MB limit and is synchronous, which would freeze the UI during operations. IndexedDB supports asynchronous operations, can store hundreds of megabytes, and allows complex queries through indexes. Dexie.js provides a clean Promise-based wrapper around IndexedDB's callback-heavy API.

### Q: How does email threading work without server-side processing?

A: Threading uses a two-tier approach. First, I look for explicit thread IDs in email headers (which well-behaved email clients include). For emails without thread IDs, I fall back to normalized subject matching - stripping prefixes like "Re:", "Fwd:", etc. and grouping emails with matching base subjects. This handles most common threading scenarios.

### Q: What security measures protect against malicious email content?

A: All HTML email content is sanitized using DOMPurify before rendering. This removes potentially dangerous elements like scripts, iframes, and event handlers while preserving safe formatting. Attachments are stored as base64 data but aren't automatically executed.

### Q: Why didn't you use AI/ML for better categorization?

A: Running ML models in the browser is computationally expensive and would significantly increase bundle size. The pattern-matching approach provides good accuracy for the defined use cases without these tradeoffs. If I were to add AI features, I'd likely offer them as an opt-in feature that processes data locally using WebAssembly-based models.

### Q: How extensible is the parser architecture for new email formats?

A: Very extensible. Each format has its own parser module that implements a common interface producing normalized Email objects. Adding support for a new format (like EML files or PST archives) would involve creating a new parser module without touching existing code. The detection pipeline automatically processes emails regardless of their source format.
