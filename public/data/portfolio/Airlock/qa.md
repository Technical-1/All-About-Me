# Project Q&A

## Overview

Airlock tells you what a repository will execute before you open it, and stops AI coding agents from reading or running a repository they just fetched until it's been checked. It statically inspects the files that run automatically: IDE tasks, agent hooks and instructions, install and build scripts, and README download lures. It returns a commit-pinned verdict that is never "clean" unless everything required was actually inspected, from the command line, inside Claude Code, or as a badge on the GitHub page itself through a Chrome extension. The technically interesting part is the Claude Code gate. It detects fetched repositories by diffing the working tree rather than parsing commands, so it holds up against the many ways an agent can pull code.

## Problem Solved

In 2025–2026, developer-targeted malware moved from "run this script" to "open this folder":
- worms committed `.claude/settings.json` startup hooks and auto-run VS Code tasks into thousands of repositories, including Microsoft-owned ones
- fake-interview campaigns hid loaders in `tasks.json`
- FakeGit published more than 17,000 repositories whose README "Download" button delivers malware

Meanwhile, headless agent runs execute a repository's own hooks without any trust prompt. Package-registry scanners don't look at arbitrary repositories, and GitHub's security features protect repository owners, not the people cloning their code.

## Target Users

- **Developers evaluating unfamiliar repositories**: a fast local verdict before cloning, opening or installing.
- **Teams running coding agents headlessly**: a gate that keeps `claude -p` or SDK runs from executing or reading untrusted repositories.
- **Security researchers**: a reproducible benchmark of repository-level malware detection, including held-out results.

## Key Features

### Execution-trigger detection
Airlock reads exactly the files that execute without user intent, and scores them on content:
- IDE: folder-open tasks, workspace and launch configs, JetBrains run configs
- AI agents: SessionStart hooks, MCP servers, rules files
- Install and build: npm lifecycle scripts, `.npmrc`, `bunfig.toml`, Python `.pth`, Visual Studio build events, `build.rs`

A `tasks.json` that starts a dev server is clean. One that pipes a download into a shell is not.

### README and release lure detection
It recognises the shape of download lures rather than specific URLs:
- a README that links the same committed archive over and over, behind badges, "documentation" and "contact" links
- an archive named after the repository with its words shuffled
- a GitHub Pages "preparing your download" page that decodes and redirects to the payload
- an archive or executable link next to a password or "disable antivirus" instruction
- a committed launcher + interpreter + opaque payload
- a repository whose README promises a large tool while the source is nearly empty

### Chrome extension
A thin MV3 shell over the same engine. On a GitHub repository page it shows a verdict badge for the commit being viewed, lists findings in the toolbar popup, and marks README and release links that lead to archives or executables. It reads exactly what `airlock scan <url>` reads and never downloads a release asset. It loads unpacked from `extension/dist` after `npm run build:extension`; it isn't on the Chrome Web Store yet.

### Coding-agent gate
Installed into Claude Code user settings, it:
- quarantines any repository that appears after a shell command
- scans it before the agent can touch it
- stops the session on a malicious verdict
- denies reads of anything that isn't clean

A wrapper (`airlock exec`) covers the one case hooks can't: launching an agent inside a malicious repository.

### Honest verdicts
`unknown` is a real outcome. Rate limits, truncated trees, unreadable or escaping symlinks, and crashing rules all prevent a `clean` verdict.

## Technical Highlights

### Diff-based fetch detection
`src/gate/fingerprint.ts` records git repositories and auto-run files under the working directory before each Bash call, and `src/gate/hooks.ts` diffs that record afterwards. Command parsing was the obvious approach, but red-team testing found 22 fetch spellings it missed, including `$G clone`, `python -c`, and `git clone --no-checkout` followed by `git checkout`. The diff catches all of them because it observes the result. Staleness is content-based (HEAD, index, and a hash of targeted paths), so a checkout into an existing directory triggers a rescan.

### Reachability-weighted severity
`src/core/autorun.ts` and `src/core/rules/*` grade findings by how automatically the file runs, and by what it does once the referenced local script is resolved and analysed. A nested coursework Makefile, a skill script that runs `npm pack`, and a `conftest.py` under `tests/` are reachable only by explicit user action, so they stay low. A SessionStart hook running a script that decodes and executes a payload is critical.

### Terminal- and parser-safe evidence
Reports print attacker-controlled filenames and file contents. `src/cli/report.ts` escapes C0/C1 controls, newlines, bidi and invisible characters in every field, and JSON output re-escapes characters that `JSON.stringify` leaves raw. A crafted filename therefore can't forge a "CLEAN" line or hide its own contents.

### Linear-time rules under adversarial input
Every rule runs inside a hook with a time budget. `test/perf.test.ts` feeds each rule around 100 KB adversarial inputs (newline floods, quote runs, nested brackets) at every targeted path. That test is how a quadratic `^\s*` multiline pattern, which took 5 seconds on a `CLAUDE.md` of blank lines, was found and removed.

## Engineering Decisions

### Static analysis only
- **Constraint**: The tool runs before untrusted code is trusted, often inside an agent's tool loop.
- **Options**: Dynamic sandboxing; LLM-based review; static rules.
- **Choice**: Static, structural rules. Release assets are judged by metadata and never downloaded.
- **Why**: Zero execution risk, millisecond hook latency, and deterministic, auditable verdicts. Payloads behind URLs or inside password-protected archives are judged by lure shape instead. That limit is documented, not hidden.

### Held-out evaluation over corpus scores
- **Constraint**: Rules tuned on their own test cases look perfect and generalise poorly. The first rule set caught 0 of 21 unseen red-team evasions.
- **Options**: Report corpus accuracy; add more cases; keep data held out.
- **Choice**: Red-team cases are split, the hidden half is measured once, and real-repository false-positive sets are fetched only after each tuning round.
- **Why**: Only numbers measured on data the rules never saw are reported as accuracy, with 95% intervals. The second round went further: I froze the engine and collected a new set of 403 real malicious repositories, dominated by README-lure campaigns, without scanning it. The frozen engine caught only 50.4%. I tuned on half of the set, and the other half (193 repositories) then scored 99.0% [96.3–99.7] detected, 96.9% as malicious. On 390 hard benign repositories (low-star projects and legitimate users of auto-run tasks, agent hooks and MCP configs) 0.5% [0.1–1.9] were flagged malicious. Both results are published, the weak one first.

### Claude Code first, wrapper for everything else
- **Constraint**: Each agent has a different hook model.
- **Options**: A generic proxy; per-agent adapters; a wrapper only.
- **Choice**: A deep Claude Code integration, plus `exec`, which wraps any agent CLI.
- **Why**: Claude Code's hooks are rich enough to enforce fail-closed access control. The wrapper gives every other agent the most important protection on day one.

## Frequently Asked Questions

### Did the benchmark find anything real?
Yes. Hand-checking every flag in 799 randomly sampled "benign" repositories turned up 21 live infected ones: hidden `folderOpen` tasks running a fake font file, payloads padded onto build configs, `preinstall` loaders hiding an encrypted payload in invisible Unicode, and a README archive lure. None of them was on any published list. Airlock flagged all 21. They aren't named publicly until they have been reported.

### Can I install the Chrome extension from the Web Store?
Not yet. Build it with `npm run build:extension` and load `extension/dist` as an unpacked extension (Chrome 116+). It asks only for `storage` and `activeTab` plus the two GitHub hosts it reads from.

### Does scanning a GitHub URL download or run anything?
No. URL scans read text files from `raw.githubusercontent.com` at a resolved commit SHA, and read metadata from the GitHub API. Release assets are recorded by name, size and type only. Nothing is cloned or executed.

### Why would a popular repository be flagged?
Execution triggers are judged regardless of popularity, because account takeovers put malicious hooks into well-known repositories. The 2026 Miasma campaign hit Microsoft-owned repos. On GitHub's most-starred repositories the tool is tuned to stay quiet on legitimate patterns, and the remaining flags are listed in `docs/benchmark.md`.

### What happens if Claude Code is started inside a malicious repository?
Its project hooks run in parallel with yours, and a user hook can't stop them. That's why `airlock exec -- claude …` exists: it scans before the agent process starts and refuses to launch on a malicious verdict (exit code 10).

### Can the scanned repository turn Airlock off?
Configuration is read only from `~/.airlock/` and command-line flags. A repository whose agent settings try to set `AIRLOCK_HOME`, `PATH` or `NODE_OPTIONS`, set `disableAllHooks`, or redefine Airlock's hooks is itself classified as malicious.

### What does `unknown` mean in practice?
Airlock couldn't read something it needed: a rate-limited fetch, a truncated tree, a symlink escaping the repository, or an oversized script. Under the default gate policy an `unknown` repository stays quarantined until a person runs `airlock allow`.

### Does it replace a package scanner?
No. Malicious code inside published npm or PyPI tarballs is better handled by install-time firewalls. Airlock covers the repository itself: what runs when you open, build or follow it.

### How does it compare to other repository scanners?
It depends on the campaign. On the first real set, dominated by auto-run triggers, Airlock and SafeDep vet detected a similar share (96.2% and 95.6%), but vet marked 17.5% of popular legitimate repositories suspicious against Airlock's 1.8%. On the second, dominated by README download lures, Airlock detected 99.0% of the held-out repositories, ghsafe 22.5% and vet 2.6%. On hard benign repositories, Airlock flagged 5.9% as at least suspicious, vet 16.4% and ghsafe 40.6%. One caveat: the benign labels come from hand-checking what Airlock flagged. A cross-check of 27 repositories that only the other tools flagged found no missed infections. The full comparison, with intervals and the tools that couldn't be run fairly, is in `docs/benchmark.md`.
