# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | TypeScript | 5.x | Strict mode + `NodeNext` + `verbatimModuleSyntax` + `noUncheckedIndexedAccess` catch the bugs that bite library consumers most. |
| Runtime peer | puppeteer-core | `>=22 <25` | The browser driver. Kept a peer (not a dependency) so consumers own the single version and nothing gets double-bundled. |
| Module formats | ESM + CJS | — | Dual build so both `import` and `require` users get working code *and* accurate per-format typings. |

## Build & Tooling

- **Monorepo**: pnpm workspaces — fast installs and first-class `workspace:` linking between the packages.
- **Task runner**: Turborepo — caches `build`/`lint`/`test`/`typecheck` across the 19 packages so CI only redoes what changed.
- **Bundler**: tsup (esbuild under the hood) — one shared base config emits `index.js` (ESM), `index.cjs` (CJS), and matching `index.d.ts` / `index.d.cts` for every package.
- **Versioning/Release**: Changesets — per-package semver with an automated version PR and provenance-backed npm publishing.

## Testing

- **Unit**: Vitest, dependency-injected mocks — no real Chrome in unit tests. ~100% line coverage / ~98% branch coverage with a 90% threshold gate.
- **Integration**: a separate tier (`PPTR_IT=1`) that launches real Chrome against a local fixture HTTP server — never the live internet — covering the browser-driving packages end-to-end.

## Development Tools

- **Package Manager**: pnpm
- **Linting**: ESLint (flat config) with a zero-warning gate
- **Type checking**: `tsc --noEmit` per package, separate from the build (the build transpiles but doesn't strictly type-check)
- **CI**: GitHub Actions — build/test/lint/typecheck matrix, the integration tier with a Chrome cache, a coverage gate, and SHA-pinned actions

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `puppeteer-core` | Drives Chrome over the DevTools Protocol (peer dependency) |
| `@puppeteer/browsers` | Resolves and downloads Chrome-for-Testing builds (inside `chrome-setup` only) |
| `puppeteer-extra` + `puppeteer-extra-plugin-stealth` | Backs the `stealth` package's anti-detection wiring |
| `tsup` | Dual ESM/CJS + declaration build |
| `turbo` | Cached, parallel monorepo task pipeline |
| `vitest` + `@vitest/coverage-v8` | Test runner and coverage |
| `@changesets/cli` | Versioning and publishing |
