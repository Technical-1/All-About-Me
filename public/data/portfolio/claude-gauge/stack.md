# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|---|---|---|---|
| Language | Rust | 2024 edition | A menubar app runs for weeks; I wanted no GC pauses, no runtime, and a single binary with nothing to install alongside it. |
| Menubar | `tray-icon` | 0.24.2 | The only maintained crate that gives a real `NSStatusItem` with a native menu, rather than drawing its own. |
| Event loop | `tao` | 0.37.0 | Required by `tray-icon`, and its macOS extension exposes the activation policy needed to run without a Dock icon. |
| Menus | `muda` | 0.19.3 | Comes with `tray-icon`. Provides submenus, check items, and a native About panel — which removed the need for any windowing code at all. |
| HTTP | `ureq` | 3.4.0 | Blocking and tiny. The app makes one request per account every five minutes; an async runtime would be more machinery than the whole program. |

## Application Structure

- **Rendering**: Native macOS menu items — no custom drawing, no web view
- **Concurrency**: Three background threads, `Arc<Mutex<…>>` for shared state, and
  a dirty flag. The menu is only *rebuilt* when its item layout changes; a
  value-only change updates the existing items in place, and identical content
  touches nothing. Threads are split by what
  each costs: sessions every 60s (local calls only), quota every 300s (the only
  thing spending requests), and a one-shot thread for the odometer's first
  full-corpus pass so the menubar is never held up by it
- **Persistence**: JSON files under `~/.config/claude-gauge/`
- **Windows**: None. The app creates no window; the About panel is the system's own

## System Integration

- **Credentials**: macOS Keychain, read through the `security` CLI
- **Automation**: AppleScript via `osascript`, for reading and raising Terminal tabs
- **Process inspection**: `ps` and `lsof`, one batched invocation each per refresh
- **Notifications**: `osascript` — arguments passed through `on run argv` rather
  than interpolated into the script source, so a value containing a quote cannot
  change what the script does
- **Startup**: A user LaunchAgent written by the app, pointing at `current_exe()`

## Infrastructure

- **Distribution**: A signed, notarized `.app` bundle. No server, no hosting.
- **CI/CD**: None. Personal tool, built from one machine.
- **Monitoring**: An append-only request log, so rate-limit questions can be
  answered from data rather than recollection.

## Development Tools

- **Package manager**: Cargo
- **Linting**: Clippy — clean at the default lint level
- **Icon pipeline**: The icon is authored as HTML/SVG and rasterised at 2048px by
  headless Chrome, then downsampled into an `.iconset`. Iterating on a gradient in
  CSS is faster than hand-editing SVG path data, and the source stays readable.
- **Testing**: None automated. Two headless modes (`--list`, `--title`) plus a
  `--menu` mode that prints the dropdown's exact text make the data path and the
  rendering verifiable from a shell without launching a GUI.

## Key Dependencies

| Package | Purpose |
|---|---|
| `tray-icon` | Menubar item, native menu, submenus |
| `tao` | Event loop; sets the accessory activation policy so no Dock icon appears |
| `ureq` | The single HTTP call. Configured with `http_status_as_error(false)` so a 429 response — and its `Retry-After` header — survives to be read |
| `serde` / `serde_json` | Response parsing and cache serialisation |
| `chrono` | Reset countdowns and cache timestamps; `serde` feature enabled so windows round-trip through the cache |
| `sha2` | Derives the Keychain service name, and the cache key, from a config root's absolute path |
| `libc` | `flock` for the single-instance guard, and `getuid` for the LaunchAgent domain |
