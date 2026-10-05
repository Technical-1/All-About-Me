# microsoft-source — architecture

State: `live` — running hourly on the tower (see `CLAUDE.md`, the repo's state of record).

## The write path

Each fetcher (`fetch_mail`, `fetch_calendar`, `fetch_onedrive`, `fetch_todo`)
writes through one funnel, `raw.write`, which checks the object's `kind` and
delegates to raw-tier's `RawStore.write_raw` (payload first, then the row; the
row is the commit point; an unchanged object bumps `last_seen` [RT-15]).

The unchanged-object exits are batched [TD-124] through `raw.batched(store)`,
which opens raw-tier's `RawStore.batched_dedupes(every=raw.DEDUPE_BATCH)`: one
manifest commit per page rather than one per object. A batch wraps only a tight
loop of writes over objects already fetched — never a Graph request, because the
manifest write lock is held for the batch's life. Objects that need a request of
their own (a message's `$value`, a full calendar event, a file's bytes) are
fetched first and their writes held in `fetch_common.Pending`, which writes them
in one batch at the end of each page, when its byte budget fills, or when the
walk ends or fails.
