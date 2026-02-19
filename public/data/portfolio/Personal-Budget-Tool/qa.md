# Project Q&A Knowledge Base

## Overview

BudgetFlow is a paycheck-centric personal budget tracker built as a Progressive Web App. Unlike most budgeting tools that organize expenses by calendar month, BudgetFlow organizes them around actual pay dates — so bills are grouped by which paycheck funds them, not when they're due on the calendar. All data stays on the user's device via IndexedDB, with no accounts or servers required.

## Key Features

- **Paycheck-Centric Budgeting**: Bills are allocated to specific paychecks based on due dates, with smart scheduling for biweekly and semi-monthly pay cycles
- **AI Budget Import**: Upload a photo of a handwritten or printed budget and Claude AI parses it into structured categories and items
- **Multi-View Dashboard**: Monthly dashboard, budget editor, payment method cards, calendar view, yearly trends, and financial goals
- **Full Offline Support**: PWA with Workbox service worker caching — works completely offline after first load
- **Data Sovereignty**: Everything stored locally in IndexedDB. No accounts, no cloud sync, no server
- **Calendar & PDF Export**: Export bills as ICS calendar events with reminders, or generate monthly PDF reports

## Technical Highlights

### Budget Period Engine
The most interesting technical challenge was implementing paycheck-centric budget periods. Instead of naively grouping expenses by calendar month, `useCalculations` determines which paycheck "funds" each bill. A rent payment due on the 3rd is actually funded by the previous month's last paycheck, so it appears in that period. This required tracking paycheck dates, generating forecasted paychecks from schedules (biweekly 14-day cycles, semi-monthly fixed days), and expanding weekly/bi-weekly items into individual occurrences filtered by paycheck boundaries.

### Reactive Persistence Without Middleware
Rather than using Zustand's built-in `persist` middleware (which serializes the entire store on every change), I built a custom `usePersistence` hook with individual `useEffect` watchers for each state slice. This gives granular control — the budget template saves differently than monthly tracking data, paychecks save individually, and some operations (like drag-and-drop card assignment) write directly to IndexedDB for immediate persistence. The hook also handles the migration path from the app's original localStorage-based storage.

### Client-Side AI Integration
The AI budget import calls the Anthropic Claude API directly from the browser — no proxy server needed. The user provides their own API key (stored locally in IndexedDB), and images are sent as base64 for parsing. Claude returns structured JSON that gets validated against a Zod schema, then either smart-merged into existing categories (matching by keyword lists) or used as a full replacement.

## Development Story

- **Hardest Part**: Getting the budget period logic right. Edge cases around month boundaries, bills due before the first paycheck, and handling multiple occurrence frequencies (weekly items that span paycheck boundaries) required careful thought. The `isItemInBudgetPeriod` and `expandItemOccurrences` functions went through many iterations.
- **Lessons Learned**: Starting with localStorage was fine for prototyping but quickly hit limits with structured data. The migration to IndexedDB was worth doing early. Also, CSS custom properties for theming turned out to be much simpler than any CSS-in-JS solution would have been.
- **Future Plans**: The Goals feature is partially implemented but hidden from navigation — it needs more work on the UI and integration with the main budget flow. Notification reminders are wired up but could be more sophisticated.

## Frequently Asked Questions

### How does paycheck allocation work?
When you enter paychecks for a month (or configure a schedule for automatic forecasting), BudgetFlow groups your bills by which paycheck funds them. A bill due on day 15 gets assigned to the paycheck that arrives just before it. Bills due before your first paycheck of the month are handled by the previous month's last paycheck period (or rollover funds). You can manually reassign any bill to a different paycheck.

### Why IndexedDB instead of a backend database?
Privacy and simplicity. All your financial data stays on your device — no accounts to create, no servers to trust, no data breaches to worry about. IndexedDB provides structured storage with indexes for efficient queries, supports much more data than localStorage, and works perfectly offline. The trade-off is no cross-device sync, but that's an acceptable trade for a personal budget tool.

### How does the AI budget import work?
You take a photo of your budget (handwritten, spreadsheet, printed — anything visual) and upload it. The app sends it to the Anthropic Claude API using your own API key (stored locally, never proxied). Claude extracts categories, items, amounts, and frequencies, then returns structured JSON. You can preview the parsed result and choose to smart-merge it with your existing budget or replace everything.

### Why no React Router?
BudgetFlow is a fully offline PWA with no shareable URLs. Adding React Router would introduce complexity (URL syncing, history management, service worker route handling) without meaningful benefit. A simple `view` string in Zustand handles navigation, and view state persists across sessions via IndexedDB.

### How does the undo system work?
Rather than storing full state snapshots (which would be expensive with all the monthly tracking data), each undoable action stores a closure pair — an `undo` function and a `redo` function. This is memory-efficient and allows targeted reversals. Currently supports undo for delete operations (expenses and categories), with a toast notification offering an "Undo" button.

### What's the difference between "trackable" and regular expenses?
Regular expenses have a fixed budgeted amount (like rent or a subscription). Trackable expenses are budget categories where you log individual purchases — like Groceries, where you might budget $400/month but track each grocery trip separately. Trackable items expand to show individual entries with descriptions, dates, and amounts.

### How does multi-currency work?
You can choose from 10 currencies (USD, EUR, GBP, CAD, AUD, JPY, INR, CHF, MXN, BRL) in Settings. The selection is persisted and all amounts throughout the app format with the correct currency symbol and decimal rules. A module-level singleton pattern keeps all `useCurrency()` hook instances synchronized without needing a React context provider.

### Can I use BudgetFlow offline?
Yes, completely. The Workbox service worker precaches all static assets on first load. Google Fonts are cached with a CacheFirst strategy (365-day TTL). Once installed as a PWA, the app works identically offline. All data operations use IndexedDB, which is fully available offline.
