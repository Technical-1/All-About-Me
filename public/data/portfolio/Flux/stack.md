# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | 5.9.3 | Type safety with strict mode |
| Framework | React Native | 0.81.5 | Cross-platform UI (New Architecture enabled) |
| Platform | Expo SDK | 54 | Managed workflow, build tooling, native APIs |
| Runtime | React | 19.1.0 | Component model and hooks |

## Frontend

- **Framework**: React Native 0.81 with Expo SDK 54
- **Navigation**: Expo Router 6 (file-based routing with typed routes)
- **State Management**: React Context (AudioProvider, SettingsProvider, ToastProvider)
- **Animation**: React Native Reanimated 4 (UI thread animations at 60fps)
- **Graphics**: React Native SVG 15 (particle rendering, backgrounds, thumbnails, icons)
- **Gestures**: React Native Gesture Handler 2.28 (pan rotation, custom sliders)
- **UI Components**: @gorhom/bottom-sheet v5 (sheet-based mobile interface)
- **Styling**: StyleSheet API with centralized design tokens (`constants/theme.ts`)

## Audio

| Platform | Technology | Capabilities |
|----------|------------|-------------|
| Web | Web Audio API | Procedural noise, oscillators, FM synthesis, binaural beats, real FFT, 3-band EQ, spatial panning |
| Native | expo-audio 1.1.1 | File playback, looping, background audio, `playsInSilentMode` |

## Storage & Persistence

- **Primary**: @react-native-async-storage/async-storage 2.2.0
- **File Storage**: expo-file-system 19.0.21 (custom sound imports on native)
- **Key Strategy**: All keys namespaced with `flux_` prefix
- **Export/Import**: JSON-based bulk data transfer with version tracking

## Infrastructure

- **Web Hosting**: Vercel (static export)
- **Native Builds**: EAS Build (development, preview, production profiles)
- **Audio Assets**: Git LFS (26 audio files, WAV/FLAC/MP3)
- **Deep Linking**: Custom URL scheme (`flux://`)

## Development Tools

- **Package Manager**: npm
- **Bundler**: Metro (with audio asset extension support: mp3, wav, flac, ogg, m4a, aac)
- **Transpiler**: Babel with `babel-preset-expo` + `react-native-reanimated/plugin`
- **Linting**: ESLint (flat config, extends `eslint-config-expo`)
- **Type Checking**: TypeScript 5.9.3 (strict mode, path aliases `@/*`)
- **Testing**: Jest 29 + jest-expo + @testing-library/react-native
- **Audio Processing**: Python 3 scripts using ffmpeg/ffprobe (analysis, trimming, loop creation)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo-audio` | Native audio playback with looping and background support |
| `react-native-reanimated` | UI-thread animations for particle rotation and sheet transitions |
| `react-native-svg` | SVG rendering for particles, backgrounds, icons, and thumbnails |
| `@gorhom/bottom-sheet` | Bottom sheet UI with peek/expanded states |
| `react-native-gesture-handler` | Pan gestures for rotation and custom slider controls |
| `expo-blur` | Frosted-glass effect on bottom bar and floating controls |
| `expo-haptics` | Tactile feedback on interactions (iOS/Android) |
| `expo-document-picker` | Custom sound file import |
| `expo-file-system` | Local file management for custom sounds |
| `expo-sharing` | Data export sharing |

## Unused Dependencies (Candidates for Removal)

| Package | Notes |
|---------|-------|
| `@react-three/fiber` | Three.js React renderer — from earlier 3D prototype, replaced by SVG approach |
| `@react-three/drei` | Three.js helpers — unused alongside fiber |
| `three` | Three.js core — unused |
| `expo-gl` | OpenGL ES context — unused after Three.js removal |
| `expo-gl-cpp` | Native GL bindings — unused |
