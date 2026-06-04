# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | JavaScript (JSX) | ES2020+ | No build-time type layer needed for an app this size |
| Framework | React Native | 0.76 | One codebase targeting web + iOS + Android |
| Toolchain | Expo | SDK 52 | Handles bundling, assets, permissions, and native builds without ejecting |
| Web runtime | react-native-web | 0.19 | Renders the same RN components in the browser, which is the primary deploy target |

## Frontend

- **Framework**: React Native 0.76 with React 18.3
- **State Management**: Local component state + a `useRef` pixel cache (no external store — a single screen doesn't need one)
- **Styling**: `StyleSheet` with `Platform`-conditional shadows; raw `<div>`/`<pre>` on web where colored ASCII needs inline spans
- **Build Tool**: Metro (via Expo)

## Image & Conversion

- **Pixel access (web)**: HTML `<canvas>` — `drawImage` to downscale, `getImageData` to read RGBA
- **Pixel access (native)**: `@shopify/react-native-skia` 1.5 — offscreen surface, `drawImageRect`, `readPixels`
- **Conversion**: Hand-written pure module (`src/asciiCore.js`) — luminance mapping, Sobel edge detection, brightness/contrast, ANSI nearest-color

## Infrastructure

- **Hosting**: Static web export (`expo export --platform web`) — deployable to any static host
- **CI/CD**: None — a small personal project verified by hand + unit tests
- **Monitoring**: None

## Development Tools

- **Package Manager**: npm
- **Testing**: Jest — unit tests cover the pure conversion core (`asciiCore`, `exportPayload`)
- **Linting / Formatting**: None configured

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo` | App toolchain, config, native build orchestration |
| `react-native-web` | Renders the app in the browser (primary target) |
| `@shopify/react-native-skia` | Decodes and samples image pixels on iOS/Android |
| `expo-image-picker` | Choose a photo from the library or take one with the camera |
| `expo-file-system` / `expo-sharing` | Write and share `.txt` / `.html` exports on native |
| `expo-clipboard` | Copy ASCII / HTML output |
| `react-native-view-shot` | Capture the rendered ASCII as a PNG on native |
