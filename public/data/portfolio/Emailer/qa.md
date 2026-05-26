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
Template-based detection system that identifies verification codes from Google, Microsoft, Apple, Amazon, Facebook, Twitter, Discord, and generic providers. Each template has specific regex patterns optimized for that provider's email format.

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
IMAP connections do not handle concurrent operations gracefully. With multiple views (Inbox, Recent, Verification) potentially triggering fetches simultaneously, I implemented a serial operation queue using async/await primitives. The `acquireImapLock` pattern ensures only one IMAP operation runs at a time while keeping the UI responsive.

### Challenge: OAuth Token Lifecycle
OAuth tokens expire, and users expect to stay logged in. I implemented automatic token refresh that checks token expiry on app launch and before any IMAP operation. If the access token is within 5 minutes of expiry, the app transparently uses the refresh token to obtain a new access token without user intervention.

### Challenge: Email Body Encoding
Emails arrive in various encodings (base64, quoted-printable, plain UTF-8, ISO-8859-1). I built a multi-fallback decoding system that tries each encoding strategy in order until one produces readable text. This handles the real-world diversity of email formats.

### Innovative Approach: Template-Based Code Detection
Rather than a single regex for all verification codes, I designed a template system where each provider (Google, Microsoft, etc.) has its own detection configuration including sender patterns, subject patterns, code regex patterns, and expected code lengths. This reduces false positives and allows provider-specific optimizations.

## Engineering Decisions

### IMAP over per-provider APIs
- **Constraint**: I wanted the same client to talk to Gmail, Outlook, Yahoo, and self-hosted servers without three separate implementations.
- **Options**: Gmail REST API + Microsoft Graph + Yahoo Mail API (three integrations, three auth flows, three message models), or a single IMAP layer.
- **Choice**: IMAP via `SwiftMail`, with OAuth2/XOAUTH2 for the major providers and basic auth as a fallback.
- **Why**: One protocol and one message model means one body-decoder, one folder model, and one set of caching rules. The cost is being on IMAP's serial-connection semantics, which I addressed with the operation lock in `MailSession.swift`.

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

### 8. Why is there no test suite?

I acknowledge this as a gap. IMAP operations require a real server connection, and mocking the SwiftMail library would be complex. OAuth flows require real credentials. I prioritized shipping functionality over test coverage for this personal project, but for a production app, I would invest in integration tests with a test email account.

### 9. Could this be adapted for Android?

The architecture could translate, but the implementation would need to be rewritten. The IMAP and OAuth logic would be similar (likely using JavaMail), but the UI would use Jetpack Compose or standard Android Views. The core concepts - template-based detection, token management, serial IMAP operations - would all apply.

### 10. How does the app handle the 15-second auto-refresh without hammering the IMAP server?

The verification views run a 15-second timer, but each refresh goes through the same serial IMAP lock as everything else, and the header cache in `MailSession.swift` is valid for 30 seconds. So a refresh that fires while another fetch is mid-flight queues behind it, and a refresh whose underlying data is still fresh returns from cache without a network round-trip. In practice the server only sees a fetch every ~30 seconds even though the UI ticks twice as often.
