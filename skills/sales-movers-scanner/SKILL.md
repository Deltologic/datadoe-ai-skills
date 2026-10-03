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
  title: Sales Movers Scanner
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
   - **Traffic** - `total_sessions` (or `total_page_views`), per child ASIN per day on
     `amazon_profit_by_sku_and_date`. Down/up means a visibility, rank, ads, suppression,
     or seasonality change. Sales followed the traffic.
   - **Conversion** - there is **no conversion-rate column** on this table; compute it as
     `total_units_sold / total_sessions` (unit session rate) or `total_orders /
     total_sessions` (order rate) per ASIN per window, after aggregating per the
     per-ASIN rule in Configuration. Conversion down/up while traffic held ->
     listing/price/reviews/offer problem or win.
   - **Price / AOV** - sales per unit (`total_sales / total_units_sold`) shifted -> a
     price change, promo, or mix shift, even if units held.
   - **Buy-box** - `avg_buybox_percentage` down is the classic hidden cause of a
     conversion drop (you still get traffic but can't convert it). Always check it on a
     decliner.
   - **Availability** - a mover whose `avg_buybox_percentage` (or conversion) rises *from
     ~0* is usually **back in stock / newly buyable**, not an organic win; label it that
     way. A computed conversion above 100% is a units-per-session quirk (multi-unit
     orders), not a literal rate - don't report it as-is.
3. **Name the dominant driver** per SKU (the lever that explains most of the swing) and
   route it: traffic -> rank/ads/suppression check; conversion -> listing/price/reviews;
   buy-box -> pricing/competitor; price -> confirm the change was intended.
4. **Roll up**: is the catalog move concentrated in a few SKUs or broad? One suppressed
   hero SKU vs an across-the-board seasonal dip are very different stories.

**Data-completeness guard (check BOTH windows before you trust any broad move).** Sales
run ~1 day behind (shipped-order sales, refreshed intraday), traffic runs up to 3 days
behind and is revised for up to 30, and both can have mid-window holes, so *either*
window can be under-counted - a lagging recent window fakes a collapse, and an
under-counted prior window fakes a boom (every SKU reads as a riser). Guard both:
- **Normalize by effective days, not calendar days present.** A window's **effective
  days** = sum over its days of (ASINs reporting that day / median daily ASIN count),
  counted from the per-day rows of the window exports (step 4). Two windows are only
  comparable when their effective days are ~equal. If they differ materially (a missing or
  half-loaded day on either side), the delta is an artifact - re-pull/shift the windows or
  state that a window looks under-reported; do NOT report the move as real.
- **Traffic completes later than sales.** `total_sessions`, `total_page_views` and
  `avg_buybox_percentage` come from Amazon's Sales and Traffic report and may be delayed
  by up to 3 days (and revised for up to 30), while sales are ~1 day behind. Judge traffic
  completeness separately from sales (step 3): the newest ~3 days are
  **traffic-provisional even when their sales are complete**, and a traffic-driven
  "decline" confined to those days is the lag, not a move. Say so in the output whenever
  the recent window includes them.
- **The uniform-move tell.** If *most* SKUs move by a *similar* amount in the *same*
  direction and *all* read as "traffic" (sessions up/down ~uniformly), that is almost
  always an incomplete window on one side, not a real catalog swing. A real move is
  concentrated in specific SKUs with mixed drivers (traffic here, buy-box there), not a
  flat uniform shift everywhere.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (resolve by table name with `exports_sources_get`). Both are premium
  export (5 AI Tokens instead of 2; always-on default dataset, never disabled) - do not
  print the token cost in the output - and both have `requiresDatePeriod: true`, so
  top-level `from` / `to` are mandatory on every export (a `date` filter does not
  replace them):
  - `amazon_profit_by_date` - "Profit by Date", account level, **one row per date and
    currency**: `total_sales`, `total_units_sold`, `total_orders`, `total_sessions`.
    Used only to calibrate completeness and find the window end (step 3).
  - `amazon_profit_by_sku_and_date` - "Profit by SKU & Date", **one row per SKU, child
    ASIN and date**: the outcome (`total_sales`, `total_units_sold`, `total_orders`) and
    the funnel (`total_sessions`, `total_page_views`, `avg_buybox_percentage`) side by
    side, plus `child_asin`, `sku`, `product_name`. It replaces the deprecated Sales &
    Traffic by ASIN & Date table this skill used to build on.
    **Per-ASIN aggregation rule:** `total_sessions`, `total_page_views` and
    `avg_buybox_percentage` are "for the child ASIN on this date" and are **repeated on
    every SKU row of that ASIN** - grouping by `child_asin` and summing them
    double-counts every ASIN with more than one SKU. Group by `[date, child_asin, ...]`
    and take `max()` for those three; `sum()` is only right for sales, units and orders.
    Conversion is not a column: compute `total_units_sold / total_sessions` in code.
    `total_sales` is shipped-order sales, VAT-inclusive where Amazon reports prices with
    tax (`sales_tax` holds the tax part if an ex-VAT view is wanted).
- Windows: compare a recent window to the prior equal window (e.g. last 7 days vs the 7
  before). **Sales run ~1 day behind** (the newest day is still filling as orders ship),
  **traffic up to 3 days**, and holes happen - never assume a fixed offset. Detect the
  last complete day dynamically (see workflow step 3) - it is the **end of the latest
  contiguous run of complete days**, not an isolated complete day sitting after a hole -
  and end both windows there, so you compare two equally-complete windows, not a full
  week against a half-reported one.
- Currency/marketplace: read `marketplace_country_code` and `currency`; keep each
  marketplace in its own currency and scan them separately - never sum sales across
  currencies.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> resolve the `sourceId` of `amazon_profit_by_date` (query
   "profit by date") and of `amazon_profit_by_sku_and_date` (query "profit by sku"),
   confirming each hit on `tableName`. Both are in the always-on default dataset, so
   there is no deprecation warning to carry into the output header.
3. **Calibrate completeness first - don't assume a lag.** `exports_create` once on
   `amazon_profit_by_date` over a wide span (~30 days) with `groupBy: ["date",
   "currency"]` (rows are per date *and* currency) and aggregations `sum(total_sales)` as
   `sales`, `sum(total_units_sold)` as `units` and `max(total_sessions)` as `sessions`
   (account-level rows are already one per date and currency, so `max` just carries the
   day's value through), `orderByColumn: date`, JSON, `limit: 100`. One call, one row per
   day per currency (~23-30 rows each). This table is account level - there is no
   per-ASIN row count here; the per-day ASIN counts for effective days come free from the
   per-day window exports in step 4. From the per-day values:
   - **Median daily sales, units and sessions** for the account over the span (leave the
     newest 3 days out of the medians), and a **full-day threshold = ~60% of each
     median** - relative and per-account, never a fixed amount.
   - **Sales-complete day** = a `date` whose `sales` *and* `units` are at or above their
     threshold. Expect the newest day (sometimes two) to miss it - that is the normal
     ~1-day shipped-sales lag, not an outage; a day under the threshold inside the span is
     a hole. Optional cross-check: add `sum(unshipped_sales)` - a day where it is a large
     share of `total_sales` is still filling.
   - **Traffic-complete day** = a `date` whose `sessions` are at or above their
     threshold - judged **separately**, because traffic can lag up to 3 days and be
     revised for up to 30. Expect a traffic tail of ~3 days behind the sales tail.
   - **Last complete day (window end)** = the latest date D such that D and the 6 days
     before it are all sales-complete - i.e. the end of the latest contiguous complete
     run. An isolated complete day after a hole is **not** an anchor (e.g. complete
     08-30..09-20, hole 09-21..09-24, one day 09-25 -> window end 09-20, not 09-25). If
     no 7-day contiguous run exists in the span, widen the span once; failing that,
     anchor to the latest complete day and flag the scan provisional.
   - **Traffic window end** = the end of the latest contiguous run of traffic-complete
     days. When it is earlier than the sales window end, either end both windows at the
     traffic end (one clean comparison; preferred when the user wants the drivers) or
     keep the sales end and mark sessions / conversion / buy-box for the days after the
     traffic end as **provisional** in the output. State which you did.
   - **Gap days** = any `date` inside a window below the threshold, including mid-window
     holes, not only the lagging tail - flag and exclude them.
   End both windows at the window end found above.
4. **Pull both windows per day and per ASIN** from `amazon_profit_by_sku_and_date`
   (CSV, `limit: 5000`, `from` / `to` mandatory): `groupBy [date, child_asin,
   product_name]` (add `marketplace_country_code` or `currency` to `columns` + `groupBy`
   if you need them - they are not emitted otherwise) with aggregations `sum(total_sales)`,
   `sum(total_units_sold)`, `sum(total_orders)`, and **`max(total_sessions)`,
   `max(total_page_views)`, `max(avg_buybox_percentage)`** - `max`, not `sum`, because
   those three repeat on every SKU row of the ASIN (see Configuration); `max` collapses
   the duplicates to the ASIN's single daily value. Grouping on `[date, child_asin]`
   rather than the ASIN alone is what keeps that dedupe exact before you add across days.
   **Row budget:** 7 days x ~1,600 ASINs is ~11k rows per window, over the 5,000-row CSV
   cap, so one export per window is **not** enough. Split each window by date into
   **2-day chunks** (4 exports per window - 2+2+2+1 days - at ~3,200 rows each, 8 exports
   in total; fire them concurrently and poll together). If any chunk returns `rowCount`
   equal to the limit, page it with `skip: 5000` on the same query (same `orderByColumn`)
   or split it to single days, and never treat a chunk that hit the cap as complete.
   Then **aggregate per ASIN per window in code**: sum `total_sales`, `total_units_sold`,
   `total_orders`, `total_sessions` and `total_page_views` across the window's days;
   average `avg_buybox_percentage` across the days (weight by `total_page_views` if you
   want the page-view-weighted share); conversion = units / sessions; price = sales /
   units. Also count distinct `child_asin` per `date` from these rows - that is the day
   ASIN count step 5 needs.
5. **Check both windows for completeness** (see the guard): compute each window's
   **effective days** = sum over its days of (day ASIN count / median daily ASIN count
   across both windows). If the two windows' effective days differ materially, or either
   has gap days, the comparison is apples-to-oranges - do not report the delta as real.
   **Shift rule:** move both windows back, keeping them adjacent and equal, so the recent
   window ends on the last day of the longest contiguous complete run from step 3 (e.g.
   09-19..09-25 vs 09-12..09-18 at 2.9 vs 6.9 effective days -> 09-14..09-20 vs
   09-07..09-13 at 6.9 vs 6.9), re-pull step 4 and recompute. Report the shift in the
   output header ("windows shifted back to end {date}: later days incomplete"). Only if
   no complete pair exists, flag the scan provisional and say which window is
   under-reported.
6. **Join on child ASIN** and compute per SKU: sales change (abs + %), and the change in
   sessions, conversion (units / sessions), price-per-unit and buy-box.
7. **Rank by absolute sales change**; take the top gainers and top decliners.
8. **Decompose each** to its dominant driver (traffic / conversion / price / buy-box) and
   attach the lever. Add the catalog roll-up (concentrated vs broad).

## Output format

```
Sales Movers - {marketplace} - {recent window} vs {prior window}   (ends {last complete day}; both windows complete)
{if shifted: "Windows shifted back to end {date} - data after it is incomplete (lag {n} days)."}
{if the recent window includes days after the traffic window end: "Sessions / conversion / buy-box for {dates} are provisional - Amazon traffic data lags up to 3 days and may be revised."}
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
and its `avg_buybox_percentage` dropped from ~95% to ~40% -> **buy-box loss** is the cause
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
- Did I detect the last complete day dynamically (not assume a fixed lag), anchor at the
  end of a contiguous complete run, and check BOTH windows for completeness / equal
  effective days before trusting the delta - shifting both back and reporting it if not?
- Did I take `max()`, not `sum()`, for sessions / page views / buy box when grouping SKU
  rows to the ASIN, and compute conversion as units / sessions (there is no rate column)?
- Did I judge traffic completeness separately from sales and mark the newest ~3 days of
  sessions / conversion / buy-box provisional when a window includes them?
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
  incomplete window on one side; shift both windows back to the end of the latest
  contiguous complete run and re-pull, or flag it - don't cry wolf.
- Anchoring the windows to an isolated complete day that sits after a hole (a 3/7 recent
  week reads as -58%), or pulling a whole 7-day window per ASIN per day in one export and
  counting ASINs from a file truncated at the 5,000-row cap - chunk the window by date.
- Summing `total_sessions` / `total_page_views` / `avg_buybox_percentage` across the SKU
  rows of one ASIN - they repeat per SKU, so multi-SKU ASINs double-count; group by
  `[date, child_asin]` and take `max()`.
- Reading a sessions drop on the newest ~3 days as a traffic move - that is the Amazon
  traffic-report lag; sales complete ~1 day behind, traffic up to 3.
- Calling a buy-box/conversion rise from ~0 an organic win when it's back-in-stock, or
  reporting a >100% conversion rate literally (units-per-session quirk).

## Notes

- Read-only (analysis). Fixes that follow (price, listing, ads) are separate write
  skills, each dryRun-gated.
- Complements the weekly business review (account-level) and the buy-box root-cause
  skill (buy-box only) - this is the catalog-wide, cause-attributed mover scan.
- A DataDoe skill, built on DataDoe's Profit by SKU & Date data (sales, sessions, page
  views, buy-box per child ASIN per day) with Profit by Date for completeness calibration.
