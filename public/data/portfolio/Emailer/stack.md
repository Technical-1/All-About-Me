# Technology Stack

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| SwiftUI | iOS 17+ | Declarative UI framework for the entire interface |
| Swift | 5.9+ | Primary programming language |
| WebKit (WKWebView) | iOS 17+ | Renders HTML email bodies (JavaScript disabled for safety) |
| UIKit | iOS 17+ | Clipboard (`UIPasteboard`), system colors, `UIViewRepresentable` bridges |

## Platform

| Component | Details |
|-----------|---------|
| Target Platform | iOS 17.0+ / iPadOS 17.0+ |
| Architecture | arm64 (Apple Silicon required) |
| Xcode | 15.0+ |
| Build System | Swift Package Manager |

## Authentication & Security

| Technology | Purpose |
|------------|---------|
| AuthenticationServices | ASWebAuthenticationSession for OAuth flows |
| CryptoKit | SHA256 hashing for PKCE code challenges |
| Security.framework | iOS Keychain API for secure credential storage |
| OAuth2 + PKCE | Secure authorization without client secrets |

## Networking & Email

| Dependency | Version | Source | Purpose |
|------------|---------|--------|---------|
| SwiftMail | main branch | [Cocoanetics/SwiftMail](https://github.com/Cocoanetics/SwiftMail) | IMAP client with XOAUTH2 support |
| swift-nio | 2.92.2 | Apple | Asynchronous networking foundation |
| swift-nio-ssl | 2.36.0 | Apple | TLS/SSL for secure IMAP connections |
| swift-nio-imap | main branch | Apple | IMAP protocol implementation |

## Supporting Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| swift-atomics | 1.3.0 | Thread-safe operations for NIO |
| swift-collections | 1.3.0 | Efficient data structures |
| swift-log | 1.8.0 | Logging infrastructure |
| swift-system | 1.6.3 | System call wrappers |
| swift-se0270-range-set | 1.0.1 | Range set data structure |
| swift-dotenv | 2.1.0 | Environment variable loading |

## Testing & Tooling

| Aspect | Details |
|--------|---------|
| Test framework | Apple's Swift Testing (`import Testing`, `@Test` functions) — Xcode 16+ |
| Test target | `emailerTests` — uses `@testable import emailer` for internal access |
| CLI runner | `bin/test.sh` — wraps `xcodebuild test`, accepts `DESTINATION` env override |
| CI | GitHub Actions (`.github/workflows/test.yml`) — runs on push to main + PRs |
| CI runner | `macos-15` with latest-stable Xcode (currently Xcode 26 series) |
| Test count | 30 unit tests covering PKCE, Keychain, verification templates, body decoders, Date helpers, AsyncSemaphore |

## Infrastructure

| Aspect | Details |
|--------|---------|
| Distribution | Local builds via Xcode / TestFlight |
| Signing | Apple Developer Program required |
| CI/CD | GitHub Actions runs unit tests on every push/PR; no automated release pipeline (manual TestFlight) |

## Key Dependency Choices

### SwiftMail

I chose SwiftMail because:
- **XOAUTH2 Support**: Native support for OAuth2-based IMAP authentication, which is required for Gmail and recommended for Outlook
- **Modern Swift**: Built with async/await and Swift concurrency in mind
- **Apple NIO Foundation**: Uses Apple's swift-nio for reliable networking
- **Active Maintenance**: Actively maintained with recent commits

### iOS Keychain (vs UserDefaults or third-party)

I implemented a custom `KeychainManager` wrapper around iOS Security.framework because:
- **Security**: Keychain data is encrypted and protected by the Secure Enclave
- **No Dependencies**: Avoided third-party keychain wrappers to reduce attack surface
- **Learning**: Building the wrapper taught me the Keychain API nuances

### ASWebAuthenticationSession (vs custom WebView)

I used Apple's ASWebAuthenticationSession for OAuth because:
- **Security**: System-managed browser prevents credential interception
- **User Trust**: Users see Safari's familiar interface with security indicators
- **Apple Requirement**: Required for App Store apps that implement OAuth

### Native SwiftUI (vs UIKit or cross-platform)

I built entirely in SwiftUI because:
- **Modern Development**: Declarative syntax matches my mental model
- **Automatic Features**: Dark mode, Dynamic Type, accessibility largely automatic
- **Future Investment**: SwiftUI is Apple's direction for UI development
- **No Bridging**: Avoided UIViewRepresentable complexity where possible

## Limitations & Trade-offs

### SwiftMail Main Branch
I depend on the main branch of SwiftMail rather than a tagged release because XOAUTH2 support needed fixes not in any release. The risk is builds breaking with upstream changes; mitigated by the CI workflow catching breakage on every push, and by being able to fork and pin to a specific commit if needed.

### Single Account by Design
The app supports one email account at a time. `MailSession` is a single shared `@EnvironmentObject` owning one IMAP connection, one OAuth2Manager, one set of caches. Multi-account would mean decomposing this into per-account instances plus account-picker UI — a real architectural change rather than an oversight. The current design is intentional for the verification-code-capture use case (typically one throwaway/test account at a time).

### Remote Images in HTML Emails
`HTMLBodyView` currently allows `<img src>` to load remote URLs, which means marketing emails' tracking pixels will fire when the email is viewed. Mitigation planned via a `WKContentRuleList` that blocks remote resource loads while permitting `data:` URIs. JavaScript is already disabled in the WebView so script-based tracking is blocked today.
