# mac-agents — stack

**Mac half: Python 3.9, stdlib only. Zero third-party runtime dependencies.**

## Why 3.9, deliberately

The agent runs under **`/usr/bin/python3`, which is 3.9.6 today.**

⚠️ **The original reason for that choice is DISPROVEN** [MA-22, measured
2026-08-11]. It was *"Full Disk Access is granted to the interpreter binary,
and Homebrew replaces its python on upgrade."* Two corrections:

- ⭐ **`/usr/bin/python3` is not a binary — it is the `xcrun` shim**, one file
  hard-linked 78 times, which redirects to whatever `xcode-select -p` points
  at. A stable path with a moving target.
- ⭐ **The grant does not attach to the interpreter at all.** macOS attributes
  access to the **responsible process** — for a launchd job, its own
  executable — and children inherit it. Task 4's target is a Developer
  ID-signed app bundle (`com.technical1.mac-agents.collector`, team
  `M7SN262HK4`) whose designated requirement carries **no code hash**, so the
  grant survives rebuilds. Ad-hoc signing does not: any change revokes it
  permanently, and even restoring the byte-identical binary does not bring it
  back.

⭐ **The 3.9 floor stands on the surviving half of the reason**: the
interpreter the agent will actually exec is the Xcode-shipped 3.9.6, and a
syntax error there surfaces as an agent that stopped running — i.e. as
silence.

So: **no `match`, no runtime `X | Y` unions, no `tomllib`** anywhere under
`mac_agents/`. Every module carries a test that parses it with
`ast.parse(feature_version=(3, 9))`, and one test imports the whole package
under `/usr/bin/python3` itself rather than under whatever runs the suite.

`pyproject.toml` declares `requires-python = ">=3.9"` — the *lower* of the
repo's two floors. The tower half (Task 3) needs 3.11+ because it imports
`raw_tier`; that floor is not expressible here and is enforced by the tower's
own interpreter. Raising this one would refuse to install on the interpreter
the agent actually runs.

## Runtime pieces

| piece | what it is | note |
|---|---|---|
| `sqlite3` (stdlib) | `Connection.backup()` per store | ⭐ [MA-11] retired PyObjC: the collectors copy the stores, so there is no venv to keep in sync with a TCC grant, and no per-service TCC prompt a background agent could not answer |
| `rsync` | the only transport | ⚠️ macOS 26.5.1 ships **openrsync** (`rsync version 2.6.9 compatible`, protocol 29), **not** GNU rsync — see below |
| `ssh` | `BatchMode=yes`, `ConnectTimeout=15` | an hourly agent that meets an interactive prompt blocks forever, and then the run lock refuses every later run |
| `fcntl.flock` | the run lock | released by the kernel on process death, so no reaper exists |
| `launchd` | `RunAtLoad` + `StartInterval=3600` | ⭐ its `ProgramArguments` names the **signed bundle**, never an interpreter |
| ⭐ `MacAgentsCollector.app` | ~20 lines of C that `exec` `/usr/bin/python3 -m mac_agents.cli collect` | ⭐ **the thing Full Disk Access is granted to.** Built by `scripts/build-launcher.sh` with `cc` + `codesign` against the Developer ID (team `M7SN262HK4`); ⚠️ **no ad-hoc fallback, ever** [MA-22] |
| `plistlib` (stdlib) | reads the installed agent plist in `mac-agents check` | ⚠️ stricter than `plutil` — see qa.md |

⭐ **The 2026-08-12 amendments added no dependency and no Mac-side change**, and
both are **live**. The relational mirror reads `sqlite_master` at run time and
replicates every table with the same stdlib `sqlite3`, and it runs entirely on
the **tower** half, under the 3.11+ floor named above. ⭐ The Mac kept its 3.9
floor, its zero-dependency rule and the transport described here; what changed
is that the container it ships is **transport, not payload**. ⚠️ **One tower-side
pragma is worth knowing here:** a mirror database runs
`PRAGMA journal_mode=DELETE`, ⛔ **never WAL** — WAL would manufacture two
permanent sidecars under the raw root. Summary: `.portfolio/architecture.md` §9.

## ⚠️ openrsync, and the flag that is not there

`/usr/bin/rsync` on macOS 26.5.1 rejects **`--append-verify`** —
`unrecognized option`, exit 1 — and the plan mandates it. Passed
unconditionally it would fail every transfer at argument parsing, and per
[MD-153] that logs and exits 0, so the 50 GB first sync would simply never
have happened.

The requirement is *resumption*, not a flag. `--partial` keeps the incomplete
file and the delta algorithm uses it as its basis. **Observed**: an 8 MB
source against a 6 MB partial moves 2.4 MB, matches 6.0 MB, and lands
byte-identical. The capability is probed at run time, `--append-verify` is
used when present, and the mode taken is recorded in the heartbeat so a
downgrade cannot be silent. Bare `--append` is refused as a substitute — it
has no verification at all.

⭐ **`--ignore-existing` DOES exist in openrsync, and it IS passed — on the
attachment tree alone** [MA-45]. Measured 2026-08-12 the same way the flag
above was, because a flag's own documentation is not evidence: it is accepted
(exit 0), it leaves a destination file with different content untouched, it
still sends a file the destination lacks, and — the seam that matters, since
the receiver is GNU rsync on Ubuntu — openrsync **forwards** it, observed as
`rsync --server … --ignore-existing …` in what it asks the remote shell to run.

⚠️ **It costs the per-file resume basis**, measured by interrupting a real
transfer twice: the partial-dir fragment stops being consulted, so the
in-flight file restarts — 8,389,783 B re-sent against 5,284,767 B without the
flag. ⭐ Accepted deliberately, because [MA-21]'s requirement is about the
tree and every completed file is now skipped outright. The recorded
`resume_mode` names `ignore-existing`, so this downgrade cannot be silent
either. ⚠️ One combination stays UNMEASURED and cannot be measured here — this
Mac has no GNU rsync, so `--ignore-existing` and `--append-verify` have never
run together; on openrsync the pair cannot arise.

⛔ **Never on `chat.db` or a store snapshot**: those are mutable at stable
paths and are *meant* to be replaced.

## Build

`[tool.setuptools] packages = ["mac_agents"]`, declared explicitly, with a
test that builds a wheel and asserts the modules are **inside** it. Asserting
on the wheel's filename is not enough: setuptools derives that from the
project name and will happily produce it for an empty wheel [SF-11].
