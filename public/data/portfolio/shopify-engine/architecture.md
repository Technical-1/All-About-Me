# shopify-engine — architecture

State: `live`. A compute engine: it reads the raw tier's `source='shopify'` rows read-only and writes one SQLite store of derived tables, every row carrying a receipt to the exact raw version it was read from. It calls no origin, opens no socket and holds no model client. Verbs are a CLI over the store.

## One build, start to finish (`shopify_engine/cli.py` `_build`)

1. **Refusals first.** Where the raw root or the state dir lies under `/data/fast/state`, that path must be a mount point, or nothing is read and nothing written (`cli.build`). A build with no `--as-of` refuses a dirty checkout (`identity.refuse_dirty_tree`): the code identity is the commit.
2. **The read phase** (`inputs.read_phase`) — ONE read-only transaction over `manifest.db`, through `raw_tier.snapshot.SnapshotReader` and nothing else: fix the instant, take the snapshot identity, read every version row of the read set, read the `__parentId` of each row in a dir that holds a selected child class (`inputs.parent_of`), select, and compute the gate fingerprints.
3. **Freshness** (`freshness.py`) — written to `<state>/freshness.json` on every tick from those same rows: the newest `last_seen` of the read set and of each dir a table reads. Outside the identity and the store.
4. **The change gate** (`gate.py`) — the identity (watermarks, the `storage`, `selected_version` and `swept_seen` fingerprints, the code identity) is written to `gate-reading.json` and compared for equality with the last build's. Equal: the run records `ok`, `unchanged: true`, and stops; the store and `build_id` are untouched.
5. **Normalize** (`normalize/`) — each payload decoded once (`json.loads(parse_float=str)`: no float is ever constructed) into a content-addressed cache keyed by the payload's sha256 and the decoder identity. `normalize/shape.py` checks what each table needs of a payload: the parse coverages.
6. **The partition** (`partition.py`) — every row's class, `(dir, payload gid-type, doc_id gid-type, parent gid-type)`, is on exactly one side: derivation input (a table selects it) or declared out (by rule, never by list). A class on neither side fails the build `data-error`.
7. **Derive** (`derive/`) — every table in full from the selected versions; each column names its raw key path beside the assignment. Then the join coverages, each held to its floor (`coverage.py`, `tests/fixtures/floors.json`).
8. **The store** (`store.py`) — written beside the previous one (`store.db.prev`); `build_id` is the content digest of the `d_*` tables, so it moves only when derived content does. `build_meta` is a `(key, value)` table.
9. **The run record** (`runrecord.py`) — `last-run.json` and `runs.jsonl`, written before the report. A non-paging finding goes to `findings[]`, never `warnings[]`.

## Selection (`select.py`)

A table names its class: a resource dir, the gid-type of the payload's own `id`, and the gid-type of its `__parentId` (none for a top-level line). Within the dir the selected version of each **(gid, parent)** is the one with the greatest (`last_seen`, `fetched_at`, rowid). ⛔ Never by `kind`, never by directory alone, never merged across dirs.

- **Pair tables** read either shape: a bulk-sweep child line, or a node of a connection nested in the parent's payload (the small-kinds lane). Their rows come from one function, `select.pair_rows()`, which hands derive a `PairRow`. Where the parent's selected version nests the connection the pairs are that list, with the parent's receipt; otherwise the child lines. A pair no longer listed stays a row (`withdrawn`, or `unknown` under a list cut short — a `connection-truncated` finding and limit).
- **`membership`** of a pair, from `last_seen` alone against its parent's selected row: `offered`, `withdrawn` (earlier, while some pair of the class was seen since) or `unknown`.
- **`seen_lag_seconds`** of a swept top-level row: how far its `last_seen` is behind the newest selected row of its class. `presence` reads `unknown`: the archive records no completed sweep, so the engine never says an object is gone. A verb counts a row as lagging only at a minute or more (`config.LAGGING_AFTER_SECONDS`).

## The tables

| table | read from | key | columns | shrink rule | |
|---|---|---|---|---|---|
| `d_order` | `orders/` · Order | `order_id` | 43 | append-only |  |
| `d_order_item` | `orders/` · a child of the order's selected payload | `line_item_id` | 23 | current-state |  |
| `d_order_transaction` | `orders/` · a child of the order's selected payload | `tx_id` | 12 | current-state |  |
| `d_fee` | `orders/` · a child of the order's selected payload | `fee_id` | 12 | current-state |  |
| `d_refund` | `orders/` · a child of the order's selected payload | `refund_id` | 7 | current-state |  |
| `d_payout` | `payouts/` · ShopifyPaymentsPayout | `payout_id` | 11 | append-only |  |
| `d_balance_txn` | `balance_transactions/` · ShopifyPaymentsBalanceTransaction | `btx_id` | 13 | append-only |  |
| `d_customer` | `customers/` · Customer | `customer_id` | 12 | append-only |  |
| `d_tender` | `tenderTransactions/` · TenderTransaction | `tender_id` | 7 | append-only |  |
| `d_product` | `products/` · Product | `product_id` | 33 | append-only | swept |
| `d_variant` | `productVariants/` · ProductVariant | `variant_id` | 25 | append-only | swept |
| `d_variant_stock_version` | `productVariants/` · ProductVariant, every version | `stock_version_id` | 7 | append-only |  |
| `d_inventory_item` | `inventoryItems/` · InventoryItem | `inventory_item_id` | 14 | append-only | swept |
| `d_inventory_level` | `inventoryItems/` · InventoryLevel under InventoryItem | `pair_id` | 11 | append-only | pair |
| `d_location` | `locations/` · Location | `location_id` | 23 | append-only | swept |
| `d_fulfillment` | `orders/` · a child of the order's selected payload | `fulfillment_id` | 13 | current-state |  |
| `d_fulfillment_shipment` | `returnableFulfillments/` · ReturnableFulfillment | `shipment_id` | 10 | append-only |  |
| `d_collection` | `collections/` · Collection | `collection_id` | 14 | append-only | swept |
| `d_collection_member` | `collections/` · Product under Collection | `pair_id` | 9 | append-only | pair |
| `d_discount` | `discountNodes/` · DiscountCodeNode / DiscountAutomaticNode | `discount_id` | 22 | append-only | swept |
| `d_draft_order` | `draftOrders/` · DraftOrder | `draft_order_id` | 34 | append-only | swept |
| `d_delivery_profile` | `deliveryProfiles/` · DeliveryProfile | `profile_id` | 16 | append-only | swept |
| `d_storefront` | `webPresences/` · MarketWebPresence | `presence_id` | 10 | append-only | swept |
| `d_inventory_quantity` | `inventoryItems/` · each stock-level pair's `quantities[]`, either shape | `quantity_pair_id` | 12 | append-only | TA.9 |
| `d_inventory_quantity_version` | `inventoryItems/` · every archived level version carrying `quantities[]` | `quantity_version_id` | 12 | append-only | TA.9 |
| `d_discount_entitlement` | `discountNodes/` · the selected discount version's `customerGets` | `discount_id` | 10 | append-only | TA.9 |
| `d_draft_order_item` | `draftOrders/` · DraftOrderLineItem under DraftOrder, either shape | `pair_id` | 34 | append-only | pair (W5) |
| `d_discount_code` | `discountNodes/` · the discount's `discount.codes` list | `pair_id` | 11 | append-only | pair (W4) |
| `d_discount_target` | `discountNodes/` · the discount's three entitled lists | `pair_id` | 8 | append-only | pair (W4) |
| `d_order_tax_line` | `orders/` · a child of the order's selected payload (lines' and shipping lines' `taxLines`) | `tax_line_key` | 12 | current-state | line money |
| `d_order_discount_allocation` | `orders/` · a child of the order's selected payload | `allocation_key` | 7 | current-state | line money |
| `d_order_shipping_line` | `orders/` · a child of the order's selected payload | `shipping_line_id` | 12 | current-state | line money |
| `d_refund_line` | `orders/` · a child of the order's selected payload | `refund_line_id` | 10 | current-state | line money |
| `d_draft_order_tax_line` | `draftOrders/` · a draft line's (or the draft's shipping line's) `taxLines` | `tax_line_key` | 11 | append-only | line money |

Listed by the code: `shopify_engine/config.py` `CLASSES`, `derive/__init__.py` `SCHEMA`.

## Receipts (`receipts.py`)

`{"kind":"raw","source":"shopify","doc_id":"<gid>","receipt":"sha12=<12 hex> <dir>/<table>.<column>[ #<child gid>]"}` — the origin's gid, and the pin of the version file inside the justification. A child of an order receipts the order's version and names its own gid after `#`. An aggregate row carries `receipts[]`, its members, up to 100 inline and a `member_spec` above; `receipts-for <figure_id>` returns them all.

## State on disk (`/data/fast/state/shopify-engine/`)

`store.db` · `store.db.prev` · `gate-reading.json` · `freshness.json` · `last-run.json` · `runs.jsonl` · `cache/` (the decode cache) · `conformance/last-run.json` (written by `verify`).

## Deployed

`shopify-engine.timer` on the tower, every 15 minutes at :09 :27 :39 :51, runs `shopify-engine build` with every default. The alerter reads the run record after each run (`period_seconds = 900`; stale at two periods). Units, stanza and bootstrap step: `Technical-1/tower`.
