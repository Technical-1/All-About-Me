# Project Q&A

## Overview

**Emailer** is a native iOS app I built to explore programmatic email access via IMAP with OAuth2 authentication. The app automatically detects and extracts verification codes from incoming emails, making it useful for automation workflows that require email verification. It connects to Gmail, Outlook, Yahoo, or any IMAP server and presents verification codes from major providers with one-tap copying to clipboard.

### Problem Solved

Modern authentication often requires email verification codes, which creates friction in automated testing, account creation workflows, and multi-device setups. Manually checking email and copying codes interrupts flow. This app solves that by automatically scanning for verification emails and presenting codes ready to copy, with 15-second auto-refresh to catch codes as soon as they arrive.

### Target Users

- Developers testing authentication flows
- QA engineers automating account creation
- Power users managing multiple accounts who need quick access to verification codes
- Anyone frustrated by the email-code-copy workflow

## Key Features

### OAuth2 Authentication with PKCE
Secure sign-in with Gmail, Outlook, and Yahoo using the industry-standard PKCE flow. Users authenticate directly with their email provider through a system browser, so the app never sees their password.

### Multi-Provider Verification Code Detection
Template-based detection that identifies verification codes from Google, Microsoft, Apple, Amazon, Facebook, and Twitter, with a stricter catch-all template for unknown senders. Each template has subject patterns, sender-domain patterns, and code regexes — all anchored to verification-context phrasing so order numbers, tracking IDs, and timestamps don't get extracted as codes.

### Auto-Refresh
The verification code views automatically refresh every 15 seconds, catching new codes as soon as they arrive without manual intervention.

### One-Tap Copy with Read Tracking
Copy verification codes to clipboard with a single tap. The app visually marks codes that have been copied or that came from already-read emails, helping users track which codes have been used.

### Fallback IMAP Support
For users with self-hosted email or providers not supporting OAuth, the app offers traditional username/password IMAP authentication to any server.

### Secure Credential Storage
All tokens and credentials are stored in the iOS Keychain, encrypted and protected by the device's Secure Enclave.

## Technical Highlights

### Challenge: IMAP Concurrent Access
IMAP doesn't tolerate concurrent commands on a single connection, but four tabs plus auto-refresh timers can all trigger fetches independently. I built `AsyncSemaphore` (`emailer/AsyncSemaphore.swift`) — a ~25-line actor that gives proper FIFO mutual exclusion via `CheckedContinuation`-backed `wait()` / `signal()`. No busy-waiting, no third-party dependency, and `MailSession` stays `@MainActor` for SwiftUI compatibility. A concurrency stress test in the test suite fires 10 concurrent tasks at the semaphore and asserts only one is ever in the critical section.

### Challenge: OAuth Token Lifecycle
OAuth tokens expire, and users expect to stay logged in. I implemented automatic token refresh that checks token expiry on app launch and before any IMAP operation. If the access token is within 5 minutes of expiry, the app transparently uses the refresh token to obtain a new access token without user intervention.

### Challenge: Email Body Encoding
Emails arrive in base64, quoted-printable, plain UTF-8, or ISO-8859-1 — sometimes multiple in the same multipart message. `MessageBodyDecoder` (`emailer/MessageBodyDecoder.swift`) is a pure-function decoder that walks the message parts, honors each part's Content-Transfer-Encoding, and falls back to SwiftMail's `textBody`/`htmlBody` if none decode cleanly. The base64 path strips whitespace before decoding so the RFC-2045 line-wrapped payloads that real servers send actually decode (a heuristic that checked "is this string entirely base64 alphabet?" rejected wrapped payloads). Decode runs in `Task.detached(priority: .userInitiated)` so large HTML emails don't stall the main thread.

### Challenge: HTML Email Rendering Without Letting Email HTML Run Scripts
Real transactional emails are heavily-formatted HTML. Rendering them as raw `Text(body)` shows raw markup. Rendering them in a default `WKWebView` lets arbitrary email content execute JavaScript inside the app — a real risk for an inbox app. `HTMLBodyView` wraps `WKWebView` with `WKWebpagePreferences.allowsContentJavaScript = false` and `loadHTMLString(html, baseURL: nil)` so HTML renders with full CSS/layout fidelity but cannot execute scripts or resolve relative URLs.

### Innovative Approach: Template-Based Code Detection with Negative Coverage
Each provider has its own `VerificationTemplate` with subject patterns, sender-domain patterns, and anchored code regexes (e.g. `"verification code is[^0-9]*([0-9]{6,8})"`, not bare `([0-9]{6,8})`). The test suite includes negative regression cases: an Amazon "order has shipped" email with a 6-digit order number in the body returns `nil`, a Facebook "promo code" marketing email doesn't match the verification template, a Twitter login email with an embedded Unix timestamp extracts the real code rather than the timestamp. "No code found" is always preferred over "wrong code."

## Engineering Decisions

### IMAP over per-provider APIs
- **Constraint**: I wanted the same client to talk to Gmail, Outlook, Yahoo, and self-hosted servers without three separate implementations.
- **Options**: Gmail REST API + Microsoft Graph + Yahoo Mail API (three integrations, three auth flows, three message models), or a single IMAP layer.
- **Choice**: IMAP via `SwiftMail`, with OAuth2/XOAUTH2 for the major providers and basic auth as a fallback.
- **Why**: One protocol and one message model means one body-decoder, one folder model, and one set of caching rules. The cost is IMAP's serial-connection semantics, addressed by the `AsyncSemaphore` primitive that gates all `MailSession` IMAP calls.

### Template-driven code extraction over one mega-regex
- **Constraint**: Verification emails vary wildly by provider, and a generic `\d{6}` match produces too many false positives (order numbers, tracking IDs, dates).
- **Options**: A single tuned regex applied to every message, or per-provider templates with sender/subject filters layered on top of code patterns.
- **Choice**: `VerificationTemplate.swift` defines provider templates (Google, Microsoft, Apple, Amazon, Facebook, Twitter, Discord, generic) checked in priority order.
- **Why**: Specific templates run first, so a Google recovery email is matched by the Google template instead of falling through to the generic pattern. Adding a new provider is a data change, not a code change.

### Custom Keychain wrapper instead of a third-party library
- **Constraint**: OAuth refresh tokens grant long-lived mailbox access. I wanted minimal third-party surface area for the code that touches them.
- **Options**: Pull in a popular Swift keychain wrapper, or write a small wrapper on top of `Security.framework` directly.
- **Choice**: `KeychainManager.swift` calls `SecItemAdd`/`SecItemCopyMatching` directly with the access flags I want.
- **Why**: The wrapper is under 150 lines, has no dependencies, and makes the access-control settings explicit at the call site instead of hidden behind a library's defaults.

### Single shared `MailSession` instead of per-view view-models
- **Constraint**: Inbox, Recent, and the two verification views all read from the same IMAP connection and need to react to login state, refresh ticks, and cache invalidation together.
- **Options**: Per-view `ObservableObject` view-models with a separate networking layer, or one shared `@EnvironmentObject` that owns the connection and publishes message arrays.
- **Choice**: One `MailSession` `@MainActor ObservableObject` injected via `@EnvironmentObject`.
- **Why**: Avoids duplicated cache state and connection bookkeeping across views. The trade-off is that adding multi-account support later means decomposing this object — acceptable for a single-account app.

### OAuth client IDs in a gitignored file, not committed config
- **Constraint**: OAuth client IDs aren't true secrets but they tie every build of the codebase to one developer's Google Cloud / Azure / Yahoo project. Forks shouldn't share quota with me.
- **Options**: Commit them and document that forks should swap; move them to `.xcconfig` build settings; isolate them in a gitignored Swift file.
- **Choice**: `emailer/Auth/OAuth2Secrets.swift` is gitignored. `OAuth2Config.swift` (committed) reads `OAuth2Secrets.gmailClientId`, `.outlookRedirectScheme`, etc. README has the template and setup walkthrough.
- **Why**: Zero build-config complexity, immediately obvious which strings are environment-specific, and Xcode 16's synchronized file groups auto-include the file in the target. CI substitutes a placeholder version with `YOUR_*` values so builds still compile without anyone's real credentials.

## FAQ

### 1. Why did you build this instead of using the Gmail API directly?

I wanted to support multiple email providers (Gmail, Outlook, Yahoo) with a single codebase. IMAP is the common protocol they all support. The Gmail API would have been simpler for Gmail-only use, but would require separate implementations for each provider. Additionally, IMAP allowed me to learn a protocol I had not worked with before.

### 2. Why SwiftUI instead of UIKit?

SwiftUI aligns with where Apple is heading for iOS development. I wanted hands-on experience with declarative UI patterns and modern Swift concurrency (async/await). The trade-off is less control over specific behaviors, but for this app's requirements, SwiftUI's defaults worked well.

### 3. Is this app safe to use with my real email?

The app uses the same OAuth2 security model as any third-party email client. It never sees your password - you authenticate directly with your email provider. Tokens are stored in the iOS Keychain, not in plain text. However, like any app with email access, you should review what it does. The code is open source.

### 4. Why do you store credentials in the Keychain instead of using a library?

I wanted to minimize third-party dependencies for security-sensitive code. The iOS Keychain API is well-documented and battle-tested by Apple. Writing my own wrapper helped me understand exactly what data goes where and how it is protected.

### 5. Can this app send emails or modify my inbox?

No. The app only has read access. It fetches email headers and bodies, and can mark messages as read, but cannot compose, send, delete, or move emails. The OAuth scopes requested are read-only.

### 6. Why does the verification code detection sometimes miss codes?

The detection uses regex patterns tuned for common verification email formats. If a provider changes their email template or uses an unusual format, the patterns may not match. The template system makes it easy to add new patterns when this happens.

### 7. How does auto-login work?

On app launch, the app checks the Keychain for stored OAuth tokens. If found and not expired, it uses them to connect to IMAP. If the access token is expired but a refresh token exists, it automatically refreshes. Only if all that fails does the app show the login screen.

### 8. How do you avoid extracting random 6-digit numbers as verification codes?

Every code regex in `VerificationTemplate` is anchored to verification-context phrasing — `"verification code is[^0-9]*([0-9]{6,8})"`, `"security code: ([0-9]{6,8})"`, `"code is[^0-9]*([0-9]{6,8})"`. No template uses a bare `([0-9]{6})` fallback, so an Amazon order-confirmation email with a 6-digit order number doesn't yield that number as a "verification code." The test suite locks this in: there are explicit negative cases asserting that Amazon order shipments, Facebook promo emails, and Twitter timestamps don't match. The trade-off is that an email with a code but no surrounding "code is" / "verification code" wording will return `nil` — I optimize for "no code found" over "wrong code," because a wrong code copied to clipboard is the worst user outcome.

### 9. Could this be adapted for Android?

The architecture could translate, but the implementation would need to be rewritten. The IMAP and OAuth logic would be similar (likely using JavaMail), but the UI would use Jetpack Compose or standard Android Views. The core concepts - template-based detection, token management, serial IMAP operations - would all apply.

### 10. How does the app handle the 15-second auto-refresh without hammering the IMAP server?

The verification views run a 15-second timer, but each refresh goes through the same `AsyncSemaphore`-gated path as everything else, and the verification-header cache (`Constants.verificationHeadersCacheSeconds`, 30s) returns cached results when fresh. So a refresh fired while another is mid-flight queues behind it, and a refresh whose underlying data is still fresh returns from cache without a network round-trip. The server only sees a real fetch every ~30 seconds even though the UI ticks twice as often.

### 11. Why is JavaScript disabled in the HTML email viewer?

Email HTML is *arbitrary content from the internet*. If the WebView ran scripts, opening a marketing email could effectively execute attacker-controlled JavaScript inside the app with access to whatever the WebView is permitted to do. `HTMLBodyView` sets `WKWebpagePreferences.allowsContentJavaScript = false` and uses `loadHTMLString(html, baseURL: nil)` so relative URLs don't resolve either. The cost is that emails that depend on JavaScript for layout render slightly worse — vanishingly rare for legitimate transactional email. Remote `<img src>` is still loaded today (tracking pixels will fire); blocking those via `WKContentRuleList` is on the roadmap.

### 12. How are verification codes kept from lingering in the clipboard?

`UIPasteboard.general.setItems(_:options:)` is invoked with `.expirationDate = Date().addingTimeInterval(Constants.pasteboardCodeExpirationSeconds)` (60s) and `.localOnly = true`. The code auto-expires after a minute and never propagates via Universal Clipboard to other Apple devices. This matters more for 2FA codes than for general copy-paste because the codes themselves are short-lived secrets — leaving them in the clipboard long-term is the same security category as leaving a password there.
