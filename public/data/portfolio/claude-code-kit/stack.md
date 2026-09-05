# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|---|---|---|---|
| Scripting | Python | 3 (stdlib only) | Runs everywhere macOS does with no install step; the tools must work when an account is out of quota and nothing can be fetched |
| Shell | Bash | 3.2 | The version macOS ships. Constrains the code — no `mapfile`, no `readarray` — but avoids requiring a Homebrew bash |
| Image conversion | `sips` | macOS built-in | Ships with the OS, converts HEIC in ~0.1s, needs no install |
| Archiving | `zip` / `unzip` | macOS built-in | Integrity-checkable with `unzip -t`, which the retire path relies on before deleting anything |

## Dependencies

**None.** No package manifest, no lockfile, no virtualenv.

Every import is from the Python standard library: `json`, `os`, `re`, `subprocess`, `pathlib`, `shutil`, `filecmp`, `sys`, `time`, `collections`. Everything else is a CLI that macOS already has, or the `claude` binary the project manages.

This is deliberate rather than minimalist posturing. The handoff tools exist to run when an account has hit its limit — a dependency that needs fetching is a dependency that can fail at exactly the wrong moment.

## Infrastructure

- **Hosting**: none — local CLI tooling
- **CI/CD**: none
- **Monitoring**: `~/.config/claude-code-kit/sync-hook.log`, one line per hook invocation with mode, duration and outcome

## Development Tools

- **Package Manager**: none
- **Linting**: `apple-signing-skill/validate-skills.py` (submodule) for skill frontmatter
- **Testing**: none as a suite — each tool is verified by running it against real data and asserting the observable result

## Key Dependencies

| Package | Purpose |
|---|---|
| `security` (macOS) | reads per-account OAuth tokens from the Keychain, and forgets orphaned ones |
| `rsync` | merges transcripts between accounts with `--ignore-existing`, so a more complete copy is never overwritten |
| `git` | submodule for the Apple-signing skills; symlink-aware storage of skill links |
| `claude` | the CLI being managed — `plugin install`, `plugin marketplace add`, `plugin list` |

## Platform Notes

macOS only, and not incidentally:

- Keychain service-name derivation is Apple-specific
- `sips` has no Linux equivalent in the skill's primary path
- The bash floor is 3.2 because that is what macOS ships; `mapfile` is unavailable and its absence fails *silently* under `set -u`, so the code uses NUL-delimited read loops throughout
