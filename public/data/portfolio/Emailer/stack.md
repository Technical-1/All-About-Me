# Technology Stack

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| SwiftUI | iOS 17+ | Declarative UI framework for building the entire interface |
| Swift | 5.9+ | Primary programming language |
| UIKit | iOS 17+ | Used sparingly for clipboard operations and system colors |

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

## Infrastructure

| Aspect | Details |
|--------|---------|
| Distribution | Local builds via Xcode / TestFlight |
| Signing | Apple Developer Program required |
| CI/CD | None (manual builds) |

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
I depend on the main branch of SwiftMail rather than a tagged release because:
- XOAUTH2 support needed recent fixes not in any release
- This means builds could break with upstream changes
- **Mitigation**: I could fork and pin to a specific commit for production

### No Test Coverage
The project currently lacks automated tests because:
- IMAP operations are difficult to unit test without mocking
- OAuth flows require real credentials to test
- **Future Work**: Could add UI tests and mock the MailSession

### Single Account Support
The app only supports one email account at a time because:
- Simplifies the authentication and session management
- Multiple IMAP connections would require connection pooling
- **Future Work**: Could extend to support account switching
