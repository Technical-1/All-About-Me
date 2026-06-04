# Project Q&A

## Overview

Local Hoster is a macOS menu bar app that finds the dev servers running on your machine and previews any of them in a small in-tray iframe. It's for anyone juggling several local projects at once who wants a glanceable list of what's up — and a quick look at a server — without hunting through terminal tabs or browser windows. The technically interesting part is that discovery requires zero cooperation from the servers: it reads the OS process table, matches command lines, and concurrently probes ports, all behind a strict loopback-only security gate.

## Problem Solved

When you're running a Vite frontend, a Django API, and a Tauri shell at the same time, "which of these is actually up, and on what port?" becomes a recurring tax. Local Hoster answers it passively: it polls in the background, shows live online/offline status, and lets you peek at any server's UI in two clicks. It also makes the answer trustworthy — only loopback and private-network hosts can ever load.

## Target Users

- **Full-stack developers** — running several local servers at once and wanting a single status board in the menu bar
- **Frontend developers** — who want a quick responsive-width preview (mobile/tablet/full) of a running app without opening DevTools
- **Anyone on a shared/LAN dev box** — who needs to register a server by host/port manually but only within safe private ranges

## Key Features

### Cooperation-free discovery
Servers don't have to register themselves. The backend matches running process command lines against a table of ~16 known tools (Vite, Next.js, Nuxt, CRA, Angular, SvelteKit, Astro, Remix, Gatsby, Flask, Django, Rails, Tauri, Laravel, and more), reads any `--port` override from the command, scans a ±5 range around each known default port to catch auto-incremented instances, and confirms each candidate actually serves web content before listing it.

### Embedded responsive preview
A selected server loads in a sandboxed iframe with mobile (375px), tablet (768px), and full-width presets, plus a copyable URL bar and an "open in real browser" action.

### Live status with toasts
A background poll diffs each scan against the last and surfaces "New: …" and "Offline: …" toasts, so you notice when a server comes up or dies without staring at the list.

### Safe manual servers
You can add a server the scanner can't see, but only if its host is `localhost`, an IPv6 loopback, or an RFC1918 private address — enforced in Rust, not just the form.

### Signed, self-updating distribution
Releases are universal (`aarch64` + `x86_64`), Developer ID-signed, and Apple-notarized, so a fresh download opens without Gatekeeper warnings. The app then keeps itself current: on launch it checks a signed update feed and offers to install new versions in place.

## Technical Highlights

### A host security gate that resists spoofing
The preview iframe is constrained by a Content Security Policy that allows `frame-src http://*:*`, so the real protection has to be the URL itself. `is_allowed_preview_url` (`src-tauri/src/main.rs`) strips any `user:pass@` userinfo before reading the host, which defeats attacks like `http://[::1]:3000@evil.com` where the loopback prefix is a decoy and the true authority is `evil.com`. It handles IPv6 bracket forms (`[::1]`), rejects junk after the closing bracket, and shares its host check with manual-server validation — a single `is_local_host` is the one source of truth. The behavior is pinned by a dedicated `rejects_bracket_host_tricks` test.

### Defense in depth at config load
A gate on *adding* a server doesn't help if a server was persisted before the gate existed, or if someone hand-edits `config.json`. `local_manual_servers` re-filters every stored manual server through `is_local_host` at startup and logs how many were dropped, so the loopback-only invariant holds for the lifetime of the data, not just at entry.

### Single-pass concurrent probing, pure assembly
`Scanner.discover` collects process-match candidates with no I/O, then probes the *union* of candidate ports and the configured scan list exactly once. A generic `scoped_probe(ports, check)` chunks that union across at most 16 threads via `std::thread::scope`, so even a 100+-port list never spawns one thread per port — and the same fan-out backs both the TCP and HTTP checks. The resulting set is handed to `assemble_servers`, a pure function with no networking — which is why dedup precedence (a process candidate wins over a bare port scan on the same port), offline marking, and out-of-scan-range candidates are all covered by fast, deterministic unit tests.

### "Online" means "serves a web page," not "accepts a connection"
A bare TCP connect can't tell a dev server from a database or the macOS AirPlay receiver — which sits on port 5000 and answers HTTP `403` with an empty body, so it used to appear as a blank, unpreviewable row. After the cheap TCP check finds open ports, `port_serves_web` sends a minimal HTTP request and keeps a port only if it responds with status `< 400` or serves HTML; the parsing rule lives in a pure `classify_http_response` that's unit-tested against the real AirPlay response and non-HTTP listeners. The HTTP round-trip runs only on already-open ports, so the cost stays low, and it generalizes to any non-web service without hardcoding individual ports.

### Tray popup positioning across mixed-DPI monitors
When the tray icon is clicked, the backend gets the icon's rect in physical pixels. To place a logical-pixel popup centered under it, it finds which monitor the icon actually sits on and divides by *that* monitor's scale factor (`main.rs`), rather than assuming a single global DPI — so the popup lands correctly on a Retina laptop, an external display, or a mix of both.

## Engineering Decisions

### Where to enforce the "local only" rule
- **Constraint**: A malicious or stale config must never cause the iframe to load a public host.
- **Options**: Validate in the Svelte form only; validate in each command; validate at every boundary including load time.
- **Choice**: Enforce in Rust at add-time, open-in-browser-time, *and* config-load-time, with one shared `is_local_host`.
- **Why**: The frontend can be bypassed; the config file can be edited. Only the command layer is unavoidable, and re-checking at load closes the stale-data gap.

### How aggressively to scan ports
- **Constraint**: Ranging ±5 around each known default port gives better coverage of auto-incremented instances, but multiplies the connects and threads per scan.
- **Options**: Unbounded thread-per-port; a fixed thread pool; a hard cap on port count.
- **Choice**: Both a 16-thread cap on the probe and a 128-port cap on the list, enforced in the backend.
- **Why**: The thread cap bounds resource use independent of list length; the port cap bounds total work even if the UI limit is bypassed, and is sized to hold the generated ranges. Together they keep a 5-second poll cheap.

### Ordering of the settings save
- **Constraint**: In-memory state, `config.json`, and the LaunchAgent plist must agree, but the plist write can fail.
- **Options**: Save config first then toggle auto-start; do them in parallel; do the fallible step first.
- **Choice**: Toggle the plist first; only on success mutate state and persist config.
- **Why**: Putting the one externally-fallible operation first means a failure aborts before anything diverges — no "UI says on, plist missing" states.

## Frequently Asked Questions

### How does it find servers that aren't listening on a default port?
Three things combine. If the server is a known tool, its process command line is matched and any `--port`/`-p`/`--port=` flag is read directly. The scan list also covers a ±5 range around each known default, so a second Vite instance that auto-incremented from 5173 to 5174 is still caught. And the discover step probes the union of process candidates and the scan list, so a server on a non-standard port is still found because its process gave away the port number.

### Why can't I add a server on a public domain or IP?
By design. The app renders servers in an iframe with a permissive frame CSP, so allowing arbitrary hosts would turn it into a proxy for loading any site. Manual adds are restricted to `localhost`, IPv6 loopback, and RFC1918 ranges (`10.*`, `192.168.*`, `172.16–31.*`), checked in the Rust backend.

### What happens to the preview when a server goes offline?
The background poll detects the online→offline transition and fires an "Offline: …" toast; the row dims. The iframe itself will simply fail to load if you open an offline server. Status is re-derived on every scan rather than cached.

### Does auto-start install anything system-wide?
No. It writes a per-user `LaunchAgent` plist to `~/Library/LaunchAgents/com.localhoster.app.plist` with `RunAtLoad`. Turning the toggle off removes the file. The program path written into the plist is XML-escaped to handle app paths containing `&`, `<`, or `>`.

### How often does it scan, and can I change it?
Every 5 seconds by default. The Settings panel lets you pick a different interval and edit the scanned port list (up to 128 ports). Overlapping scans are skipped, so a slow probe never stacks up behind the timer.

### Why doesn't my database (or some other running service) show up?
Because it isn't a web server. A port only appears once it responds to a minimal HTTP request like a web app would — status under 400, or an HTML body. Services that hold a socket but don't speak HTTP (databases, SSH, message brokers) are filtered out, since they couldn't be previewed in the iframe anyway. On macOS the AirPlay receiver's ports (5000 and 7000) are excluded outright, because it answers HTTP `403` with no content and would otherwise show as a blank entry.

### Why Tauri instead of Electron?
The app is a thin native shell around a small Svelte UI. Tauri uses the OS webview instead of bundling Chromium, so the binary is dramatically smaller, and the parts that need native access — process inspection, port probing, tray management, the LaunchAgent — are written in Rust where that work is natural and safe.

### Is the config forward-compatible if I upgrade?
Yes. Newer fields in `AppConfig` use `#[serde(default …)]`, so a config written by an older version still deserializes, falling back to sensible defaults (5s interval, the standard port list, system theme) for anything missing.

### Is the app code-signed and notarized?
Yes. Release builds are signed with an Apple Developer ID certificate and notarized by Apple, so the `.dmg` opens on a clean machine without the "damaged / unidentified developer" Gatekeeper prompt. The bundle is universal, so it runs natively on both Apple Silicon and Intel Macs.

### How do updates work, and are they verified?
On launch the app checks a published update feed. Each update archive is signed with a dedicated key (separate from the Apple certificate) whose public half is embedded in the app; the updater verifies that signature before installing, so a tampered or unofficial build is rejected even if it somehow reached the release host. When an update is available you get an in-app banner, and accepting it downloads, installs, and relaunches into the new version.
