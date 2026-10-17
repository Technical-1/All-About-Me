# messages-engine — stack

State: `live`.

- **Language:** Python 3.12 [A9]. The standard library: `sqlite3`, `zoneinfo`, `plistlib`, `json`, `gzip`.
- **raw-tier:** installed editable, and never a declared dependency. Its snapshot reader is the only way the engine reads the archive, and its order is the version rule.
- **Images:** `pillow==12.3.0` and `pillow-heif==1.8.1`, pinned exactly. The spec's image renditions (amendment M5) and the fixture's image specimens are their encoder output, so `FIXTURE.lock` digests them.
- **Excluded:** no model client, no network library, no claim-store code.
- **Deployed:** on the tower, from its own `.venv` at `/data/fast/repos/messages-engine/.venv`, run by `messages-engine.timer` every ten minutes at :08 :18 :28 :38 :48 :58, as `jacob`. Its SQLite temp and its scratch stay on the encrypted state volume.
