# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|---|---|---|---|
| Language | Swift | 5 | The native language for the platform; strict concurrency via MainActor isolation |
| UI | SwiftUI + Observation | iOS 17+ | The game is a phase machine rendering from one observable state object, which is exactly SwiftUI's model |
| Networking | URLSession WebSocket | system | No third-party socket library needed; delegate callbacks are pinned to the main queue for actor safety |
| Media | stasel/WebRTC | 138.0.0 | A maintained binary build of libwebrtc; the only third-party dependency in the app |
| Project | XcodeGen | latest | `project.yml` is the reviewable source of truth; the pbxproj is generated output |

## App

- **Minimum OS**: iOS 17, iPhone only, portrait only
- **State**: `@Observable` classes (`RoomConnection`, `CallController`) owned by
  the screens; server state arrives as whole snapshots so there is nothing to
  reconcile
- **Persistence**: `UserDefaults` with the same keys the web client uses in
  local storage (`qg:nickname`, `qg:token:CODE`, `qg:questions:CODE`), so the
  mental model is identical across clients; nothing stored is load-bearing
- **Typography**: Archivo Black and JetBrains Mono, bundled

## Networking

- **Game**: one `URLSessionWebSocketTask` per room against the production
  Worker, with a 25-second heartbeat, 500 ms to 8 s exponential backoff, and an
  immediate reconnect on foregrounding
- **HTTP**: room creation, room existence checks, a server capability probe,
  and anonymous feedback reports, all plain `URLSession`
- **Wire format**: hand-written Codable mirror of the server's schemas,
  tolerant of newer servers by construction

## Media

- **Engine**: libwebrtc via the stasel/WebRTC package
- **Publish**: 480x360 at up to 20 fps from the front camera, sendonly
  transceivers, modest on purpose because this is a talking game
- **Signaling**: the Cloudflare Realtime session and track HTTP API, proxied by
  the game's Worker so no app secret ships in the binary
- **Simulator**: the audio unit is deliberately disabled under simulation
  because concurrent simulators contending for the Mac's audio hardware abort
  in CoreAudio; tracks still negotiate, so the stack stays testable

## Testing

- **Unit**: Swift Testing suites for the protocol codec, the connection
  reducer, copy pinning against the site, and the practice script
- **Integration**: an XCTest that joins a live production room and proves the
  call stack end to end (ICE connected, remote frames decoded by a real
  renderer, inbound audio bytes climbing); it skips itself unless a far-end
  peer is publishing
- **UI**: XCUITests for the practice round flow
- **Debug autopilot**: launch arguments (`-qgName`, `-qgAutoJoin`,
  `-qgAutoStart`, `-qgAutoAnswer`) drive whole games across several simulators
  reproducibly; the autopilot compiles out of Release builds entirely

## Key Dependencies

| Package | Purpose |
|---|---|
| `stasel/WebRTC` | The WebRTC engine for the in-app call; the app's only third-party dependency |
