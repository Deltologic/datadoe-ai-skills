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

1. **Ownership** - the **anchor-day** `avg_buybox_percentage` below the thresholds in
   Configuration (**< 95 = candidate, < 80 = loss**) on an ASIN with real traffic = you're
   sharing or losing the box *right now*. Use the last complete
   day (the anchor, see step 3) plus a mandatory 7-day trend, never a 30-day average -
   averaging masks a dip-then-recovery and flags SKUs that already hold the box again.
   **Traffic floor:** flag an ASIN only when its anchor-day `total_page_views` >= 20 (or
   its per-day `total_page_views` summed over the 7-day window >= 50) AND bb_now < 95. A
   low or 0% read on 0-5 page views is "no data", not a loss (on one re-test 52 of 70 ASINs
   flagged without the floor had zero page views that day). `avg_buybox_percentage` is
   never null - it is 0 when there was no featured-offer impression. An ASIN with no row on
   the anchor day has "no data that day", not 0%. Both columns are per-ASIN values repeated
   on every SKU row of the ASIN - read them once per ASIN-day (`max`), never summed across
   SKUs (see Configuration).
2. **Price** - compare `your_price` with `featuredoffer_price` (or `lowest_price_new_plus_
   shipping`) on an in-stock SKU. Three readings, not one:
   - `your_price > featuredoffer_price` = **priced out** (+gap).
   - `your_price == featuredoffer_price` and 0 < bb_now < 100 = **shared Featured Offer at
     matched price**. When you hold or share the box, `featuredoffer_price` *is* your own
     price, so a gap of 0 does not clear you: it says another seller sits on the listing at
     your price and Amazon rotates the box. That is an offer/enforcement question, not a
     price cut.
   - `your_price == featuredoffer_price` and bb_now == 0 with real traffic = **lost at
     matched price** - a competitor has matched you and holds the box; verify in Seller
     Central that the featured offer is not yours.
   The gate can only read "priced out" when the box belongs to someone else at a lower
   price; on a shared box it is structurally blind to price (one re-test: six flagged
   ASINs, every one with gap 0, five wrongly routed to "fulfilment/health").
3. **Stock** - `available = 0` / very low = Amazon can suppress your offer. Judge it on the
   **latest** snapshot (today), not only the anchor day: the buy-box read is a lagged
   anchor, a stockout is a today-problem (step 4).
4. **Fulfilment/health** - FBM vs FBA and account-health issues also cost the box
   (flag as "check" - not in these tables). **Residual only:** no price row at all, or
   price and stock both fine and bb_now == 0.
Report the first gate that fails, biggest-revenue SKU first.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (no dedicated buy-box table - synthesize):
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`) [premium] - `avg_buybox_percentage`
    (a **per-day series**), `total_sales`, `total_page_views`, `total_sessions`,
    `total_units_sold`, `sku`, `child_asin`, `product_name`. One row per SKU per day;
    `requiresDatePeriod: true` (every export needs `from`/`to`); refreshed intraday with
    sales about 1 day behind. Read the last *complete, contiguous* day, not a window
    average. Two rules apply to every export in step 3:
    - **Per-ASIN traffic aggregation:** `total_sessions`, `total_page_views` and
      `avg_buybox_percentage` describe the *child ASIN* on that date and are repeated on
      every SKU row of the ASIN. Group by `[date, child_asin]` (plus `product_name`) and
      take `max()` of those three; `sum()` only sales, units and orders. Summing sessions or
      buy box across SKU rows double-counts.
    - **Traffic completeness:** the traffic columns come from Amazon's Sales and Traffic
      report and lag by one to two weeks on real accounts (Amazon's own note says up to 3
      days) and remain incomplete or be revised for up to 30 days, while sales are ~1 day
      behind. Detect the anchor day on the traffic
      columns themselves (step 3a), not on sales, and treat the newest ~3 days as
      provisional even when sales look complete. Holes of several days still occur.
    `avg_buybox_percentage` is `nullable: false`: expect zeros, not nulls, when there was
    no featured-offer impression. Export cap: 5,000 rows CSV / 1,000 JSON - a 30-day daily
    per-SKU export does not fit on a catalog of more than ~160 selling SKUs, so use the
    export shapes in step 3.
  - `Profit by Date` (`amazon_profit_by_date`) [premium] - the same measures at account
    level, one row per `date` and `currency` (`total_sessions`, `total_units_sold`,
    `total_sales`); used only for the completeness calibration in step 3a.
  - `FBA Inventory Health` (`amazon_fba_inventory_health`) [premium] - `sku`, `child_asin`,
    `your_price`, `sales_price`, `featuredoffer_price`, `lowest_price_new_plus_shipping`,
    `available`. A daily snapshot that **keeps daily history** (`requiresDatePeriod: true`
    - every export needs `from`/`to`; `from = to = one day` gives that day's snapshot).
    Price lives here, not in the profit table. One day can exceed the 5,000-row CSV cap on a
    large catalog, so filter to the flagged ASINs (`child_asin in (...)`) and paginate with
    `skip` if needed.
    Premium note (applies to all three premium tables above): a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the tables are part of the always-on default dataset, so they are never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and for price fall back to `amazon_fba_stranded_inventory.your_price` or `amazon_listings_with_cogs.listing_price_value` (with `fba_quantity_available` for stock); never render zeros.
    Also treat `your_price = 0` as missing (it is 0 on half to two thirds of the rows), not as a price.
  - `amazon_item_offers` exists as a future per-seller Buy Box source (per-offer
    `IsBuyBoxWinner`, `SellerId`, offer prices); this skill does not build on it yet. It is
    the source that would *name* the other seller on a "shared Featured Offer at matched
    price" row - until then that row points at the offers list in Seller Central.
- Thresholds (defined once here; use these words in the output):
  - **bb_now < 95 = flag candidate** (chronic 90-95 sharing is worth listing on a hero ASIN).
  - **bb_now < 80 = loss**; 80 <= bb_now < 95 = **sharing**.
  - 7-day trend decides the label: **bb7 >= 90 and bb_now < 80 = "just lost it"**;
    **bb7 < 90 = "chronically low"**.
  - Candidate floor for the 7-day pull: anchor-day `total_page_views` >= 8 (see step 3).
  - Traffic floor to flag: anchor-day `total_page_views` >= 20, or 7-day >= 50.
  - 30-day sales window: the **30 calendar days ending yesterday** (sales are ~1 day
    behind), independent of the anchor.
- Currency/marketplace: localise (e.g. a German marketplace = EUR; the data uses the
  country code, e.g. `GB` for the UK marketplace).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> resolve `amazon_profit_by_sku_and_date`, `amazon_profit_by_date`
   and `amazon_fba_inventory_health` (all premium, never disabled; if inventory health
   returns 0 rows, use the price fallback listed above).
3. Buy-box reads from `amazon_profit_by_sku_and_date` - do **not** pull the full 30-day
   daily per-SKU series (`groupBy [date, child_asin, product_name]` is ~46k rows on a
   1,500-ASIN catalog vs the 5,000-row cap; the export truncates inside day 4). Every
   per-ASIN export below takes `max()` of the traffic columns and `sum()` of sales/units,
   per the aggregation rule in Configuration. Run these exports instead, all of which fit
   the cap:
   - **(a) Calibration, account-wide daily:** `amazon_profit_by_date`, last 45 days,
     `groupBy [date, currency]`, `sum(total_units_sold)`, `sum(total_sales)`,
     `max(total_sessions)` (~45 rows per currency). **Anchor day** = the last day of the
     longest recent contiguous run of days whose `total_sessions` is at/above the
     completeness threshold (>= 80% of the trailing median of the prior 7 complete days).
     Judge completeness on the **traffic** column: sales are ~1 day behind but traffic lags
     by one to two weeks on real accounts (13 days measured; Amazon's own note says up to 3),
     so the newest days routinely show complete units and sales with **rows present but
     `total_sessions` = 0** - a row existing is not completeness; the sessions value is.
     Those days are not complete for buy box. Contiguous means the previous calendar day is
     also complete - an isolated day after a multi-day hole is **not**
     the anchor even if its totals look complete (one re-test: 09-25 sat alone after a
     4-day gap; the right anchor was 09-20). `MAX(date)` alone is never safe. Name the
     anchor, the traffic lag in days from today, and any gap; every day after the anchor is
     provisional.
   - **(b) Anchor day per ASIN:** `from = to = anchor day`, `groupBy [child_asin,
     product_name]`, `max(avg_buybox_percentage)` -> **bb_now**, `max(total_page_views)` ->
     anchor-day page views, `sum(total_sales)`, `sum(total_units_sold)` (one row per ASIN;
     `max` collapses the per-ASIN traffic values repeated on the ASIN's SKU rows).
   - **(c) 30-day sales per ASIN (ranking input):** `from`/`to` = the 30 calendar days
     ending yesterday (sales are ~1 day behind), independent of the anchor - say the dates;
     `groupBy [child_asin, product_name]`,
     `sum(total_sales)`, `sum(total_units_sold)` (one row per ASIN). Keep ASINs with
     `total_units_sold > 0` over the window - this is a **flag precondition, not just a
     ranking input**: the profit table also carries traffic-only ASIN-days (rows with a null
     `sku`, e.g. variation parents with page views and no offer), and without this filter 3
     of the 4 ASINs that cleared the traffic floor in testing were parents showing a fake
     100% loss. No traffic columns in this shape - a `max` over 30 days returns the busiest
     day, and a `sum` double-counts SKU rows.
   - **Candidates for (d):** every ASIN that sold in the window (c), has a non-null `sku`
     row on the anchor day, **bb_now < 95**, and anchor-day `total_page_views` >= 8 (8 x 7 is
     the smallest anchor-day read that can plausibly reach 50 over the week). This - not
     "the flagged ASINs" - is the set (d) is pulled for: the flag rule's 7-day floor needs
     (d) first, so pulling (d) only for flagged ASINs is circular and silently drops the
     ASINs that only clear the 7-day floor (one re-test: 12 anchor-day page views / 56 over
     7 days, and 10 / 69 - both real). Size on a 1,200-selling-ASIN account: 23 ASINs,
     ~160 rows.
   - **(d) 7-day trend for the candidates (mandatory):** the 7 complete days ending on
     the anchor, `groupBy [date, child_asin]`, `filters: child_asin in (...)` limited to the
     candidates, `max(avg_buybox_percentage)` + `max(total_page_views)` per ASIN-day
     (one value per ASIN per day - never `sum` or `avg` across its SKU rows) ->
     **bb7** = page-view-weighted bb over the 7 days (`sum(bb x page_views) /
     sum(page_views)`, summed across the 7 days), to tell "just lost it" from "chronically
     low" and to confirm the anchor-day read is not a one-day dip on a handful of page
     views.
   - **Flag** an ASIN as a *current* buy-box loss only if it is a candidate AND clears the
     traffic floor (anchor-day `total_page_views` >= 20, or 7-day `total_page_views` >= 50
     from (d)). **bb_now < 80 = loss**; 80 <= bb_now < 95 = **sharing** (listed below the
     losses, worth a line on a hero ASIN). Label by trend: bb7 >= 90 and bb_now < 80 =
     "just lost it", bb7 < 90 = "chronically low". Never flag on the 30-day average alone
     (a 30-day mean flags ASINs that dipped and have since recovered). An ASIN with **no row
     on the anchor day** is "no data that day", not 0%: use its own latest day within the
     last 7 complete days and mark the date; if none, report "no recent buy-box read".
     Report the count of selling ASINs without an anchor-day row and their 30-day sales as
     a single line (observed: 495 ASINs, GBP 9.3k) - they are not losses, they are
     unmeasured.
4. `exports_create` on `amazon_fba_inventory_health` **twice** for the flagged ASINs
   (`sku`, `child_asin`, `your_price`, `featuredoffer_price`,
   `lowest_price_new_plus_shipping`, `available`, `filters: child_asin in (...)`; the table
   requires a date range and keeps daily history; paginate with `skip` if a day exceeds the
   cap):
   - `from = to = anchor day` - the **price snapshot** that pairs with bb_now (same moment).
   - `from = to = max available date` (usually today) - the **latest stock snapshot**.
     Mandatory, not optional: the buy-box read is a lagged anchor (9-13 days behind on real
     accounts) and a stockout is a today-problem. On one re-test the only two hard losses
     (22 -> 0 units and 6 -> 0 units, `your_price` 0 on the latest day) were visible *only*
     in this pull. Also use it to say whether a price gap still exists today.
5. Join inventory onto the ASIN with **matching time bases**: pair the anchor-day price
   snapshot with **bb_now** (same day), never the 30-day average or a snapshot taken days
   later - both sides of the join must describe the same moment. `amazon_fba_inventory_health`
   can have several SKUs for one `child_asin`. Do not collapse those rows or average `your_price`.
   `child_asin` is the primary join key (the buy box is an ASIN-level read); the profit
   table also carries `sku`, so when an ASIN has several SKUs you can join on `sku` to put
   each SKU's own 30-day sales next to its price row.
   - Price (anchor-day snapshot): for each in-stock SKU (`available` > 0; a null
     `available` is unknown, not 0) with `your_price > 0` (0 means missing, not free), gap
     = `your_price - featuredoffer_price`. If several SKUs are in stock, show each. Then:
     - gap > 0 -> **priced out (+gap)**; fix: match/beat `featuredoffer_price`.
     - gap == 0 and 0 < bb_now < 100 -> **shared Featured Offer at matched price**; fix:
       another seller is on the listing at your price - check the offers on the listing in
       Seller Central; this is an enforcement/offer question, not a price cut.
     - gap == 0 and bb_now == 0 (traffic floor cleared) -> **lost at matched price**;
       verify the featured offer is not yours (a competitor matched your price).
   - Stock (latest snapshot from step 4): when every in-stock SKU of the ASIN now has
     `available = 0` (nulls excluded), report **stock (as of {latest date})** with the full
     30-day sales exposed - even when the anchor-day read was fine. If the anchor-day
     snapshot already showed 0, say "out of stock since at least {anchor}".
   - Fulfilment/health check: **residual only** - no price row at all, or price and stock
     both fine and bb_now == 0.
6. Rank by sales at risk (30d sales x (1 - bb/100); a current stockout exposes the full
   30d sales) and render.

## Output format

```
Buy Box Loss - {marketplace} - buy-box as of {anchor day} (traffic lag {n}d{, gap: dates missing}; later days provisional)  (sales: 30 calendar days ending {yesterday})
Traffic floor: {pv} page views on the anchor day / {pv7} over 7d · thresholds: < 80 loss, 80-94 sharing · {k} ASINs with no anchor-day row (no data that day)

SKU                 BB%(now) BB%(7d) PV   Sales    Likely cause                               Fix
{sku}               {bb}%    {bb7}%  {pv} {cur}..  priced out (+{cur}gap)                     match/beat {cur}{feat}
{sku}               {bb}%    {bb7}%  {pv} {cur}..  shared Featured Offer at matched price     check offers on the listing (enforcement, not a price cut)
{sku}               {bb}%    {bb7}%  {pv} {cur}..  lost at matched price                      verify the featured offer is not yours
{sku}               {bb}%    {bb7}%  {pv} {cur}..  stock (as of {latest date})*               restock (see restock skill)
{sku}               {bb}%    {bb7}%  {pv} {cur}..  fulfilment/health (residual)               check FBM/AHR

* stock judged on the latest snapshot ({latest date}), not the anchor day; full 30d sales exposed.
Sharing (80-94%, hero ASINs only): {sku} {bb}% / {bb7}% - {cause}
Biggest sales at risk: {sku} ({cur}.. exposed).
```

## Worked example (illustrative)

The calibration shows sales complete through yesterday but account-level sessions at a
third of their trailing median on the last two days - so the anchor is three days back,
the last day whose traffic is complete. Reading each ASIN's **anchor-day** buy-box % (not
a 30-day average), confirmed by the 7-day trend and the traffic floor, surfaces the ones
losing the box *now* with real traffic - a SKU that dipped mid-month but sits at 98% on
the anchor day is not flagged, and neither is one at 75% on 4 page views. An ASIN with
three SKUs shows the same 41% and 310 page views on each SKU row: read once (`max`), not
summed to 930 page views. The skill then joins the anchor-day prices: if `your_price`
12.90 > `featuredoffer_price` 11.95, the cause is "priced out by 0.95" and the fix is to
match/beat 11.95 (or hold price if margin matters more than the box). If `your_price`
18.99 == `featuredoffer_price` 18.99 and the ASIN sits at 81%, the gap of 0 is not a clean
bill: the featured offer *is* this seller's price, so another seller shares the listing at
the same price - "shared Featured Offer at matched price", check the offers, not the
price. And if the latest snapshot shows `available = 0` where the anchor day still had 22
units, the cause is stock as of today, routed to the restock skill with the full 30-day
sales exposed. Same signal, different fix - the skill picks the right one.

## Quality self-check

- Did I apply the traffic floor (anchor-day `total_page_views` >= 20 or 7-day >= 50) so
  a 0% read on a handful of page views is "no data", not a loss?
- Did I anchor on the last day of a contiguous complete run judged on the **traffic**
  column (`total_sessions` from `amazon_profit_by_date` vs its trailing median - not on
  units or sales, not an isolated day after a hole, not `MAX(date)`), and name the anchor,
  lag and gaps?
- Did I take `max()` of `avg_buybox_percentage` / `total_page_views` / `total_sessions`
  per ASIN-day and `sum()` only sales and units, so SKU rows of one ASIN are not
  double-counted?
- Did I key off the anchor-day `avg_buybox_percentage` confirmed by the 7-day trend, NOT a
  30-day average, so recoveries aren't misread as current losses?
- Did I treat ASINs with no anchor-day row as "no data that day" rather than 0%?
- Did I pair the anchor-day price snapshot (`from = to = anchor day`) with the anchor-day
  buy-box read (same time basis)?
- Did I pull the 7-day trend for the **candidate set** (bb_now < 95, anchor-day page views
  >= 8), not only for ASINs already flagged, so the 7-day floor can actually admit an ASIN?
- Did I read a gap of 0 with 0 < bb_now < 100 as "shared Featured Offer at matched price"
  (another seller at my price), not as "price is fine, must be fulfilment"?
- Did I judge stock on the **latest** snapshot, and expose the full 30-day sales on a
  current stockout even when the anchor-day read looked fine?
- Did I use the defined thresholds (< 95 candidate, < 80 loss, bb7 >= 90 "just lost it")
  and the pinned 30-day window (ending yesterday), so another run gives the same list?
- Did I check price gap AND stock before blaming "fulfilment"?
- Did I rank by revenue at risk, not by lowest bb%?
- Did I keep margin in mind (winning the box below cost isn't a win)?

## Common mistakes

- Chasing buy-box on tiny long-tail SKUs (bb 0 but 1 unit/mo) - not worth it.
- Recommending a price cut when the real cause is a stockout.
- Averaging buy-box % across the window - `avg_buybox_percentage` is a daily series; a
  SKU that dipped and recovered reads as a chronic loss. Use the latest-day value (or a
  short trend), not a 30-day mean.
- Summing `total_sessions`, `total_page_views` or `avg_buybox_percentage` across the SKU
  rows of one ASIN - they are per-ASIN values repeated on every SKU row; take `max()` per
  ASIN-day and `sum()` only sales, units and orders.
- Comparing a 30-day average buy-box to a single-day price snapshot - two different time
  bases; pair the anchor day with the anchor day.
- Pulling the full 30-day daily per-SKU series - it blows the 5,000-row cap and
  silently truncates after a few days; use the calibration, anchor-day, 30-day-per-ASIN
  and filtered 7-day shapes from step 3.
- Anchoring on sales completeness - sales are ~1 day behind but the traffic columns lag
  one to two weeks on real accounts and can be revised for 30 days; a day with complete
  sales and half the usual sessions is not complete for buy box.
- Treating gap = 0 as "price is fine" on a shared box - when you hold or share the
  Featured Offer, `featuredoffer_price` is your own price. Gap 0 with 0 < bb_now < 100
  means another seller matches you; routing it to "fulfilment/health" sends the reader to
  the wrong screen.
- Judging stock on the anchor-day snapshot when the anchor is a week old - a stockout is a
  today-problem; pull the latest day and report "stock (as of {date})".
- Pulling the 7-day trend only for already-flagged ASINs - circular with the 7-day floor;
  pull it for the candidate set (bb_now < 95, anchor-day page views >= 8).
- Choosing your own "low" threshold - < 95 candidate, < 80 loss, as defined in
  Configuration; a different cut gives a different list.
- Anchoring on the latest day present when it is isolated after a gap - the anchor must
  be contiguous with the days before it.
- Expecting null `avg_buybox_percentage` - the column is never null; it is 0 when there
  was no featured-offer impression. With low page views that is "no data"; with real
  traffic it is a loss. A sole-seller ASIN shows as 0 or 100 depending on impressions, so
  check traffic before flagging.
- Reporting an ASIN that has no row on the anchor day as 0% - it has no data that day.
- Racing a hijacker to the bottom instead of enforcing (flag for enforcement).

## Notes

- Read-only. No auto-repricing (a price change would be `bulk-price-update`, dryRun-gated).
- Buy box is synthesized (no first-class table) - state assumptions in the output.
- A DataDoe skill, built on DataDoe buy-box % + price columns.
