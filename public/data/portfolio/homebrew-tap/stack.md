# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Distribution | Homebrew tap | — | The de-facto package manager on macOS; `brew install` is the install path users already know |
| Recipe language | Ruby (Homebrew Formula DSL) | — | Required by Homebrew; formulae are Ruby classes subclassing `Formula` |
| Rust build chain | `rust` / Cargo | Homebrew `rust` | Builds the Rust CLI from source via `cargo install` |
| Python build chain | `python@3.13` + virtualenv | 3.13 | Isolates the Python CLI's dependencies from the system interpreter |

## Infrastructure

- **Hosting**: GitHub (the tap repo itself; source tarballs come from each tool's own GitHub releases)
- **CI/CD**: None in this repo — formulae are updated when a source project cuts a release and its `url`/`sha256` are refreshed
- **Monitoring**: None — install correctness is enforced by each formula's `test` block, run via `brew test`

## Development Tools

- **Validation**: `brew style` (RuboCop rules for formulae) and `brew audit --strict --online`
- **Resource generation**: `brew update-python-resources` to derive Python `resource` blocks from a project's dependencies
- **Local install testing**: `brew install --build-from-source` and `brew test`

## Key Dependencies

These are the toolchains each formula declares, not application libraries.

| Declared dependency | Purpose |
|---------------------|---------|
| `rust` (build) | Compiles `crypto-price-tracker-v2` with Cargo |
| `python@3.13` | Runtime interpreter and virtualenv host for `shopify-atc` |
| `requests` (+ `certifi`, `charset-normalizer`, `idna`, `urllib3`) | The Python CLI's pinned runtime dependency closure, vendored as `resource` blocks |
