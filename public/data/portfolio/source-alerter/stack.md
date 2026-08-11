# source-alerter — stack

**Python 3.11+, standard library only at runtime.** No third-party runtime
dependencies, deliberately.

| Concern | Choice | Why |
|---|---|---|
| HTTP | `urllib.request` | one outbound POST does not justify a dependency |
| Data in | `json` + `pathlib` | run records are local JSON files |
| Config | `tomllib` | stdlib since 3.11, and the registry wants comments |
| State | one small JSON file, `os.replace` + `fsync`, `fcntl.flock` | must survive between runs — this is `Type=oneshot` — and the hourly and weekly timers can fire in the same second |
| Tests | `pytest` (dev only) | the program's convention |
| Build | `setuptools` with ⭐ **`packages` declared explicitly** | [SF-11] — flat-layout *inference* breaks the first time a top-level directory is added, and an editable install keeps working after the metadata stops building, so a green suite can sit beside a broken build |

## Why no dependencies

This runs hourly, forever, on a machine Jacob owns, and its whole job is to be
working on the day something else breaks. ⚠️ **A dependency is another thing
that can fail on the day you need this most** — and it would be failing in the
component whose absence looks exactly like health.

## Runtime shape

- `Type=oneshot` under a systemd timer, hourly, `Persistent=true`.
- Runs as `jacob`; `RequiresMountsFor=/data/fast/state`.
- **Outbound only** — one HTTPS POST. No listener, no inbound route, no port,
  so the no-public-exposure posture is untouched.
- Reads `/data/fast/state/<source>/last-run.json` for each Source; **opens no
  Source database** and holds no Source lock. ⚠️ It must never be able to take a
  Source down.

## Credential

The ntfy topic lives at `/data/fast/state/source-alerter/ntfy-topic`, mode
`600`, never in git and never in a log line. ⭐ **On public `ntfy.sh` the topic
name *is* the password** — which is the second reason the alert carries no data.
