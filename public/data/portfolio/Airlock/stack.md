# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | ^5.9 (type-check only) | Types document the snapshot/verdict contracts shared by every surface. |
| Runtime | Node.js | ≥ 22.18 (developed on 26) | Native type stripping runs `.ts` directly; Claude Code hooks already depend on `node`. |
| Tests | `node:test` | built-in | No test-framework dependency. Tests import the real modules. |
| Extension bundler (dev only) | esbuild | ^0.25 | Bundles the unchanged engine into an MV3 service worker; never shipped to CLI users. |
| Browser | Chrome MV3 | Chrome 116+ | Service worker, content script, popup and options page over the same engine. |
| Sandbox (benchmark only) | Docker | 29.x | Isolates untrusted third-party scanners during comparison runs. |

## Backend / CLI

- **Runtime**: Node.js, ES modules
- **Interfaces**: CLI (`bin/airlock.js`), a Claude Code hook entrypoint (`airlock hook pre-tool|post-tool`) reading JSON on stdin, and a Chrome extension (`extension/`)
- **Network**: global `fetch` against the GitHub REST API and `raw.githubusercontent.com`, with an optional bearer token
- **State**: JSON quarantine store under `~/.airlock/`, written atomically under an `O_EXCL` lockfile

## Infrastructure

- **Hosting**: none. Airlock runs locally.
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) on Ubuntu and macOS with Node 22 and 24: type check, the full test suite, the offline benchmark corpus, and a build-and-pack smoke test
- **Monitoring**: none. Every verdict carries its own coverage report.

## Browser Extension

- **Manifest**: MV3, permissions `storage` and `activeTab`, host access to `api.github.com` and `raw.githubusercontent.com` only, strict extension-page CSP
- **Build**: `npm run build:extension` runs `extension/build.ts`; esbuild resolves `node:fs`, `node:fs/promises` and `node:path` to throwing stubs and injects a small `Buffer` shim, and the build fails if any other Node import or dynamic code loading reaches the bundle
- **Distribution**: load unpacked from `extension/dist`; not yet on the Chrome Web Store

## Development Tools

- **Package Manager**: npm (dev dependencies only)
- **Type checking**: `tsc --noEmit` with `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`
- **Testing**: `node:test`
  - unit tests per rule (positive and benign look-alike)
  - adversarial red-team suites
  - real-git integration tests
  - an adversarial-input timing test guarding against regex backtracking
  - extension tests that run the bundled worker in a bare `vm` context with a mocked `chrome.*`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` (dev) | Type checking only; nothing is emitted |
| `@types/node` (dev) | Node built-in typings |
| `esbuild` (dev) | Bundles the Chrome extension only |

There are no runtime dependencies, by design: a security gate that runs inside every agent tool call shouldn't widen its own supply-chain surface.
