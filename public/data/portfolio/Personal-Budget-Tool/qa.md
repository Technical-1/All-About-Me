# Project Q&A Knowledge Base

## Overview

BudgetFlow is a paycheck-centric personal budget tracker built as a Progressive Web App. Unlike most budgeting tools that organize expenses by calendar month, BudgetFlow organizes them around actual pay dates — so bills are grouped by which paycheck funds them, not when they're due on the calendar. It is local-first and zero-knowledge: data lives in IndexedDB encrypted under a passphrase-derived key, and optional cross-device sync through Firebase only ever uploads ciphertext.

## Problem Solved

Most people budget paycheck to paycheck, but most budgeting apps think in calendar months, which makes "how much of this paycheck is actually free?" hard to answer. And financial data is exactly what people are least comfortable handing to a server. BudgetFlow answers the paycheck question directly and keeps the data readable only by its owner, even when it syncs.

## Target Users

- **Paycheck-to-paycheck budgeters** — see exactly which bills each payday has to cover and what is left over
- **Privacy-conscious users** — use a full budgeting app with no account at all, or sync across devices without the server being able to read anything
- **People migrating from paper or spreadsheets** — photograph an existing budget and import it instead of re-typing it

## Key Features

### Paycheck-Centric Budgeting
Bills are allocated to specific paychecks based on due dates, with schedule forecasting for biweekly and semi-monthly pay. Each paycheck shows its bills, what has been paid, and what remains.

### Passphrase Lock and Encryption at Rest
The app opens behind a lock screen. On first use you set a passphrase and receive a one-time recovery code; from then on, record contents in IndexedDB are encrypted and nothing loads until unlock.

### Optional End-to-End Encrypted Sync
Sign in with Google to sync. The encrypted snapshot and receipt files are stored in Firestore and Firebase Storage; on a new device, "Sign in to restore" unlocks with the same passphrase. If two devices diverge, a dialog asks which copy to keep.

### Receipts per Payment
Attach images or PDFs to a payment. Files are encrypted locally and, when sync is on, uploaded encrypted; they are included in JSON backups.

### AI Budget Import
Upload a photo of a handwritten or printed budget and Claude Sonnet 4.6 parses it into categories and items, validated with Zod before anything is applied.

### Views and Exports
Monthly dashboard (with a guided setup screen while empty), budget editor, payment-method cards with drag and drop, calendar with ICS export, yearly trends, and monthly PDF reports.

## Technical Highlights

### Budget Period Engine
`src/hooks/useCalculations.js` decides which paycheck "funds" each bill rather than grouping by calendar month. A rent payment due on the 3rd is funded by the previous month's last paycheck, so it appears in that period. This requires tracking real and forecasted paychecks (biweekly 14-day cycles, semi-monthly fixed days), frequency-aware due detection for every-N-months items, and expanding weekly and bi-weekly items into individual occurrences bounded by paycheck dates. Calendar-month due detection goes through one shared helper (`isItemDueInCalendarMonth`), so monthly totals, yearly totals, and spending trends agree on when an item is due.

### Envelope Encryption with WebCrypto
`src/crypto/keyVault.js` generates a random 256-bit data key and wraps it twice — once with a PBKDF2-SHA256 key (600,000 iterations) from the passphrase and once with a key from a 20-character Crockford base32 recovery code (~100 bits). The resulting record holds only salts and ciphertext, so it can be stored locally and in Firestore. Changing the passphrase re-wraps one slot; no data is re-encrypted. AES-GCM authentication failure is what signals a wrong passphrase.

### Field-Level Encryption That Keeps Indexes Working
`src/db/crypto.js` maps each object store to the fields that must stay plaintext — its key path and indexed fields such as `monthKey` or `date` — and moves everything else into an encrypted `_enc` envelope. `src/db.js` routes generic `get`/`put`/`getAll` through this transform, so callers are unchanged. Pre-existing plaintext data is upgraded by `migrateToEncrypted()`, which skips already-encrypted records and sets a marker only at the end, so an interrupted run simply resumes.

### Sync That Doesn't Write When Nothing Changed
`src/hooks/useSync.js` subscribes to the stores, debounces pushes by 4 seconds, and compares a content signature (the export payload minus its timestamp) against the last synced state, so a page load or no-op update never uploads. Pushes run in a serial loop: a change arriving mid-push sets a dirty flag and triggers one more pass, so two pushes can never claim the same version number. The pull decision (`resolvePull` in `src/sync/syncEngine.js`) is a pure function returning apply, push, none, or conflict, and is unit-tested directly.

## Engineering Decisions

### Zero-knowledge sync over server-side storage
- **Constraint**: Cross-device access was wanted without giving any server the ability to read a user's finances.
- **Options**: Plain Firestore documents protected only by security rules; a custom backend with server-side encryption; client-side encryption with the server storing ciphertext.
- **Choice**: Client-side envelope encryption, with Firebase holding only the wrapped-key record, one encrypted snapshot, and encrypted receipt files.
- **Why**: Security rules protect against other users but not the operator; client-side encryption protects against both. The trade-off is that the server can't merge data, which pushed the design toward whole-state snapshots with explicit conflict resolution.

### One passphrase for local lock and cloud sync
- **Constraint**: At-rest encryption and sync each need a key, and a second passphrase prompt on top of the lock screen would be confusing.
- **Options**: Separate local and cloud keys; derive the cloud key from the Google account; share one wrapped data key.
- **Choice**: The lock screen creates the key; on first sign-in the cloud adopts the local key record, and a new device adopts the cloud record via "Sign in to restore".
- **Why**: Users remember one secret. If the cloud holds a different key (set up elsewhere), sync pauses instead of stacking a second unlock prompt.

### localStorage to IndexedDB
- **Constraint**: Monthly tracking data is a nested map keyed by year-month, with paychecks, overrides, card assignments, and now binary receipt files. localStorage is capped at roughly 5–10 MB and stores only strings.
- **Options**: Stay on localStorage; adopt IndexedDB with object stores per concern; use a heavier wrapper like Dexie.
- **Choice**: IndexedDB via `idb`, now 13 object stores.
- **Why**: Structured storage, indexes, room for blobs, and a thin dependency. `db.js` still migrates the original localStorage layout on first load.

### Reactive persistence without `persist` middleware
- **Constraint**: Different slices need different write semantics, writes have to pass through an encryption layer, and the legacy migration needs fine-grained control.
- **Options**: Zustand's `persist` middleware (serializes the whole store); a custom hook with per-slice watchers.
- **Choice**: Custom `usePersistence` hook with per-slice effects, plus direct writes from some store actions.
- **Why**: Avoids re-serializing unrelated data on every keystroke and keeps load, migration, import, and export in one place. Imports write to IndexedDB before updating state, so disk stays the source of truth if a later step fails.

## Frequently Asked Questions

### How does paycheck allocation work?
When you enter paychecks for a month (or configure a schedule for forecasting), BudgetFlow groups your bills by which paycheck funds them. A bill due on day 15 gets assigned to the paycheck that arrives just before it. Bills due before your first paycheck of the month are handled by the previous month's last paycheck period (or rollover funds). You can manually reassign any bill to a different paycheck.

### What happens if I forget my passphrase?
Use the recovery code shown once when you created the passphrase — it unlocks the same data key. If you lose both, the lock screen offers a reset that erases the data on that device. Because the server never has the key, nobody can recover it for you.

### Do I need an account?
No. Without signing in, everything is stored encrypted on your device. Signing in with Google only adds sync, and signing out keeps the local copy.

### What can the server actually see?
Your Google account identity, a wrapped-key record (salts and ciphertext), one encrypted snapshot with a version number and timestamp, and encrypted receipt files with their IDs. Budget names, amounts, and notes are never sent unencrypted. When Firebase is configured, Firebase Analytics is also initialized for standard usage analytics.

### How are sync conflicts handled?
Each push increments a version. On pull, if the cloud is ahead and this device has unsynced changes, a dialog asks whether to keep this device or the cloud copy; the other is overwritten. Otherwise the newer side wins automatically.

### How does the AI budget import work?
You upload a photo (JPG, PNG, or HEIC, up to 5 MB). The app sends it to the Anthropic API with your own key, stored encrypted on your device and never included in exports. The response is checked for shape, validated with Zod, and then either merged into matching categories using whole-word matching (so "Tax" doesn't fold into "syntax") or used as a full replacement.

### What's the difference between "trackable" and regular expenses?
Regular expenses have a fixed budgeted amount (like rent or a subscription). Trackable expenses are budget categories where you log individual purchases — like Groceries, where you might budget $400/month but track each trip separately.

### Can I use BudgetFlow offline?
Yes. The Workbox service worker precaches static assets and caches Google Fonts with CacheFirst. Unlock happens locally against the stored key record, so the app works fully offline. If a sync push fails while offline, the next change after reconnecting uploads the full encrypted snapshot.
