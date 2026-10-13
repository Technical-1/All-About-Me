# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | ~6.0.3 | Strict mode across app, lib, and tests |
| Framework | React Native | 0.86.0 | One codebase for iOS, Android, and web (via `react-native-web` ~0.21.2) |
| Platform | Expo SDK | ^57.0.0 | Managed native modules, EAS builds, static web export |
| UI runtime | React | 19.2.3 | Current React with the New Architecture renderer |
| Graphics | `@shopify/react-native-skia` | 2.6.2 | GPU `Atlas` draws thousands of sprites in one call, natively and on web via CanvasKit |
| Audio graph | `react-native-audio-api` | ^0.13.2 | The same Web Audio–style API on native and web, so synthesis and FFT work everywhere |

## Frontend

- **Framework**: React Native 0.86 on Expo SDK 57
- **Navigation**: Expo Router ~57.0.6 (file-based, `typedRoutes` enabled); routes for the studio, onboarding, custom sounds, and credits
- **State management**: React Context (`SettingsProvider`, `ThemeProvider`, `ToastProvider`, `AudioProvider`, plus a separate `AmplitudeContext`); entitlements use a small subscribe/notify emitter instead of a context
- **Animation**: React Native Reanimated 4.5.0 with `react-native-worklets` 0.10.0 (the Babel plugin is `react-native-worklets/plugin`)
- **Graphics**: Skia for the particle sphere; `react-native-svg` 15.15.4 for the reactive background, saved-creation thumbnails, preset previews, and icons
- **Gestures**: React Native Gesture Handler ~2.32.0 (sphere drag-rotation, sliders)
- **Sheets**: `@gorhom/bottom-sheet` ^5 on mobile; a custom side panel at 900px and wider
- **Styling**: `StyleSheet` with design tokens in `constants/theme.ts` and a high-contrast palette switched by `ThemeContext`

## Audio

| Layer | Technology | What it handles |
|-------|------------|-----------------|
| Synthesis and analysis | `react-native-audio-api` ^0.13.2 | Noise buffers, harmonic and FM oscillators, binaural panning, 3-band EQ, `AnalyserNode` FFT (size 256) |
| File playback | `expo-audio` ~57.0.2 | The 24 bundled MP3 loops, custom-sound playback with trim-window looping, import preview, and the audio session (`playsInSilentMode`) |
| Context input | `expo-sensors` ~57.0.2 | Accelerometer at about 1 Hz for adaptive mode (native only) |

## Storage and Persistence

- **Primary**: `@react-native-async-storage/async-storage` 2.2.0, every key prefixed `flux_`
- **Files**: `expo-file-system` ~57.0.1 (custom sounds and custom soundscapes on native, backup files)
- **Backup**: `expo-document-picker`, `expo-sharing`, and a browser download on web, behind `lib/settingsBackup.ts`
- **Import safety**: versioned JSON; import checks each key against a type allowlist before writing

## Infrastructure

- **Web hosting**: Vercel (static export to `dist/`, SPA rewrite, security headers and CSP in `vercel.json`)
- **Native builds**: EAS Build (`development`, `preview`, `production` profiles)
- **Monitoring**: Sentry (`@sentry/react-native` ~7.11.0), on only in production builds with `EXPO_PUBLIC_SENTRY_DSN` set
- **Assets**: MP3/WAV/FLAC tracked with Git LFS (`.gitattributes`)
- **CI/CD**: none; builds and deploys run from npm scripts

## Development Tools

- **Package manager**: npm
- **Bundler**: Metro, with extra asset extensions for mp3, wav, flac, ogg, m4a, and aac (`metro.config.js`)
- **Linting**: ESLint ^9.39.4, flat config extending `eslint-config-expo` ~57.0.0
- **Type checking**: TypeScript strict, `@/*` path alias
- **Testing**: Jest ^29.7.0 with `jest-expo` ~57.0.2 and `@testing-library/react-native` ^13.3.3; 28 suites and 322 tests covering the pure `lib/` modules and the sheet quick-control components
- **Audio tooling**: Python 3 scripts in `scripts/` that shell out to ffmpeg/ffprobe for analysis, trimming, and seamless-loop creation; `scripts/copy-canvaskit.js` stages the CanvasKit WASM for web builds

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@shopify/react-native-skia` | Atlas-based particle and trail rendering; `WithSkiaWeb` loads CanvasKit on web |
| `react-native-audio-api` | Cross-platform audio graph for synthesis, EQ, panning, and FFT |
| `expo-audio` | MP3 loop playback and custom-sound playback |
| `react-native-reanimated` / `react-native-worklets` | UI-thread rotation and wobble clocks, sheet transitions, reactive background |
| `expo-sensors` | Accelerometer input for adaptive mode |
| `@gorhom/bottom-sheet` | Mobile peek/expanded control sheets |
| `react-native-svg` | Reactive background, thumbnails, previews, icons |
| `@sentry/react-native` | Production crash reporting |
| `expo-document-picker` / `expo-file-system` / `expo-sharing` | Custom-sound import and backup export/import |
| `expo-haptics` / `expo-blur` | Tactile feedback and the frosted bottom bar |
