# Project Q&A

## Overview

This is a [Homebrew](https://brew.sh) tap — a personal package repository that lets anyone install my command-line tools with a single `brew install`. Each tool is described by a Ruby *formula* that tells Homebrew how to fetch, build, verify, and install it. The interesting part is that the tools span different language ecosystems, so the tap demonstrates two distinct, idiomatic packaging strategies side by side: a Rust binary built with Cargo, and a Python CLI installed into an isolated virtualenv with a fully pinned dependency closure.

## Problem Solved

Distributing a CLI tool to other people is awkward: you either ship raw binaries (which need building, hosting, and signing for every OS) or you tell users to install a language toolchain and run `cargo install` / `pip install` themselves. A Homebrew tap removes that friction — `brew install Technical-1/tap/<tool>` works for any of my tools regardless of the language they're written in, and Homebrew handles toolchain resolution, checksum verification, and `PATH` wiring.

## Target Users

- **People who want to run my CLIs** — they get a one-line install and a tool on their `PATH`, without caring whether it's Rust or Python underneath.
- **Engineers reviewing the packaging** — they get two clean, contrasting examples of how to write a correct Homebrew formula for a compiled language and for an interpreted one.

## Key Features

### One-line install for cross-language tools
After `brew tap Technical-1/tap`, any listed tool installs with `brew install <formula>`. The user never sees the difference between a Cargo build and a virtualenv build.

### Reproducible, checksum-verified builds
Every source tarball is pinned by tag and `sha256`. For the Python tool, every transitive dependency is also pinned to an exact PyPI artifact and checksum, so an install fetches exactly the audited bytes — nothing is resolved "live" at install time.

### Self-testing formulae
Each formula ships a `test` block that runs the installed binary's `--help`, so `brew test` can confirm an install actually produced a working executable.

## Technical Highlights

### Pinning a Python CLI's entire dependency closure
The naive way to package a Python CLI is to let `pip` resolve dependencies at build time, which makes installs non-reproducible. Instead, `Formula/shopify-atc.rb` declares `requests` *and* its full transitive set — `certifi`, `charset-normalizer`, `idna`, `urllib3` — as individual `resource` blocks, each frozen to a specific sdist URL and `sha256`. `virtualenv_install_with_resources` then builds the whole closure into a private virtualenv. The result is an install that is reproducible and fully checksum-verified.

### Idiomatic per-ecosystem install logic
`Formula/crypto-price-tracker-v2.rb` delegates to `system "cargo", "install", *std_cargo_args`, the Homebrew helper that points Cargo's output at the Cellar. `Formula/shopify-atc.rb` instead `include`s `Language::Python::Virtualenv` and isolates the tool in its own environment. Each formula uses the approach its ecosystem expects rather than forcing one generic pattern onto both.

### Stable and bleeding-edge installs from one recipe
Both formulae pair a tagged, checksummed `url` with a `head` URL pointing at the project's `main` branch. Regular users get the verified release; `brew install --HEAD` builds straight from the latest commit — both from the same formula, no duplication.

## Engineering Decisions

### Build from source vs. ship bottles
- **Constraint**: Homebrew can serve precompiled "bottles," but producing them means building and hosting per-OS binaries.
- **Options**: Maintain a bottling pipeline, or build from source on the user's machine.
- **Choice**: Build from source.
- **Why**: For a handful of personal tools, source builds eliminate all binary-hosting and signing overhead and keep the tap to plain-text recipes. The trade-off is a short local compile, which is acceptable for CLI tools.

### Virtualenv isolation for Python vs. installing into system site-packages
- **Constraint**: A Python CLI's dependencies can conflict with the system interpreter or other installed tools.
- **Options**: Install into the shared environment, or sandbox each tool.
- **Choice**: A dedicated virtualenv per formula.
- **Why**: Isolation means installing or removing the tool can never disturb the user's Python setup or another formula's dependencies.

### Expressing the Rust tool's dual license honestly
- **Constraint**: The crypto tracker is offered under MIT *or* Apache-2.0.
- **Options**: Pick one license string for the formula, or model the real relationship.
- **Choice**: `license any_of: ["MIT", "Apache-2.0"]`.
- **Why**: Homebrew's license DSL can represent "either license applies," so the formula states the actual terms instead of misrepresenting them as a single license.

## Frequently Asked Questions

### How do I install one of these tools?
```bash
brew install Technical-1/tap/<formula>
```
or `brew tap Technical-1/tap` once, then `brew install <formula>`.

### Why is a Python tool packaged so differently from the Rust one?
The two ecosystems have different needs. Rust produces a single static binary, so `cargo install` is enough. Python needs its dependency tree present at runtime, so the formula vendors that tree into an isolated virtualenv to avoid polluting the system interpreter.

### Why list every Python dependency by hand instead of just running `pip install`?
To make installs reproducible and verifiable. Each `resource` block pins an exact artifact and checksum, so the build downloads precisely the dependencies that were audited — not whatever PyPI happens to resolve on install day.

### Can I install the very latest, unreleased version?
Yes — `brew install --HEAD Technical-1/tap/<formula>` builds from the project's `main` branch using the formula's `head` URL.

### Do I need Rust or Python installed first?
No. The formulae declare their toolchains (`rust`, `python@3.13`) as dependencies, and Homebrew installs them automatically as needed.

### How do I know an install actually worked?
Each formula includes a `test` block that runs the tool's `--help`. You can trigger it yourself with `brew test Technical-1/tap/<formula>`.

### How do I add a new tool to the tap?
Add a `Formula/<tool>.rb` recipe with the source `url` + `sha256`, the right build logic for its language, and a `test` block; validate it with `brew style` and `brew audit --strict --online`.
