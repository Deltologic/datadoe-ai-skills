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
   array with a price and simply have no sellable stock). **Before counting anything**,
   set aside variation parents, identified only by explicit metadata:
   `attributes.parentage_level[0].value == "parent"` (pull `attributes` in the raw
   export). On one UK account all 15 parent SKUs probed carried `parent` and their
   children `child`. `relationships` lists `childSkus` on most parents (14 of those 15)
   but can be empty, and a null `parent_asin` also covers standalone products, so neither
   is the marker. Variation parents carry `LISTING_SUPPRESSED` and empty offers as a matter
   of course and cost nothing (on one re-test 26 of 157 LISTING_SUPPRESSED rows were
   parents): exclude them from the suppressed headline and from "no offer", and report
   their count once as context. Do
   **not** detect parents by SKU name - `Transparent` contains `parent`. Do **not** infer
   "never had an offer" from the current snapshot either: no FNSKU, no offers and empty
   `fulfillment_availability` also describe a seller-fulfilled SKU that sold last month
   and has since gone inactive or been suppressed. A non-parent SKU with no offer goes to
   the context count **"no offer, nothing at risk"** only when step 3 shows no 30-day
   sales, no stock and no stranded units - and leaves the suppressed headline even when
   it carries `LISTING_SUPPRESSED` (on one run 75 of 130 non-parent suppressed rows were
   such Incomplete SKUs with nothing at risk); a SKU with sales or stock stays in the
   diagnostic buckets.
   **Stranded** = you still hold stock that cannot sell: `amazon_fba_stranded_inventory` is
   the source of record (`stranded_reason`, `primary_action`, and the **auto-removal
   deadline** `date_to_take_auto_removal` - Amazon disposes of the units on that date if
   nothing is done, so it is the first sort key); in `amazon_listings_with_cogs` the gate is
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
revenue at risk. Keep `child_asin` alongside for the **sibling rule**, in every bucket:
a flagged SKU is **covered** only by a sibling on the same `child_asin` that is
`listing_status = Active`, is a regular new-condition SKU (not an `amzn.gr.*` Grade and
Resell SKU) and **sold something in the last 30 days**. Then print the sibling and its own
30-day sales next to the flagged SKU's and label the row **"duplicate SKU, ASIN still
selling via <sibling> (<cur><sibling sales>)"** (0 own sales: "covered by sibling SKU
<sibling>"). "Active" alone is not cover: on one run ten live top sellers would have read
"still selling via <sibling> (GBP 0)" because a legacy or resale SKU on the ASIN was
Active with no sales. When the only Active sibling sold nothing, say "Active sibling
<sibling> has no sales - not covered". **Never apply cover to a BUYABLE row** - that SKU is
live itself, so its own sales are what is at risk. Keep the flagged SKU's own sales as its
at-risk figure. **TOP EXPOSURE = the highest at-risk row without a covering sibling,
taken from the gate failures (suppressed, catalog removed, ERROR, attribute-suppressed, no
offer, stranded) and "buyable but flagged" - not from "inactive, no issue"**, which is a
restock item. One re-test headlined an inactive EU-suffixed SKU at GBP 1,780 whose sibling
on the same ASIN was Active at GBP 12,718 - the ASIN was not at risk; with the old
"Active means covered" rule, another run lost a GBP 5,466 live listing with a catalogue
error from the headline because its sibling had sold GBP 48.

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
    `attributes` (`attributes.parentage_level` marks variation parents; `relationships`
    lists `childSkus` on most parents but can be empty). NOTE: rows are large JSON - pull only the columns you need and parse
    them programmatically; download to a file rather than dumping raw JSON into context.
    Export cap: **100 rows per JSON export / 250 per CSV**, and JSON columns cannot be
    filtered server-side (`contains` on `summaries` / `issues` is rejected). Filters work
    only on scalar columns (`sku`, `child_asin`, `marketplace_country_code`,
    `last_seen_at`) - use `sku in (...)` to pull a targeted subset: split the SKU list into
    chunks of 250 and send one export per chunk (`sku in (chunk)`, `limit 250`, no `skip`).
    A whole 858-SKU / 23k-character list with `skip` paging also works, but repeats the
    long filter on every page. Download each page as soon as it completes - the
    `exports_raw_url_get` link expires 15 minutes after the export was created.
  - `amazon_listings_with_cogs` [premium] - the narrowing table and the stranded gate:
    `listing_status` (Active/Inactive/Incomplete), `fba_quantity_available`,
    `fba_has_stranded_inventory` (true when at least one stranded-inventory row exists for
    the SKU), `listing_name`, `listing_price_value`. Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and fall back to the raw
    listings table only (status from `summaries.status`, FBM quantity from
    `fulfillment_availability[].quantity`, FBA stock from
    `amazon_fba_inventory_by_asin_by_country.quantity_for_local_fulfillment`); never
    render zeros. **Dedupe on `sku`** before joining: a SKU can appear twice with
    different `listing_id` (150 of 11,449 on one account), sometimes with different
    `listing_status` (34 such SKUs on one run) - if any row is Active, treat the SKU as
    Active; otherwise keep the row with the most `fba_quantity_available`. Never join on
    raw row count.
  - `amazon_fba_stranded_inventory` - Amazon's own stranded list and the stranded source
    of record (24 columns, `requiresDatePeriod: false`, not premium, one row per stranded
    SKU, full snapshot replaced daily). Pull: `sku`, `child_asin`, `product_name`,
    `stranded_reason`, `primary_action`, `date_stranded`, **`date_to_take_auto_removal`**,
    `status_primary`, `status_secondary`, `error_message`, `your_price`,
    `fulfillable_qty`, `reserved_quantity`, `unfulfillable_qty`. **Units** = `fulfillable_qty`
    (show `reserved_quantity` beside it - reserved units are in customer orders or
    transfers, not the stranded stock itself); **value** = units x `listing_price_value`
    from step 3 (today's listing price), else units x `your_price` - say which. A stranded
    row whose SKU is Active in `amazon_listings_with_cogs` with stock and 30-day sales may
    already be resolved: mark it "verify - may be stale" and do not lead with it (one run:
    158 "stranded" units, 136 of them reserved, on a SKU that sold GBP 570 that month). On "Potential high pricing
    error" rows `your_price` is the price Amazon flagged as too high (one SKU: 10.99 vs a
    listing price of 7.49), so valuing at it overstates the stock. The auto-removal date is
    the deadline Amazon will act on without you (on one re-test 38 of 123 stranded SKUs
    were 7 days from it, 48 within 16 days: 698 units, GBP 7,880). A `date_to_take_auto_removal`
    in the **past** with stock still listed means "verify in Seller Central - Amazon's date
    may be stale", not "already removed".
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
    `max()`, never sum them across SKUs - and they lag one to two weeks on real accounts and
    can be revised for 30 days, while sales are ~1 day behind. Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and rank by units on hand x `listing_price_value` instead; never render zeros. (Item name and main image come from
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
3. **Narrow first:** `exports_create` on `amazon_listings_with_cogs` (`listing_id`, `sku`,
   `child_asin`, `marketplace_country_code`, `listing_status`, `fba_quantity_available`,
   `fba_has_stranded_inventory`, `listing_name`, `listing_price_value`; limit 5000,
   `orderByColumn listing_id` - selected and unique per row, so `skip` pages are stable;
   an unordered or `sku`-ordered page can swap the two rows of a duplicated SKU),
   dedupe on `sku`, and bucket: Active / Inactive / Incomplete,
   stranded (`fba_has_stranded_inventory = true`), and "inactive with stock"
   (`listing_status != Active` AND `fba_quantity_available > 0`). Pull
   `amazon_fba_stranded_inventory` (small, one row per stranded SKU) with the column list
   from Configuration - reason, action and the auto-removal deadline. **Pull the 30-day
   sales now, before the raw pull** (they drive the narrowing in step 4): `exports_create`
   on `amazon_profit_by_sku_and_date`, `from`/`to` = the 30 calendar days ending
   yesterday (say the dates), `groupBy [sku]`, `sum(total_sales)`,
   `sum(total_units_sold)`, no SKU filter (CSV; above 5,000 rows page with `orderByColumn
   sku` - one row per SKU, so the order is unique). `child_asin` for the sibling rule comes
   from the listings table above. Data facts: the row with a null `sku` is account-only
   (ads with no SKU) and carries no SKU sales - drop it; and a SKU with no sales has **no
   row at all**, so a missing row means 0, never "unknown". If
   `amazon_listings_with_cogs` returns 0 rows (initial load still in progress), say so,
   skip to step 4 and page the raw table instead.
4. **Pull raw listings only for the SKUs that need the JSON gates.** Two sets:
   - **(a) Something at risk:** Inactive or Incomplete SKUs with 30-day sales > 0 or FBA
     stock > 0, plus every stranded SKU, Active ones included (FBM stock is not in the
     narrowing table, so an Inactive FBM SKU with stock and no sales is skipped - say so
     if the account sells FBM). Skip non-Active SKUs with no stock,
     no sales and no stranded units - their enforcement state changes nothing (one
     re-test: the broad set was 5,719 SKUs = 23 CSV pages; skipping Inactive SKUs with
     nothing at risk left 855 = 4 pages, and treating Incomplete the same way leaves about
     220 = 1 page - most skipped Incomplete SKUs are variation parents and never-completed
     listings). Report the skipped Inactive and Incomplete counts as context.
   - **(b) Top Active sellers (standard):** the 50 Active SKUs with the highest 30-day
     sales from step 3 (one page; the user may ask for up to 250). Active sellers carry the
     largest live-but-flagged exposure - on one account 11 of the top 50 had an ERROR on a
     live listing, GBP 21,476 of their own sales - and the non-Active pull never sees them.
   `exports_create` on
   `amazon_listings_raw` with a bounded column set - `sku`, `child_asin`,
   `marketplace_country_code`, `summaries`, `issues`, `offers`,
   `fulfillment_availability`, `attributes` (for `parentage_level`; it makes rows heavy,
   which is one more reason to download to a file), `last_seen_at` - and `filters: sku in
   (...)` for both sets in chunks of 250 (CSV, one export per chunk, no `skip`). Download
   via `exports_raw_url_get` to a file and parse per row - do not dump raw JSON into
   context. Report the headline as "gates applied to {m} of {N} SKUs ({k} Inactive or
   Incomplete with nothing at risk and {a} other Active SKUs not gate-checked)" - never
   call the whole remainder "Inactive" (on one run 5,729 of the 10,598 unchecked SKUs were
   Active). Only a *full*
   sweep (needed to count "buyable but flagged" rows across the whole catalog) pages the
   whole table: count first (`count(sku)` grouped by `marketplace_country_code`); budget
   ~40 CSV pages per 10k SKUs, with retries - bursts above ~15 MCP calls get rate-limited.
   Under the narrowed pull, say "buyable-but-flagged counted within the gate-checked set".
5. **Apply the gates** per SKU/marketplace by parsing the JSON:
   - `issues[]`: read `enforcements.actions[].action` and bucket by action -
     `LISTING_SUPPRESSED` / `CATALOG_ITEM_REMOVED` (suppressed), `SEARCH_SUPPRESSED`
     (search), `ATTRIBUTE_SUPPRESSED` (partial). Split by `severity`; for `ERROR` keep
     `code` + `message` + `categories`.
   - `summaries.status`: `BUYABLE` present + any enforcement or ERROR = "buyable but
     flagged - verify". `BUYABLE` absent with **no** blocking issue (no enforcement, no
     ERROR; WARNING / INFO only is fine) = "inactive, no issue" (not suppressed) - say how
     many of those carry warnings. `DISCOVERABLE` absent = won't show in search - count it in {q} next to
     the explicit `SEARCH_SUPPRESSED` actions and show both numbers. `summaries` NULL = no
     snapshot payload (parent status unknown too) - count it in the context line.
   - `offers`: `[]` = no active offer (always non-buyable; the reverse is not true).
   - **Parents first:** `attributes.parentage_level[0].value == "parent"` -> variation
     parent; drop it from the suppressed, no-offer and error counts before anything else
     is tallied, and report the parent count once as context. A missing
     `parentage_level` is not a parent.
   - **No offer, nothing at risk:** a non-parent row with `offers == []` and, from step 3,
     no 30-day sales, no stock and no stranded units -> context count only, out of the
     suppressed headline too (say how many of them carry `LISTING_SUPPRESSED`). Every row
     with sales or stock stays in its diagnostic bucket, whatever its offers and
     availability look like today.
   - **Roll up identical ERROR root causes** across SKUs (same `code` / same message
     pattern, e.g. media on one host returning HTTP 403 behind several codes) into one
     line with the SKU count; keep per-SKU rows only for SKUs with 30-day sales (after the
     narrowing nearly every row has sales, stock or stranded units, so "sales or stock"
     filters nothing).
6. **Stranded + context + rank:** stranded = `fba_has_stranded_inventory = true` (step 3)
   with `stranded_reason` / `primary_action` / `date_to_take_auto_removal` from
   `amazon_fba_stranded_inventory`; take `listing_name` / `listing_price_value`, and item
   name / main image from `summaries`. Rows marked "verify - may be stale" (Configuration)
   go at the end. **Sort the stranded section by
   `date_to_take_auto_removal` ascending first**, then by value; lead it with the URGENT
   line (SKUs, units and value reaching auto-removal within the next 14 days). Rows whose
   date is already in the past go in their own "verify in Seller Central - date may be
   stale" block after the URGENT rows, not at the top; rows with no date go last. **Roll up by
   `(stranded_reason, primary_action)`** with SKU count, units, value and 30-day sales - on
   one account "Potential high pricing error" -> "Update price" was 99 of 123 SKUs and GBP
   12.0k of 15.5k, and the same issue codes sat behind 46 of the LISTING_SUPPRESSED rows:
   when one pair dominates both lists, say **"one fix clears both lists"** - it is the most
   actionable sentence in the report. Join the 30-day sales from step 3 onto every bucket -
   including "inactive, no issue" and "inactive with stock", so an out-of-stock hero
   surfaces with its sales (one tested account had an inactive SKU with GBP 2,805 / 566
   units in 30 days and no issue). Each SKU's own 30-day sales are its revenue at risk.
   **Sibling rule (every bucket):** a flagged, non-BUYABLE SKU is covered only by a
   sibling on the same `child_asin` that is `listing_status = Active` (step 3), not an
   `amzn.gr.*` resale SKU, and has 30-day sales > 0 (step-3 export). Then print the sibling
   and its sales and label the row "duplicate SKU, ASIN still selling via <sibling>
   (<cur><sibling sales>)" - or "covered by sibling SKU <sibling>" when own sales are 0.
   An Active sibling with no sales is not cover - say "Active sibling <sibling> has no
   sales - not covered"; with only non-Active siblings, print no sibling label at all.
   When the covering sibling has 0 FBA stock today, add "(sibling out of FBA stock
   today)". Keep own sales as the at-risk figure. **TOP EXPOSURE is the
   highest at-risk row without a covering sibling among the gate failures and "buyable
   but flagged"** (step 4b rows included), never an "inactive, no issue" row. Sort by
   revenue at risk (then stranded value, then severity).
7. **Report** the prioritized list with the failing gate, the exact issue text
   (`code` + `message`), the snapshot age from `last_seen_at`, and the concrete fix.
   Group by severity; call out the single biggest exposure; give the "inactive, no
   issue" count once, as context, not as a finding.

## Output format

```
Listing Health - {marketplace} - snapshot as of {last_seen_at} ({age})
Scanned {N} listings · gates applied to {m} of {N} SKUs ({m1} with something at risk - non-Active with sales or stock, or stranded - + the top {m2} Active sellers) · not gate-checked: {k} Inactive or Incomplete with nothing at risk, {a} other Active SKUs
{s} suppressed SKUs (LISTING_SUPPRESSED; {sp} variation parents and {sn} no-offer SKUs with nothing at risk excluded) · {r} catalog item removed · {e} SKUs with an ERROR issue ({eb} buyable but flagged, within the gate-checked set; tables list each SKU under its first failing gate) · {a2} attribute-suppressed · {q} search-suppressed ({qe} enforcement, {qi} not DISCOVERABLE) · {t} stranded · {w} warnings
Context: {i} inactive with no issue within the gate-checked set (out of stock / inactive offers - not suppressions) · {sp} variation parents · {p} no offer and nothing at risk ({sn} of them carry LISTING_SUPPRESSED) · {np} rows with no snapshot payload

TOP EXPOSURE: {sku} ({product}) - {gate failed}, ~{cur}{sales/30d} at risk (this SKU's own sales; no selling sibling)
URGENT: {n} stranded SKUs reach auto-removal by {date} - {units} units, {cur}{value} (value at {listing price | your_price})
{One fix clears both lists: "{stranded_reason}" -> "{primary_action}" is {k} of {t} stranded SKUs ({cur}{value}) and sits behind {j} of the {s} suppressions.}

ERRORS / SUPPRESSED (fix first)
  SKU              Status          Issue (code)                        Fix                         At risk
  {sku}            suppressed      missing price (5009)                add price / restore offer    {cur}{v}/mo
  {sku}            suppressed      {issue (code)}                      {fix}                        {cur}{v}/mo - duplicate SKU, ASIN still selling via {sku2} ({cur}{v2})
  {sku}            attr-suppressed invalid main image (INVALID_IMAGE)  add compliant main image     covered by sibling SKU {sku2} ({cur}{v2})
  {sku}            error           {issue (code)}                      {fix}                        {cur}{v}/mo - Active sibling {sku3} has no sales - not covered
  {n} SKUs         error           {rolled-up root cause (codes)}      {fix}                        {cur}{v}/mo across them

BUYABLE BUT FLAGGED (verify - enforcement or ERROR on a live offer; includes the top {m2} Active sellers)
  {sku}            buyable         {issue (code)}                      verify / fix                 {cur}{v}/mo (own sales; a live row is never "covered")
  By root cause: {code / message}: {n} SKUs, {cur}{v}/mo

INACTIVE, NO ISSUE, WITH RECENT SALES (out of stock, not suppressed - restock)
  {sku}            inactive        no issue, 0 stock                   restock                      {cur}{v}/mo
  {sku}            inactive        no issue, 0 stock                   none - duplicate             {cur}{v}/mo - ASIN still selling via {sku2} ({cur}{v2})

STRANDED INVENTORY (stock that can't sell; sorted by auto-removal date)
  SKU              Auto-removal     Units  {stranded_reason} -> {primary_action}             Value          Sales/30d
  {sku}            {date}           {u}    {reason} -> {action}                               {cur}{u x p}   {cur}{v}
  Past auto-removal date, stock still listed (verify in Seller Central - date may be stale):
  {sku}            {date}           {u}    {reason} -> {action}                               {cur}{u x p}   {cur}{v}
  By reason -> action: {reason} -> {action}: {k} SKUs, {units} units, {cur}{value}, {cur}{sales}/30d

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
its sibling kept selling, so it reads "covered by sibling SKU" instead of a figure. A live
top seller with a catalogue-data ERROR keeps its own GBP 5,466 at risk even though a resale
SKU on its ASIN is Active - a live row is never covered, and that sibling sold almost
nothing. An
inactive EU-suffixed SKU with GBP 1,780 of its own sales is not the headline either: its
sibling on the same ASIN is Active at GBP 12,718, so it reads "duplicate SKU, ASIN still
selling via <sibling>", and TOP EXPOSURE goes to the biggest row with no Active sibling.
Separately, a SKU is `Active` and buyable by every raw gate but
`fba_has_stranded_inventory` is true: Amazon's stranded list says "Potential high pricing
error" -> "Update price" on 141 units, auto-removal in 7 days - stranded inventory, at the
top of the stranded table with units x price and that action; the same reason -> action
pair covers 99 of the 123 stranded SKUs and the same codes sit behind 46 suppressions, so
the report says "one fix clears both lists". The 26 variation parents carrying
`LISTING_SUPPRESSED` (`parentage_level` = parent) are excluded from the suppressed count and
reported once as context, while a seller-fulfilled SKU with no current offer but sales last
month stays in the suppressed list with those sales at risk. A third SKU is live but missing a recommended attribute -> a warning, listed
below the blockers. The thousands of Inactive SKUs with no stock and no sales are not gate-checked
at all and appear once, as a context count. Same scan, three severities, ordered by what costs the most.

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
- Did I set aside variation parents by `attributes.parentage_level` (never by SKU name or
  by an empty current offer) before counting suppressions and no-offer rows, and keep
  every SKU with sales or stock in the diagnostic buckets?
- Did I pull `date_to_take_auto_removal`, sort stranded by it, lead with the URGENT line,
  roll up by reason -> action, and say "one fix clears both lists" when it does?
- Did I count a sibling as cover only when it is Active, not a resale SKU, and sold
  something in 30 days - and never on a BUYABLE row?
- Did I take TOP EXPOSURE from the gate failures and "buyable but flagged" only, without a
  covering sibling?
- Did I narrow the raw pull to non-Active SKUs with sales, stock or stranded units, add the
  top Active sellers, pull the sales export first, and split the not-gate-checked count
  into Inactive/Incomplete and Active in the headline?
- Did I keep no-offer SKUs with nothing at risk out of the suppressed headline, value
  stranded stock at a stated price, and put past auto-removal dates in their own block?
- Did I rank by revenue at risk / units on hand, not by issue count - using each SKU's
  own 30-day sales from `amazon_profit_by_sku_and_date`, and labelling a 0-sales flagged
  SKU "covered by sibling SKU" only when that sibling is selling?
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
  in `amazon_profit_by_sku_and_date`; a flagged SKU with 0 sales and a selling sibling is
  "covered by sibling SKU", not "at risk".
- Dumping the full raw listing JSON into the analysis - pull only the needed fields
  and parse them.
- Treating `amazon_listings_raw` as a time series - it's a current snapshot; use
  `last_seen_at` for age, and don't expect a date range to subset it.
- Reporting a wall of dead long-tail SKUs above the one suppressed hero SKU.
- Counting variation parents as suppressed or as "no offer" - a parent is never buyable
  and costs nothing; identify it by `attributes.parentage_level`, not by SKU name
  (`Transparent` contains `parent`).
- Reading "never had an offer" from today's snapshot - a seller-fulfilled SKU that sold
  last month and went inactive also has no FNSKU, no offers and empty availability; check
  step-3 sales and stock before setting a SKU aside.
- Headlining a duplicate SKU whose sibling on the same ASIN is Active and selling - the
  ASIN is not at risk.
- Treating any Active sibling as cover - legacy, zero-stock and `amzn.gr.*` resale SKUs are
  often Active with no sales; cover needs sales, and a live row is never covered.
- Printing the whole not-gate-checked remainder as "Inactive" - most of it can be Active.
- Gate-checking every Incomplete SKU - most are variation parents or never-completed
  listings with nothing at risk; it quadruples the raw pull.
- Ignoring `date_to_take_auto_removal` - stranded stock past that date is disposed of by
  Amazon, not merely unsellable.
- Pulling raw listings for every Inactive SKU - thousands of pages for SKUs with no stock
  and no sales, where the enforcement state changes nothing.

## Notes

- Read-only (analysis). Fixing a listing (e.g. correcting an attribute or restoring
  an offer) is a separate write skill via `AMAZON_LISTINGS_UPDATE` (dryRun-gated).
- Some fixes live outside these tables (uploading a compliance document, a category
  approval) - the skill flags them and points you to the exact issue to resolve.
- A DataDoe skill, built on DataDoe `amazon_listings_raw` (status, issues, enforcement
  actions, offers) plus `amazon_listings_with_cogs` (status, stock, stranded flag),
  `amazon_fba_stranded_inventory` (reason, action, auto-removal date) and SKU-level sales
  from `amazon_profit_by_sku_and_date`.
