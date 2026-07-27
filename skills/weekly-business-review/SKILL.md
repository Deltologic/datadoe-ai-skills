---
name: weekly-business-review
description: >-
  Generate a weekly Amazon BUSINESS review - profit, margin, ad efficiency (TACoS) and inventory - comparing this week to your trailing 4-week normal, explaining any margin/fee anomaly, and ending in concrete actions. Use for "weekly business review", "weekly profit review", "weekly P&L", "how is the business doing", "what changed and why", "is my margin or TACoS ok", "profit this week". For a quick sales-only snapshot, use the Weekly Sales Briefing instead.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
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

1. **Get the period right first (or every number below is a lag artifact).** The daily
   data lags (6+ days observed) and has mid-series gaps, so never assume "this week = the
   last 7 calendar days" or a fixed lag. Detect the **last complete day dynamically** (see
   workflow), anchor both week windows to it, and count each week's **effective (complete)
   days**. If a week is missing days, normalize by effective days or mark it
   **provisional** - never present a partial week's drop as a real move. (Same
   completeness guard as the Sales-Movers and Buy-Box skills.)
2. **Compare to normal, not just last week.** Show this week vs the **trailing
   4-week median** (median, not mean - one anomalous week shouldn't move the
   baseline) as the primary signal, plus last week for context, plus a small 6-8
   week trend. A single week is noisy; the baseline keeps the headline honest.
3. **Explain the anomaly - and check it's real.** If margin or TACoS deviates
   materially from baseline (e.g. > 5pp), decompose *why* using the cost columns as
   % of sales - COGS %, fees %, FBA fees %, ad %. Name the driver. **Then apply the
   settlement-timing test:** Amazon books fees on *settlement date*, not sale date,
   so `profit_by_date` weekly margin is lumpy - a fee spike concentrated in 1-2 weeks
   on otherwise-flat sales is usually a settlement batch, not a real cost increase.
   Say so, and route to the Reimbursement/Fee Audit (which reconciles by order_date)
   to confirm before the seller panics. Sales, units and ad spend are sale-dated and
   reliable weekly; **margin is only trustworthy over a trailing 4-week window.**
4. **Movers.** Biggest SKU profit gainers/droppers this week vs last.
5. **Do this week.** 3 concrete actions, each pointing to the deeper skill.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources:
  - `Profit by Date` (`amazon_profit_by_date`, id `b24cd69c06`) - account-level weekly
    totals AND cost breakdown (`total_sales`, `profit`, `ad_spend`, `cogs_total`,
    `total_fees`, `fba_fees`, `total_selling_fees`, `total_units_sold`).
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`, id `57a0cb319c`) - per-SKU movers.
  - Optional: `FBA Inventory Health` (`amazon_fba_inventory_health`) for stockout watch-outs.
- **Daily data lags and gaps.** The underlying daily series can be 6+ days behind today
  and miss days mid-series (an every-other-day recent stretch has been observed). So do
  NOT just "drop the partial current week": detect the last complete day dynamically and
  measure each week's effective days (see workflow). **On the profit sources, measure
  completeness by daily sales value, not row count** - rows backfill (all SKUs appear at
  ~full count) before the sales/profit values settle, so a row-count test falsely marks a
  settlement-incomplete day as complete. If the review is later extended to
  traffic/conversion/buy-box via `amazon_sales_and_traffic_with_cogs`, that source lags on
  rows instead, so it uses a row-count signal (as in Sales-Movers) - match the signal to
  how the source lags.
- Currency: read `currency`, localise; if the connection spans currencies, group by
  `currency` and report the main one (never sum across currencies).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm sources `enabled`.
3. **Calibrate completeness first (don't assume a lag).** `exports_create` once on
   `amazon_profit_by_date`, ~30 days, `groupBy [date]`, sum `total_sales` per day. On the
   profit sources the completeness signal is **daily sales value, NOT row count** - rows
   backfill (all SKUs appear at ~full count) before the sales/profit values settle, so a
   day can pass a row-count test yet hold only a fraction of its real sales (observed: a
   day with ~1,450 rows but £143 sales vs a normal ~£8,000). From the daily `total_sales`:
   the **median daily sales**, a **full-day threshold ~60% of median daily sales**
   (relative, per-account), the **last complete day** (latest date at/above threshold,
   walking back from the tail - the lag is whatever this detects, not a fixed 4-6), and
   **gap days** (any date below threshold, including mid-series holes). (Row count is a
   fine secondary sanity check, but sales value is authoritative here.) Anchor "this week"
   = the 7 days ending on the last complete day, "last week" = the 7 before that.
4. **Weekly account trend + cost mix:** `exports_create` on `amazon_profit_by_date`, last ~8
   weeks, `groupBy [date, currency]` + `dateInterval WEEK`, sum `total_sales`,
   `profit`, `ad_spend`, `total_units_sold`, `cogs_total`, `total_fees`, `fba_fees`,
   `total_selling_fees`. Anchor the week boundaries to the last complete day (step 3), not
   the calendar week / last-7-calendar-days.
5. **Effective-days guard (both weeks).** For "this week" and "last week", compute
   **effective days** = count of days present at/above the threshold. If a week has < 7
   effective days, either normalize the comparison per effective day OR mark that week
   **provisional** and state how many days it reflects - never present a partial week's
   delta as a real move. If the two weeks' effective days differ materially, the raw Δ is
   an artifact; flag it. (Check BOTH weeks - an under-counted prior week distorts the Δ
   just as much as a partial current one.)
6. **Baseline:** latest complete week = "this week"; prior = "last week"; baseline =
   mean of the 4 complete weeks before this one (skip or flag any baseline week that is
   itself under-counted). For each KPI show this week, the Δ vs last week, and the Δ vs
   baseline. Recompute margin = profit/sales and TACoS = ad_spend/sales per week (never
   sum ratios); if a week is provisional, label its margin/TACoS provisional too - don't
   average a rate over missing days.
7. **Anomaly drill:** if this week's (or a recent week's) margin/TACoS is > ~5pp off
   baseline, express each cost as % of sales per week (COGS%, total_fees%, fba_fees%,
   ad%) and identify which line moved - that is the cause. Report it in plain words.
8. **Movers:** `exports_create` on `amazon_profit_by_sku_and_date` for this week and last week
   (the windows anchored in step 3), `groupBy [sku, product_name]`, sum
   `profit`+`total_sales`, pull a wide set (limit ~200 each so mid-size SKUs aren't
   missed), diff by SKU -> top gainers/droppers.
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
a fee-settlement batch, not an operational problem; confirm in the Reimbursement/Fee
Audit by order_date," and treats weekly margin as indicative only. That is the
difference between a scary wrong number and a correct insight.

## Quality self-check

- Did I detect the last complete day dynamically (not a fixed lag / last-7-calendar-days)
  and anchor both weeks to it?
- Did I compute effective days for BOTH weeks, flag mid-series gaps, and mark a partial
  week provisional rather than reporting a phantom drop?
- Did I avoid averaging rate metrics (margin/TACoS) over a partial week?
- Did I compare to the trailing baseline, not just last week (so a noisy prior week
  can't mislead)?
- If margin/TACoS was off, did I name the cost driver, not just flag it?
- Ratios recomputed per week (not summed)?
- Did I end in 3 concrete actions?

## Common mistakes

- Assuming "this week = the last 7 calendar days" or a fixed lag - the daily source lags
  6+ days with mid-series gaps; detect the last complete day and anchor to it.
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
- A DataDoe skill, built on DataDoe Profit by Date (`b24cd69c06`) + Profit by SKU
  (`57a0cb319c`), with the same completeness/lag guard as Sales-Movers and Buy-Box.
