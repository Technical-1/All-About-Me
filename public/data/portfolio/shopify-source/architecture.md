# shopify-source — architecture

**State: `live`** — built, merged, and running hourly on the tower at `:47`
since 2026-08-14. Collects orders, payouts, balance transactions and a
schema-driven sweep of every other resource [SS-4]; writes each payload
byte-for-byte, **then** the `raw_objects` row, which is the commit point.

> ⛔ **CORRECTED 2026-08-19.** This file read *"State: `scaffolded`. This
> component is scaffolded; its architecture lives in its owning plan … until
> code exists here"* over a Source that had been writing real data for five
> days. ⭐ `.portfolio/` is what `github-connector` extracts, so a stale state
> line here teaches the **KB** that a running Source is an empty repo — the same
> drift `CLAUDE.md` carries a banner about, in the file next to this one.

**Shape:** `auth.py` exchanges a **24-hour** token from `client_id` +
`client_secret` (client credentials — ⛔ the token is derived, never stored and
trusted) · `client.py` is the cost-aware GraphQL retry loop, where an **HTTP 200
can still be a failure** (`THROTTLED`) · `fetch_orders` · `fetch_payouts` ·
`fetch_sweep` acquire · `raw.py` writes through `raw-tier` · `cursors.py` holds
position per `(datatype, scope)`.

⚠️ **Acquisition only.** The credential carries **71 `write_` scopes** —
deliberately, so no second consent round is needed when write-back arrives
[GS-10/PF-58] — but the code sends exactly one mutation, `bulkOperationRunQuery`,
which is a read-export. ⛔ That boundary is contract, not enforcement.

See `CLAUDE.md` for the state of record.
