# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | Rust | 2021 Edition | Backend: cryptography, file I/O, state management |
| Language | TypeScript | 5.9.3 | Frontend: type-safe React components and IPC layer |
| Desktop Framework | Tauri | 2.x | Native desktop shell, IPC bridge, system APIs |
| UI Framework | React | 19.2.4 | Component-based frontend rendering |
| Build Tool | Vite | 6.4.1 | Frontend bundling with HMR |

## Frontend

- **Framework**: React 19.2.4
- **State Management**: Zustand 5.0.11 (single store, screen routing + app state)
- **Styling**: Tailwind CSS 4.1.18 (dark theme, utility-first)
- **Validation**: Zod 4.3.6 (IPC response validation at boundary)
- **Build Tool**: Vite 6.4.1 + @vitejs/plugin-react 4.7.0
- **Minification**: Terser 5.46.0 (console/debugger removal in production)

I chose React + Tailwind over the original eframe/egui because:
- **Richer UI capabilities**: Pattern grids, modals, and responsive layouts are significantly easier in React
- **Developer velocity**: Hot reload with Vite vs full recompile with egui
- **Tailwind v4**: Zero-config dark theme with CSS variables, much smaller output than v3
- **Zustand over Redux**: Minimal boilerplate for a single-store app with simple state shape

## Backend

- **Runtime**: Rust (compiled to native via Tauri)
- **Framework**: Tauri v2 command system
- **API Style**: IPC commands (49 endpoints across 6 modules)
- **Authentication**: Dual — master password (Argon2id) OR 6x6 pattern lock
- **Session Management**: In-memory state with `zeroize` on Drop

I chose Tauri v2 over Electron because:
- **Rust backend**: All cryptographic operations in memory-safe native code
- **No Node.js runtime**: Smaller binary (~15 MB vs ~150 MB for Electron)
- **Security boundary**: IPC enforces clean separation — frontend can't directly access crypto
- **v2 specifically**: Permissions system, stronger CSP support, plugin ecosystem

## Cryptographic Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `aes-gcm` | 0.10.3 | AES-256-GCM authenticated encryption |
| `argon2` | 0.5.3 | Memory-hard key derivation (Argon2id) |
| `zeroize` | 1.8.2 | Secure memory clearing on Drop |
| `subtle` | 2.6 | Constant-time comparison (TOTP, hash verification) |
| `rand` | 0.9.0 | Cryptographically secure RNG |
| `rand_chacha` | 0.9 | ChaCha20 RNG for deterministic seeding |
| `sha2` | 0.10 | SHA-256 checksums for USB exports |

**Why these specific libraries:**
- `aes-gcm`: Pure Rust, well-audited, provides authenticated encryption (integrity + confidentiality)
- `argon2`: Winner of the Password Hashing Competition, OWASP-recommended
- `zeroize`: Compiler-resistant memory clearing — prevents sensitive data from lingering in memory
- `subtle`: Prevents timing side-channel attacks on credential verification

## Supporting Libraries

### Backend (Rust)

| Library | Version | Purpose |
|---------|---------|---------|
| `serde` | 1.0 | Serialization framework for Rust types |
| `serde_json` | 1.0 | JSON parsing/writing for vault files |
| `thiserror` | 2 | Derive macro for error types |
| `base64` | 0.22.1 | Base64 encoding for encrypted data in JSON |
| `chrono` | 0.4 | Date/time handling for lockout timestamps |
| `directories` | 6.0.0 | Platform-specific data directory resolution |
| `once_cell` | 1.21.1 | Lazy static initialization |
| `totp-rs` | 5.6 | TOTP code generation with secret generation |
| `qrcode` | 0.14 | QR code generation for 2FA setup |
| `sysinfo` | 0.33 | USB device detection for backup/restore |
| `tokio` | 1 | Async runtime for timed clipboard clear |

### Frontend (npm)

| Package | Version | Purpose |
|---------|---------|---------|
| `@tauri-apps/api` | 2.10.1 | Tauri IPC invoke + event system |
| `@tauri-apps/plugin-clipboard-manager` | 2.3.2 | Clipboard read/write operations |
| `react` | 19.2.4 | UI rendering engine |
| `react-dom` | 19.2.4 | DOM reconciliation |
| `zustand` | 5.0.11 | Lightweight state management |
| `zod` | 4.3.6 | Runtime schema validation at IPC boundary |

## Infrastructure

### Build & Development

- **Package Manager**: npm (frontend), Cargo (backend)
- **Frontend Build**: Vite 6.4.1 with Tailwind CSS v4 plugin + Terser minification
- **Backend Build**: Cargo with release profile (LTO, strip, codegen-units=1, panic=abort)
- **Dev Server**: Vite on port 5173 with HMR, Tauri watches for Rust changes
- **TypeScript**: Strict mode with tsc for type checking before build

### CI/CD (GitHub Actions)

- **Trigger**: Semantic version tags (`v*.*.*`)
- **Test Job**: `cargo test` on Ubuntu (167 tests)
- **Build Matrix**: Ubuntu 22.04, macOS (ARM + x86), Windows
- **Artifacts**: Tauri installers (.dmg, .msi, .AppImage, .deb)
- **Release**: Automatic GitHub Release with all platform installers

### Security Configuration

**Argon2id Parameters by Security Level:**

| Level | Memory | Iterations | Parallelism |
|-------|--------|------------|-------------|
| Low | 19 MiB | 3 | 2 |
| Medium | 47 MiB | 3 | 4 |
| High | 64 MiB | 4 | 4 |

All levels exceed OWASP minimum recommendations (19 MiB, 2 iterations).

**Content Security Policy** (index.html):
```
default-src 'self'; style-src 'self'; script-src 'self'; font-src 'self';
img-src 'self' data:; connect-src 'self'; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

**Release Profile Optimizations:**
```toml
[profile.release]
strip = true        # Strip debug symbols
lto = true          # Link-time optimization
codegen-units = 1   # Single codegen unit for max optimization
panic = "abort"     # Abort on panic (smaller binary)
```

### Data Storage

**Vault Files Location:**

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/com.KANFER.QuickPass/` |
| Linux | `~/.local/share/QuickPass/` |
| Windows | `C:\Users\<User>\AppData\Roaming\KANFER\QuickPass\` |

## Why I Made These Choices

### Tauri v2 over Electron
Password managers written in Electron have historically had security issues due to JavaScript's memory model and the full Node.js runtime in production. Tauri's Rust backend ensures all sensitive operations happen in native code with proper memory clearing (`zeroize`), and the IPC boundary prevents the webview from directly accessing cryptographic material.

### React + Tailwind over eframe/egui
The original QuickPass v1 used Rust's eframe/egui immediate-mode GUI. While this kept everything in Rust, the UI was limited — complex layouts, responsive design, and rich interactions required significantly more code. Migrating to React + Tailwind CSS v4 gave me hot reload during development, a mature component ecosystem, and a dark theme that looks production-ready.

### Zod over Runtime Trust
Tauri's `invoke()` returns `unknown` in TypeScript. Rather than casting to trusted types, I validate every IPC response with Zod schemas. This catches bugs where the Rust backend shape drifts from frontend expectations — especially important since there's no shared type generation between Rust structs and TypeScript interfaces.

### Local Storage over Cloud
I deliberately avoided cloud sync features because:
- Reduces attack surface significantly
- No server infrastructure to maintain or trust
- Users maintain full control of their data
- USB export provides manual sync when needed
