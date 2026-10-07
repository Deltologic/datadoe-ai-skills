---
name: fba-inventory-ledger-report
description: >-
  Build an FBA inventory ledger workbook (Excel) that shows where your units moved - per
  SKU, fulfillment center, disposition and marketplace: the ledger per marketplace (or one
  EU-wide ledger), every fulfillment-center event (transfers, receipts, returns,
  adjustments), inbound and FC-transfer quantities, and one consolidated view per SKU across
  marketplaces (e.g. UK + DE). Sized to the account, so big ledgers stay usable. Live from
  DataDoe. Use for "inventory ledger", "ledger per SKU", "where did my units go", "FC
  transfers", "fulfillment center transfers", "inventory reconciliation", "EU inventory
  movements", or "customer damaged units". Then offers an updated version with a lost &
  damaged vs reimbursed sheet (units Amazon may still owe you) and a balance check.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: FBA Inventory Ledger per SKU
  access: read
  category: Inventory
  interface: mcp
  output: report
  youtube-video-embed-url: https://www.youtube.com/embed/gsxAi79N4y8
---

# FBA Inventory Ledger per SKU

Amazon moves your inventory between fulfillment centers all the time. This skill builds one
workbook that shows where exactly those units went - by SKU, fulfillment center, disposition
and reconciliation status - for every marketplace you sell in, plus a consolidated sheet that
puts each SKU's stock across marketplaces side by side (for example UK + Germany for a
European seller). The sheets are filterable, so "show me everything customer-damaged" or
"what happened to SKU X" is two clicks - and the assistant can analyse the data for you in
the same chat. Live from DataDoe.

## When to use this

- Weekly or monthly inventory reconciliation, or any time stock "disappears".
- Tracking units moving between fulfillment centers and countries (Pan-EU, EFN).
- Checking customer returns, damaged, lost and found units per SKU.
- Trigger phrases: "inventory ledger", "ledger per SKU", "where did my units go", "FC
  transfers", "fulfillment center transfers", "inventory reconciliation", "customer damaged".

## The framework. Four views of the same units

1. **Inbound & FC Transfers** (newest inventory snapshot) - what is on its way in, available,
   reserved for FC transfer or FC processing, per SKU.
2. **Ledger** (FBA Ledger Summary) - daily balance per SKU, fulfillment center and
   disposition: starting balance, every movement bucket, ending balance.
3. **FC Transfers** (FBA Ledger Details) - every individual event: event type, quantity,
   fulfillment center, disposition, reason, country, reconciled / unreconciled quantity.
4. **Consolidated** - one row per SKU with the latest stock in each marketplace side by side.

For one FNSKU at one location: starting balance + the movement columns (`receipts`,
`customer_shipments`, `customer_returns`, `vendor_returns`, `warehouse_transfer_in_out`,
`found`, `lost`, `damaged`, `disposed`, `other_events`, `unknown_events`) = ending balance.
`in_transit_between_warehouses` is informational, not part of that sum (the identity held on
100% of rows in testing). Balances are per FNSKU and location - when you add locations
together, group by `fnsku`.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- **Export rules (every export in this skill):** each `exports_create` call needs `limit` and
  `outputType`. Aggregation aliases must differ from column names (`sum` of `ad_spend` -> alias
  `total_ad_spend`; reusing the column name fails with ALIAS_COLLISION). Text columns can't be
  aggregated (`max` on a name fails with INVALID_AGGREGATE) - put them in `groupBy` and merge rows
  in code. Load every page of `exports_source_get` (a table's columns are spread over several
  pages). If `exports_create` already returns `COMPLETED`, skip polling; otherwise poll
  `exports_get` every ~5 s. For results you process in code, use `exports_raw_url_get` and save
  the file (the URL expires after ~15 minutes) instead of pulling it into the conversation.
  Treat null numbers as 0 unless a step says otherwise. Marketplace codes are ISO (the UK is `GB`).
- **FBA Ledger Summary** (`amazon_fba_ledger_summary`): daily, per `fnsku` x `location`
  (fulfillment center) x `disposition` (SELLABLE, CUSTOMER_DAMAGED, DEFECTIVE,
  WAREHOUSE_DAMAGED, DISTRIBUTOR_DAMAGED, ...). Columns: `date`, `msku`, `fnsku`, `child_asin`,
  `title`, `disposition`, `starting_warehouse_balance`, `in_transit_between_warehouses`, the
  movement columns above, `ending_warehouse_balance`, `location`. Quantities are signed:
  receipts, returns and found add; shipments, `lost`, `damaged` and disposals are negative.
- **FBA Ledger Details** (`amazon_fba_ledger_details`): one row per event - `date`, `msku`,
  `fnsku`, `child_asin`, `event_type` (Adjustments / CustomerReturns / Receipts / Shipments /
  VendorReturns / WhseTransfers), `reference_id`, `quantity`, `fulfillment_center`,
  `disposition`, `reason`, `country`, `reconciled_quantity`, `unreconciled_quantity`.
- **FBA Inventory Health** (`amazon_fba_inventory_health`) **[premium]**: daily snapshot per
  SKU - `inbound_quantity` (already = working + shipped + received), `inbound_working`,
  `inbound_shipped`, `inbound_received`, `reserved_fc_transfer`, `reserved_fc_processing`,
  `available`, `total_reserved_quantity`. Not additive across dates - use the newest snapshot
  only. Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs,
  and the table is part of the always-on default dataset, so it is never disabled. A 0-row export
  means no data in the window or an initial load still in progress - say which; never render
  zeros.
- **The two ledger tables are not in the default dataset.** Check `enabled` in
  `exports_sources_get`; if `false`, tell the user to enable them in DataDoe (Settings > Data)
  and wait for the first load (up to 540 days of history) - don't build an empty workbook.
- **Ledgers are big.** One row per FNSKU x fulfillment center x disposition x day - a large
  European seller has ~48,000 rows per day (~1.4M a month). Always size the pull first
  (workflow step 3) and keep each sheet to what can be pulled and opened: up to ~25,000 rows
  per sheet in full, otherwise movement rows only, otherwise a shorter window.
- **EU-wide ledgers:** with Pan-EU / unified accounts Amazon reports one ledger for the whole
  region, so every marketplace account returns the same ledger rows. If the per-date row counts
  are identical across marketplaces, build **one** ledger sheet ("Ledger - EU") from one account
  and never add marketplaces together (the same applies to reimbursements). Inventory snapshots
  stay per marketplace.
- **Lag and gaps:** ledger data typically lags 7-9 days and can miss whole dates. Find the
  newest date per marketplace and any missing dates in the window, and state both.
- Window: the **last 7 days of available ledger data** by default (ask; longer windows are
  fine when the size check allows).
- Marketplaces: one DataDoe seller account per marketplace. `exports_create` takes up to 5
  `sellerOrVendorIds` at once - pull the chosen accounts together and split rows by
  `marketplace_country_code`.
- Row caps: 1,000 rows per JSON export, 5,000 per CSV - use CSV and page with `skip` until a
  page returns fewer than `limit` rows. Only one `orderByColumn` is allowed - order by `date`
  and finish sorting in code. Never truncate silently.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller account(s); for a European seller, ask which
   marketplaces to include (default: all connected ones).
2. `exports_sources_get` (queries "ledger", "inventory health") -> resolve
   `amazon_fba_ledger_summary`, `amazon_fba_ledger_details`, `amazon_fba_inventory_health`;
   `exports_source_get` to confirm columns and `enabled`.
3. **Size check (cheap, aggregated):** for each ledger table, `exports_create` over the last
   ~21 days with `groupBy ["date", "marketplace_country_code"]` and a `count`. From it:
   - the newest date per marketplace (this sets the window end) and missing dates;
   - whether marketplaces return identical counts (-> one EU-wide ledger);
   - the row volume for the window. If the summary window holds more than ~25,000 rows, run the
     count again with the **movement-row filter** (combinator `or`: each movement column `!=
     0`); if that is still above ~50,000, shorten the window (newest 1-3 days) or sum across
     locations (`groupBy` date, `msku`, `fnsku`, `disposition`, sums; the Location column is
     dropped). Tell the user which one you did.
4. **Ledger summary** - `exports_create` for the window with the columns above (plus
   `marketplace_country_code`), the filter from step 3 if needed, CSV, paged.
5. **Ledger details** - same window, the detail columns, CSV, paged. All event types (filter
   `event_type = WhseTransfers` only if the user wants transfers alone). Apply the same size
   rule.
6. **Inventory snapshot** - `exports_create` on `amazon_fba_inventory_health`, `from` = 3 days
   ago, `to` = today, the inbound / reserved / available columns plus `date`, `sku`, rows with
   stock only (combinator `or`: `available > 0`, `inbound_quantity > 0`,
   `total_reserved_quantity > 0`), CSV, paged. Keep the newest `date` per marketplace.
7. **Consolidated view:**
   - Ledger balance: per marketplace (or EU), `exports_create` on the summary for the newest
     date only, filter `disposition = SELLABLE`, `groupBy ["fnsku", "msku"]`, sum
     `ending_warehouse_balance` (alias `total_ending_balance`) - this adds all locations per
     FNSKU. Roll FNSKUs up to their MSKU in code.
   - Join with the newest inventory snapshot on SKU (`sku` = `msku`); outer-join across
     marketplaces so SKUs sold in only one marketplace still appear.
8. Build the workbook (Output format), save, report the path, open it if you can.
9. Offer analysis in chat: biggest unreconciled quantities, lost/damaged by SKU, units in
   transit between FCs.
10. **Offer the updated version** (see below): "There's an updated version of this workbook -
    it adds a Lost & Damaged vs Reimbursed sheet that shows units Amazon lost or damaged and
    hasn't paid back yet, plus a balance check on every ledger row. Want it?" Build it only on a
    yes.

## Output format

Excel workbook, Arial, navy header row (white bold), alternating row shading, frozen header,
auto-filter on every sheet, dates `YYYY-MM-DD`, numbers `#,##0;(#,##0);"-"`, readable headers
(`ending_warehouse_balance` -> "Ending Warehouse Balance"):

| Sheet (tab colour) | Rows | Columns |
| --- | --- | --- |
| Inbound & FC Transfers (blue) | newest snapshot, all marketplaces, sorted marketplace / SKU | Date, Marketplace, SKU, Inbound Quantity, Inbound Working, Inbound Shipped, Inbound Received, Reserved FC Transfer, Reserved FC Processing, Available, Total Reserved Quantity |
| Ledger - {UK} (green), Ledger - {DE} (orange), ... one per marketplace - or one "Ledger - EU" sheet for a shared EU ledger | ledger summary rows, sorted date / MSKU | Date, Marketplace, MSKU, FNSKU, Disposition, Starting Warehouse Balance, In Transit Between Warehouses, Receipts, Customer Shipments, Customer Returns, Vendor Returns, Warehouse Transfer In/Out, Found, Lost, Damaged, Disposed, Other Events, Unknown Events, Ending Warehouse Balance, Location |
| FC Transfers (red) | ledger detail events | Date, Marketplace, MSKU, FNSKU, Event Type, Reference ID, Quantity, Fulfillment Center, Disposition, Reason, Country, Reconciled Quantity, Unreconciled Quantity |
| Consolidated ({UK} + {DE}) (purple) | one row per SKU | SKU, then per marketplace: Inventory Date, Available, Inbound Qty, Inbound Working, Inbound Shipped, Inbound Received, FC Transfer, FC Processing; then Ledger Date and Ending Balance (sellable) per ledger |

Label marketplaces the way the user knows them (`GB` -> "UK"). Finish with a short chat
summary: window, marketplaces (and whether the ledger is EU-wide), what the size check did
(full / movement rows / shortened window), row counts per sheet, newest data date and gaps,
and 2-3 things worth a look (e.g. "SKU X: 40 units unreconciled in WhseTransfers").

## Updated version (offer after the standard workbook)

The same sheets stay as they are; the updated version adds money and a sanity check. Build it
only when the user says yes.

- **Balance Check column** on every ledger sheet: starting balance + the movement columns -
  ending balance (in-transit left out), which should be 0. Highlight only the rows that don't
  balance, and report the share that do.
- **New sheet "Lost & Damaged vs Reimbursed"** (one row per SKU - per marketplace, or once for an
  EU-wide ledger - sorted by estimated value). This uses aggregated exports, so a 30-day window
  is affordable even for big accounts:
  - Ledger summary over the window, `groupBy ["msku", "fnsku"]`, sum `lost`, `damaged`, `found`
    (aliases `total_lost`, `total_damaged`, `total_found`). `lost` and `damaged` are stored as
    negatives: **Net lost = -(lost + damaged) - found**, never below 0.
  - `FBA Reimbursements` (`amazon_fba_reimbursements`) from the window start to today (Amazon
    pays late), reasons `Lost_Warehouse` and `Damaged_Warehouse`: reimbursed units
    (`quantity_reimbursed_total`) and amount (`amount_total`) per SKU, per currency
    (`currency_unit`). Show `Lost_Inbound` reimbursements in a separate column - inbound
    shortages are not ledger losses.
  - Unreimbursed units = max(0, net lost - reimbursed units). Est. value = unreimbursed x the
    SKU's average cash `amount_per_unit` over the last 12 months (rows with
    `quantity_reimbursed_cash` > 0); no history -> the user's unit cost, or leave it blank.
    Keep each currency separate - never add GBP and EUR.
  - Footer: these are candidates to check, not guaranteed claims - Amazon reimburses many units
    automatically after investigating, and claim windows are limited (check Amazon's current
    policy). Point the user to Seller Central's reimbursement / case flow for the top rows.
- `amazon_fba_reimbursements` is not in the default dataset: if `enabled` is false, say so and
  ask the user to enable it in Settings > Data instead of showing an empty sheet.

## Worked example (illustrative)

A UK + DE seller asks "where did my units go?". The size check shows ~48,000 ledger rows per
day and identical counts for UK and DE - a shared EU ledger - so the workbook gets one
"Ledger - EU" sheet with movement rows only for the newest 7 days. SKU X starts at 1,200
sellable units: -950 customer shipments, +40 customer returns, -60 warehouse transfers, ending
at 230. The FC Transfers sheet shows those 60 units as WhseTransfers events from a UK FC to
Poland and Germany, 52 reconciled and 8 unreconciled. The consolidated sheet shows SKU X
available in both marketplaces, with 120 more inbound to DE. The answer: the units weren't
lost - they moved within the EU network; 8 are still unreconciled and worth a case if they
don't reconcile.

## Quality self-check

- Did I confirm both ledger tables are enabled (and say so if not) before building?
- Did I size the pull first, and tell the user if I used movement rows only or a shorter
  window?
- Did I detect an EU-wide ledger and avoid duplicate sheets and double counting?
- Did I page every export to completion (no silent truncation at 1,000 / 5,000 rows)?
- In the consolidated view, did I sum ending balances across all FC locations per FNSKU for the
  newest date, sellable only, and use one inventory snapshot date per SKU?
- Did I state the window, the newest data date and any missing dates?
- Did I offer the updated version at the end - and change nothing unless the user said yes?

## Common mistakes

- Pulling 30 days of a big ledger in full - over a million rows; size first.
- Building separate UK and DE ledger sheets from the same EU ledger, or adding them together.
- Building from a disabled ledger source (0 rows) and presenting an empty workbook.
- Keeping one FC location per SKU in the consolidated balance instead of summing locations
  (grouped by `fnsku`).
- Treating `lost` / `damaged` as positive numbers (they are negative) - net lost comes out
  wrong.
- Counting `Lost_Inbound` reimbursements against warehouse losses.
- Summing inventory snapshots across days, or adding the inbound sub-columns to
  `inbound_quantity` (it already contains them).
- Truncating at the export row cap.

## Notes

- Read-only.
- Lost / damaged units in the ledger are where FBA reimbursement claims start - the updated
  version shows what Amazon already paid back.
- A DataDoe skill, built on `amazon_fba_ledger_summary`, `amazon_fba_ledger_details` and
  `amazon_fba_inventory_health` (plus `amazon_fba_reimbursements` in the updated version).
