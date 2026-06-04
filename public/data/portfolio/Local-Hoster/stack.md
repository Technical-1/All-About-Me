# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Backend language | Rust | edition 2021 | Safe concurrency for the threaded port probe, and the language Tauri's native layer is written in |
| App framework | Tauri | v2 | Native macOS tray app with a webview UI at a fraction of an Electron bundle's size |
| Frontend framework | SvelteKit + Svelte | 5.51 | Runes (`$state`, `$derived`, `$props`) give fine-grained reactivity with almost no boilerplate, and Svelte compiles away to a tiny bundle |
| Language (frontend) | TypeScript | 5.9 | Shared `DevServer`/`AppConfig` shapes between commands and components, checked with `svelte-check` |
| Build tool | Vite | 7.3 | Fast HMR during `cargo tauri dev` and the default SvelteKit bundler |

## Frontend

- **Framework**: Svelte 5 (runes mode), SvelteKit 2.50
- **State management**: Local component state via runes; no external store library — the app is small enough that `$state`/`$derived` cover it
- **Styling**: Hand-written CSS with custom properties (a small design-token system: `--bg-glass`, `--accent`, `--space-*`, `--radius-*`) for a translucent menu-bar aesthetic with light/dark theming
- **Build adapter**: `@sveltejs/adapter-static` — outputs a prerender-free SPA that Tauri serves from `ui/build`

## Backend

- **Runtime**: Native binary (Rust), no embedded server
- **IPC**: Tauri commands invoked from the webview via `@tauri-apps/api`
- **Concurrency**: `std::thread::scope` with a fixed 16-worker cap for port probing (a generic `scoped_probe` shared by the TCP and HTTP checks)
- **Persistence**: JSON file in the OS config dir (`dirs` crate locates it)

## Infrastructure

- **Hosting**: N/A — distributed as a code-signed, notarized macOS `.dmg` (universal `aarch64` + `x86_64`)
- **CI/CD**: GitHub Actions — `cargo fmt`/`clippy`/`cargo test` plus `svelte-check` and a frontend build on every PR and push; a tag-triggered (`v*.*.*`) pipeline builds the universal bundle, signs it with a Developer ID certificate, notarizes it with Apple, and publishes the GitHub release
- **Updates**: signed Tauri updater feed (`latest.json` + a minisign signature over the update archive) served from GitHub Releases; the app checks it on launch
- **Auto-start**: macOS `LaunchAgent` plist written at runtime

## Development Tools

- **Package Manager**: npm (frontend), Cargo (backend)
- **Type Checking**: `svelte-check` against `tsconfig.json`
- **Testing**: `cargo test` — unit tests cover the host security gate, HTTP response classification (including the real AirPlay `403` and non-HTTP listeners), port probing, and server assembly. No frontend test runner; the UI is small enough to verify by hand.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `tauri` (v2, `tray-icon` + `image-png`) | Native shell, tray icon, webview windows, IPC |
| `tauri-plugin-updater` (2) | Check the signed update feed and download/install new versions |
| `tauri-plugin-process` (2) | Relaunch the app into the new version after an update installs |
| `sysinfo` (0.33) | Process inspection for dev-server discovery |
| `serde` / `serde_json` (1.0) | (De)serialize `DevServer` and `AppConfig` across the IPC boundary and to disk |
| `dirs` (5.0) | Locate the OS config and home directories for `config.json` and the LaunchAgent plist |
| `log` / `env_logger` (0.4 / 0.11) | Structured logging for non-fatal persistence failures |
| `@tauri-apps/api` (2.10) | Frontend bindings for `invoke`, window control, and clipboard |
| `@tauri-apps/plugin-updater` / `plugin-process` (2) | Frontend bindings to run the update check and relaunch into the new version |
| `@sveltejs/adapter-static` (3.0) | Build the frontend as a static SPA for the Tauri webview |

## Security Configuration

- **Content Security Policy** (`tauri.conf.json`): restricts `script-src` to `'self'`, scopes `connect-src` to loopback, and limits `frame-src`/`img-src` to `http://*:*` — the iframe is the only thing allowed to reach off-`self` hosts, and only over HTTP to a host the Rust gate has already vetted.
- **Capability scoping** (`capabilities/default.json`): the popup window is granted only the window/event permissions it actually uses (close, set-size, set-position, set-focus, show, hide).
- **iframe sandbox**: `allow-scripts allow-same-origin allow-forms allow-popups` — enough to render a real dev app, without `allow-top-navigation`.
