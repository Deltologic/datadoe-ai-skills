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

A listing only sells when it clears every gate. Check them in order and report the
first one that fails - that is the fix:

1. **Status** - the listing's own status flags say it is buyable and discoverable.
   A listing missing "buyable" is not purchasable; missing "discoverable" won't show
   in search. This is the clearest suppression signal.
2. **Errors** - any listing issue at ERROR severity blocks or limits the listing
   (e.g. an attribute that conflicts with Amazon's catalog, a compliance/document
   gap). ERROR beats everything below it.
3. **Buyability** - there must be a live offer with a price and available stock.
   Inventory on hand with no buyable offer = **stranded inventory** (you're paying
   storage on units that can't sell).
4. **Quality warnings** - WARNING/INFO issues (missing recommended attributes,
   image/title gaps) don't kill the listing but suppress its performance and can
   escalate to suppression later.
5. **Suppression risk** - missing the fields Amazon requires to keep a listing live
   in its category (main image, minimum bullets, required attributes) - fix before
   Amazon acts.

Rank the failures by **revenue at risk** (recent sales of the SKU, or units on hand
for stranded stock), not by count - one suppressed hero SKU outranks ten dead
long-tail ones.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (resolve each by table name with `exports_sources_get`):
  - `amazon_listings_raw` - the core source. Per SKU/marketplace it carries
    `summaries` (listing status flags + item name), `issues` (each with a
    `severity`, `code`, `categories` and human-readable `message`), `offers`,
    `fulfillment_availability`, and `attributes`. NOTE: rows are large JSON - pull
    only the columns you need and parse them; download to a file rather than dumping
    everything into context.
  - `amazon_products_by_child_asin` - `product_name`, category, `product_image_url`
    for a readable report and to confirm a missing main image.
  - `amazon_fba_inventory_by_asin_by_country` (or your inventory-health source) -
    units on hand, to flag stranded inventory and size the storage exposure.
  - `amazon_profit_by_sku_and_date` (or `amazon_sales_and_traffic_with_cogs`) -
    recent sales per SKU, to rank issues by revenue at risk.
- Currency/marketplace: read `marketplace_country_code`; a multi-marketplace account
  has one listing row per marketplace, so check and report each marketplace
  separately (a SKU can be live in one and suppressed in another). Keep money in
  each marketplace's own currency - never sum across currencies.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm `amazon_listings_raw` is `enabled` (plus the
   catalog / inventory / sales sources you'll join for context).
3. **Pull listings:** `exports_create` on `amazon_listings_raw` with `child_asin`,
   `sku`, `marketplace_country_code`, `summaries`, `issues`,
   `fulfillment_availability`, `offers`. Use `exports_raw_url_get` / download to a
   file for large accounts, then parse per row.
4. **Apply the gates** per SKU/marketplace:
   - Read the status flags in `summaries`; flag anything not buyable/discoverable.
   - Scan `issues`: split into ERROR vs WARNING/INFO; keep the `code` + `message`
     so the report is actionable.
   - Check `offers` + `fulfillment_availability`: a SKU with stock but no live
     buyable offer = stranded.
5. **Add context + rank:** join `amazon_products_by_child_asin` for the name/image,
   inventory for units on hand, and recent sales for revenue at risk. Sort by
   revenue at risk (then units on hand for stranded, then severity).
6. **Report** the prioritized list with the failing gate, the exact issue text, and
   the concrete fix. Group by severity; call out the single biggest exposure.

## Output format

```
Listing Health - {marketplace} - {date}
Scanned {N} listings · {e} errors · {s} suppressed/inactive · {t} stranded · {w} warnings

TOP EXPOSURE: {sku} ({product}) - {gate failed}, ~{cur}{sales/mo} at risk

ERRORS / SUPPRESSED (fix first)
  SKU              Status          Issue (code)                    Fix                         At risk
  {sku}            not buyable     product_type conflict (8541)    match Amazon's product type  {cur}{v}/mo
  {sku}            suppressed      missing main image              add compliant main image     {cur}{v}/mo

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
- Did I separate ERROR (blocks the listing) from WARNING/INFO (perf drag)?
- Did I catch stranded inventory (stock on hand + no buyable offer), not only
  catalog errors?
- Did I rank by revenue at risk / units on hand, not by issue count?
- Did I check each marketplace separately and keep each in its own currency?
- Did I keep the issue `code` + message so each line is actionable?

## Common mistakes

- Reading only the issues list and missing a listing that is simply not buyable.
- Treating every WARNING as urgent - blockers first, warnings next.
- Ignoring stranded inventory because the catalog "looks fine" - the cost is real
  (storage on unsellable units).
- Summing revenue at risk across marketplaces/currencies into one meaningless total.
- Dumping the full raw listing JSON into the analysis - pull only the needed fields
  and parse them.
- Reporting a wall of dead long-tail SKUs above the one suppressed hero SKU.

## Notes

- Read-only (analysis). Fixing a listing (e.g. correcting an attribute or restoring
  an offer) is a separate write skill via `AMAZON_LISTINGS_UPDATE` (dryRun-gated).
- Some fixes live outside these tables (uploading a compliance document, a category
  approval) - the skill flags them and points you to the exact issue to resolve.
- A DataDoe skill, built on DataDoe listing status, issues, offer, inventory and
  sales data.
