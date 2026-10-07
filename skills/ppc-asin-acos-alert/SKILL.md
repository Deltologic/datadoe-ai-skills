---
name: ppc-asin-acos-alert
description: >-
  Set up a daily per-ASIN ACoS alert - give a list of ASINs with their own ACoS thresholds,
  and every morning a routine checks each ASIN's advertising ACoS from DataDoe and emails you
  the ASINs above their threshold and by how much. Then ask why an ASIN's ACoS is high and
  drill into its campaigns in the same chat. Use for "ASIN ACoS alert", "ACoS threshold per
  product", "email me when an ASIN goes over its ACoS", "keep ACoS low per ASIN", "product
  ACoS monitor", or "daily ACoS check by ASIN". Then offers an updated version that suggests
  each ASIN's threshold from its break-even ACoS and adds product names to the email. For
  campaign-level thresholds, use PPC Campaign ACoS Alert.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: PPC ASIN ACoS Alert
  access: read
  category: PPC & Ads
  interface: mcp
  output: report
  youtube-video-embed-url: https://www.youtube.com/embed/XY955bci5x4
---

# PPC ASIN ACoS Alert

Keeping ACoS low per ASIN is hard when every product has a different margin and therefore a
different acceptable ACoS. Give this skill your ASINs and each one's threshold; it builds a
morning routine that checks every ASIN's ACoS and emails you the ones above their threshold -
with the threshold and how far over each one is. When something is over, ask "why is ACoS high
for this ASIN?" and keep digging in the same chat. Live from DataDoe.

## When to use this

- Products with different margins (one ASIN can live with 55% ACoS, another not with 11%).
- A daily morning check without opening the ads console.
- Trigger phrases: "ASIN ACoS alert", "ACoS threshold per product", "email me when an ASIN goes
  over its ACoS", "keep ACoS low per ASIN", "product ACoS monitor".

## The framework. Your threshold per ASIN, checked every morning

1. **Inputs:** a list of ASINs, each with a maximum ACoS (e.g. B0... -> 40%, B0... -> 25%). The
   user pastes it, or asks the assistant to start from the ASINs' current ACoS.
2. **Measure:** per ASIN, **ACoS = ad spend / ad sales x 100**, from the summed values over the
   window - by default the **last 7 days ending yesterday** (the user can pick yesterday only,
   but a single day of PPC data is noisy and its ad sales are still arriving).
3. **Compare:** over = ACoS > threshold, or ad spend > 0 with zero ad sales (ACoS shown as "no
   sales"). **Over by** = ACoS - threshold, in percentage points.
4. **Alert:** email the ASINs that are over, worst first. No ASIN over -> no email by default
   (the user can ask for a short daily "all clear" instead).

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
- Data source: `Ad Performance by ASIN & Date` (`amazon_ads_performance_by_child_asin_and_date`)
  - `date`, `child_asin`, `product_name`, `ad_campaign_type`, `ad_campaign_name`, `ad_spend`,
  `ad_sales`, `is_estimated`. Several rows per ASIN and day (one per campaign / ad) - always sum.
- `ad_sales` is the attributed-sales column (7 days Sponsored Products, 14 days Display /
  Brands); the older 14-day column names no longer exist.
- Sponsored Brands rows are estimates (`is_estimated` = true: Amazon reports Brands at campaign
  level and DataDoe allocates them to ASINs). Default: include all ad types, so the ACoS matches
  the ASIN's total ad cost; if the user wants Sponsored Products only, filter `ad_campaign_type
  = SPONSORED_PRODUCTS`.
- Ads data refreshes at about 10am, 1pm and 4pm marketplace time; a run at ~8am reports through
  the previous day. `from` / `to` are required (YYYY-MM-DD).
- **Attribution lag:** the newest days' ad sales keep arriving for up to 7-14 days, so a recent
  ACoS can still fall. Say so in the email footer.
- Email: the user's connected email tool (e.g. Gmail); if it can only draft, create a draft and
  say so. Send only to the addresses the user gives.

## Step-by-step workflow (MCP-native)

**Setup (in chat):**
1. Take the ASIN -> threshold list from the user. If they only have ASINs, pull their last-30-day
   ACoS (run step 1 with a 30-day window) and let them set thresholds against it.
2. Ask for: the email address, the account / marketplace (`sellers_and_vendors_list` - e.g. UK
   or DE), the time (default ~08:10 local, daily) and the window (default last 7 days).
   Yesterday's ads data arrives around 10am: a run before that ends its window the day before
   yesterday (and says so); schedule after ~10:30 to include yesterday.
3. `exports_sources_get` (query "asin ads") -> resolve the source; `exports_source_get` to
   confirm the columns.
4. Show the plan back (ASINs, thresholds, recipient, time), create the routine (Scheduling), and
   offer to **run it now** once.
5. **Offer the updated version** (see below): "There's an updated version of this alert - it
   suggests each ASIN's threshold from its break-even ACoS (your margin before ads) instead of a
   guess, and adds product names to the email. Want it?" On a yes, show the suggested
   thresholds for approval and update the routine prompt.

**Each run:**
1. `exports_create`: `from` = window end - 6, `to` = window end (yesterday, or the day before
   when the run is before ~10am), filter `child_asin in <ASINs, comma-separated>`, `groupBy
   ["child_asin"]`, aggregations sum `ad_spend` (alias `spend_sum`) and sum `ad_sales`
   (`sales_sum`), `limit 1000`, JSON.
2. Per ASIN: ACoS from the sums, over / OK, over-by. An ASIN with no rows, or with 0 spend and 0
   sales, = "no ad activity" (listed once in the footer, not an alert).
3. If any ASIN is over: send the email (Output format).

**Follow-up - "why is ACoS high for ASIN X?"** (in chat, on request):
1. Same source, that ASIN only, this window vs the window before, `groupBy ["ad_campaign_name",
   "ad_campaign_type"]`, sums of `ad_spend`, `ad_sales`, `ad_clicks`, `ad_orders` (aliases
   `spend_sum`, `sales_sum`, `clicks_sum`, `orders_sum`).
2. Name the driver: which campaign's spend rose, which campaign's sales fell, CPC up or
   conversion down. Sponsored Brands rows have no clicks - compute CPC and conversion from
   Sponsored Products + Display rows only.
3. Route the fix: PPC Wasted Spend Watchdog for the search terms burning spend, PPC Bid
   Optimizer to cut bids (dry run first).

## Output format

Subject: `ACoS Alert - {n} ASINs over threshold ({date})`

HTML body (a real table, not plain text):

```
{n} ASINs exceeded their ACoS targets over the last 7 days ({from} - {to}).

ASIN          Current ACoS   Threshold   Over by
B0XXXXXXX1    48.2%          35%         +13.2 pp
B0XXXXXXX3    41.0%          37%         +4.0 pp
B0XXXXXXX2    no sales       25%         £64.20 spend, 0 sales

No ad activity in the window: {ASINs, or "none"}.
Ad spend and sales include all ad types (Sponsored Brands allocated per ASIN by estimate).
ACoS for the most recent days can still fall as attributed sales arrive.
- DataDoe ACoS Monitor
```

Row order: ASINs with an ACoS first, largest over-by first; then the "no sales" rows, largest
spend first. Keep the table even for one ASIN. `{date}` in the subject is the run date
(e.g. 7 Oct 2026).

## Updated version (offer after setup)

Same routine, same email - the updated version makes the thresholds evidence-based and the
email easier to read. Build it only when the user says yes.

- **Break-even ACoS per ASIN** from `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`,
  premium - 5 AI Tokens per export) over a settled window - `from` = today - 104 days, `to` =
  today - 15 days (90 days; Amazon's fees reach the profit table late) - `groupBy
  ["child_asin", "product_name", "cogs_present"]`, sums of `total_sales`, `sales_tax`,
  `cogs_total`, `total_fees` (aliases `sales_sum`, `tax_sum`, `cogs_sum`, `fees_sum`). The
  `cogs_present` groups mean different things - treat them separately:
  - `true` - sales rows with uploaded COGS: use their sales, tax, COGS and fees.
  - `false` - sales rows **missing** COGS: leave them out (they would inflate the margin) and
    report their share of sales as the COGS gap; under ~80% coverage, ask the user for a unit
    cost instead of guessing.
  - `null` - **fee-only rows** (no shipped items or returns that day: storage, inbound and
    similar fees). Keep their fees - they are real costs of the ASIN. If part of the sales was
    left out as `false`, scale these fees by the covered share so costs and sales match.
  Margin before ads = (net sales - COGS - all kept fees) / net sales, where net sales = sales -
  sales tax (`sales_tax` is already 0 in the US / Canada); **break-even ACoS = that margin**.
- **Break-even at or below 0:** the ASIN "loses money before ads - check COGS and fees"; no ACoS
  target can be profitable, so suggest no threshold for it.
- Caveats to show with the table: DataDoe fees can include VAT charged on Amazon's fees - for a
  VAT-registered seller who reclaims it, break-even comes out a few points too low
  (conservative); refunds are not in the formula.
- **Suggested threshold** = break-even ACoS minus the user's target profit margin (default 0
  points = break-even). Show ASIN | product | current 30-day ACoS | break-even ACoS | suggested
  threshold, and let the user accept or edit before the routine is updated.
- **Product names** in the alert email - take them from the break-even export above (or
  `Product Catalog by ASIN`, `amazon_products_by_child_asin`, for ASINs without sales), one name
  per ASIN, cut to ~60 characters; when two ASINs share a title (sizes, colours), add the SKU or
  the size so they can be told apart.

## Scheduling (daily routine)

Create the routine with the client's scheduler (a scheduled task / routine in Claude Code, the
Claude desktop app or Cowork; a scheduled task in ChatGPT). Self-contained prompt:

```
Every day at {08:10} {Europe/London}: run the ppc-asin-acos-alert skill for DataDoe seller
{seller name} ({sellerOrVendorId}, {marketplace}). Thresholds (ASIN -> max ACoS %): {B0...: 40,
B0...: 35, ...}. Window: last 7 days ending yesterday (ending the day before yesterday when run
before ~10am), from amazon_ads_performance_by_child_asin_and_date (sum ad_spend and ad_sales per
child_asin); spend with zero sales counts as over. {Updated version: product names.} Email
{address} only if an ASIN is over: table ASIN | Current ACoS | Threshold | Over by, worst first.
```

The skill must be installed where the routine runs (otherwise paste the full skill text into
the routine).

- Local routines need the computer on and the app running; cloud routines need the DataDoe and
  email connectors there.
- "Run now" any time to test or to see today's state.

## Worked example (illustrative)

20 ASINs with thresholds from 11% to 76%, UK account, daily 08:10, last 7 days. This morning 3
are over: one at 48.2% vs 35% (+13.2pp), one with £64 spend and no sales vs 25%, one at 41% vs
37% (+4pp). The email lists them in that order. The user replies in chat "why is ACoS high for
the first one?" - the drill shows one auto campaign doubled its spend week over week with flat
sales -> next step: wasted-spend watchdog on that campaign's search terms.

## Quality self-check

- Summed all rows per ASIN (several campaigns / ads per day) before dividing?
- Spend with zero sales flagged, not skipped?
- Over-by in percentage points, worst first, table format?
- Window stated in the email; attribution note included?
- Window end correct for the run time (before ~10am -> the day before yesterday), and stated?
- Updated version: break-even from rows with COGS plus fee-only rows (null), rows missing COGS
  left out and reported, negative break-even reported as "loses money before ads"?
- Routine prompt contains every ASIN and threshold, the recipient, the time and time zone?
- Did I offer the updated version - and change nothing unless the user said yes?

## Common mistakes

- Using the removed 14-day ad columns - the export fails.
- Dividing per row and averaging ACoS instead of summing spend and sales first.
- Skipping ASINs with zero sales (division by zero) - they are the most expensive ones.
- Alerting on a one-day window and chasing noise.
- Mixing marketplaces - one routine per marketplace account.
- Including a half-loaded yesterday in an early-morning run (Sponsored Brands rows missing,
  Sponsored Products spend partial).
- Computing break-even from rows without COGS (it looks far too generous) - or dropping the
  fee-only rows (`cogs_present` null), which removes storage / inbound fees and overstates the
  safe ACoS.

## Notes

- Read-only: it alerts, it never changes bids.
- A good threshold is the ASIN's break-even ACoS (its margin before ad cost); ask the user if
  they want help estimating it from DataDoe profit data.
- A DataDoe skill, built on `amazon_ads_performance_by_child_asin_and_date`.
