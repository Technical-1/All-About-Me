# source-alerter — stack

**Python 3.11+, standard library only at runtime.** No third-party runtime
dependencies, deliberately.

| Concern | Choice | Why |
|---|---|---|
| HTTP | `urllib.request` | one outbound POST, and the watchdog's one GET [TD-281], do not justify a dependency |
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
- **Outbound only** — one HTTPS POST, and the watchdog's one empty GET to
  its dead-man service. No listener, no inbound route, no port, so the
  no-public-exposure posture is untouched.
- ⭐ The watchdog (`source-alerter-watchdog`) is its own `Type=oneshot` unit
  on its own timer (twelve check-ins an hour); it imports nothing from the package, so a broken
  detector or sender cannot stop the check-ins.
- Reads `/data/fast/state/<source>/last-run.json` for each Source; **opens no
  Source database** and holds no Source lock. ⚠️ It must never be able to take a
  Source down.

## Credential

The ntfy topic lives at `/data/fast/state/source-alerter/ntfy-topic`, mode
`600`, never in git and never in a log line. ⭐ **On public `ntfy.sh` the topic
name *is* the password** — which is the second reason the alert carries no data.

The watchdog's check-in URL lives at
`/data/fast/state/source-alerter/watchdog-url` — mode `600`, owned by the
runner, never printed. Whoever holds it can make the check report healthy, so
a file anyone else can read is refused (`not-configured`), not warned about.
