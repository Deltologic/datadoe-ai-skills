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
   Configuration (**< 95 = candidate, < 80 = loss**) on an ASIN with real traffic = you are
   sharing or losing the box on the anchor day. Use the last traffic-complete day (the
   anchor, step 3a) plus a mandatory 7-day trend, never a 30-day average - averaging masks a
   dip-then-recovery and flags ASINs that already hold the box again.
   **Traffic floor:** flag an ASIN only when its anchor-day `total_page_views` >= 20 (or its
   per-day `total_page_views` summed over the 7-day window >= 50) AND bb_now < 95. A low or
   0% read on 0-5 page views is "no data", not a loss (on one re-test 52 of 70 ASINs flagged
   without the floor had zero page views that day). `avg_buybox_percentage` is never null -
   it is 0 when there was no featured-offer impression. An ASIN with no row on the anchor
   day has "no data that day", not 0%. Both columns are per-ASIN values repeated on every
   SKU row of the ASIN - read them once per ASIN-day (`max`), never summed across SKUs.
2. **Price** - compare `your_price` with `featuredoffer_price` (or `lowest_price_new_plus_
   shipping`) on an in-stock SKU, then confirm with the offers on the listing (step 4b).
   - `your_price > featuredoffer_price` = **priced out** (+gap).
   - `your_price == featuredoffer_price` and 0 < bb_now < 100 = **matched price, box not
     always yours**. A gap of 0 does not clear you - when you hold the box,
     `featuredoffer_price` *is* your own price - but it does not prove a rival either. The
     offers decide which of two causes it is:
     - another seller's offer at a landed price (price + shipping) at or below yours ->
       **another seller at your price** - an offer/enforcement question, not a price cut;
     - you are the only seller, or every other offer is dearer -> **box not always shown** -
       on those page views Amazon showed no Featured Offer (or featured your other offer).
       Check Featured Offer eligibility and whether Amazon judges the price uncompetitive;
       do not tell the seller someone shares the listing. On one UK account all six flagged
       ASINs read gap 0, and the offers showed the seller alone on two and the only rival
       GBP 2-19 dearer on the rest.
   - `your_price == featuredoffer_price` and bb_now == 0 with real traffic = **lost at
     matched price** - confirm with the offers who holds the box.
   The offers table is a snapshot that can be one or two weeks old (one account: 11 days
   before the anchor). Use it whatever its age and print its date; when it is more than 7
   days older than the anchor, prefix the cause with "likely". Only with no snapshot at all
   for the ASIN say "offers not checked" and give both possible causes.
3. **Stock** - `available = 0` = Amazon cannot feature the offer. Judge it on the **latest**
   snapshot (today), not only the anchor day: the buy-box read is lagged, a stockout is a
   today-problem. An ASIN that ran out often loses its page views too, so the stock check
   also sweeps every selling ASIN, not only the flagged ones (step 4c).
4. **Fulfilment/health** - FBM vs FBA and account-health issues also cost the box (flag as
   "check" - not in these tables). **Residual only:** no price row at all, or price and
   stock both fine and bb_now == 0 with no offers data.
Report the first gate that fails, biggest-revenue SKU first.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (no dedicated buy-box table - synthesize):
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`) [premium] - `avg_buybox_percentage`
    (a **per-day series**), `total_sales`, `total_page_views`, `total_sessions`,
    `total_units_sold`, `sku`, `child_asin`, `product_name`. One row per SKU per day;
    `requiresDatePeriod: true` (every export needs `from`/`to`); refreshed intraday with
    sales about 1 day behind. Two rules apply to every export in step 3:
    - **Per-ASIN traffic aggregation:** `total_sessions`, `total_page_views` and
      `avg_buybox_percentage` describe the *child ASIN* on that date and are repeated on
      every SKU row of the ASIN. Group by `child_asin` (plus `date` where needed) and take
      `max()` of those three; `sum()` only sales, units and orders. Summing sessions or buy
      box across SKU rows double-counts.
    - **Traffic completeness, per ASIN:** the traffic columns come from Amazon's Sales and
      Traffic report and lag from 2 days to two weeks (Amazon's own note says up to 3 days),
      with holes of several days, while sales are ~1 day behind. Judge completeness on the
      **per-ASIN rows of this table** (step 3a). Do **not** use the account-level
      `amazon_profit_by_date.total_sessions`: it can show full sessions on days whose
      per-ASIN rows are missing (one UK account: 6,000-7,000 account sessions a day on 26-29
      Sep 2026 with no per-ASIN traffic rows at all), so a hole in the data you actually
      read stays invisible.
    A child ASIN with traffic but no SKU activity that day comes back as a row with a null
    `sku` - variation parents do, but so does a selling ASIN that sold nothing that day,
    which is exactly what a total buy-box loss looks like. Keep those rows.
    `avg_buybox_percentage` is `nullable: false`: expect zeros, not nulls, when there was
    no featured-offer impression. Export cap: 5,000 rows CSV / 1,000 JSON - a 30-day daily
    per-SKU export does not fit on a catalog of more than ~160 selling SKUs, so use the
    export shapes in step 3.
  - `FBA Inventory Health` (`amazon_fba_inventory_health`) [premium] - `sku`, `child_asin`,
    `your_price`, `featuredoffer_price`, `lowest_price_new_plus_shipping`, `available`,
    `inbound_quantity`, `units_shipped_t30`. A daily snapshot that **keeps daily history**
    (`requiresDatePeriod: true`; `from = to = one day` gives that day's snapshot). FBA SKUs
    only - an own FBM SKU on the same ASIN is invisible here. Price lives here, not in the
    profit table. One day is ~7,500 rows on a UK account, over the 5,000-row CSV cap, so
    always filter (`child_asin in (...)`, or the stockout filter in step 4c).
    Treat `your_price = 0` as missing (it is 0 on half to two thirds of the rows), not as a
    price: for that SKU take `amazon_listings_with_cogs.listing_price_value` ([premium]) and
    say it is today's listing price, not the anchor-day price. Leave used-condition and
    `amzn.gr.*` Grade and Resell SKUs out of the price gate - they are priced below new, so
    their negative gap means nothing.
  - `amazon_item_offers` - the offers on the listing: per-offer `SellerId`,
    `IsBuyBoxWinner`, `IsFulfilledByAmazon`, `ListingPrice`, `Shipping` inside the `offers`
    JSON, plus `summary` (offer count, Buy Box prices) and `last_seen_at`. Your own offers
    carry your `marketplace_seller_id` as `SellerId`. Not premium, no date range; a current
    snapshot per ASIN that can be a week or more old - state `last_seen_at`. Filter
    `asin in (...)` for the flagged ASINs. Your own FBM offer can be missing from it; the
    ASIN's non-FBA SKUs and their `listing_price_value` in `amazon_listings_with_cogs` show
    it.
  Premium note (applies to both premium tables above): a premium export costs 5 AI Tokens
  instead of 2 - nothing else differs, and the tables are part of the always-on default
  dataset, so they are never disabled. A 0-row export means no data in the window or an
  initial load still in progress - say which, and for price fall back to
  `amazon_fba_stranded_inventory.your_price` or `amazon_listings_with_cogs.listing_price_value`
  (with `fba_quantity_available` for stock); never render zeros.
- Thresholds (defined once here; use these words in the output):
  - **bb_now < 95 = flag candidate**; **bb_now < 80 = loss**; 80 <= bb_now < 95 = **sharing**.
  - 7-day trend decides the label: **bb7 >= 90 and bb_now < 80 = "just lost it"**;
    **bb7 < 90 = "chronically low"**.
  - Traffic floor to flag: anchor-day `total_page_views` >= 20, or 7-day >= 50.
  - Candidate floor for the 7-day pull: anchor-day `total_page_views` >= 5 (the 7-day floor
    divided by 10, rounded up - low enough that an ASIN with a quiet anchor day but a busy
    week still reaches the 7-day check).
  - **When the user sets a different floor X:** X replaces 20, the 7-day floor becomes 2.5
    x X, and the candidate floor becomes the new 7-day floor divided by 10, rounded up
    (floor 10 -> 7-day 25 -> candidate 3). Say which floors you used.
  - 30-day sales window: the **30 calendar days ending yesterday** (sales are ~1 day
    behind), independent of the anchor.
- Currency/marketplace: localise (e.g. a German marketplace = EUR). The seller list can name
  the UK marketplace `UK` while table columns use `GB` (both seen) - accept either.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> resolve `amazon_profit_by_sku_and_date`,
   `amazon_fba_inventory_health` (both premium, never disabled; if inventory health returns
   0 rows, use the price fallback above) and `amazon_item_offers`.
3. Buy-box reads from `amazon_profit_by_sku_and_date` - do **not** pull the full 30-day
   daily per-SKU series (`groupBy [date, child_asin, product_name]` is ~46k rows on a
   1,500-ASIN catalog vs the 5,000-row cap; the export truncates inside day 4). Every
   per-ASIN export below takes `max()` of the traffic columns and `sum()` of sales/units.
   Run these exports instead, all of which fit the cap:
   - **(a) Calibration, per ASIN:** last 45 days, filter `total_page_views > 0`, `groupBy
     [date]`, `countDistinct(child_asin) as asins_with_traffic` (~45 rows). A date that is
     missing from the result had no per-ASIN traffic at all - count it as 0. A day is
     **traffic-complete** when `asins_with_traffic` >= 80% of the median of the 7 complete
     days before it. **Anchor day** = the newest complete day that ends a run of at least 3
     consecutive complete days; a day standing alone or two days after a hole are not the
     anchor (one re-test: 09-25 sat alone after a 4-day gap; the right anchor was 09-20).
     Rows present with `total_sessions` = 0 are not completeness; the traffic value is.
     Name the anchor, the traffic lag in days from today, and every **hole** (incomplete
     day) in the 30 days before the anchor; every day after the anchor is provisional.
   - **(b) Anchor day per ASIN:** `from = to = anchor day`, `groupBy [child_asin]`,
     `max(avg_buybox_percentage)` -> **bb_now**, `max(total_page_views)` -> anchor-day page
     views, `sum(total_sales)`, `sum(total_units_sold)` (one row per ASIN; take
     `product_name` from (c)).
   - **(c) 30-day sales per ASIN (ranking input):** `from`/`to` = the 30 calendar days
     ending yesterday, independent of the anchor - say the dates; `groupBy [child_asin,
     product_name]`, `sum(total_sales)`, `sum(total_units_sold)`; sum per `child_asin` in
     code if an ASIN comes back on two rows. Keep ASINs with `total_units_sold > 0` - a
     **flag precondition, not just a ranking input**: variation parents carry traffic and
     never sell, and without this filter 3 of the 4 ASINs that cleared the traffic floor in
     one test were parents showing a fake 100% loss. No traffic columns in this shape - a
     `max` over 30 days returns the busiest day, and a `sum` double-counts SKU rows.
   - **Before the floor (report it):** of the selling ASINs from (c) that have an
     anchor-day row in (b), how many read bb_now < 80, and how many of those had 0 page
     views.
   - **Candidates for (d):** every selling ASIN from (c) with an anchor-day row, **bb_now <
     95**, and anchor-day `total_page_views` >= the candidate floor (5 by default). Pull (d)
     for this set, not for "the flagged ASINs": the 7-day floor needs (d) first, so pulling
     it only for flagged ASINs is circular and drops the ASINs that clear only the 7-day
     floor (one re-test: 12 anchor-day page views / 56 over 7 days, and 10 / 69 - both
     real; another run's only real loss had 14 / 84). Size on a 1,200-selling-ASIN account:
     7-23 ASINs, ~50-160 rows.
   - **(d) 7-day trend for the candidates (mandatory):** the **7 most recent complete days
     up to and including the anchor** from (a) - skip hole days, and say so when the window
     had to reach back past a hole - `groupBy [date, child_asin]`, `filters: child_asin in
     (...)`, `max(avg_buybox_percentage)` + `max(total_page_views)` per ASIN-day ->
     **bb7** = page-view-weighted bb over those 7 days (`sum(bb x page_views) /
     sum(page_views)`), to tell "just lost it" from "chronically low" and to confirm the
     anchor-day read is not a one-day dip on a handful of page views.
   - **Flag** an ASIN only if it is a candidate AND clears the traffic floor (anchor-day
     `total_page_views` >= 20, or the 7-day sum from (d) >= 50). **bb_now < 80 = loss**;
     80 <= bb_now < 95 = **sharing**, listed below the losses. Label by trend: bb7 >= 90
     and bb_now < 80 = "just lost it", bb7 < 90 = "chronically low". Never flag on the
     30-day average alone.
   - **No anchor-day row:** selling ASINs with no row on the anchor day are "no data that
     day", not 0%. Report their count and 30-day sales as one line - they are unmeasured,
     not losses (observed: 495-525 ASINs, GBP 9-13k). Stockouts among them are caught by
     step 4c.
4. Inventory and offers (`amazon_fba_inventory_health`: `sku`, `child_asin`, `your_price`,
   `featuredoffer_price`, `lowest_price_new_plus_shipping`, `available`, `inbound_quantity`,
   `units_shipped_t30`):
   - **Latest date first:** `from` = 3 days ago, `to` = today, `groupBy [date]`,
     `count(sku)` -> the newest snapshot date (usually today).
   - **(a) Anchor-day snapshot:** `from = to = anchor day`, `child_asin in (...)` for the
     flagged ASINs and the stockout-sweep ASINs from (c) - the price pairs with bb_now
     (same moment), and the stock tells whether a stockout already existed on the anchor
     day.
   - **(b) Offers:** `amazon_item_offers`, `asin in (...)` for the flagged ASINs,
     `item_condition` New - parse `offers` per ASIN: who holds the Buy Box, every other
     seller's landed price (price + shipping) next to yours, and any second offer of your
     own (an FBM SKU on the same ASIN, sometimes cheaper than the FBA one). State
     `last_seen_at`.
   - **(c) Stockout sweep, latest snapshot:** `from = to = latest date`, filter `available =
     0 AND units_shipped_t30 > 0` (about 90 rows on a UK account), then pull the latest
     snapshot for those ASINs **and** the flagged ASINs (`child_asin in (...)`, one
     export). An ASIN is out of stock when every SKU with a non-null `available` is 0.
     Keep the ones with 30-day sales in (c) of step 3 and report them as stock rows
     whatever their buy-box read: an ASIN that ran out often drops to 0 page views (one
     account's best stock catch went from 30-45 page views a day to 0), so no traffic floor
     can ever admit it, and a 100% read on the anchor day can sit on the last unit. If
     `amazon_listings_with_cogs` shows an Active non-FBA SKU on the ASIN, say "FBA out of
     stock; FBM SKU {sku} still listed".
5. Join inventory onto the ASIN with **matching time bases**: pair the anchor-day price
   snapshot with **bb_now** (same day), never the 30-day average or a snapshot taken days
   later. `amazon_fba_inventory_health` can have several SKUs for one `child_asin` - do not
   collapse those rows or average `your_price`; show each in-stock SKU's price row. Sales
   stay per ASIN (the 30-day export in step 3c is grouped by `child_asin`).
   - Price (anchor-day snapshot): for each in-stock SKU (`available` > 0; a null
     `available` is unknown, not 0) with a price (`your_price > 0`, else the listings price
     as above), gap = `your_price - featuredoffer_price`. Then:
     - gap > 0 -> **priced out (+gap)**; fix: match/beat `featuredoffer_price`.
     - gap == 0 and 0 < bb_now < 100 -> read the offers from 4b:
       - another seller at or below your landed price -> **another seller at your price**;
         fix: check that seller in the offers list - an enforcement/offer question, not a
         price cut;
       - no such seller -> **box not always shown**; fix: check Featured Offer eligibility
         and whether Amazon considers the price uncompetitive; if your own FBM offer is
         cheaper than the FBA one, say that Amazon may be featuring it instead;
       - no offers data -> **matched price, offers not checked**; give both causes.
     - gap == 0 and bb_now == 0 (traffic floor cleared) -> **lost at matched price**; name
       the Buy Box holder from 4b if there is one.
   - Stock (latest snapshot, 4c): out of stock today -> **stock (as of {latest date})** with
     the full 30-day sales exposed - even when the anchor-day read was fine. If the
     anchor-day snapshot already showed 0, say "out of stock since at least {anchor}";
     otherwise "ran out after {anchor}". Show `inbound_quantity`. List the top 10 stock
     rows by sales exposed and give the rest as one line with their count and total (one
     account had 79 stock rows, 53 of them under GBP 50).
   - Fulfilment/health check: **residual only** - no price row at all, or price and stock
     both fine and bb_now == 0 with no offers data.
6. Rank by sales at risk - 30d sales x (1 - bb_now/100), or the full 30d sales on a current
   stockout - across losses, sharing and stock rows, and render.

## Output format

```
Buy Box Loss - {marketplace} - buy-box as of {anchor day} (traffic lag {n}d{, holes: dates with no per-ASIN traffic}; later days provisional)  (sales: 30 calendar days ending {yesterday})
Traffic floor: {pv} page views on the anchor day / {pv7} over 7d{, 7-day window reaches back past a hole} · thresholds: < 80 loss, 80-94 sharing
Before the floor: {b} selling ASINs read < 80% on {anchor day}, {z} of them on 0 page views. After the floor: {l} losses, {s} sharing.

SKU                 BB%(now) BB%(7d) PV   Sales    Likely cause                               Fix
{sku}               {bb}%    {bb7}%  {pv} {cur}..  priced out (+{cur}gap)                     match/beat {cur}{feat}
{sku}               {bb}%    {bb7}%  {pv} {cur}..  another seller at your price ({seller})    check that offer (enforcement, not a price cut)
{sku}               {bb}%    {bb7}%  {pv} {cur}..  {likely }box not always shown (you are the only/cheapest seller{, offers of {date}})   check Featured Offer eligibility
{sku}               {bb}%    {bb7}%  {pv} {cur}..  lost at matched price                      check who holds the box
{sku}               {bb}%    {bb7}%  {pv} {cur}..  fulfilment/health (residual)               check FBM/AHR

Sharing (80-94%), by sales at risk: {sku} {bb}% / {bb7}% - {cause} · {cur}{at risk}
Out of stock today ({latest date}) - full 30d sales exposed, whatever the buy-box read (top 10):
{sku}  {product}  0 units (inbound {n})  {cur}{sales 30d}  {out since at least {anchor} | ran out after {anchor}}{ · FBM SKU still listed}
+ {n} more out-of-stock ASINs, {cur}{total} of 30-day sales
Today's stock for the flagged ASINs: {all in stock | list}. Offers checked: {last_seen_at}.
Unmeasured: {k} selling ASINs ({cur}{sales}) had no row on {anchor day} - no read, not losses.
Biggest sales at risk: {sku} ({cur}.. exposed).
```

## Worked example (illustrative)

The calibration counts ASINs with traffic per day: complete through yesterday-minus-two,
with four days missing entirely the week before - so the anchor is two days back, and the
7-day trend reaches back past the hole. Reading each ASIN's **anchor-day** buy-box % (not a
30-day average), confirmed by the 7-day trend and the traffic floor, surfaces the ones
losing the box with real traffic - an ASIN that dipped mid-month but sits at 98% on the
anchor day is not flagged, and neither is one at 75% on 4 page views. An ASIN with three
SKUs shows the same 41% and 310 page views on each SKU row: read once (`max`), not summed
to 930 page views. The skill then joins the anchor-day prices: if `your_price` 12.90 >
`featuredoffer_price` 11.95, the cause is "priced out by 0.95". If `your_price` 23.49 ==
`featuredoffer_price` 23.49 at 69%, the offers decide: here the only other offer is an FBM
seller at 26.48 + 15.50 shipping, so nobody shares the listing at your price - "box not
always shown", a Featured Offer eligibility check, not an enforcement case. And the stock
sweep finds an ASIN that held 100% on 45 page views with its last unit on the anchor day and
0 today - a stock row with the full 30-day sales exposed, which no buy-box threshold would
have flagged. Same signal, different fix - the skill picks the right one.

## Quality self-check

- Did I judge completeness on the **per-ASIN** rows (`countDistinct(child_asin)` with page
  views > 0, missing dates = 0), anchor on the newest complete day ending a run of 3+, and
  name the anchor, lag and every hole?
- Did I apply the traffic floor (anchor-day `total_page_views` >= 20 or 7-day >= 50, or the
  scaled floors when the user set one) so a 0% read on a handful of page views is "no data"?
- Did I take `max()` of `avg_buybox_percentage` / `total_page_views` / `total_sessions`
  per ASIN-day and `sum()` only sales and units?
- Did I keep null-`sku` traffic rows of selling ASINs (a total loss looks like that) and use
  30-day units sold to drop parents?
- Did I report the before-the-floor count on a stated base (selling ASINs with an anchor-day
  row)?
- Did I pull the 7-day trend for the **candidate set** over the 7 most recent complete
  days, skipping holes?
- Did I check the offers before naming a cause on a matched price - "another seller at your
  price" only when such an offer exists, "box not always shown" when I am alone or
  cheapest?
- Did I run the stockout sweep on every selling ASIN, not only the flagged ones, and expose
  the full 30-day sales on a current stockout?
- Did I use the defined thresholds and the pinned 30-day window (ending yesterday)?
- Did I check price, offers and stock before blaming "fulfilment"?
- Did I rank by revenue at risk across losses, sharing and stock rows, not by lowest bb%?
- Did I keep margin in mind (winning the box below cost isn't a win)?

## Common mistakes

- Chasing buy-box on tiny long-tail ASINs (bb 0 but 1 unit/mo) - not worth it.
- Recommending a price cut when the real cause is a stockout.
- Averaging buy-box % across the window - `avg_buybox_percentage` is a daily series; an
  ASIN that dipped and recovered reads as a chronic loss.
- Summing `total_sessions`, `total_page_views` or `avg_buybox_percentage` across the SKU
  rows of one ASIN - they are per-ASIN values repeated on every SKU row.
- Comparing a 30-day average buy-box to a single-day price snapshot - two different time
  bases; pair the anchor day with the anchor day.
- Pulling the full 30-day daily per-SKU series - it blows the 5,000-row cap and silently
  truncates after a few days.
- Calibrating on `amazon_profit_by_date.total_sessions` - the account total can look
  complete on days with no per-ASIN rows, so the 7-day trend silently loses days and the
  header says "no gap".
- Anchoring on sales completeness, or on the latest day present when it stands alone after
  a hole.
- Telling the seller "another seller shares your listing at your price" from a gap of 0
  alone - on one account the seller was alone or cheapest on every such ASIN. Check the
  offers first.
- Checking stock only for flagged ASINs - an ASIN that ran out loses its page views, so it
  never reaches the flag list; sweep today's stockouts on every selling ASIN.
- Dropping null-`sku` rows on the anchor day - a selling ASIN with traffic and no sale that
  day comes back that way, and a total loss is exactly that.
- Pulling the 7-day trend only for already-flagged ASINs - circular with the 7-day floor.
- Choosing your own "low" threshold - < 95 candidate, < 80 loss, as defined in
  Configuration; a different cut gives a different list.
- Expecting null `avg_buybox_percentage` - it is 0 when there was no featured-offer
  impression. A sole-seller ASIN can read below 100% when Amazon shows no Featured Offer
  on some page views - that is not a rival.
- Reporting an ASIN that has no row on the anchor day as 0% - it has no data that day.
- Racing a hijacker to the bottom instead of enforcing (flag for enforcement).

## Notes

- Read-only. No auto-repricing (a price change would be `bulk-price-update`, dryRun-gated).
- Buy box is synthesized (no first-class table) - state assumptions in the output.
- Inventory Health covers FBA SKUs only; own FBM SKUs (often suffixed `_MFN` / `_Virt`) show
  up in the offers and in `amazon_listings_with_cogs`, not in the price and stock gates.
- A DataDoe skill, built on DataDoe buy-box %, price, offers and inventory columns.
