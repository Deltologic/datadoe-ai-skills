---
name: sales-movers-scanner
description: >-
  Scan the whole catalog for the SKUs that moved the most this period - up and down -
  and decompose each move into its cause: traffic, conversion, price, or buy-box. Ranked
  by the size of the swing in money, with a data-completeness guard on both windows so a
  lagging or partial week doesn't read as a fake collapse or a fake boom. Live from
  DataDoe, read-only. Use for "what changed", "biggest movers", "why did sales drop",
  "what's up this week", "sales down", "which products dropped", "what moved", or
  "week over week".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  access: read
  category: Reporting
  interface: mcp
  output: report
---

# Sales Movers Scanner

Scans the whole catalog for the SKUs that moved the most this period - up and down - and
**decomposes each move into its cause**: traffic, conversion, price, or buy-box. Instead
of "sales dropped," it tells you "sales dropped because sessions fell 40%" or "because
you lost the buy box" - so you act on the reason, not the symptom. Ranked by the size of
the swing in money, so you see what actually matters. Live from DataDoe, read-only.

## When to use this

- Weekly review: "what changed across my catalog, and why?"
- Revenue is up or down overall and you need the SKUs and reasons behind it.
- Monday-morning triage - a short list of what needs attention, already diagnosed.
- After a price change, ad change, or a competitor move, to see the ripple per SKU.
- Trigger phrases: "what changed", "biggest movers", "why did sales drop", "what's up
  this week", "sales down", "which products dropped", "what moved", "week over week".

## The framework. Rank the movers, decompose the cause

Sales for a SKU are roughly **sessions x conversion x price**. So a change in sales comes
from one (or more) of three levers, and the buy-box sits behind conversion. Compare a
recent window to the prior equal window, then for each big mover decompose:

1. **Size the move** - rank SKUs by the absolute change in sales (money), not by percent
   (a 5% drop on a hero SKU beats a 90% drop on a trickle SKU). Look at gainers AND
   decliners.
2. **Decompose the driver** for each mover:
   - **Traffic** - `sessions` (or `page_views`) down/up -> visibility/rank/ads change,
     a suppression, or seasonality. Sales followed the traffic.
   - **Conversion** - `units_session_percentage` (unit session rate) down/up while
     traffic held -> listing/price/reviews/offer problem or win.
   - **Price / AOV** - sales per unit (`total_sales / total_units`) shifted -> a price
     change, promo, or mix shift, even if units held.
   - **Buy-box** - `buybox_percentage` down is the classic hidden cause of a conversion
     drop (you still get traffic but can't convert it). Always check it on a decliner.
   - **Availability** - a mover whose `buybox_percentage` (or conversion) rises *from
     ~0* is usually **back in stock / newly buyable**, not an organic win; label it that
     way. A conversion reading above 100% is a units-per-session quirk (multi-unit
     orders), not a literal rate - don't report it as-is.
3. **Name the dominant driver** per SKU (the lever that explains most of the swing) and
   route it: traffic -> rank/ads/suppression check; conversion -> listing/price/reviews;
   buy-box -> pricing/competitor; price -> confirm the change was intended.
4. **Roll up**: is the catalog move concentrated in a few SKUs or broad? One suppressed
   hero SKU vs an across-the-board seasonal dip are very different stories.

**Data-completeness guard (check BOTH windows before you trust any broad move).** Sales &
Traffic lags and backfills unevenly, so *either* window can be under-counted - a lagging
recent window fakes a collapse, and an under-counted prior window fakes a boom (every SKU
reads as a riser). Guard both:
- **Normalize by effective days, not calendar days present.** A window's **effective
  days** = sum over its days of (day row count / median daily rows). Two windows are only
  comparable when their effective days are ~equal. If they differ materially (a missing or
  half-loaded day on either side), the delta is an artifact - re-pull/shift the windows or
  state that a window looks under-reported; do NOT report the move as real.
- **The uniform-move tell.** If *most* SKUs move by a *similar* amount in the *same*
  direction and *all* read as "traffic" (sessions up/down ~uniformly), that is almost
  always an incomplete window on one side, not a real catalog swing. A real move is
  concentrated in specific SKUs with mixed drivers (traffic here, buy-box there), not a
  flat uniform shift everywhere.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data source (resolve by table name with `exports_sources_get`):
  - `amazon_sales_and_traffic_with_cogs` - per child ASIN per day: `total_sales`,
    `total_units`, `total_orders`, `session`, `page_views`, `units_session_percentage`
    (conversion), `buybox_percentage`, `product_name`. This one table carries both the
    outcome (sales) and the funnel (traffic, conversion, buy-box) to decompose it.
- Windows: compare a recent window to the prior equal window (e.g. last 7 days vs the 7
  before). **This table lags by a variable amount** (6+ days has been observed, not a
  fixed 4) - never assume a fixed offset. Detect the last complete day dynamically (see
  workflow step 3) and end both windows at/before it, so you compare two equally-complete
  windows, not a full week against a half-reported one.
- Currency/marketplace: read `marketplace_country_code`; keep each marketplace in its own
  currency and scan them separately - never sum sales across currencies.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm `amazon_sales_and_traffic_with_cogs` is `enabled`.
3. **Calibrate completeness first - don't assume a lag.** `exports_create` once over a
   wide span (~30 days) `groupBy [date, child_asin]`, then count the **records per `date`**
   (the number of ASINs reporting that day) to get each day's row count. From those counts:
   - **Median daily row count** for the account, and a **full-day threshold = ~60% of the
     median** - relative and per-account, never a fixed count like "~1300".
   - **Last complete day** = the latest `date` at or above the threshold (walk back from
     the tail). The lag is whatever this detects - 6+ days has been observed, not 4.
   - **Gap days** = any `date` inside a window below the threshold, including mid-window
     holes, not only the lagging tail - flag and exclude them.
   End both windows at/before the last complete day.
4. **Pull both windows:** `exports_create` twice (recent + prior equal window), each
   `groupBy [child_asin, product_name]`, summing `total_sales`, `total_units`,
   `session`, `page_views`, and averaging `units_session_percentage` and
   `buybox_percentage`. (These `avg()` aggregations are supported; a first-attempt failure
   is a transient backend blip - retry, it is not a query-shape problem.)
5. **Check both windows for completeness** (see the guard): compute each window's
   **effective days** = sum over its days of (day row count / median daily rows). If the
   two windows' effective days differ materially, or either has gap days, the comparison
   is apples-to-oranges - re-pull/shift or flag it; do not report the delta as real.
6. **Join on child ASIN** and compute per SKU: sales change (abs + %), and the change in
   sessions, conversion, price-per-unit and buy-box.
7. **Rank by absolute sales change**; take the top gainers and top decliners.
8. **Decompose each** to its dominant driver (traffic / conversion / price / buy-box) and
   attach the lever. Add the catalog roll-up (concentrated vs broad).

## Output format

```
Sales Movers - {marketplace} - {recent window} vs {prior window}   (ends {last complete day}; both windows complete)
Net catalog change: {cur}{delta} ({pct}%)   ·   concentrated in {k} SKUs / broad

TOP DECLINERS (by money lost)
  SKU / ASIN      sales (was -> now)   driver              detail                 lever
  {sku}           {cur}.. -> {cur}..   traffic -{x}%       sessions {a}->{b}       rank/ads/suppression
  {sku}           {cur}.. -> {cur}..   buy-box -{x}pp      bb {a}%->{b}%           pricing/competitor
  {sku}           {cur}.. -> {cur}..   conversion -{x}%    CVR {a}%->{b}%          listing/price/reviews

TOP GAINERS (by money gained)
  {sku}           {cur}.. -> {cur}..   traffic +{x}%       sessions {a}->{b}       protect / scale ads

Biggest single swing: {sku} {cur}{delta} - {driver} -> {lever}
```

## Worked example (illustrative)

A weekly scan shows the catalog down modestly, but the decline is concentrated in two
SKUs, not broad. The first: sales down a third while sessions held - conversion fell,
and its `buybox_percentage` dropped from ~95% to ~40% -> **buy-box loss** is the cause
(a reseller/price move), routed to pricing, not copy. The second: sales down with
sessions down the same amount -> a **traffic** problem (check rank/ads/suppression), not
the listing. Meanwhile a gainer doubled on rising sessions -> ads/rank working, protect
it. The output is a short, ranked, already-diagnosed list - not a spreadsheet of every
SKU's delta.

## Quality self-check

- Did I rank by absolute money change, not percent (so hero SKUs surface)?
- Did I decompose each mover into traffic vs conversion vs price vs buy-box, not just
  report the delta?
- Did I check buy-box on every decliner (the classic hidden conversion killer)?
- Did I detect the last complete day dynamically (not assume a fixed lag) and check BOTH
  windows for completeness / equal effective days before trusting the delta?
- Did I say whether the move is concentrated or broad (one SKU vs seasonality)?
- Did I keep each marketplace in its own currency?

## Common mistakes

- Reporting deltas with no cause - the decomposition (traffic/conversion/price/buy-box)
  is the whole point.
- Ranking by percent - tiny SKUs dominate and the real money hides.
- Comparing windows of unequal completeness - a partial recent week fakes a drop, a
  partial prior week fakes a boom. Check effective days on both sides.
- Blaming the listing when sessions fell (that's traffic) or when the buy-box dropped
  (that's pricing/competitor).
- Summing sales across marketplaces/currencies into one number.
- Reacting to a single SKU's noise instead of the ranked, material movers.
- Reporting a broad, uniform, all-traffic move (either direction) as real - that is an
  incomplete window on one side; re-pull at the detected last complete day or flag it,
  don't cry wolf.
- Calling a buy-box/conversion rise from ~0 an organic win when it's back-in-stock, or
  reporting a >100% conversion rate literally (units-per-session quirk).

## Notes

- Read-only (analysis). Fixes that follow (price, listing, ads) are separate write
  skills, each dryRun-gated.
- Complements the weekly business review (account-level) and the buy-box root-cause
  skill (buy-box only) - this is the catalog-wide, cause-attributed mover scan.
- A DataDoe skill, built on DataDoe sales & traffic (sessions, conversion, buy-box) data.
