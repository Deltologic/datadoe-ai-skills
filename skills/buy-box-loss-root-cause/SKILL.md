---
name: buy-box-loss-root-cause
description: >-
  Find the Amazon SKUs losing the Buy Box (Featured Offer) and the most likely reason
  - price vs the featured offer, out of stock, or fulfilment - so you can win it back.
  Live from DataDoe. Use for "buy box", "featured offer", "lost the buy box", "buy box
  percentage", "why did sales drop but traffic did not", or "someone else has my listing".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Buy Box Loss Root Cause
  access: read
  category: Listings & Content
  interface: mcp
  output: report
---

# Buy Box Loss Root Cause

Finds the SKUs where you're losing the Featured Offer (Buy Box) and tells you the
most likely reason - price vs the featured offer, out-of-stock, or fulfilment -
so you can win it back. DataDoe has no single "buy box" table, so this skill
synthesizes it from the buy-box % and price columns.

## When to use this

- Sales dropped on a SKU that still gets traffic (classic buy-box loss).
- Weekly check on hero SKUs' buy-box ownership.
- After a competitor/reseller appears on your listing.
- Trigger phrases: "buy box", "featured offer", "lost the buy box", "buy box
  percentage", "why did sales drop but traffic didn't", "someone else has my listing".

## The framework. The Buy Box gates (check in order)

1. **Ownership** - the **anchor-day** `buybox_percentage` well below 100 on an ASIN with
   real traffic = you're sharing or losing the box *right now*. Use the last complete
   day (the anchor, see step 3) plus a mandatory 7-day trend, never a 30-day average -
   averaging masks a dip-then-recovery and flags SKUs that already hold the box again.
   **Traffic floor:** flag an ASIN only when its anchor-day `page_views` >= 20 (or its
   `page_views` summed over the 7-day window >= 50) AND bb_now is low. A low or 0% read
   on 0-5 page views is "no data", not a loss (on one re-test 52 of 70 ASINs flagged
   without the floor had zero page views that day). `buybox_percentage` is never null -
   it is 0 when there was no featured-offer impression. An ASIN with no row on the anchor
   day has "no data that day", not 0%.
2. **Price** - `your_price` above `featuredoffer_price` (or `lowest_price_new_plus_
   shipping`) = you're priced out of the box.
3. **Stock** - `available = 0` / very low = Amazon can suppress your offer.
4. **Fulfilment/health** - FBM vs FBA and account-health issues also cost the box
   (flag as "check" - not in these tables).
Report the first gate that fails, biggest-revenue SKU first.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (no dedicated buy-box table - synthesize):
  - `Sales & Traffic by ASIN & Date` (`amazon_sales_and_traffic_with_cogs`) - `buybox_percentage`
    (a **per-day series**), `total_sales`, `page_views`, `total_units`, `child_asin`,
    `product_name`. This table has no `sku` column. Read the last *complete, contiguous*
    day, not a window average. The table lags Amazon by typically 6-14 days (the source
    says up to 14), the newest day present is often partial, and holes of several days
    occur - so detect the anchor day first (see step 3). `buybox_percentage` is
    `nullable: false`: expect zeros, not nulls, when there was no featured-offer impression.
    Export cap: 5,000 rows CSV / 1,000 JSON - a 30-day daily per-ASIN export does not fit
    on a catalog of more than ~160 selling ASINs, so use the export shapes in step 3.
  - `FBA Inventory Health` (`amazon_fba_inventory_health`) [premium] - `sku`, `child_asin`,
    `your_price`, `sales_price`, `featuredoffer_price`, `lowest_price_new_plus_shipping`,
    `available`. A daily snapshot that **keeps daily history** (`requiresDatePeriod: true`
    - every export needs `from`/`to`; `from = to = one day` gives that day's snapshot).
    Price lives here, not in the sales table. One day can exceed the 5,000-row CSV cap on a
    large catalog, so filter to the flagged ASINs (`child_asin in (...)`) and paginate with
    `skip` if needed.
    Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and fall back for price to `amazon_fba_stranded_inventory.your_price` or `amazon_listings_with_cogs.listing_price_value` (with `fba_quantity_available` for stock); never render zeros.
    Also treat `your_price = 0` as missing (it is 0 on about half the rows), not as a price.
  - `amazon_item_offers` exists as a future per-seller Buy Box source (per-offer
    `IsBuyBoxWinner`, `SellerId`, offer prices); this skill does not build on it yet.
- Currency/marketplace: localise (e.g. a German marketplace = EUR; the data uses the
  country code, e.g. `GB` for the UK marketplace).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm `amazon_sales_and_traffic_with_cogs` + `amazon_fba_inventory_health`
   enabled (if inventory health is disabled or empty, use the price fallback listed above).
3. Buy-box reads from `amazon_sales_and_traffic_with_cogs` - do **not** pull the full
   30-day daily per-ASIN series (`groupBy [date, child_asin, product_name]` is ~46k rows
   on a 1,500-ASIN catalog vs the 5,000-row cap; the export truncates inside day 4).
   Run these exports instead, all of which fit the cap:
   - **(a) Calibration, account-wide daily:** last 45 days, `groupBy [date]`,
     `count(child_asin)` + `sum(total_units)` (~45 rows). **Anchor day** = the last day of
     the longest recent contiguous run of days whose units and row count are at/above the
     completeness threshold (>= 80% of the median of the prior 7 present days). Contiguous
     means the previous calendar day is present - an isolated day after a multi-day hole is
     **not** the anchor even if its totals look complete (one re-test: 09-25 sat alone
     after a 4-day gap; the right anchor was 09-20). `MAX(date)` alone is never safe. Name
     the anchor, the lag in days from today, and any gap.
   - **(b) Anchor day per ASIN:** `from = to = anchor day`, `groupBy [child_asin,
     product_name]`, `buybox_percentage` (one row per ASIN), `sum page_views`,
     `sum total_units`, `sum total_sales` -> **bb_now** and the anchor-day page views.
   - **(c) 30-day sales per ASIN (ranking input):** `groupBy [child_asin, product_name]`,
     `sum total_sales`, `sum total_units`, `sum page_views` (one row per ASIN). Keep ASINs
     with `total_units > 0` over the window.
   - **Flag** an ASIN as a *current* buy-box loss only if **bb_now** is low AND it clears
     the traffic floor (anchor-day `page_views` >= 20, or 7-day `page_views` >= 50 from
     (d)) - not if only its 30-day average is low (a 30-day mean flags ASINs that dipped
     and have since recovered). An ASIN with **no row on the anchor day** is "no data that
     day", not 0%: use its own latest day within the last 7 complete days and mark the
     date; if none, report "no recent buy-box read".
   - **(d) 7-day trend for the flagged ASINs (mandatory):** the 7 complete days ending on
     the anchor, `groupBy [date, child_asin]`, `filters: child_asin in (...)` limited to the
     flagged ASINs, `avg(buybox_percentage)` + `sum(page_views)` per day -> **bb_trend** =
     page-view-weighted bb over the 7 days (`sum(bb x page_views) / sum(page_views)`), to
     tell "just lost it" from "chronically low" and to confirm the anchor-day read is not
     a one-day dip on a handful of page views.
4. `exports_create` on `amazon_fba_inventory_health` with `from = to = anchor day` (the
   table requires a date range and keeps daily history, so the price snapshot matches the
   bb read): `sku`, `child_asin`, `your_price`, `featuredoffer_price`,
   `lowest_price_new_plus_shipping`, `available`, `filters: child_asin in (...)` for the
   flagged ASINs; paginate with `skip` if the day still exceeds the cap. Optionally pull
   the latest available day the same way to say whether the gap still exists today.
5. Join inventory onto the ASIN with **matching time bases**: pair the anchor-day price
   snapshot with **bb_now** (same day), never the 30-day average or a snapshot taken days
   later - both sides of the join must describe the same moment. `amazon_fba_inventory_health`
   can have several SKUs for one `child_asin`. Do not collapse those rows or average `your_price`.
   - Price: for each SKU with `your_price > 0` (0 means missing, not free), gap =
     `your_price - featuredoffer_price`.
     Report the SKU that is actually in stock (`available` > 0). If several are in stock,
     show each SKU's gap. A gap above 0 means priced out.
   - Stock: only when every SKU for that ASIN has `available` = 0.
   - Otherwise: fulfilment/health check.
6. Rank by sales at risk (30d sales x (1 - bb/100)) and render.

## Output format

```
Buy Box Loss - {marketplace} - buy-box as of {anchor day} (lag {n}d{, gap: dates missing})  (sales over last 30d)
Traffic floor: {pv} page views on the anchor day / {pv7} over 7d · {k} ASINs with no anchor-day row (no data that day)

SKU                 BB%(now) BB%(7d) PV   Sales    Likely cause            Fix
{sku}               {bb}%    {bb7}%  {pv} {cur}..  priced out (+{cur}gap)  match/beat {cur}{feat}
{sku}               {bb}%    {bb7}%  {pv} {cur}..  out of stock            restock (see restock skill)
{sku}               {bb}%    {bb7}%  {pv} {cur}..  fulfilment/health       check FBM/AHR

Biggest sales at risk: {sku} ({cur}.. exposed).
```

## Worked example (illustrative)

Reading each ASIN's **anchor-day** buy-box % (not a 30-day average), confirmed by the
7-day trend and the traffic floor, surfaces the ones losing the box *now* with real
traffic - a SKU that dipped mid-month but sits at 98% on the anchor day is not flagged,
and neither is one at 75% on 4 page views. The skill then joins the anchor-day prices: if `your_price` 12.90 >
`featuredoffer_price` 11.95, the
cause is "priced out by 0.95" and the fix is to match/beat 11.95 (or hold price if
margin matters more than the box). If instead `available = 0`, the cause is stock,
routed to the restock skill. Same signal, different fix - the skill picks the right
one.

## Quality self-check

- Did I apply the traffic floor (anchor-day `page_views` >= 20 or 7-day >= 50) so a 0%
  read on a handful of page views is "no data", not a loss?
- Did I anchor on the last day of a contiguous complete run (not an isolated day after a
  hole, not `MAX(date)`), and name the anchor, lag and gaps?
- Did I key off the anchor-day `buybox_percentage` confirmed by the 7-day trend, NOT a
  30-day average, so recoveries aren't misread as current losses?
- Did I treat ASINs with no anchor-day row as "no data that day" rather than 0%?
- Did I pair the anchor-day price snapshot (`from = to = anchor day`) with the anchor-day
  buy-box read (same time basis)?
- Did I check price gap AND stock before blaming "fulfilment"?
- Did I rank by revenue at risk, not by lowest bb%?
- Did I keep margin in mind (winning the box below cost isn't a win)?

## Common mistakes

- Chasing buy-box on tiny long-tail SKUs (bb 0 but 1 unit/mo) - not worth it.
- Recommending a price cut when the real cause is a stockout.
- Averaging buy-box % across the window - `buybox_percentage` is a daily series; a SKU
  that dipped and recovered reads as a chronic loss. Use the latest-day value (or a short
  trend), not a 30-day mean.
- Comparing a 30-day average buy-box to a single-day price snapshot - two different time
  bases; pair the anchor day with the anchor day.
- Pulling the full 30-day daily per-ASIN series - it blows the 5,000-row cap and
  silently truncates after a few days; use the anchor-day, 30-day-per-ASIN and
  filtered 7-day shapes from step 3.
- Anchoring on the latest day present when it is isolated after a gap - the anchor must
  be contiguous with the days before it.
- Expecting null `buybox_percentage` - the column is never null; it is 0 when there was no
  featured-offer impression. With low page views that is "no data"; with real traffic it is
  a loss. A sole-seller ASIN shows as 0 or 100 depending on impressions, so check traffic
  before flagging.
- Reporting an ASIN that has no row on the anchor day as 0% - it has no data that day.
- Racing a hijacker to the bottom instead of enforcing (flag for enforcement).

## Notes

- Read-only. No auto-repricing (a price change would be `bulk-price-update`, dryRun-gated).
- Buy box is synthesized (no first-class table) - state assumptions in the output.
- A DataDoe skill, built on DataDoe buy-box % + price columns.
