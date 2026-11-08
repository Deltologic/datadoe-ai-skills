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
   with ~1 day of lag observed on sales, while their traffic columns trail by a lag you must measure (Amazon's own note
   says up to 3 days; measured from 2-3 days (Nov 2026) to 8-13 days (Oct 2026) on a UK account, with holes) and older
   sources lagged 6+ days with mid-series gaps. Never assume "this week = the last 7 calendar
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
   materially from baseline (e.g. > 5pp) or moved more than 2pp week on week, decompose
   *why* using the cost columns as
   % of sales - `sales_tax` % (VAT, ~16.7% of sales on UK/EU accounts; 0 on US/CA),
   total fees % (of which FBA % and referral %), COGS %, ad %, refunds %. Refunds % is
   `-refund_cost / total_sales`: `refund_cost` is signed and *added* to profit (refund
   outflows negative, fee reversals positive), so its cost-side share is its negative -
   a -10 refund contribution on 100 of sales is +10% of costs. The lines sum to 100% -
   margin, so the decomposition reconciles only with `sales_tax` and the refunds line in
   it; omit VAT and a UK review infers a +16.7% margin where the real one is negative. Name the driver. **Then apply the
   settlement-timing test:** `total_fees` and `fba_fees` book order fees on the order
   date, but storage, long-term storage, disposal and inbound fees on the **posting
   date**, so `profit_by_date` weekly margin is lumpy - a fee spike on one or two days of
   otherwise-flat sales is usually a **posted-date bill**, not a real cost increase. On a
   UK account FBA storage posted around the 7th of each month and long-term storage around
   the 19th-20th; weeks holding a bill ran -3.8% to -5.7% margin, weeks without ran -1.4%
   to -2.8%. These are legitimate monthly bills, not reimbursement candidates: name each
   bill and the day it posted (step 7), show the week's margin with and without them, and
   keep "flag for reimbursement / fee review" (reconcile the fee rows by `order_date` in
   `amazon_settlements_with_cogs`) for **order** fees that look wrong. Sales, units and ad spend are sale-dated and
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
  - Optional, to name posted-date bills (step 7): `Settlements & P&L Components`
    (`amazon_settlements_with_cogs`) - not premium, in the default dataset,
    `requiresDatePeriod: true`. Settlement sign: negative = cost.
  - Optional, for traffic / conversion / buy-box watch-outs: the traffic columns already
    on the two profit tables - `total_sessions`, `total_page_views`,
    `avg_buybox_percentage` per `date` on `amazon_profit_by_date` (account level) and
    per SKU / child ASIN on `amazon_profit_by_sku_and_date`. No extra source is needed.
    Two rules: (1) on the per-SKU table these three columns are **per child ASIN and
    repeated on every SKU row** of that ASIN - take `max()` per `child_asin`, never
    `sum()` (summing double-counts every multi-SKU ASIN); (2) the traffic columns may be
    **delayed by a lag you must measure (Amazon says up to 3 days; measured 2-3 to 8-13
    days on a UK account, per child ASIN a day more than the account total) and revised
    for 30 days**, while sales lag
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
  `currency` and report the main one (never sum across currencies). **Rows with an empty
  `currency`** can appear on `amazon_profit_by_date` (observed on 50 of 72 days); they
  carry only `refund_cost` (return COGS added on the return date). On a single-currency
  account fold them into that currency and say so in one line (dropping them misstated a
  week's profit by 94.36); on a multi-currency account report them separately.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm sources `enabled`. `amazon_profit_by_date`,
   `amazon_profit_by_sku_and_date` and `amazon_fba_inventory_health` are **premium**. Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and stop (or drop that section); never render zeros.
3. **One daily export, then calibrate completeness (don't assume a lag).** `exports_create`
   once on `amazon_profit_by_date`, the last ~63 days plus a few days of slack (8 weeks of
   trend + the 4 baseline weeks), `groupBy [date, currency]`, sum `total_sales`, `profit`,
   `ad_spend`, `cogs_total`, `total_fees`, `fba_fees`, `total_selling_fees`, `sales_tax`,
   `refund_cost`, `total_units_sold` and `unshipped_sales` with distinct aliases
   (`sum(profit) as profit_sum`, `sum(refund_cost) as refund_cost_sum`,
   `sum(unshipped_sales) as unshipped_sum`; `as profit` errors `ALIAS_COLLISION`). This single export feeds steps 3-7; do not add `dateInterval WEEK`
   (see Configuration). On the profit sources the completeness signal is **daily sales
   value, NOT row count** - rows backfill (all SKUs appear at ~full count) before the
   sales/profit values settle, so a day can pass a row-count test yet hold only a fraction
   of its real sales (observed: a day with ~1,450 rows but £143 sales vs a normal ~£8,000).
   From the daily `total_sales`: the **median daily sales**, a **full-day threshold ~60% of
   median daily sales** (relative, per-account), the **sales-complete days** (at/above
   threshold) and **gap days** (any date below threshold, including mid-series holes).
   (Row count is a fine secondary sanity check, but sales value is authoritative here.)
   **Unshipped check (the same rule as Sales Movers).** `unshipped_sales` is not included
   in `total_sales`, and a recent day can pass the 60% test while many of its orders are
   still waiting to ship. A day whose `unshipped_sum` is more than ~10% of
   `total_sales + unshipped_sales` is still filling and is NOT complete, even if it passes
   the 60% test. Observed: a day at 74.8% of median sales had 27.0% of its order value
   unshipped (older days 0-2%); anchoring on it read margin -1.83pp vs normal, against
   -0.13pp one day earlier.
   **Fee-completeness check (beside the sales test).** Fees post after sales, so a day
   can be sales-complete with fees still missing. Test the **order-dated** fees: for each
   candidate day compute `total_selling_fees / total_sales` (the referral fee, booked on
   the order date) and compare it with the median of that ratio over the 5 preceding
   complete days: if the day's ratio is below ~80% of the trailing ratio, its order fees
   have not posted yet. Do not run this test on `total_fees` or `fba_fees` - they also
   book storage, long-term storage, disposal and inbound bills on the posting date, so a
   monthly bill can hide missing order fees (observed: a 2,158 storage bill lifted a day's
   total-fee ratio to 124% of trailing while its referral fees were only 72% posted).
   Separately, flag any day whose `total_fees / total_sales` is above ~120% of its trailing
   ratio as **"a posted-date bill landed"** - step 7 names it. (Earlier observation: a day
   at 71% of median sales with fees at 39% of sales vs ~50% normal turned the week's
   margin from -3.98% to -3.06% and flipped the WoW margin delta's sign.)
   **Last complete day (the anchor)** = the latest date that passes all three tests -
   sales value, unshipped and referral fees - walking back from the tail (the lag is
   whatever this detects; ~1-2 days on the profit tables, more on other sources). Name any
   later day you left out and which test it failed. Anchor "this week" = the 7 days
   ending on the last complete day, "last week" = the 7 before that.
4. **Weekly account trend + cost mix, bucketed in code.** From the step-3 daily rows, sum
   8 consecutive 7-day windows ending on the last complete day (this week = days -6..0,
   last week = -13..-7, and so on) per currency; recompute margin and TACoS per bucket from
   the sums. Do NOT use `dateInterval WEEK`: it produces fixed Sunday-start calendar
   buckets whose newest bucket includes the partial current day and whose oldest is
   clipped by `from`, and it cannot be anchored to the last complete day. Carry the fee
   decomposition columns (`total_fees`, `fba_fees`, `total_selling_fees`, `cogs_total`,
   `sales_tax`, `ad_spend`, `refund_cost`) through the same buckets so step 7 can read
   them.
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
   average a rate over missing days. The baseline of each KPI is the **median of its 4
   weekly values** - for margin and TACoS the median of the 4 weekly ratios, not the ratio
   of the 4 weeks' pooled sums (observed -3.86% vs -3.84%) - and the header says "median".
   **Profit deltas:** when this week's, last week's or the baseline profit is 0 or below,
   show the change in currency, not %: a % change on a negative base reads backwards
   (observed: a deeper loss shown as -92.86% vs last week and -35.49% vs normal).
7. **Anomaly drill:** if this week's (or a recent week's) margin/TACoS is > ~5pp off
   baseline, or this week's moved more than 2pp vs last week, express each cost as % of
   sales per week - `sales_tax`% (VAT; 0 on US/CA),
   total_fees% (of which fba_fees% and `total_selling_fees`% - subsets, never added on
   top), COGS%, ad%, refunds% = `-refund_cost_sum / sales_sum` (sign reversed - profit
   adds the signed `refund_cost`) - and check they reconcile: the lines sum to
   100% - margin. Identify which line moved - that is the cause. Report it in plain words.
   **Posted-date bills (runs whether or not the drill above fired).** When a week's
   FBA-fee share moves, or step 3 flagged a day as
   "a posted-date bill landed", run one export on `amazon_settlements_with_cogs` over the
   review span (the 8 weeks; pass `from` / `to` - `requiresDatePeriod: true`):
   `groupBy [date, currency]`, sum `fba_storage_fee`, `long_term_storage_fee` and
   `fba_disposal_fee` with distinct aliases. Settlement sign: negative = cost, positive =
   a credit. On the first run, check `date` against `transaction_posted_date` for the
   bill rows (they matched on every bill on a UK account, Nov 2026); if they differ, use
   the one whose days match the fee spikes in step 3. Name each bill and the day it
   posted - FBA storage posts around the 7th of the month, long-term storage around the
   19th-20th - and show the week's margin with and without these bills
   (`(profit_sum + bills) / sales_sum`, bills as positive costs). They are normal monthly
   bills, not reimbursement candidates.
8. **Movers (full per-SKU totals, diffed client-side).** `exports_create` twice on
   `amazon_profit_by_sku_and_date` - once for this week, once for last week (the windows
   anchored in step 3) - `groupBy [sku, product_name]`, sum `profit`, `total_sales`,
   `total_units_sold` with distinct aliases (`profit_sum`, `sales_sum`, `units_sum` -
   `as profit` errors `ALIAS_COLLISION`), format CSV with `limit 5000` (JSON caps at 1,000
   rows, CSV at 5,000; page with `skip` if the account has more SKUs than that). Drop rows whose `sku` is null or blank
   (account-level rows - observed ~1,300 per week), then **sum per `sku`** before diffing: about 165 SKUs per week came
   back twice, once with a blank `product_name`; keep the non-blank name. Diff by SKU in code -> top gainers/droppers by
   Δ profit, and say how many SKUs **sold** in only one week (`total_sales > 0` in one week and not the other - mere
   presence in one export undercounts it: 505 vs 802 observed). Do NOT pull a top-N by profit per week (e.g. `limit ~200 DESC`): on a
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
Weekly Insights - {marketplace} - week of {start} (ends {last complete day})   (vs 4-wk median)
Period: this week = {n}/7 complete days{ - PROVISIONAL if < 7}; gaps: {dates or none}{; left out: {date} - {n}% unshipped / referral fees {x}% posted}.
        Sales are shipped sales; ordered incl. unshipped {cur}.. ({+/-}% vs last wk).

            This wk    vs last wk   vs normal(4wk median)
Sales       {cur}..    {+/-}%       {+/-}%
Profit      {cur}..    {+/-}%       {+/-}%      (as {+/-}{cur}.. when either side is 0 or below)
Margin      {m}%       {+/-}pp      {+/-}pp
Ad spend    {cur}..    {+/-}%       {+/-}%
TACoS       {t}%       {+/-}pp      {+/-}pp
Units       {u}        {+/-}%       {+/-}%
Trend (8wk): sales ▁▃▆▅▆▇  profit ▆▇▃▁▄▆

Why (if > 5pp off normal or > 2pp vs last week): margin {m}% vs normal {b}% / last wk {l}% - driver: {fees/COGS/ads} moved
  from {x}% to {y}% of sales in wk {date}.
  Cost mix (% of sales): VAT {v}%  fees {f}% (FBA {fb}%, referral {r}%)  COGS {c}%  ads {a}%  refunds {rc}%  -> margin {m}%
  {if a day in the week failed the referral-fee test: "Margin provisional: {date} is fee-incomplete (referral fees {x}% of sales vs ~{y}% trailing)."}
Bills        {FBA storage {cur}.. on {date}; long-term storage {cur}.. on {date}} in the 8 weeks - margin without them {m2}% (normal {b2}%).
             (Shown whenever step 7 ran the settlements export, even with no anomaly.)

Top movers   +{sku} {cur}..   -{sku} {cur}..
Watch-outs   {rising TACoS / stockouts / buy-box}
Do this week 1) ...  2) ...  3) ...
```

## Worked example (illustrative)

Suppose this week's margin reads -5.7% against a normal (4-week median) of -3.9% and
-2.9% last week. That is under the 5pp anomaly bar but a 2.8pp drop week on week, so the
drill runs. Decomposing costs as % of sales, VAT, COGS and ads held roughly flat - the
mover was **FBA fees**, up about 3pp of sales, and step 3 had flagged one day of the week
as "a posted-date bill landed" (its total-fee ratio at ~124% of trailing while its
referral fees looked normal). The settlements export names it: the monthly FBA storage
bill (2,158) posted on the 7th, while last week instead got a storage credit (+638 on the
29th). The 8-week view shows the same saw-tooth - storage around the 7th, long-term
storage around the 19th-20th - and every week holding a bill ran 1-3pp below the weeks
without one. So the card concludes: "the margin dip is this month's storage bill landing
in this week, not an operational problem; without posted-date bills margin is about the
same as normal," and reads margin on the trailing 4 weeks. No reimbursement flag - these
are legitimate monthly bills; that flag is kept for order fees that look wrong. That is
the difference between a scary wrong number and a correct insight.

## Quality self-check

- Did I detect the last complete day dynamically (not a fixed lag / last-7-calendar-days)
  and anchor both weeks to it - bucketing the daily rows in code, not with
  `dateInterval WEEK`?
- Did I run the unshipped check (a day with > 10% of its order value unshipped is not
  complete) and the fee-completeness check on the order-dated referral fee
  (`total_selling_fees / total_sales` vs the trailing 5-day ratio, not `total_fees`), and
  anchor on the latest day that passes all three tests?
- Did I name every storage / long-term storage bill in the review span with the day it
  posted, and show the week's margin with and without them?
- Does the header say "vs 4-wk median", and are profit changes in currency when either
  side is 0 or below?
- Did I fold empty-currency rows into a single-currency account (and say so), sum the
  per-SKU rows per `sku` before diffing, and count "sold in only one week" by
  `total_sales > 0`?
- Did I compute effective days for BOTH weeks, flag mid-series gaps, and mark a partial
  week provisional rather than reporting a phantom drop?
- Did I diff movers over full per-SKU pulls (CSV `limit 5000`, both weeks), not a top-200
  per week?
- Does the cost mix include `sales_tax` % and the refunds line as `-refund_cost / sales`
  (exported in step 3, carried through the weekly buckets), and reconcile to 100% -
  margin?
- Did I avoid averaging rate metrics (margin/TACoS) over a partial week?
- Did I compare to the trailing baseline, not just last week (so a noisy prior week
  can't mislead)?
- If margin/TACoS was off, did I name the cost driver, not just flag it?
- Ratios recomputed per week (not summed)?
- Did I end in 3 concrete actions?

## Common mistakes

- Assuming "this week = the last 7 calendar days" or a fixed lag - lag differs per source
  and per column (~1 day on the intraday profit tables' sales, a measured 2-3 to 8-13
  days on their traffic columns, 6+ days with gaps on older sources); detect the last
  complete day and anchor to it.
- Summing `total_sessions` / `total_page_views` / `avg_buybox_percentage` across the SKU
  rows of `amazon_profit_by_sku_and_date` - they are per child ASIN and repeated on each
  SKU row; take `max()` per `child_asin`.
- Using `dateInterval WEEK` for the weekly trend - it yields fixed Sunday-start calendar
  buckets, the newest including the partial current day; bucket the daily rows in code.
- Treating a sales-complete day as margin-complete - fees post later; run the
  fee-completeness check on the referral fee or the newest day inflates margin. A
  posted-date storage bill on the same day can make `total_fees` look complete when the
  order fees are not.
- Anchoring on a day that passes the 60% sales test while a large share of its orders is
  still unshipped - check `unshipped_sales` per day.
- Pulling movers as a top-200 by profit per week - SKUs that went negative vanish from
  the list; pull full per-SKU totals (CSV `limit 5000`) for both weeks and diff in code.
- Decomposing costs without `sales_tax` - on UK/EU accounts VAT is ~16-17% of sales and
  the lines will not reconcile to the margin without it.
- Using the raw signed `refund_cost` as the refunds share, or leaving it out of the step-3
  export - profit adds `refund_cost`, so the cost line is `-refund_cost / sales`; with the
  raw value or no value the mix cannot reconcile to the margin.
- Reporting a partial/gappy week's drop as a real collapse - normalize by effective days
  or mark it provisional (check BOTH weeks; an under-counted prior week distorts the Δ too).
- WoW-only headline: last week being abnormal makes this week look great/terrible.
- Reading a single week's margin as real - storage, long-term storage and other bills
  post on one day a month; use the trailing window for margin, name the bills from
  `amazon_settlements_with_cogs`, and keep the reimbursement flag for order fees that
  look wrong.
- Showing a % profit change when a week lost money - a deeper loss reads as a small or
  positive %; show the change in currency.
- Flagging "margin dropped" without decomposing which cost moved.
- Summing TACoS/margin/ACoS columns.
- A wall of metrics with no action.

## Notes

- Read-only. Routes to the deeper DataDoe skills for each action.
- A DataDoe skill, built on DataDoe Profit by Date (`amazon_profit_by_date`) + Profit by
  SKU (`amazon_profit_by_sku_and_date`), with the same completeness/lag guard as
  Sales-Movers and Buy-Box.
