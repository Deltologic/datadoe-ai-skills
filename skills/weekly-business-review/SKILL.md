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

## The framework. Baseline -> anomaly -> movers -> 3 actions

1. **Compare to normal, not just last week.** Show this week vs the **trailing
   4-week median** (median, not mean - one anomalous week shouldn't move the
   baseline) as the primary signal, plus last week for context, plus a small 6-8
   week trend. A single week is noisy; the baseline keeps the headline honest.
2. **Explain the anomaly - and check it's real.** If margin or TACoS deviates
   materially from baseline (e.g. > 5pp), decompose *why* using the cost columns as
   % of sales - COGS %, fees %, FBA fees %, ad %. Name the driver. **Then apply the
   settlement-timing test:** Amazon books fees on *settlement date*, not sale date,
   so `profit_by_date` weekly margin is lumpy - a fee spike concentrated in 1-2 weeks
   on otherwise-flat sales is usually a settlement batch, not a real cost increase.
   Say so, and route to the Reimbursement/Fee Audit (which reconciles by order_date)
   to confirm before the seller panics. Sales, units and ad spend are sale-dated and
   reliable weekly; **margin is only trustworthy over a trailing 4-week window.**
3. **Movers.** Biggest SKU profit gainers/droppers this week vs last.
4. **Do this week.** 3 concrete actions, each pointing to the deeper skill.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources:
  - `Profit by Date` (`amazon_profit_by_date`) - account-level weekly
    totals AND cost breakdown (`total_sales`, `profit`, `ad_spend`, `cogs_total`,
    `total_fees`, `fba_fees`, `total_selling_fees`, `total_units_sold`).
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`) - per-SKU movers.
  - Optional: `FBA Inventory Health` (`amazon_fba_inventory_health`) for stockout watch-outs.
- Complete weeks only (drop the partial current week). Currency: read `currency`,
  localise; if the connection spans currencies, group by `currency` and report the
  main one (never sum across currencies).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm sources `enabled`.
3. **Weekly account trend + cost mix:** `exports_create` on `amazon_profit_by_date`, last ~8
   weeks, `groupBy [date, currency]` + `dateInterval WEEK`, sum `total_sales`,
   `profit`, `ad_spend`, `total_units_sold`, `cogs_total`, `total_fees`, `fba_fees`,
   `total_selling_fees`. Drop the partial current week.
4. **Baseline:** latest complete week = "this week"; prior = "last week"; baseline =
   mean of the 4 complete weeks before this one. For each KPI show this week, the
   Δ vs last week, and the Δ vs baseline. Recompute margin = profit/sales and
   TACoS = ad_spend/sales per week (never sum ratios).
5. **Anomaly drill:** if this week's (or a recent week's) margin/TACoS is > ~5pp off
   baseline, express each cost as % of sales per week (COGS%, total_fees%, fba_fees%,
   ad%) and identify which line moved - that is the cause. Report it in plain words.
6. **Movers:** `exports_create` on `amazon_profit_by_sku_and_date` for this week and last week,
   `groupBy [sku, product_name]`, sum `profit`+`total_sales`, pull a wide set
   (limit ~200 each so mid-size SKUs aren't missed), diff by SKU -> top gainers/droppers.
7. Render the HTML card.

## Output format (interactive HTML card)

Render a single self-contained HTML card (KPI tiles, a small trend sparkline per
KPI, a movers table, watch-outs, actions). Header "Weekly Insights", footer "Data
via DataDoe". If the client cannot render HTML, fall back to the text layout below.

```
Weekly Insights - {marketplace} - week of {start}   (vs 4-wk avg)

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

- Did I compare to the trailing baseline, not just last week (so a noisy prior week
  can't mislead)?
- If margin/TACoS was off, did I name the cost driver, not just flag it?
- Complete weeks only; ratios recomputed (not summed)?
- Did I end in 3 concrete actions?

## Common mistakes

- WoW-only headline: last week being abnormal makes this week look great/terrible.
- Reading a single week's margin as real - fees settle in batches; use the trailing
  window for margin and confirm fee spikes in settlements by order_date.
- Flagging "margin dropped" without decomposing which cost moved.
- Summing TACoS/margin/ACoS columns.
- A wall of metrics with no action.

## Notes

- Read-only. Routes to the deeper DataDoe skills for each action.
- A DataDoe skill. Built on DataDoe Profit by Date + Profit by SKU.
