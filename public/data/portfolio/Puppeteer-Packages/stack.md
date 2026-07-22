# Tech Stack

The stack is chosen so the suite is easy to *consume*: whichever module system you use, whichever Puppeteer version you're on, the packages fit in without a fight.

## Core technologies

| Category | Technology | Version | Why it's here |
|----------|------------|---------|---------------|
| Language | TypeScript | 5.x | Strict mode + `NodeNext` + `verbatimModuleSyntax` + `noUncheckedIndexedAccess` catch the bugs that bite library consumers most — before you ever hit them. |
| Runtime peer | puppeteer-core | `>=22 <25` | The browser driver. Kept a peer, not a dependency, so *your* project owns the single version and nothing gets double-bundled. |
| Module formats | ESM + CJS | — | A dual build so both `import` and `require` users get working code *and* accurate per-format typings. No "works in my project but not yours." |

## Build & tooling

- **Monorepo**: pnpm workspaces — fast installs and first-class `workspace:` linking between the 29 packages.
- **Task runner**: Turborepo — caches `build`/`lint`/`test`/`typecheck` so CI only redoes what actually changed.
- **Bundler**: tsup (esbuild under the hood) — one shared base config emits `index.js` (ESM), `index.cjs` (CJS), and matching `index.d.ts` / `index.d.cts` for every package.
- **Versioning/Release**: Changesets — independent per-package semver, an automated version PR, and provenance-backed npm publishing.

## Testing

- **Unit**: Vitest with dependency-injected mocks — no real Chrome, so the default test run stays fast. Coverage is held above a 90% line/branch/function threshold in CI.
- **Integration**: a separate tier (`PPTR_IT=1`) that launches real Chrome against a local fixture HTTP server — never the live internet — exercising the browser-driving packages end to end.

## Development tools

- **Package manager**: pnpm
- **Linting**: ESLint (flat config) with a zero-warning gate
- **Type checking**: `tsc --noEmit` per package, kept separate from the build (the build transpiles but doesn't strictly type-check)
- **CI**: GitHub Actions — a build/test/lint/typecheck matrix, the integration tier with a Chrome cache, a coverage gate, and SHA-pinned actions

## Key dependencies

| Package | Purpose |
|---------|---------|
| `puppeteer-core` | Drives Chrome over the DevTools Protocol (peer dependency) |
| `@puppeteer/browsers` | Resolves and downloads Chrome-for-Testing builds (inside `chrome-setup` only) |
| `puppeteer-extra` + `puppeteer-extra-plugin-stealth` | Back the `stealth` package's anti-detection wiring |
| `tsup` | Dual ESM/CJS + declaration build |
| `turbo` | Cached, parallel monorepo task pipeline |
| `vitest` + `@vitest/coverage-v8` | Test runner and coverage |
| `@changesets/cli` | Versioning and publishing |
</content>
