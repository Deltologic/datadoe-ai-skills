---
name: ppc-campaign-acos-alert
description: >-
  Set up a daily ACoS alert for your Amazon PPC campaigns - pick your top campaigns (or name
  them), see their ad spend, ad sales and ACoS, set a threshold (e.g. 20%), and get an email
  every day at the time you choose saying which campaigns are over it. Built in about a minute
  from DataDoe's Amazon Ads data, runs as a scheduled routine. Use for "ACoS alert", "PPC
  campaign alert", "email me if ACoS goes over", "monitor my top campaigns", "campaign ACoS
  threshold", or "daily PPC check". Then offers an updated version that also warns when a
  campaign's ACoS is climbing week over week and suggests the next step for each campaign
  over the threshold. For per-ASIN thresholds, use PPC ASIN ACoS Alert.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: PPC Campaign ACoS Alert
  access: read
  category: PPC & Ads
  interface: mcp
  output: report
  youtube-video-embed-url: https://www.youtube.com/embed/nQSSBho-MSs
---

# PPC Campaign ACoS Alert

When ACoS starts growing on a campaign you need to act fast - but nobody checks every campaign
every day. This skill builds an alerting system in about a minute: it finds your top
campaigns, shows their ACoS, and creates a daily routine that checks them against your
threshold and emails you the result. Live from DataDoe.

## When to use this

- You want to know the same day a key campaign's ACoS goes over target.
- You don't know which campaigns to watch yet - start from your top performers.
- Trigger phrases: "ACoS alert", "PPC campaign alert", "email me if ACoS goes over", "monitor
  my top campaigns", "campaign ACoS threshold", "daily PPC check".

## The framework. Pick, measure, alert

1. **Pick the campaigns.** Default: the **top 5 campaigns by ad sales over the last 30 days**
   (the user can name campaigns instead, or change the count / ranking - e.g. by spend).
2. **Measure.** For each campaign: ad spend, ad sales, **ACoS = ad spend / ad sales x 100**,
   computed from the summed values for the window.
3. **Alert.** Each run compares every campaign with the threshold (default from the user,
   e.g. 20%) and emails a summary: the campaigns over the threshold first, then the full table.
   A campaign with spend and **zero** ad sales is over any threshold (ACoS shown as "no sales").
4. **Window.** Month-to-date (1st of the month to today), so the number is the month's running
   ACoS. In the first 3 days of a month, use the last 7 days instead (and say so) - one or two
   days of data is noise.

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
- Data source: `Ad Performance by Campaign & Date` (`amazon_ads_performance_by_campaign_by_date`)
  - `date`, `ad_campaign_id`, `ad_campaign_name`, `ad_campaign_type`, `ad_campaign_status`,
  `ad_spend`, `ad_sales`, `ad_campaign_budget_currency`. All campaign types (Sponsored
  Products, Brands, Display, TV); filter `ad_campaign_type` if the user wants SP only.
- `ad_sales` is the attributed sales column (7 days for Sponsored Products, 14 days for Brands
  and Display). The older 14-day column names no longer exist.
- **Track campaigns by `ad_campaign_id`**, show `ad_campaign_name` - names can be renamed in the
  console, ids don't change.
- Ads data refreshes at about 10am, 1pm and 4pm marketplace time; `from` / `to` are required
  (YYYY-MM-DD, marketplace time zone).
- **Attribution lag:** ad sales for the last few days keep arriving for up to 7-14 days, so a
  very recent ACoS can drop later. Mention it in the email footer.
- Currency from `ad_campaign_budget_currency`.
- Email: the user's connected email tool (e.g. Gmail). If it can only create drafts, create a
  draft and say so. Send only to the addresses the user gives.

## Step-by-step workflow (MCP-native)

**Setup (in chat):**
1. `sellers_and_vendors_list` -> ask which account / marketplace (e.g. UK or DE).
2. `exports_sources_get` (query "campaign") -> resolve the source; `exports_source_get` to
   confirm the columns.
3. **Top campaigns:** `exports_create`, last 30 days to yesterday, `groupBy ["ad_campaign_id",
   "ad_campaign_name"]`, sum `ad_spend` (alias `spend_sum`) and `ad_sales` (`sales_sum`),
   `orderByColumn sales_sum DESC`, `limit 10`, JSON. Merge rows per `ad_campaign_id` (a renamed
   campaign comes back under two names - keep the newest name), then take the top 5. Show the
   list (names, spend, sales, ACoS) and confirm it - or use the campaigns the user names.
4. Ask for: the ACoS threshold (one for all, or per campaign), the time and time zone (e.g.
   daily 15:00 Europe/London), and the email address(es).
5. Create the routine (Scheduling), then **run it once now** so the user gets the first email.
6. **Offer the updated version** (see below): "There's an updated version of this alert - it
   also warns when a campaign's ACoS is climbing week over week, before it crosses your
   threshold, and suggests the next step for every campaign over it. Want it?" On a yes,
   update the routine prompt to include it.

**Each run:**
1. `exports_create`: window (month-to-date to today; last 7 days in the first 3 days of a
   month), filter `ad_campaign_id in <ids, comma-separated>`, `groupBy ["ad_campaign_id",
   "ad_campaign_name", "ad_campaign_budget_currency"]`, sum `ad_spend` (`spend_sum`), sum
   `ad_sales` (`sales_sum`), max `date` (`last_data_date`), JSON. Merge rows per
   `ad_campaign_id` (newest name). The window label is "{1st} - {last_data_date}" - early in
   the day the newest date may still be partial or missing. Sponsored Brands rows have no budget
   currency; use the account's currency.
2. Compute ACoS per campaign from the unrounded sums; status = OVER if ACoS > threshold or
   (spend > 0 and sales = 0), else OK. A tracked campaign with no rows at all = "no data in
   window" (paused or archived) - list it, don't drop it.
3. Send the email (Output format) - every run, so silence never means "it didn't run".

## Output format

Subject:
- `⚠️ ACoS alert - {seller} {marketplace} - {n} of {N} campaigns over {T}% - {date}`, or
- `✅ ACoS OK - {seller} {marketplace} - all {N} campaigns under {T}% - {date}`

HTML body:

```
{n} campaign(s) are over your {T}% ACoS threshold ({window: month-to-date 1-17 May}).

Campaign                              Ad spend   Ad sales   ACoS    Threshold  Status
{name over threshold}                 £412.30    £1,580.00  26.1%   20%        OVER (+6.1pp)
{name}                                £233.10    £1,402.95  16.6%   20%        OK
...

ACoS for the most recent days can still fall as attributed sales arrive (7 days Sponsored
Products, 14 days Brands / Display). Data via DataDoe.
```

Row order: OVER campaigns first, largest over-by first; then the rest by ad spend, largest
first. Compare unrounded ACoS with the threshold, and show two decimals whenever one decimal
would print a value equal to the threshold (19.96% on an OK row must not read "20.0%").

## Updated version (offer after the first email)

Same email, same table - the updated version adds an early warning and a next step. Build it
only when the user says yes.

- **Rising ACoS:** one extra export per run - the tracked campaigns, `groupBy ["ad_campaign_id",
  "date"]` over the 14 days ending **2 days ago** (the newest days are still collecting
  attributed sales and would make ACoS look like it is rising), sums of spend and sales; split
  into two 7-day windows in code (a WEEK interval follows calendar weeks, so it can't do this).
  A campaign under the threshold whose ACoS rose by 5+ points (adjustable) goes into a
  "⬆ Rising" block: "{campaign}: 14.2% -> 19.6% (+5.4pp), still under 20%". An OVER campaign
  that is also rising gets a ⬆ next to its status instead of a second listing.
- **Next step** column for every OVER campaign: "In chat: 'find wasted spend in {campaign}'
  (PPC Wasted Spend Watchdog), then 'optimize bids for {campaign}' (PPC Bid Optimizer - dry
  run first, applied only on your approval)." Both follow-up skills cover Sponsored Products;
  for Brands / Display campaigns the next step is "review in the Amazon Ads console".
- Subject: `⚠️ ACoS alert - ... - {n} over, {r} rising - {date}` when any campaign is over;
  `⬆ ACoS rising - ... - {r} of {N} campaigns rising - {date}` when none is over but some are
  rising; `✅ ACoS OK - ...` when neither.

## Scheduling (daily routine)

Create the routine with the client's scheduler (a scheduled task / routine in Claude Code, the
Claude desktop app or Cowork; a scheduled task in ChatGPT). Its prompt must be self-contained -
and the skill must be installed where the routine runs (otherwise paste the full skill text into
the routine):

```
Every day at {15:00} {Europe/London}: run the ppc-campaign-acos-alert skill for DataDoe seller
{seller name} ({sellerOrVendorId}, {marketplace}). Campaigns (ad_campaign_id -> name): {list}.
Threshold: {20}% {or per campaign}. Window: month-to-date (last 7 days on days 1-3 of the
month) from amazon_ads_performance_by_campaign_by_date using ad_spend and ad_sales; spend with
zero sales counts as over. {Updated version: rising block over the 14 days ending 2 days ago,
next-step column.} Email the summary to {address} every run - subject ⚠️ when any campaign
is over, ✅ when all are under.
```

- Local routines need the computer on and the app running; cloud routines need the DataDoe and
  email connectors available there.
- The user can trigger a run any time ("run it now") to test.

## Worked example (illustrative)

UK account, top 5 campaigns by ad sales (30 days), threshold 20%, daily at 15:00. The first
run (17 May, month-to-date): four campaigns between 9% and 17% ACoS, one at 26.1% (£412 spend,
£1,580 sales) -> subject "⚠️ ACoS alert - My Store UK - 1 of 5 campaigns over 20%"; that campaign
is the first row, marked OVER (+6.1pp). The next day all five are under -> "✅ ACoS OK".

## Quality self-check

- Campaigns tracked by id, shown by name?
- ACoS computed from summed spend and sales for the window (not averaged daily ACoS)?
- Spend with zero sales flagged as over; missing campaigns listed?
- Email sent every run, over-threshold rows first, attribution note included?
- Rows merged per campaign id (renamed campaigns), window labelled with the newest data date,
  unrounded comparison with the threshold?
- Routine prompt self-contained (time and time zone, seller name, ids, threshold, window,
  recipient)?
- Did I offer the updated version - and change nothing unless the user said yes?

## Common mistakes

- Using the removed 14-day ad columns - the export fails.
- Filtering by campaign name - a rename silently drops the campaign.
- Averaging daily ACoS values.
- Skipping campaigns with spend but no sales (division by zero) - they are the worst ones.
- Only emailing on breaches, so a broken routine looks like "all good".
- Sending to an address the user didn't give.
- Showing a 19.96% ACoS as "20.0%" on an OK row - compare unrounded, show two decimals there.
- Measuring "rising" on windows that end yesterday - the newest days still collect sales, so
  most campaigns look like they are rising.

## Notes

- Read-only: it alerts, it never changes bids or budgets.
- When a campaign is over, the follow-up skills are PPC Wasted Spend Watchdog (find the search
  terms burning spend) and PPC Bid Optimizer (apply bid cuts with a dry run first).
- A DataDoe skill, built on `amazon_ads_performance_by_campaign_by_date`.
