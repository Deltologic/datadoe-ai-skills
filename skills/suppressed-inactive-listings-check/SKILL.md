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

1. **Not buyable / suppressed** - the clearest signal. Either `summaries.status` is
   missing `BUYABLE` (healthy is `["DISCOVERABLE","BUYABLE"]`; a `["DISCOVERABLE"]`-only
   row is discoverable but not purchasable), OR any `issues[]` entry has an
   `enforcements.actions[].action == LISTING_SUPPRESSED`. Also flag `DISCOVERABLE` absent
   (won't show in search).
2. **ERROR-severity issues** - any `issues[]` with `severity == ERROR` blocks or limits
   the listing (e.g. `MISSING_PRICE`, `INVALID_IMAGE`, an attribute conflict). Report the
   `code` + `message` + `categories[]` as the reason. ERROR beats everything below it.
3. **Attribute-suppressed (partial)** - an `issues[]` enforcement action of
   `ATTRIBUTE_SUPPRESSED` (e.g. a bad main image) hides a field but the listing may still
   sell - lower severity than a full `LISTING_SUPPRESSED`. Flag it below full suppression.
4. **No offer / stranded inventory** - `offers == []` means no active offer (pairs with a
   non-buyable status). **Stranded** = you still hold stock: join
   `amazon_listings_with_cogs` and flag `listing_status == Inactive` AND
   `fba_quantity_available > 0` (paying storage on units that can't sell).
5. **Quality warnings (perf drag)** - `issues[]` at `severity == WARNING` / `INFO`
   (missing recommended attributes, image/title gaps) don't kill the listing but suppress
   its performance and can escalate to suppression later.

Rank the failures by **revenue at risk** (recent sales of the SKU, or units on hand
x price for stranded stock), not by count - one suppressed hero SKU outranks ten dead
long-tail ones.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (resolve each by table name with `exports_sources_get`):
  - `amazon_listings_raw` (source id `6ea445cdc4`) - the core source. One row per
    SKU/marketplace, a **current snapshot** (`CONTINUOUS` fetch, not a time series - use
    `last_seen_at` for freshness; a date range will not subset it). Carries, as JSON:
    `summaries` (`.status` array + `itemName`, `mainImage`, `productType`,
    `conditionType`, `lastUpdatedDate`), `issues` (array; each with `code`, `severity`,
    `categories[]`, `message`, `enforcements.actions[].action`, `enforcements.exemption`),
    `offers` (array; `[]` = no active offer), `fulfillment_availability`, and
    `attributes`. NOTE: rows are large JSON - pull only the columns you need and parse
    them programmatically; download to a file rather than dumping raw JSON into context.
  - `amazon_listings_with_cogs` (source id `ba689c05d7`) - for the stranded-inventory
    gate and readable fields: `listing_status` (Active/Inactive/Incomplete),
    `fba_quantity_available`, `listing_name`, `listing_price_value`.
  - `amazon_sales_and_traffic_with_cogs` (or `amazon_profit_by_sku_and_date`) - recent
    sales per SKU, to rank issues by revenue at risk. (Item name and main image come from
    `summaries`, so a separate catalog source is usually not needed.)
  - `amazon_products_by_child_asin` (optional fallback) - `product_name`, category,
    `product_image_url` if `summaries` name/image is missing or you want richer catalog data.
  - `amazon_fba_inventory_by_asin_by_country` (optional fallback) - units on hand, if you
    need a fuller inventory-health view than `amazon_listings_with_cogs` gives.
- Currency/marketplace: read `marketplace_country_code`; a multi-marketplace account
  has one listing row per marketplace, so check and report each marketplace
  separately (a SKU can be live in one and suppressed in another). Keep money in
  each marketplace's own currency - never sum across currencies.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm `amazon_listings_raw` (`6ea445cdc4`) is `enabled`
   (plus `amazon_listings_with_cogs` for the stranded gate and a sales source for ranking).
3. **Pull listings:** `exports_create` on `amazon_listings_raw` with a bounded column set
   - `sku`, `child_asin`, `marketplace_country_code`, `summaries`, `issues`, `offers`,
   `fulfillment_availability`, `last_seen_at`. Download via `exports_raw_url_get` to a
   file and parse per row - do not dump raw JSON into context. (The 3500-row export cap
   applies; for large catalogs paginate or filter.)
4. **Apply the gates** per SKU/marketplace by parsing the JSON:
   - `summaries.status`: flag `BUYABLE` absent (not purchasable) or `DISCOVERABLE` absent
     (won't show in search).
   - `issues[]`: split by `severity`; for `ERROR` keep `code` + `message` + `categories`.
     Read `enforcements.actions[].action` for `LISTING_SUPPRESSED` (full) vs
     `ATTRIBUTE_SUPPRESSED` (partial).
   - `offers`: `[]` = no active offer (pairs with a non-buyable status).
5. **Stranded + context + rank:** join `amazon_listings_with_cogs` and flag
   `listing_status == Inactive` AND `fba_quantity_available > 0` (stranded); take
   `listing_name` / `listing_price_value`, and item name / main image from `summaries`.
   Pull recent sales for revenue at risk. Sort by revenue at risk (then units on hand
   x price for stranded, then severity).
6. **Report** the prioritized list with the failing gate, the exact issue text
   (`code` + `message`), the snapshot age from `last_seen_at`, and the concrete fix.
   Group by severity; call out the single biggest exposure.

## Output format

```
Listing Health - {marketplace} - snapshot as of {last_seen_at} ({age})
Scanned {N} listings · {e} errors · {s} suppressed (full) · {a} attribute-suppressed · {t} stranded · {w} warnings

TOP EXPOSURE: {sku} ({product}) - {gate failed}, ~{cur}{sales/mo} at risk

ERRORS / SUPPRESSED (fix first)
  SKU              Status          Issue (code)                        Fix                         At risk
  {sku}            not buyable     missing price (5009)                add price / restore offer    {cur}{v}/mo
  {sku}            attr-suppressed invalid main image (INVALID_IMAGE)  add compliant main image     {cur}{v}/mo

STRANDED INVENTORY (stock that can't sell)
  {sku}            {units} units on hand, no buyable offer -> relist / fix offer   {cur}{storage exposure}

WARNINGS (perf drag, fix next)
  {sku}            missing {attribute} -> add it

Nothing else flagged: {count} listings healthy.
```

## Worked example (illustrative)

A scan returns a hero SKU whose status no longer shows as buyable and whose issues
list carries one ERROR: the feed's product type conflicts with Amazon's catalog
value. That's gate 1+2 failing - the listing is effectively suppressed, so it leads
the report with its trailing monthly sales as the revenue at risk and the fix
"align the product type to Amazon's value". Separately, a SKU shows 300 units on
hand but no buyable offer -> stranded inventory, flagged with its storage exposure
and "relist / restore the offer". A third SKU is live but missing a recommended
attribute -> a warning, listed below the blockers. Same scan, three severities,
ordered by what costs the most.

## Quality self-check

- Did I check the status flags first (buyable/discoverable), not just the issues list?
- Did I parse `issues[].enforcements.actions` for `LISTING_SUPPRESSED` (full) vs
  `ATTRIBUTE_SUPPRESSED` (partial), not just the status flags?
- Did I separate ERROR (blocks the listing) from WARNING/INFO (perf drag)?
- Did I catch stranded inventory (stock on hand + no buyable offer), not only
  catalog errors?
- Did I rank by revenue at risk / units on hand, not by issue count?
- Did I check each marketplace separately and keep each in its own currency?
- Did I keep the issue `code` + message so each line is actionable?
- Did I state the snapshot age from `last_seen_at` (this is a current snapshot, not a
  time series)?

## Common mistakes

- Reading only the issues list and missing a listing that is simply not buyable.
- Treating every WARNING as urgent - blockers first, warnings next.
- Ignoring stranded inventory because the catalog "looks fine" - the cost is real
  (storage on unsellable units).
- Summing revenue at risk across marketplaces/currencies into one meaningless total.
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
  actions, offers) plus `amazon_listings_with_cogs` (status + stock) and sales data.
