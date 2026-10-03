---
name: suppressed-inactive-listings-check
description: >-
  Scan the whole catalog for listings that are silently not selling - suppressed,
  inactive, stranded (stock on hand but not buyable), or carrying an error/quality
  issue that blocks or limits them - and rank them by the revenue at risk so you fix
  the costly ones first. A listing can look fine and still be invisible to shoppers;
  this finds those. Live from DataDoe, read-only. Use for "suppressed listings",
  "inactive listings", "why isn't my product showing", "listing errors", "stranded
  inventory", "is my listing live", "listing health", or "why did this stop selling".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Suppressed Inactive Listings Check
  access: read
  category: Listings & Content
  interface: mcp
  output: report
---

# Suppressed & Inactive Listings Check

Scans every listing on the account for the ones that are silently **not selling** -
suppressed, inactive, stranded (inventory on hand but not buyable), or carrying an
error/quality issue that blocks or limits them - and ranks them by the revenue at
risk so you fix the costly ones first. A listing can look fine in your catalog and
still be invisible to shoppers; this finds those before they quietly cost you a week
of sales. Live from DataDoe, runs in chat - no manual health-report exports.

## When to use this

- Weekly "is anything broken right now" sweep across the whole catalog.
- Sales dropped on a SKU for no obvious reason (often a suppression or an error).
- After a bulk feed/flat-file upload, a catalog change, or a compliance update.
- You have FBA stock that is not moving (possible stranded/unfulfillable inventory).
- Trigger phrases: "suppressed listings", "inactive listings", "why isn't my
  product showing", "listing errors", "stranded inventory", "is my listing live",
  "listing health", "why did this stop selling".

## The framework. The listing-live gates (check in order)

A listing only sells when it clears every gate. Parse the JSON fields below per
SKU/marketplace, check in order, and report the first (highest) gate that fails - that
is the fix:

1. **Suppressed (enforcement-driven)** - a listing is *suppressed* only when an
   `issues[]` entry carries an `enforcements.actions[].action` of `LISTING_SUPPRESSED`
   (full suppression) or `CATALOG_ITEM_REMOVED` (hard block - Amazon pulled the catalog
   item). Keep each enforcement action as its own bucket: `LISTING_SUPPRESSED`,
   `CATALOG_ITEM_REMOVED`, `SEARCH_SUPPRESSED` (won't show in search - also inferred when
   `summaries.status` lacks `DISCOVERABLE`), `ATTRIBUTE_SUPPRESSED` (gate 3). A row whose
   `summaries.status` merely lacks `BUYABLE` (healthy is `["DISCOVERABLE","BUYABLE"]`)
   **with no issue** is an out-of-stock / inactive offer, not a suppression - it maps to
   `amazon_listings_with_cogs.listing_status` Inactive/Incomplete and on a live account
   can be half the catalog (one re-test: 5,737 "not buyable" vs 806 real suppressions).
   Count those in a separate **"inactive, no issue"** bucket, never in the suppressed
   headline; list one individually only when it has stock (gate 4) or recent sales.
   `summaries` NULL = "no snapshot payload - re-check next refresh", not "status missing".
   If `status` contains `BUYABLE` but an enforcement says suppressed, the enforcement may
   be stale or apply to one offer type (e.g. B2B) - report as **"buyable but flagged -
   verify"**, below full suppressions.
2. **ERROR-severity issues** - any `issues[]` with `severity == ERROR` blocks or limits
   the listing (e.g. `MISSING_PRICE`, `INVALID_IMAGE`, an attribute conflict). Report the
   `code` + `message` + `categories[]` as the reason. ERROR beats everything below it.
   A BUYABLE listing with an ERROR is common (hundreds on a large account) - it goes in
   the "buyable but flagged" bucket, not the suppressed count.
3. **Attribute-suppressed (partial)** - an `issues[]` enforcement action of
   `ATTRIBUTE_SUPPRESSED` (e.g. a bad main image) hides a field but the listing may still
   sell - lower severity than a full `LISTING_SUPPRESSED`. Flag it below full suppression.
4. **No offer / stranded inventory** - `offers == []` means no active offer (it implies
   non-buyable; the reverse does not hold - most non-buyable rows still carry an offers
   array with a price and simply have no sellable stock). **Stranded** = you still hold
   stock that cannot sell: `amazon_fba_stranded_inventory` is the source of record
   (`stranded_reason`, `primary_action`); in `amazon_listings_with_cogs` the gate is
   `fba_has_stranded_inventory = true` (derived from that table, so it covers every
   stranded SKU). `listing_status == Inactive` AND `fba_quantity_available > 0` is only a
   secondary "dead offer with stock" signal - it catches about a third of Amazon's
   stranded list, because most stranded SKUs are `Active`. The raw-table gates do not
   surface stranded stock either (many stranded SKUs are BUYABLE with no issue), so the
   stranded check must run even when gates 1-3 pass.
5. **Quality warnings (perf drag)** - `issues[]` at `severity == WARNING` / `INFO`
   (missing recommended attributes, image/title gaps) don't kill the listing but suppress
   its performance and can escalate to suppression later.

Rank the failures by **revenue at risk** (recent sales, or units on hand x price for
stranded stock), not by count - one suppressed hero SKU outranks ten dead long-tail
ones. Recent sales come from `amazon_profit_by_sku_and_date` at **SKU grain**
(`sum(total_sales)` per `sku` over the last 30 days): a flagged SKU's own sales are its
revenue at risk. Keep `child_asin` alongside for the sibling note: when a flagged SKU has 0
sales in the window and a sibling SKU on the same ASIN is BUYABLE, label it "covered by
sibling SKU <sku>" (the ASIN keeps selling through the sibling) rather than "nothing at
risk".

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (resolve each by table name with `exports_sources_get`):
  - `amazon_listings_raw` - the core source. One row per
    SKU/marketplace, a **current snapshot** (`CONTINUOUS` fetch, not a time series - use
    `last_seen_at` for freshness; a date range will not subset it). Carries, as JSON:
    `summaries` (`.status` array + `itemName`, `mainImage`, `productType`,
    `conditionType`, `lastUpdatedDate`), `issues` (array; each with `code`, `severity`,
    `categories[]`, `message`, `enforcements.actions[].action`, `enforcements.exemption`),
    `offers` (array; `[]` = no active offer), `fulfillment_availability`, and
    `attributes`. NOTE: rows are large JSON - pull only the columns you need and parse
    them programmatically; download to a file rather than dumping raw JSON into context.
    Export cap: **100 rows per JSON export / 250 per CSV**, and JSON columns cannot be
    filtered server-side (`contains` on `summaries` / `issues` is rejected). Filters work
    only on scalar columns (`sku`, `child_asin`, `marketplace_country_code`,
    `last_seen_at`) - use `sku in (...)` to pull a targeted subset.
  - `amazon_listings_with_cogs` [premium] - the narrowing table and the stranded gate:
    `listing_status` (Active/Inactive/Incomplete), `fba_quantity_available`,
    `fba_has_stranded_inventory` (true when at least one stranded-inventory row exists for
    the SKU), `listing_name`, `listing_price_value`. Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and fall back to the raw
    listings table only (status from `summaries.status`, FBM quantity from
    `fulfillment_availability[].quantity`, FBA stock from
    `amazon_fba_inventory_by_asin_by_country.quantity_for_local_fulfillment`); never
    render zeros. **Dedupe on `sku`** before joining: a SKU can appear twice with
    different `listing_id` (150 of 11,449 on one account) - keep one row per SKU (max
    `fba_quantity_available`), never join on raw row count.
  - `amazon_fba_stranded_inventory` - Amazon's own stranded list and the stranded source
    of record: `stranded_reason`, `primary_action`, `your_price`, plus fulfillable units.
    `amazon_listings_with_cogs.fba_has_stranded_inventory` is derived from it and is the
    cross-check / gate.
  - `amazon_profit_by_sku_and_date` [premium] - recent sales, to rank issues by revenue
    at risk. **SKU grain**: `sku`, `child_asin`, `date`, `total_sales`, `total_units_sold`,
    `currency`; `requiresDatePeriod: true` (send `from`/`to` for the last 30 days);
    refreshed intraday, sales ~1 day behind. Join on `sku` and attribute the SKU's own
    30-day `sum(total_sales)` as at risk; keep `child_asin` for the sibling-SKU note (see
    the ranking rule above). Not used for ranking, but if you read `total_sessions`,
    `total_page_views` or `avg_buybox_percentage` from this table: they are per-child-ASIN
    values repeated on every SKU row of that ASIN - group by `[date, child_asin]` and take
    `max()`, never sum them across SKUs - and they can lag up to 3 days and be revised for
    30, while sales are ~1 day behind. Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and rank by units on hand x `listing_price_value` instead; never render zeros. (Item name and main image come from
    `summaries`, so a separate catalog source is usually not needed.)
  - `amazon_products_by_child_asin` (optional fallback) - `product_name`, category,
    `product_image_url` if `summaries` name/image is missing or you want richer catalog data.
  - `amazon_fba_inventory_by_asin_by_country` (optional fallback) - `quantity_for_local_fulfillment`
    is units on hand for that country, if you need a fuller inventory view than
    `amazon_listings_with_cogs` gives. `amazon_fba_inventory_health`.`available` is a premium
    alternative.
- Currency/marketplace: read `marketplace_country_code`; a multi-marketplace account
  has one listing row per marketplace, so check and report each marketplace
  separately (a SKU can be live in one and suppressed in another). Keep money in
  each marketplace's own currency - never sum across currencies.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm `amazon_listings_raw` is `enabled`; resolve
   `amazon_listings_with_cogs` (narrowing + stranded gate; premium, never disabled) and
   confirm `amazon_fba_stranded_inventory` plus `amazon_profit_by_sku_and_date` for ranking.
3. **Narrow first:** `exports_create` on `amazon_listings_with_cogs` (`sku`, `child_asin`,
   `marketplace_country_code`, `listing_status`, `fba_quantity_available`,
   `fba_has_stranded_inventory`, `listing_name`, `listing_price_value`; limit 5000,
   paginate with `skip`), dedupe on `sku`, and bucket: Active / Inactive / Incomplete,
   stranded (`fba_has_stranded_inventory = true`), and "inactive with stock"
   (`listing_status != Active` AND `fba_quantity_available > 0`). Pull
   `amazon_fba_stranded_inventory` (small, one row per stranded SKU) for the reason and
   action. If `amazon_listings_with_cogs` returns 0 rows (initial load still in progress),
   say so, skip to step 4 and page the raw table instead.
4. **Pull raw listings only for the SKUs that need the JSON gates:** `exports_create` on
   `amazon_listings_raw` with a bounded column set - `sku`, `child_asin`,
   `marketplace_country_code`, `summaries`, `issues`, `offers`,
   `fulfillment_availability`, `last_seen_at` - and `filters: sku in (...)` for the
   Inactive / Incomplete / stranded / inactive-with-stock SKUs from step 3 (CSV, `limit:
   250`, `skip: n*250`, `orderByColumn: sku`). Download via `exports_raw_url_get` to a
   file and parse per row - do not dump raw JSON into context. Only a *full* sweep
   (needed to catch "buyable but flagged" rows) pages the whole table: count first
   (`count(sku)` grouped by `marketplace_country_code`); budget ~40 CSV pages per 10k
   SKUs, with retries - bursts above ~15 MCP calls get rate-limited.
5. **Apply the gates** per SKU/marketplace by parsing the JSON:
   - `issues[]`: read `enforcements.actions[].action` and bucket by action -
     `LISTING_SUPPRESSED` / `CATALOG_ITEM_REMOVED` (suppressed), `SEARCH_SUPPRESSED`
     (search), `ATTRIBUTE_SUPPRESSED` (partial). Split by `severity`; for `ERROR` keep
     `code` + `message` + `categories`.
   - `summaries.status`: `BUYABLE` present + any enforcement or ERROR = "buyable but
     flagged - verify". `BUYABLE` absent with **no** issue = "inactive, no issue" (not
     suppressed). `DISCOVERABLE` absent = won't show in search. `summaries` NULL = no
     snapshot payload.
   - `offers`: `[]` = no active offer (always non-buyable; the reverse is not true).
6. **Stranded + context + rank:** stranded = `fba_has_stranded_inventory = true` (step 3)
   with `stranded_reason` / `primary_action` from `amazon_fba_stranded_inventory`; take
   `listing_name` / `listing_price_value`, and item name / main image from `summaries`.
   Pull recent sales: `exports_create` on `amazon_profit_by_sku_and_date`, `from`/`to` =
   the last 30 days, `groupBy [sku, child_asin]`, `sum(total_sales)`, `sum(total_units_sold)`,
   `filters: sku in (...)` for the flagged SKUs (CSV; paginate with `skip` above 5,000
   rows; one row per SKU, so no traffic columns and nothing to de-duplicate). Each flagged
   SKU's own 30-day sales are its revenue at risk; a flagged SKU with 0 sales whose sibling
   SKU on the same `child_asin` is BUYABLE gets "covered by sibling SKU <sku>". Sort by
   revenue at risk (then units on hand x price for stranded, then severity).
7. **Report** the prioritized list with the failing gate, the exact issue text
   (`code` + `message`), the snapshot age from `last_seen_at`, and the concrete fix.
   Group by severity; call out the single biggest exposure; give the "inactive, no
   issue" count once, as context, not as a finding.

## Output format

```
Listing Health - {marketplace} - snapshot as of {last_seen_at} ({age})
Scanned {N} listings · {s} suppressed (LISTING_SUPPRESSED) · {r} catalog item removed · {e} errors ({eb} of them buyable but flagged) · {a} attribute-suppressed · {q} search-suppressed · {t} stranded · {w} warnings
Context: {i} inactive with no issue (out-of-stock / inactive offers - not suppressions)

TOP EXPOSURE: {sku} ({product}) - {gate failed}, ~{cur}{sales/30d} at risk (this SKU's own sales)

ERRORS / SUPPRESSED (fix first)
  SKU              Status          Issue (code)                        Fix                         At risk
  {sku}            suppressed      missing price (5009)                add price / restore offer    {cur}{v}/mo
  {sku}            attr-suppressed invalid main image (INVALID_IMAGE)  add compliant main image     covered by sibling SKU {sku2}

BUYABLE BUT FLAGGED (verify - enforcement or ERROR on a live offer)
  {sku}            buyable         {issue (code)}                      verify / fix                 -

STRANDED INVENTORY (stock that can't sell)
  {sku}            {units} units on hand, {stranded_reason} -> {primary_action}   {cur}{units x price}

WARNINGS (perf drag, fix next)
  {sku}            missing {attribute} -> add it

Nothing else flagged: {count} listings healthy.
```

## Worked example (illustrative)

A scan returns a hero SKU whose issues list carries a `LISTING_SUPPRESSED`
enforcement and one ERROR: the feed's product type conflicts with Amazon's catalog
value. That's gate 1+2 failing - the listing is suppressed, so it leads the report with
its own trailing 30-day sales as the revenue at risk and the fix "align the product type
to Amazon's value"; a second suppressed SKU on the same ASIN sold nothing in 30 days while
its sibling stayed buyable, so it reads "covered by sibling SKU" instead of a figure.
Separately, a SKU is `Active` and buyable by every raw gate but
`fba_has_stranded_inventory` is true: Amazon's stranded list says "Potential high pricing
error" -> "Update price" on 141 units - stranded inventory, flagged with units x price and
that action. A third SKU is live but missing a recommended attribute -> a warning, listed
below the blockers. The 4,900 out-of-stock offers that merely lack BUYABLE appear once, as
a context count. Same scan, three severities, ordered by what costs the most.

## Quality self-check

- Did I define "suppressed" by the enforcement action (`LISTING_SUPPRESSED` /
  `CATALOG_ITEM_REMOVED`), and keep "not BUYABLE with no issue" in its own
  "inactive, no issue" bucket out of the headline?
- Did I parse `issues[].enforcements.actions` for all four actions (`LISTING_SUPPRESSED`,
  `CATALOG_ITEM_REMOVED`, `SEARCH_SUPPRESSED`, `ATTRIBUTE_SUPPRESSED`), not just the
  status flags?
- Did I report BUYABLE listings that carry an enforcement or ERROR as "buyable but
  flagged - verify" rather than as suppressed?
- Did I separate ERROR (blocks the listing) from WARNING/INFO (perf drag)?
- Did I gate stranded on `fba_has_stranded_inventory` (with
  `amazon_fba_stranded_inventory` for reason/action), not on `Inactive` + stock alone?
- Did I dedupe `amazon_listings_with_cogs` on `sku` before joining?
- Did I rank by revenue at risk / units on hand, not by issue count - using each SKU's
  own 30-day sales from `amazon_profit_by_sku_and_date`, and labelling a 0-sales flagged
  SKU "covered by sibling SKU" when a sibling on the same ASIN is BUYABLE?
- Did I check each marketplace separately and keep each in its own currency?
- Did I keep the issue `code` + message so each line is actionable?
- Did I state the snapshot age from `last_seen_at` (this is a current snapshot, not a
  time series)?

## Common mistakes

- Counting every listing that lacks BUYABLE as "suppressed" - on a live account most of
  those are out-of-stock / inactive offers with no issue; only an enforcement action makes
  a listing suppressed.
- Paging the whole raw listings table (100/250-row cap) when `amazon_listings_with_cogs`
  can narrow the SKU set first, or trying to filter `summaries` / `issues` server-side
  (JSON columns cannot be filtered).
- Treating every WARNING as urgent - blockers first, warnings next.
- Ignoring stranded inventory because the catalog "looks fine" - the cost is real
  (storage on unsellable units).
- Summing revenue at risk across marketplaces/currencies into one meaningless total.
- Attributing the ASIN's or a sibling's sales to a suppressed SKU - sales are per `sku`
  in `amazon_profit_by_sku_and_date`; a flagged SKU with 0 sales and a BUYABLE sibling is
  "covered by sibling SKU", not "at risk".
- Dumping the full raw listing JSON into the analysis - pull only the needed fields
  and parse them.
- Treating `amazon_listings_raw` as a time series - it's a current snapshot; use
  `last_seen_at` for age, and don't expect a date range to subset it.
- Reporting a wall of dead long-tail SKUs above the one suppressed hero SKU.

## Notes

- Read-only (analysis). Fixing a listing (e.g. correcting an attribute or restoring
  an offer) is a separate write skill via `AMAZON_LISTINGS_UPDATE` (dryRun-gated).
- Some fixes live outside these tables (uploading a compliance document, a category
  approval) - the skill flags them and points you to the exact issue to resolve.
- A DataDoe skill, built on DataDoe `amazon_listings_raw` (status, issues, enforcement
  actions, offers) plus `amazon_listings_with_cogs` (status, stock, stranded flag),
  `amazon_fba_stranded_inventory` and SKU-level sales from `amazon_profit_by_sku_and_date`.
