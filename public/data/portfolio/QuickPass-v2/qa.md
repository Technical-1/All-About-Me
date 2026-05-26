# Project Q&A Knowledge Base

## Overview

QuickPass is a secure, cross-platform desktop password manager I built with Tauri v2 (Rust backend) and React 19 (frontend). It provides encrypted vault storage for credentials with dual authentication (master password or visual pattern lock), TOTP 2FA, and USB backup — all running locally with no cloud dependencies, no subscriptions, and no telemetry.

**Problem Solved:** Users need a trustworthy, offline-first password manager that doesn't require subscription fees or cloud trust. QuickPass provides enterprise-grade encryption (AES-256-GCM, Argon2id) in a standalone desktop app that keeps all data local.

**Target Users:** Security-conscious individuals who prefer local data storage, users migrating from other password managers (Bitwarden, 1Password, LastPass), and anyone wanting a free, open-source alternative to commercial offerings.

## Key Features

- **Encrypted Vault System**: Each vault uses AES-256-GCM encryption with per-vault random keys. The vault key is encrypted under both the master password and pattern lock, enabling dual-unlock capability.
- **Dual Authentication**: Unlock via master password or a 6x6 visual pattern grid (minimum 12 unique cells, ~42 bits of entropy). Either method works independently.
- **Configurable Security Levels**: Three Argon2id tiers (Low/Medium/High) let users balance security vs unlock speed. Even "Low" exceeds OWASP recommendations.
- **Brute-Force Protection**: Progressive lockouts with exponential backoff (15min → 30min → 60min). Vault deleted after 4th lockout period.
- **TOTP/2FA Support**: Full two-factor authentication with QR code generation. Available per-entry (for storing 2FA secrets) and vault-level (requiring 2FA to unlock).
- **Password Manager Import**: Automatic format detection for Bitwarden, 1Password, LastPass, and generic CSV exports.
- **USB Portable Backup**: Export encrypted vault backups to removable drives with SHA-256 checksum verification.
- **Entropy Game**: Tic-Tac-Toe mini-game collecting user interaction timing and patterns to supplement system RNG for password generation.
- **Frontend Isolation**: React frontend never holds real passwords — only masked DTOs. Zod schemas validate all IPC responses.
- **Custom Fields**: Add arbitrary key-value pairs to any vault entry for flexible credential storage.

## Technical Highlights

### Challenge: Migrating from eframe/egui to Tauri v2 + React
The original QuickPass v1 was a pure Rust desktop app using eframe/egui. While this kept everything in one language, the UI was limited. I migrated the entire application to Tauri v2 with a React frontend while keeping all cryptographic operations in Rust. The key challenge was designing a clean IPC boundary — 49 commands across 6 modules — that never leaks sensitive data to the web layer. Passwords cross the boundary only for clipboard copy, and the frontend only receives masked DTOs (`"********"`).

### Challenge: Dual-Key Encryption Architecture
I needed to support two independent unlock methods (password and pattern) without storing either credential. My solution: generate a random vault key, encrypt it separately under both Argon2id-derived keys, and store both encrypted copies. Either credential can decrypt the vault key, which then decrypts the actual data. Changing a credential only requires re-encrypting the 32-byte vault key — not the entire vault.

### Challenge: Secure IPC Boundary Design
With a web-based frontend, the attack surface is larger than a pure native app. I implemented multiple layers: Content Security Policy blocks all external resources, Zod schemas validate every IPC response before use, passwords never exist in React state, and Tauri v2's capability system restricts which commands the webview can call. Even if the webview were compromised, it couldn't extract stored passwords without going through the IPC layer.

### Challenge: Memory-Safe Credential Handling
Passwords lingering in memory are attack vectors. I used Rust's `zeroize` crate with `Drop` implementations to ensure all sensitive data (vault key, decrypted entries, password hashes) is securely cleared when the session ends. The `subtle` crate provides constant-time comparison for TOTP verification and hash checking, preventing timing side-channel attacks.

### Innovative Approach: Token-Based Clipboard Clear
Most clipboard managers compare content to decide whether to clear. This requires reading the clipboard, potentially exposing data to other apps. Instead, I use a unique token per copy operation — when the timer fires, it clears the clipboard only if the token is still current. This avoids ever reading clipboard contents back.

### Comprehensive Test Coverage
167 backend tests across three categories: 109 unit tests covering encryption round-trips, CSV parsing, validation, and security audit coverage; 17 command tests verifying the Tauri IPC layer; and 41 integration tests for full workflows including import/export, security features, and cross-module security verification.

### Defense in Depth Across the IPC Boundary
The most realistic attack surface for a web-frontend desktop app is the webview itself. QuickPass treats the IPC layer as the trust boundary: rate-limited password reveal commands (5 per 10-second sliding window in `commands/vault_commands.rs`), length-bounded string inputs on every command, fail-secure canonicalization on USB exports, and capability-gated webview permissions in `src-tauri/capabilities/`. A compromised webview can still copy a single password (because the user is logged in), but it cannot exfiltrate the vault in bulk or pivot to file system writes outside the configured locations.

## Engineering Decisions

### Tauri v2 over Electron
- **Constraint**: Needed a cross-platform desktop shell that does not hold sensitive material in a runtime where memory clearing is unreliable.
- **Options**: Electron + Node.js, Tauri v2 + Rust, native per-platform (Swift / WinUI / GTK).
- **Choice**: Tauri v2 with a Rust core.
- **Why**: Rust's `zeroize` provides compiler-resistant memory clearing for vault keys and decrypted entries — something Node.js fundamentally cannot offer. The OS-webview model also drops binary size from ~150 MB (Electron) to ~15 MB and removes the Node runtime from the production attack surface.

### Dual-key vault encryption instead of one-of-two storage
- **Constraint**: Users wanted both a password unlock and a visual pattern unlock, but I refused to store either credential or any reversible form of one.
- **Options**: Store both credentials encrypted, derive a shared key from a combiner, or encrypt the vault key separately under both.
- **Choice**: Generate a random 32-byte vault key, then encrypt that key twice — once under the password-derived Argon2id key and once under the pattern-derived Argon2id key.
- **Why**: Changing one credential only requires re-encrypting the 32-byte key, not the whole vault. Either credential decrypts independently. Compromising one Argon2id hash gives no information about the other, and the vault key itself never touches disk in plaintext.

### Zod validation at the IPC boundary instead of `as` casts
- **Constraint**: Tauri's `invoke()` returns `unknown`, and there is no shared type generation between the Rust `serde` structs and the TypeScript interfaces.
- **Options**: Trust the Rust side and cast, hand-write type guards, or use a schema validator.
- **Choice**: Zod schemas in `src/lib/schemas.ts` validate every IPC response inside a `safeInvoke()` wrapper before any frontend code touches the value.
- **Why**: Drift between a Rust struct and a TypeScript interface becomes a loud runtime error at the boundary instead of a silent `undefined` deeper in a component. The cost is duplication, but for a security tool the boundary check is worth it.

### Token-based clipboard clear instead of content comparison
- **Constraint**: After the auto-clear timeout, I want to wipe the copied password from the clipboard — but only if it is still mine to wipe.
- **Options**: Re-read the clipboard and compare to the stored password, or track ownership with a token.
- **Choice**: Each copy operation generates a unique token; when the timer fires, the backend clears the clipboard only if the current in-process token still matches.
- **Why**: The comparison approach requires reading the clipboard back, which itself exposes whatever the user has copied since (potentially from another app). Token-based ownership avoids ever reading clipboard contents back into QuickPass.

## Frequently Asked Questions

### Why build another password manager when established options exist?
Commercial password managers require trust in their cloud infrastructure and ongoing subscriptions. I wanted a verifiably secure, local-only solution I could audit myself. Open-sourcing it lets others do the same.

### Why Tauri v2 instead of Electron?
Electron bundles a full Chromium + Node.js runtime (~150 MB). Tauri uses the OS webview + a Rust backend (~15 MB). More importantly, Electron apps have historically had security issues because Node.js can't reliably clear sensitive data from memory. Rust's `zeroize` crate provides compiler-resistant memory clearing.

### How does the dual authentication work without compromising security?
The vault key is encrypted separately under both credentials using Argon2id-derived keys. Neither credential is stored — only their verification hashes and the encrypted vault keys. Knowing one credential doesn't help decrypt the copy encrypted under the other.

### Why Argon2id instead of bcrypt or PBKDF2?
Argon2id won the Password Hashing Competition specifically for its resistance to GPU and ASIC attacks through memory-hardness. It's the current OWASP recommendation. Even my "Low" security level (19 MiB, 3 iterations) exceeds OWASP minimums.

### What happens if I forget both my password and pattern?
The vault is unrecoverable by design. There's no backdoor, no master key, no recovery option. This is intentional — any recovery mechanism would be an attack vector.

### How does the frontend stay secure if it's web-based?
Multiple layers: (1) Content Security Policy blocks all external resources, (2) passwords never exist in React state — only masked DTOs, (3) Zod validates every IPC response, (4) Tauri v2 capabilities restrict webview permissions, (5) devtools are disabled in production builds. Real passwords only cross the IPC boundary for clipboard copy operations.

### Why Zod validation at the IPC boundary?
Tauri's `invoke()` returns untyped data in TypeScript. Without validation, a shape mismatch between Rust and TypeScript would silently produce runtime bugs. Zod catches these at the boundary — especially important since there's no shared type generation between the two languages.

### How does the lockout system protect against brute force?
After configurable failed attempts (3-10), the vault locks with exponential backoff (15min, 30min, 60min). After the 4th lockout period, the vault is deleted. An attacker gets limited attempts before losing access entirely. Lockout state persists across app restarts.

### Can I sync vaults between devices?
Not automatically — this is intentional to avoid cloud dependencies. USB export creates encrypted backup files with SHA-256 checksum verification that can be manually transferred between devices.

### What's the Tic-Tac-Toe game for?
It's an entropy collection mechanism. User interaction timing and move sequences feed into password generation, supplementing the system's ChaCha20 RNG. It's optional but adds user-contributed randomness for those who want it.

### How do I verify the security of this implementation?
The codebase is open source with clear module separation. Critical security code is isolated in `src-tauri/src/vault.rs` (AES-256-GCM + dual-key encryption) and `src-tauri/src/security.rs` (Argon2id parameters), so a reviewer can audit the primitives without reading the whole codebase. The 167 backend tests in `src-tauri/tests/` include round-trip encryption checks, timing-safe comparison verification, lockout state machine coverage, and cross-module security regressions, so any regression on a hardened path fails CI before release.
