# Project Q&A

## Overview

A Node.js script that logs into UCF's student portal every 12 hours, screenshots the admission decision panel, OCRs the screenshot to read whether I was accepted/waitlisted/denied, and texts me the result. The interesting technical angle is the deliberate choice to OCR a fixed pixel region instead of scraping the DOM — the underlying PeopleSoft portal is a moving target of nested iframes and auto-generated class names, and the screenshot-and-read approach turned out to be both simpler and more robust.

## Problem Solved

I was applying to UCF and the admissions portal posts your decision without notice. The official guidance is "check the portal" — meaning refresh it manually, repeatedly, for weeks. I valued my time too much to do that. Beyond this one decision, I had hit a broader wall: a growing list of small computer tasks I was doing over and over by hand, and a strong instinct that this is what computers are for. This script was the first thing I built to act on that instinct, and it became the starting point of everything I've done since with automation, workflow tooling, and building software for myself.

## Target Users

- **Me, late 2019** — waiting on a UCF decision and unwilling to refresh a portal on a schedule
- **Anyone in a similar admissions waiting room** — the pattern (headless login → screenshot → OCR → SMS) generalizes to any portal that won't email you

## Key Features

### Headless login through UCF's SAML SSO
Drives a real Chromium instance through UCF's Shibboleth identity provider, including injecting the SAML redirect `referer` header so the post-login bounce actually completes.

### OCR-based decision extraction
Screenshots a fixed 700×250 region of the admission status page, runs it through an OpenCV blur+greyscale pipeline, then Tesseract — the regex match on the recognized text decides whether to text "accepted", "waitlist", "denied", or "not out yet".

### SMS notification via TextBelt
A single HTTP POST sends the result to my phone — no Twilio account, no number provisioning, just an API key and a phone number.

### 12-hour polling loop
Runs continuously in-process, sleeping 12 hours between attempts until a real decision is detected, at which point the loop exits.

## Technical Highlights

### Stable extraction from an unstable DOM via screenshot + OCR
UCF's admission status page is rendered through a PeopleSoft view (`CF_ADM_CUSTOM.CF_HA_UGRD_APPSTAT`) wrapped in nested iframes with auto-generated CSS selectors. Trying to query the decision element by selector was fragile. Instead, the script (`Checker.js:128-129`) screenshots a hard-coded rectangle — `{x: 180, y: 140, width: 700, height: 250}` — that always contains the decision text regardless of which iframe wrapper PeopleSoft chose to render that day. This eliminated the selector-maintenance problem entirely.

### OpenCV preprocessing as the OCR-accuracy fix
Raw Tesseract misread the colored PeopleSoft header band consistently. The `OCR()` function (`Checker.js:10-20`) runs `gaussianBlur(new cv.Size(5,5), 1.2)` then `cvtColor(COLOR_BGR2GRAY)` before calling Tesseract. Both steps were necessary — blur alone left enough chroma noise to misread, greyscale alone left enough aliasing to misread. Together they pushed character accuracy past the threshold where the three regex branches reliably picked the right outcome.

### Surviving UCF's SAML flow with three stacked techniques
The SAML login fails in default headless Chrome. The fix combines: `puppeteer-extra-plugin-stealth` to patch the headless fingerprint, `browser.createIncognitoBrowserContext()` to prevent cookie carry-over poisoning subsequent attempts, and a request-interception hook (`Checker.js:104-116`) that injects `referer: https://idp-prod.cc.ucf.edu/idp/profile/SAML2/Redirect/SSO?execution=e2s1` on the post-login navigation. Removing any one of the three breaks the login.

### Self-terminating polling loop
The IIFE at `Checker.js:143-159` is a simple `while(decisionReceived !== true)` driven by a 12-hour `delay()` promise. Once `checkDecisionText` returns true (a real decision found), the loop exits and the process ends — no manual stop, no leftover orphan process to clean up.

## Engineering Decisions

### Screenshot + OCR over DOM scraping
- **Constraint**: PeopleSoft markup is unstable across login sessions and gets re-skinned periodically
- **Options**: CSS selector scraping, XPath, accessibility-tree traversal, OCR
- **Choice**: OCR a fixed pixel region
- **Why**: The pixel layout was the only thing UCF's portal kept stable. OCR removed the selector-maintenance problem and the OpenCV preprocessing made it accurate enough

### Long-lived in-process loop over external scheduler
- **Constraint**: One-off personal use, single host, no shared infrastructure
- **Options**: cron, systemd timer, launchd, GitHub Actions schedule, in-process loop
- **Choice**: `while(true)` with a 12-hour `setTimeout` promise
- **Why**: Adding a scheduler is overhead for a script that runs on one machine for a few weeks. Quitting the process means "decision received" — that's the cleanest possible exit condition

### TextBelt over Twilio
- **Constraint**: I needed maybe a dozen SMS over the lifetime of this script
- **Options**: Twilio, AWS SNS, TextBelt, email-to-SMS gateways
- **Choice**: TextBelt
- **Why**: One HTTP POST, no account setup, no provisioned number, pennies per message. Twilio's verification and provisioning flow would have taken longer than the project itself

### Single-file script over modular structure
- **Constraint**: Personal tool, written in days, expected lifespan of weeks
- **Options**: Split into modules (browser/, ocr/, notify/), keep as one file
- **Choice**: One file
- **Why**: At ~150 lines with one entry point, splitting would add navigation cost without organizational benefit. The right time to modularize is when reuse pressure appears — it never did

## Frequently Asked Questions

### Why OCR instead of just scraping the page?
The admission status page is a PeopleSoft view wrapped in nested iframes with auto-generated class names. Selectors broke between login sessions. The decision text always appeared in the same on-screen rectangle, so screenshot + OCR was the more stable extraction path.

### Why is the macOS Chrome path hard-coded?
Because I was running it on my MacBook and never had a reason to make it portable. A modern rewrite would either let Puppeteer download its own Chromium or read the path from an environment variable.

### Why TextBelt and not Twilio?
TextBelt is one HTTP POST with an API key — no account, no provisioned number. For a script sending fewer than 20 messages total, Twilio's setup time was longer than the project's lifespan.

### Why is this still on Node 10/12-era dependencies?
Because the project is preserved as-is from November 2019. `request` is deprecated, `opencv4nodejs` is painful to install on modern Node, and the UCF SAML markup has likely changed too. Updating it would mean rewriting it — and the original served its purpose.

### Why is there no `package.json`?
I hadn't internalized `npm init` as a habit yet. I installed dependencies with bare `npm install <pkg>` commands and treated `node_modules/` as the lockfile. That was the first habit I corrected in projects after this one.

### Did it actually work?
Yes — I got my acceptance text from the script before I would have thought to check the portal manually. That single working notification is the reason I kept building things this way.

### Why is this repo still here if it's archived?
Because it's the origin point of my engineering work — first GitHub commit, first push, first time I solved a real problem with code instead of doing it by hand. It belongs in the portfolio as a starting line, not as production code.

### Is it safe to use today?
No. UCF's portal has changed, the SAML flow has likely moved, the dependencies are out of date, and the credentials live in plaintext in the source file. Treat this as a read-only reference, not a runnable utility.
