---
name: daily-performance-health-check
description: >-
  Set up a daily Amazon performance health check that posts to Slack (or email) every
  morning - yesterday's sales, orders, units, profit, ACoS, TACoS and ROI per marketplace on
  a 7-day trend, an advertising check (yesterday vs the last 7 days), and a short list of
  what needs attention first, such as a marketplace whose sales collapsed or ads that
  stopped running. Built on real-time DataDoe order data plus Amazon Ads data, with
  completeness checks so a late data load is never reported as a collapse. Use for "daily
  account health report", "daily performance report", "morning sales check", "alert me on
  Slack if sales drop", "did my ads stop", or "daily Amazon summary". Then offers an updated
  version that adds the Amazon account-health verdict, the likely cause of each alert, and a
  quiet mode. For Amazon's account-health metrics alone (AHR, ODR, policy violations), use
  Daily Account Health Check.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Daily Performance Health Check (Slack)
  access: read
  category: Account Health
  interface: mcp
  output: report
  youtube-video-embed-url: https://www.youtube.com/embed/2-zIMOAQj84
---

# Daily Performance Health Check (Slack)

Big problems - ads that stop, a marketplace whose sales fall off a cliff - hide in the data
until the revenue is already lost, and checking sales, profit and ads per marketplace by hand
every day doesn't happen. This skill sets up a daily routine that pulls yesterday's numbers for
every marketplace you sell in, compares them with the last 7 days, and posts one message to
Slack with the biggest issues first. Live from DataDoe.

## When to use this

- Every morning, as the first read of the business - delivered, not looked up.
- Sellers with several marketplaces (e.g. UK + DE) who can't eyeball each one daily.
- Trigger phrases: "daily account health report", "daily performance report", "morning sales
  check", "alert me on Slack if sales drop", "did my ads stop", "daily Amazon summary".

## The framework. Yesterday vs normal, from data that is complete

1. **Yesterday comes from real-time orders.** Profit tables count shipped items and get
   Amazon's fees days later, so early in the morning they show only a fraction of yesterday (16%
   at 2am in testing) - exactly what a "collapse" looks like. Order Line Items are complete
   within about an hour of each order, so yesterday's Sales, Orders, Units, COGS and tax come
   from there, and **Profit (before Amazon fees)** = sales - tax - COGS - ad spend.
2. **Ads come from the newest complete ads day.** Ads data refreshes during the day (around
   10am, 1pm and 4pm) and Sponsored Brands rows arrive last. Check each ad type before using
   yesterday; if it isn't complete yet, use the day before and label it.
3. **Per marketplace, yesterday vs the 7 days before** (average), plus the 7-day daily sales
   so a trend is visible: Sales, Orders, Units, Profit, ACoS, TACoS, ROI.
4. **Rank the issues:**
   - **CRITICAL** - sales below 50% of the 7-day average, or two days in a row below 50%; ads
     stopped across the account on a complete ads day (spend 0 while campaigns normally spend);
     TACoS 0% on a complete ads day with ads normally running.
   - **WATCH** - sales 20-50% below average; a decline of 3+ days from a recent peak; ACoS or
     TACoS up more than 5 points; profit margin down more than 5 points; some campaigns that
     spent every day of the last 7 spent nothing.
   - **OK** - nothing beyond normal day-to-day noise.
   The thresholds are defaults - ask the user and store their choice in the routine.
5. **Context:** promotions, Prime Day, a stock liquidation or a known stock-out explain a peak or
   a drop. Ask the user once for known events and keep them in the routine prompt; annotate
   instead of alarming.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- **Export rules (every export in this skill):** each `exports_create` call needs `limit` and
  `outputType`. Aggregation aliases must differ from column names (`sum` of `ad_spend` -> alias
  `total_ad_spend`; reusing the column name fails with ALIAS_COLLISION). Text columns can't be
  aggregated (`max` on a name fails with INVALID_AGGREGATE) - put them in `groupBy` and merge rows
  in code. Load every page of `exports_source_get` (a table's columns are spread over several
  pages). If `exports_create` already returns `COMPLETED`, skip polling; otherwise poll
  `exports_get` every ~5 s. For results you process in code, use `exports_raw_url_get` and save
  the file (the URL expires after ~15 minutes) instead of pulling it into the conversation.
  Treat null numbers as 0 unless a step says otherwise. Marketplace codes are ISO (the UK is `GB`).
- **Yesterday's sales, orders, units, COGS, tax:** `Order Line Items`
  (`amazon_order_items_with_cogs`, free, real time) - `date` (purchase date, marketplace time),
  `amazon_order_id`, `amazon_order_status`, `quantity`, `item_price_value` (line total, excludes
  shipping), `item_tax_value`, `item_price_currency`, `cogs_item_value` (unit cost x quantity),
  `cogs_present`, `child_asin`, `product_name`. Exclude `amazon_order_status = Canceled`.
  Lines from the last ~4 hours can have no price yet - irrelevant for yesterday by morning.
- **Ads:** `Ad Performance by Campaign & Date` (`amazon_ads_performance_by_campaign_by_date`) -
  `date`, `ad_campaign_type`, `ad_campaign_id`, `ad_campaign_name`, `ad_spend`, `ad_sales`;
  `Ad Performance by ASIN & Date` (`amazon_ads_performance_by_child_asin_and_date`) for the ASIN
  view of an ad drop.
- **Drill-down / Buy Box:** `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`)
  **[premium]** - `avg_buybox_percentage` per `child_asin` (it lags up to ~3 days; compare only
  days where it has loaded). Premium note: a premium export costs 5 AI Tokens instead of 2 -
  nothing else differs, and the table is part of the always-on default dataset, so it is never
  disabled. A 0-row export means no data in the window or an initial load still in progress -
  say which; never render zeros.
- **Formulas** (from the summed values, never averaged): Profit (before Amazon fees) = sales -
  tax - COGS - ad spend; ROI = profit / (COGS + ad spend); ACoS = ad spend / ad sales; TACoS =
  ad spend / sales. Amazon's fees settle days to weeks later, so a fee-inclusive "yesterday"
  would be overstated - label profit "before Amazon fees". If lines with `cogs_present` = false
  carry part of yesterday's sales, say "COGS missing for x% of sales - profit overstated".
- **Ads completeness for a day, per ad type:** the type has rows, and Sponsored Products spend is
  at least ~70% of its 7-day average (or the type normally has no spend). If not, the day is
  still loading - use the newest complete ads day for the ads metrics and label it ("Ads:
  {date}").
- Currency per marketplace (`item_price_currency`); never add marketplaces or currencies.

## Step-by-step workflow (MCP-native)

**Setup (once, in chat):**
1. `sellers_and_vendors_list` -> the seller accounts to include (default: all connected seller
   marketplaces; each marketplace is its own account id).
2. `exports_sources_get` / `exports_source_get` -> confirm the sources above and their columns.
3. Ask: delivery channel (Slack channel or DM - default; or email / Telegram if connected), the
   time (default 10:30 in the latest marketplace's time zone - after the morning ads refresh
   everywhere; e.g. 10:30 UK time for UK + DE), thresholds (or defaults), and known
   promotions / events.
4. Run the check once now (steps below), post it, then create the daily routine (Scheduling).
5. **Offer the updated version** (see below): "There's an updated version of this check - it
   adds your Amazon Account Health verdict to the same morning post, names the likely cause of
   each alert (stock-out, lost Buy Box, ads stopped), and can stay quiet on normal days with a
   Monday all-clear. Want it?" On a yes, update the routine prompt to include it.

**Each run:**
1. **Orders (yesterday + 7 days):** `exports_create` on `amazon_order_items_with_cogs`, all chosen
   account ids (up to 5 per export), `from` = yesterday - 7, `to` = yesterday, filter
   `amazon_order_status != Canceled`, `groupBy ["date", "marketplace_country_code",
   "item_price_currency", "cogs_present"]`; aggregations: sum `item_price_value` (alias
   `sales_sum`), sum `item_tax_value` (`tax_sum`), sum `cogs_item_value` (`cogs_sum`), sum
   `quantity` (`units_sum`), countDistinct `amazon_order_id` (`orders_count`). Merge the
   `cogs_present` rows per day in code (keep the share of sales without COGS).
2. **Ads (same 8 days):** `groupBy ["date", "marketplace_country_code", "ad_campaign_type",
   "ad_campaign_id", "ad_campaign_name"]`, sum `ad_spend` (`spend_sum`) and `ad_sales`
   (`ad_sales_sum`), CSV, page with `skip` if a page is full.
3. **Ads completeness:** per marketplace, apply the rule above to yesterday; pick the newest
   complete ads day. "Ads stopped" is only ever judged on a complete day: all campaigns at 0 ->
   CRITICAL; individual campaigns that spent on each of the 7 days before and 0 now -> WATCH
   (list them). An incomplete yesterday is reported as "ads for {date} still loading", never as
   stopped.
4. **Compute** per marketplace: yesterday vs the 7-day average for every metric, the 7-day sales
   line, deltas and flags (orders-based, so no loading artifacts).
5. **Drill-down for each CRITICAL / WATCH item:** from the same Order Line Items, yesterday vs
   the 7-day average by `child_asin` (`groupBy ["child_asin", "product_name"]`, two exports or
   one with `date`) -> the 3 products that explain most of the change; for an ad drop, the
   campaigns that stopped.
6. **Post** the message (Output format) with the connected Slack tool; if Slack isn't
   available, use the channel the user chose. Only post to the destinations the user gave.

## Output format

One Slack message (mrkdwn), split per marketplace if it would exceed Slack's length limit:

```
*Daily Performance Report - {yesterday}*   {🔴 CRITICAL | 🟠 WATCH | 🟢 OK}

*{Seller} {UK} ({GBP})* - yesterday vs 7-day avg
Sales {£x} ({+/-y%}) · Orders {n} ({+/-%}) · Units {n} ({+/-%})
Profit (before Amazon fees) {£x} ({+/-%}) · ROI {x%}
ACoS {x%} ({+/-pp}) · TACoS {x%} ({+/-pp})
7-day: {d-7} £… | … | {yesterday} £…   (sales per day)
Ads{ ({date}) if not yesterday}: spend {£x} vs avg {£y} · ad sales {£x} · ACoS {x%}

*{Seller} {DE} ({EUR})* - … same block …

*What to look at first*
🔴 {DE}: sales fell from €8,250 to €3,000 to €500 in two days (-94%); ads stopped on every
   campaign - check budgets, the payment method and listing status now.
🟠 {UK}: down 3 days from the {date} peak - promotion ended? Margin -4pp.
✅ Nothing else unusual.
Data via DataDoe · sales from real-time orders · profit before Amazon fees (fees settle later)
```

Lead with the most urgent line. Keep numbers in each marketplace's currency. If an ads day is
still loading, say so on the Ads line instead of flagging it.

## Updated version (offer after the first report)

Same message, same metrics - the updated version adds three things. Build it only when the user
says yes.

- **Account health line** at the top of each marketplace block, from `Seller Account Health
  Metrics` (`amazon_seller_performance`, newest snapshot in a 14-30 day range): "Account health
  🟢 AHR 245 · no policy issues" or the worst failing gate (e.g. "🔴 Late shipment 6.1% vs <4%",
  "🔴 2 policy statuses BAD"). Score it exactly like the Daily Account Health Check skill (each
  metric's `*_status` and own target; rates are 0-1 fractions). A red gate makes the header at
  least WATCH; an AHR status of AT_RISK or CRITICAL makes it CRITICAL. The table is not in the
  default dataset - if `enabled` is false, say once that it needs enabling in Settings > Data.
- **Likely cause** under each CRITICAL / WATCH line, for the 3 products behind the move:
  - Stock-out: newest `amazon_fba_inventory_health` snapshot (**premium**, 5 AI Tokens) shows
    `available` 0 or days of supply under 7 -> "out of stock, {n} inbound". Check this for the
    top movers even when other signals are quiet.
  - Lost Buy Box: `avg_buybox_percentage` in `amazon_profit_by_sku_and_date` on the newest
    loaded day vs the 7 days before -> "Buy Box {x}% (was {y}%)". A 0 on a day that hasn't
    loaded is not a cause.
  - Ads stopped: the product's ad spend in `amazon_ads_performance_by_child_asin_and_date` went
    to 0 on a complete ads day -> "ads stopped on this ASIN".
  - None of these -> "no single cause found - check pricing and listing status".
- **Quiet mode** (ask): post only when there is a CRITICAL or WATCH item. An account-health issue
  is posted when it first appears or changes; a known, unchanged one goes into the Monday
  summary instead of every day. Every Monday, a short all-clear per marketplace without alerts
  last week ("✅ UK: no alerts last week · sales +3.2% vs the week before") - one line per
  marketplace and currency - so silence never means the routine broke.

## Scheduling (daily routine)

Create a recurring routine with the client's scheduler (a scheduled task / routine in Claude
Code, the Claude desktop app or Cowork; a scheduled task in ChatGPT). The routine runs without
this chat, so its prompt must contain everything - and the skill must be installed where the
routine runs (otherwise paste the full skill text into the routine):

```
Every day at {10:30} {Europe/London}: run the daily-performance-health-check skill for DataDoe
seller accounts {names + ids + marketplaces}. Yesterday vs the previous 7 days: sales, orders,
units, COGS and tax from amazon_order_items_with_cogs (not Canceled); ads from
amazon_ads_performance_by_campaign_by_date, judged only on a complete ads day. Thresholds:
{critical -50%, watch -20%, +5pp ACoS/TACoS, -5pp margin}. Known events: {promotions / dates}.
{Updated version: account-health line, likely causes, quiet mode with Monday all-clear.}
Post to Slack {channel}.
```

- Local routines need the computer on and the app running; cloud routines need the DataDoe and
  Slack connectors available there.
- Slack is one channel - email or Telegram work the same way if connected.

## Worked example (illustrative)

UK + DE seller, run at 10:30 on 17 May. UK: real-time sales £5,480 yesterday vs a £6,100 average
(-10%), down three days from the 14 May peak, margin -4pp -> WATCH ("did a promotion end?").
DE: orders fell from ~140 a day to 31 and then 6 (sales €8,250 -> €3,000 -> €500, -94%), and
yesterday is a complete ads day with zero spend on every campaign -> CRITICAL: ads stopped and
sales collapsed. The same check at 2am would have shown DE profit-table sales "down 76%" while
real-time orders were up 49% - which is why yesterday's numbers come from orders.

## Quality self-check

- Did yesterday's sales, orders and units come from real-time orders (not the shipped-based
  profit tables)?
- Did I judge ads only on a complete ads day, per ad type, and label a fallback day?
- Profit labelled "before Amazon fees", COGS gaps disclosed?
- Ratios from sums, per marketplace, no cross-currency totals?
- Is the most urgent issue the first line, with a concrete next step?
- Is the routine prompt self-contained (time and time zone, accounts, thresholds, events,
  destination)?
- Did I offer the updated version - and change nothing unless the user said yes?

## Common mistakes

- Reading the shipped-based profit tables for "yesterday" in the morning - they show a fraction
  of the day and every marketplace looks like it collapsed.
- Reading a partly loaded ads day (no Sponsored Brands rows yet, half the usual spend) as "ads
  stopped".
- Using net `profit` for yesterday (fees not settled yet - overstated).
- Treating a Buy Box 0 on a day that hasn't loaded as a lost Buy Box.
- Mixing marketplaces or currencies in one number.
- Posting to a channel the user didn't choose.

## Notes

- Read-only. Never changes anything on Amazon.
- Pairs with Daily Account Health Check (Amazon's AHR / policy metrics) - the updated version
  brings its verdict into the same morning post.
- A DataDoe skill, built on `amazon_order_items_with_cogs` and
  `amazon_ads_performance_by_campaign_by_date`, with `amazon_profit_by_sku_and_date`,
  `amazon_ads_performance_by_child_asin_and_date`, `amazon_fba_inventory_health` and
  `amazon_seller_performance` for the drill-down and the updated version.
