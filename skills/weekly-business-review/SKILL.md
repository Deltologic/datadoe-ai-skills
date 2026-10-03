---
name: weekly-business-review
description: >-
  Generate a weekly Amazon BUSINESS review - profit, margin, ad efficiency (TACoS) and inventory - comparing this week to your trailing 4-week normal, explaining any margin/fee anomaly, and ending in concrete actions. Use for "weekly business review", "weekly profit review", "weekly P&L", "how is the business doing", "what changed and why", "is my margin or TACoS ok", "profit this week". For a quick sales-only snapshot, use the Weekly Sales Briefing instead.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Weekly Business Review
  access: read
  category: Profit & Finance
  interface: mcp
  output: report
---

# Weekly Business Review

The Monday-morning business review: one card across profit, margin, ad efficiency
(TACoS) and inventory that compares this week to your **normal** (a trailing
baseline, not just last week), explains any margin/fee anomaly, and ends in the few
actions worth doing. This is the deep profit/diagnosis review - for a quick
sales-only snapshot use the **Weekly Sales Briefing** instead. Live from DataDoe.

## When to use this

- Every Monday, or the start of any week - the deeper profit/business review.
- The single "how's the business doing, what changed, why, what do I do" read.
- Trigger phrases: "weekly business review", "weekly profit review", "weekly P&L",
  "how is the business doing", "what changed and why", "is my margin ok",
  "is my TACoS ok", "profit this week". (For plain "sales this week" / "weekly sales
  report", the Weekly Sales Briefing is the right skill.)

## The framework. Period integrity -> baseline -> anomaly -> movers -> 3 actions

1. **Get the period right first (or every number below is a lag artifact).** Lag varies
   by account and by source: the profit tables are INTRADAY (refreshed ~10am / 1pm / 4pm)
   with ~1 day of lag observed on sales, while their traffic columns trail by one to two weeks (8 days with a 4-day hole
   measured; Amazon's own note says up to 3) and older sources lagged 6+ days with mid-series gaps. Never assume "this week = the last 7 calendar
   days" or a fixed lag - detect the **last complete day dynamically** (see workflow),
   anchor both week windows to it, and count each week's **effective (complete) days**.
   If a week is missing days, normalize by effective days or mark it **provisional** -
   never present a partial week's drop as a real move. (Same completeness guard as the
   Sales-Movers and Buy-Box skills; the lag it detects differs per source.)
2. **Compare to normal, not just last week.** Show this week vs the **trailing
   4-week median** (median, not mean - one anomalous week shouldn't move the
   baseline) as the primary signal, plus last week for context, plus a small 6-8
   week trend. A single week is noisy; the baseline keeps the headline honest.
3. **Explain the anomaly - and check it's real.** If margin or TACoS deviates
   materially from baseline (e.g. > 5pp), decompose *why* using the cost columns as
   % of sales - `sales_tax` % (VAT, ~16.7% of sales on UK/EU accounts; 0 on US/CA),
   total fees % (of which FBA % and referral %), COGS %, ad %, `refund_cost` %. The
   lines sum to 100% - margin, so the decomposition reconciles only with `sales_tax`
   in it; omit it and a UK review infers a +16.7% margin where the real one is
   negative. Name the driver. **Then apply the
   settlement-timing test:** Amazon books fees on *settlement date*, not sale date,
   so `profit_by_date` weekly margin is lumpy - a fee spike concentrated in 1-2 weeks
   on otherwise-flat sales is usually a settlement batch, not a real cost increase.
   Say so, and flag it for reimbursement / fee review (reconcile the fee rows by
   `order_date` in `amazon_settlements_with_cogs`) before the seller panics. Sales, units and ad spend are sale-dated and
   reliable weekly; **margin is only trustworthy over a trailing 4-week window.**
4. **Movers.** Biggest SKU profit gainers/droppers this week vs last.
5. **Do this week.** 3 concrete actions, each pointing to the deeper skill.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources:
  - `Profit by Date` (`amazon_profit_by_date`) - account-level daily rows that the
    review buckets into weeks itself, plus the cost breakdown (`total_sales`, `profit`,
    `ad_spend`, `cogs_total`, `total_fees`, `fba_fees`, `total_selling_fees`,
    `sales_tax`, `refund_cost`, `total_units_sold`). `profit` is already
    `total_sales - sales_tax - total_fees - cogs_total - ad_spend + refund_cost`.
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`) - per-SKU movers.
  - Optional: `FBA Inventory Health` (`amazon_fba_inventory_health`) for stockout watch-outs.
  - Optional, for traffic / conversion / buy-box watch-outs: the traffic columns already
    on the two profit tables - `total_sessions`, `total_page_views`,
    `avg_buybox_percentage` per `date` on `amazon_profit_by_date` (account level) and
    per SKU / child ASIN on `amazon_profit_by_sku_and_date`. No extra source is needed.
    Two rules: (1) on the per-SKU table these three columns are **per child ASIN and
    repeated on every SKU row** of that ASIN - take `max()` per `child_asin`, never
    `sum()` (summing double-counts every multi-SKU ASIN); (2) the traffic columns may be
    **delayed by days to weeks (8 days measured) and revised for 30 days**, while sales lag
    ~1 day - so a conversion rate (units / sessions) for the days after the last
    traffic-complete day is provisional, and a
    week's sessions can still move after the review is written.
- **Daily data lag - detect it, don't assume it.** The profit tables are INTRADAY
  (`exports_source_get` reports refreshes at ~10am / 1pm / 4pm) and lag about 1 day on
  sales: the newest date is a partial day and the day before it is usually sales-complete
  but may still be missing fees. Older sources lagged 6+ days with every-other-day gaps;
  these do not. Either way, do NOT just "drop the partial current week": detect the last
  complete day dynamically and measure each week's effective days (see workflow). **On
  the profit sources, measure completeness by daily sales value, not row count** - rows
  backfill (all SKUs appear at ~full count) before the sales/profit values settle, so a
  row-count test falsely marks a settlement-incomplete day as complete - **and check fee
  completeness separately** (fees post after sales; see step 3). If the review reads the
  traffic columns, treat them as a third completeness tier: a day can be sales- and
  fee-complete while `total_sessions` is still zero or partial for a week or more - detect
  the last traffic-complete day from the daily `total_sessions` the same way, and label
  any conversion / buy-box figure that includes later days provisional.
- **Weekly buckets are built in code, not with `dateInterval WEEK`.** `dateInterval WEEK`
  returns fixed Sunday-start calendar buckets regardless of `from`, and its newest bucket
  includes the partial current day; no request parameter shifts the boundary to the last
  complete day. Pull daily rows and sum 7-day windows ending on the last complete day.
- Currency: read `currency`, localise; if the connection spans currencies, group by
  `currency` and report the main one (never sum across currencies).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm sources `enabled`. `amazon_profit_by_date`,
   `amazon_profit_by_sku_and_date` and `amazon_fba_inventory_health` are **premium**. Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and stop (or drop that section); never render zeros.
3. **One daily export, then calibrate completeness (don't assume a lag).** `exports_create`
   once on `amazon_profit_by_date`, the last ~63 days plus a few days of slack (8 weeks of
   trend + the 4 baseline weeks), `groupBy [date, currency]`, sum `total_sales`, `profit`,
   `ad_spend`, `cogs_total`, `total_fees`, `fba_fees`, `total_selling_fees`, `sales_tax`,
   `total_units_sold` with distinct aliases (`sum(profit) as profit_sum`; `as profit` errors
   `ALIAS_COLLISION`). This single export feeds steps 3-7; do not add `dateInterval WEEK`
   (see Configuration). On the profit sources the completeness signal is **daily sales
   value, NOT row count** - rows backfill (all SKUs appear at ~full count) before the
   sales/profit values settle, so a day can pass a row-count test yet hold only a fraction
   of its real sales (observed: a day with ~1,450 rows but £143 sales vs a normal ~£8,000).
   From the daily `total_sales`: the **median daily sales**, a **full-day threshold ~60% of
   median daily sales** (relative, per-account), the **last complete day** (latest date
   at/above threshold, walking back from the tail - the lag is whatever this detects; ~1
   day on the profit tables, more on other sources), and **gap days** (any date below
   threshold, including mid-series holes). (Row count is a fine secondary sanity check,
   but sales value is authoritative here.) Anchor "this week" = the 7 days ending on the
   last complete day, "last week" = the 7 before that.
   **Fee-completeness check (beside the sales test).** Fees post after sales, so a day
   can be sales-complete with fees still missing. For each candidate day compute
   `total_fees / total_sales` and compare it with the median of that ratio over the 5
   preceding complete days: if the day's ratio is below ~80% of the trailing ratio, its
   fees have not posted yet. Observed: the newest sales-complete day passed the sales test
   at 71% of median sales but had fees at 39% of sales vs ~50% normal, turning the week's
   margin from -3.98% to -3.06% and flipping the WoW margin delta's sign. Either exclude
   such a day from "this week" for margin / TACoS / profit (sales and units may keep the
   sales anchor) or label the week's margin **provisional** and say which day is
   fee-incomplete.
4. **Weekly account trend + cost mix, bucketed in code.** From the step-3 daily rows, sum
   8 consecutive 7-day windows ending on the last complete day (this week = days -6..0,
   last week = -13..-7, and so on) per currency; recompute margin and TACoS per bucket from
   the sums. Do NOT use `dateInterval WEEK`: it produces fixed Sunday-start calendar
   buckets whose newest bucket includes the partial current day and whose oldest is
   clipped by `from`, and it cannot be anchored to the last complete day. Carry the fee
   decomposition columns (`total_fees`, `fba_fees`, `total_selling_fees`, `cogs_total`,
   `sales_tax`, `ad_spend`) through the same buckets so step 7 can read them.
5. **Effective-days guard (both weeks).** For "this week" and "last week", compute
   **effective days** = count of days present at/above the threshold. If a week has < 7
   effective days, either normalize the comparison per effective day OR mark that week
   **provisional** and state how many days it reflects - never present a partial week's
   delta as a real move. If the two weeks' effective days differ materially, the raw Δ is
   an artifact; flag it. (Check BOTH weeks - an under-counted prior week distorts the Δ
   just as much as a partial current one.)
6. **Baseline:** latest complete week = "this week"; prior = "last week"; baseline =
   **median** of the 4 complete weeks before this one (skip or flag any baseline week that is
   itself under-counted). For each KPI show this week, the Δ vs last week, and the Δ vs
   baseline. Recompute margin = profit/sales and TACoS = ad_spend/sales per week (never
   sum ratios); if a week is provisional, label its margin/TACoS provisional too - don't
   average a rate over missing days.
7. **Anomaly drill:** if this week's (or a recent week's) margin/TACoS is > ~5pp off
   baseline, express each cost as % of sales per week - `sales_tax`% (VAT; 0 on US/CA),
   total_fees% (of which fba_fees% and `total_selling_fees`% - subsets, never added on
   top), COGS%, ad%, `refund_cost`% - and check they reconcile: the lines sum to
   100% - margin. Identify which line moved - that is the cause. Report it in plain words.
8. **Movers (full per-SKU totals, diffed client-side).** `exports_create` twice on
   `amazon_profit_by_sku_and_date` - once for this week, once for last week (the windows
   anchored in step 3) - `groupBy [sku, product_name]`, sum `profit`, `total_sales`,
   `total_units_sold` with distinct aliases (`profit_sum`, `sales_sum`, `units_sum` -
   `as profit` errors `ALIAS_COLLISION`), format CSV with `limit 5000` (JSON caps at 1,000
   rows, CSV at 5,000; page with `skip` if the account has more SKUs than that). Drop rows whose `sku` is null (account-only
   ad rows) and diff by SKU in code -> top gainers/droppers by Δ profit, and say how many SKUs appear in only
   one week. Do NOT pull a top-N by profit per week (e.g. `limit ~200 DESC`): on a
   ~3,000-SKU account only 97 of 200 SKUs overlapped between the two weeks, and any SKU
   that went from positive to negative - the dropper a reviewer most wants - falls out of
   this week's list and cannot be diffed at all. There is no server-side order by change,
   so the full pull is the only reliable shape.
9. Render the HTML card.

## Output format (interactive HTML card)

Render a single self-contained HTML card (KPI tiles, a small trend sparkline per
KPI, a movers table, watch-outs, actions). Header "Weekly Insights", footer "Data
via DataDoe". If the client cannot render HTML, fall back to the text layout below.

```
Weekly Insights - {marketplace} - week of {start} (ends {last complete day})   (vs 4-wk avg)
Period: this week = {n}/7 complete days{ - PROVISIONAL if < 7}; gaps: {dates or none}.

            This wk    vs last wk   vs normal(4wk)
Sales       {cur}..    {+/-}%       {+/-}%
Profit      {cur}..    {+/-}%       {+/-}%
Margin      {m}%       {+/-}pp      {+/-}pp
Ad spend    {cur}..    {+/-}%       {+/-}%
TACoS       {t}%       {+/-}pp      {+/-}pp
Units       {u}        {+/-}%       {+/-}%
Trend (8wk): sales ▁▃▆▅▆▇  profit ▆▇▃▁▄▆

Why (if anomaly): margin {m}% vs normal {b}% - driver: {fees/COGS/ads} moved
  from {x}% to {y}% of sales in wk {date}.
  Cost mix (% of sales): VAT {v}%  fees {f}% (FBA {fb}%, referral {r}%)  COGS {c}%  ads {a}%  refunds {rc}%  -> margin {m}%
  Margin provisional if {date} is fee-incomplete (fees {x}% of sales vs ~{y}% trailing).

Top movers   +{sku} {cur}..   -{sku} {cur}..
Watch-outs   {rising TACoS / stockouts / buy-box}
Do this week 1) ...  2) ...  3) ...
```

## Worked example (illustrative)

Suppose this week shows ~62% margin and, versus last week alone, profit looks "up
~10%" - misleading, because last week was itself depressed. The trend + drill tell
the real story: two recent weeks cratered to ~33% and ~18% margin. Decomposing costs
as % of sales, COGS and ad held flat every week - the mover was **fees**, which
jumped from single digits to ~50% of sales for two weeks (FBA fees far above their
normal level). Then the settlement-timing test: that spike is concentrated in two
weeks on otherwise-flat sales - the signature of a settlement batch (fees for earlier
sales landing later), not a real cost jump. So the card concludes: "the margin dip is
a fee-settlement batch, not an operational problem; flag for reimbursement / fee review
by order_date," and treats weekly margin as indicative only. That is the
difference between a scary wrong number and a correct insight.

## Quality self-check

- Did I detect the last complete day dynamically (not a fixed lag / last-7-calendar-days)
  and anchor both weeks to it - bucketing the daily rows in code, not with
  `dateInterval WEEK`?
- Did I run the fee-completeness check (day's `total_fees / total_sales` vs the trailing
  5-day ratio) and exclude or label as provisional a day whose fees have not posted?
- Did I compute effective days for BOTH weeks, flag mid-series gaps, and mark a partial
  week provisional rather than reporting a phantom drop?
- Did I diff movers over full per-SKU pulls (CSV `limit 5000`, both weeks), not a top-200
  per week?
- Does the cost mix include `sales_tax` % and reconcile to 100% - margin?
- Did I avoid averaging rate metrics (margin/TACoS) over a partial week?
- Did I compare to the trailing baseline, not just last week (so a noisy prior week
  can't mislead)?
- If margin/TACoS was off, did I name the cost driver, not just flag it?
- Ratios recomputed per week (not summed)?
- Did I end in 3 concrete actions?

## Common mistakes

- Assuming "this week = the last 7 calendar days" or a fixed lag - lag differs per source
  and per column (~1 day on the intraday profit tables' sales, one to two weeks on their
  traffic columns, 6+ days with gaps on older sources); detect the last complete day and
  anchor to it.
- Summing `total_sessions` / `total_page_views` / `avg_buybox_percentage` across the SKU
  rows of `amazon_profit_by_sku_and_date` - they are per child ASIN and repeated on each
  SKU row; take `max()` per `child_asin`.
- Using `dateInterval WEEK` for the weekly trend - it yields fixed Sunday-start calendar
  buckets, the newest including the partial current day; bucket the daily rows in code.
- Treating a sales-complete day as margin-complete - fees post later; run the
  fee-completeness check or the newest day inflates margin.
- Pulling movers as a top-200 by profit per week - SKUs that went negative vanish from
  the list; pull full per-SKU totals (CSV `limit 5000`) for both weeks and diff in code.
- Decomposing costs without `sales_tax` - on UK/EU accounts VAT is ~16-17% of sales and
  the lines will not reconcile to the margin without it.
- Reporting a partial/gappy week's drop as a real collapse - normalize by effective days
  or mark it provisional (check BOTH weeks; an under-counted prior week distorts the Δ too).
- WoW-only headline: last week being abnormal makes this week look great/terrible.
- Reading a single week's margin as real - fees settle in batches; use the trailing
  window for margin and confirm fee spikes in settlements by order_date.
- Flagging "margin dropped" without decomposing which cost moved.
- Summing TACoS/margin/ACoS columns.
- A wall of metrics with no action.

## Notes

- Read-only. Routes to the deeper DataDoe skills for each action.
- A DataDoe skill, built on DataDoe Profit by Date (`amazon_profit_by_date`) + Profit by
  SKU (`amazon_profit_by_sku_and_date`), with the same completeness/lag guard as
  Sales-Movers and Buy-Box.
