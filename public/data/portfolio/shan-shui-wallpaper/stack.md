# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language (app) | Swift | 6.3 toolchain, Swift 5 language mode | Native access to window levels, the menu bar, power state and the system wallpaper |
| UI | AppKit + SwiftUI | macOS 13+ | AppKit for the desktop-level window and status item; SwiftUI for a settings panel that is mostly sliders |
| Renderer host | WebKit (`WKWebView`) | system | The generator is JavaScript that emits SVG; running it unmodified in the system web view avoids a port |
| Language (renderer) | JavaScript | ES5-style, no modules | Matches the generator's style and runs from a `file://` URL with no bundler |
| Graphics | SVG filters, Canvas 2D, Web Animations API | — | SVG to rasterize, canvas to hold and tint tiles, a compositor animation to move them |

## Frontend

- **Framework**: none
- **State**: a single config object in `web/wallpaper.js`, set from the URL and updated through one `apply()` entry point
- **Styling**: a few lines of CSS in `web/index.html`
- **Build Tool**: none for the page itself; a Node script generates `web/engine.js`

## Backend

Not applicable. The app is fully local and makes no network requests.

## Infrastructure

- **Distribution**: GitHub Releases (`.dmg` and `.zip`), Developer ID signed and notarized
- **CI/CD**: GitHub Actions on macOS runners — a build on every push and pull request, a release on version tags
- **Monitoring**: none

## Development Tools

- **Build**: `build.sh` calling `swiftc`, `lipo`, `codesign`; no Xcode project and no package manager
- **Packaging**: `hdiutil` for the disk image, `notarytool` and `stapler` for notarization
- **Icon**: drawn in Swift (`app/Glyph.swift`) and assembled with `iconutil`
- **Linting / Formatting**: none
- **Testing**: none automated — rendering is checked with the app's `--snapshot` and `--snapshot-settings` flags, which write what the wallpaper or settings panel shows to a PNG

## Key Dependencies

| Package | Purpose |
|---------|---------|
| shan-shui-inf (vendored, MIT) | The landscape generator; produces all of the artwork |
| WebKit | Runs the generator and the tile renderer |
| ServiceManagement | Launch at login (`SMAppService`) |
| IOKit power sources | Battery/AC change notifications for pause-on-battery |

There are no third-party packages. The app is under 1 MB.
