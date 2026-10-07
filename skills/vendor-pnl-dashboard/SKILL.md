---
name: vendor-pnl-dashboard
description: >-
  Build an Amazon Vendor Central profit-and-loss dashboard - shipped revenue, net revenue
  after ads, ad spend, ad revenue, TACoS, ACoS, ROAS and impressions with month-over-month
  badges, a revenue trend and an ad-efficiency chart, and a 12-month P&L statement (ordered
  and shipped revenue, advertising, contribution, reach) - from DataDoe's Vendor Central and
  Amazon Ads data. In Claude Cowork it is a live artifact with a Refresh button; elsewhere a
  self-contained HTML file. Use for "vendor P&L", "vendor profit and loss", "vendor central
  dashboard", "1P P&L", "vendor TACoS", "vendor ad efficiency", or "monthly vendor report".
  Then offers an updated version that adds your true vendor margin - what Amazon pays you,
  co-op deductions, margin after ads - and Amazon's Net PPM on your products.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Vendor P&L Dashboard
  access: read
  category: Profit & Finance
  interface: mcp
  output: report
  youtube-video-embed-url: https://www.youtube.com/embed/Bfl4OCux3B0
---

# Vendor P&L Dashboard

A monthly profit-and-loss view for Amazon vendors: what your products shipped, what you spent
on ads, what that spend returned, and what is left after ads - with month-over-month badges, two
trend charts and a full 12-month P&L statement. The tools that do this for big vendors cost
hundreds per month; this builds it from your own data in minutes. Live from DataDoe.

## When to use this

- Monthly vendor business review, or before a call with your Amazon vendor manager.
- Checking whether rising ad spend is paying for itself (TACoS / ROAS trend).
- Trigger phrases: "vendor P&L", "vendor profit and loss", "vendor central dashboard", "1P
  P&L", "vendor TACoS", "vendor ad efficiency", "monthly vendor report".

## The framework. Revenue, ad cost, what's left

Per month (12 full months by default), merged on the month:

- **Ordered Revenue** = `manufacturing_retail_ordered_revenue_amount` (customer orders).
- **Shipped Revenue** = `manufacturing_retail_shipped_revenue`.
- **Ad Spend** = `ad_spend`; **Ad Revenue** (ad-attributed) = `ad_sales`; **Impressions** =
  `ad_impressions`; **Clicks** = `ad_clicks`.
- **Net Revenue After Ads** = Shipped Revenue - Ad Spend (and its % of shipped revenue).
- **TACoS** = Ad Spend / Shipped Revenue · **ACoS** = Ad Spend / Ad Revenue · **ROAS** = Ad
  Revenue / Ad Spend · **Ad Spend % of Rev** = Ad Spend / Shipped Revenue · **CTR** = Clicks /
  Impressions.
- Ratios are always recomputed from the summed values per month (and for the total) - never
  averaged or summed.
- **Totals:** revenue cards (Shipped / Ordered Revenue) total all months shown. Every ad-based
  total - Ad Spend, Ad Revenue, TACoS, ACoS, ROAS, Net Rev After Ads, Impressions, Clicks - is
  computed over **the dates that have ad data only** and labelled with that range (e.g. "14 Jun -
  30 Sep"), so a ratio never divides ad money by revenue from days without ads. When ads start
  mid-month, that month's revenue for the ad totals (and for its own TACoS / Net Rev After Ads
  cells) is the revenue of the covered dates only (`first_ad_day` to month end), never the whole
  month; days before the ads connection count as unknown, not as zero ad spend. Each card's
  badge compares the last full month with the month before (MoM).

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
- **Vendor data:** `Sales, Traffic & Inventory by ASIN & Date`
  (`amazon_vendor_sales_traffic_and_inventory_by_child_and_date`) - `date`,
  `manufacturing_retail_shipped_revenue` (+ `manufacturing_retail_shipped_revenue_currency`),
  `manufacturing_retail_ordered_revenue_amount`. Manufacturing view only; never add the
  overlapping `sourcing_retail_*` columns. Vendor history goes back up to ~720 days; data
  arrives ~4 days late.
- **Ads data:** `Ad Performance by Campaign & Date` (`amazon_ads_performance_by_campaign_by_date`)
  - `date`, `ad_spend`, `ad_sales`, `ad_impressions`, `ad_clicks`. The old 14-day column names
  no longer exist - use `ad_sales`.
- **Ads history is short.** Amazon lets DataDoe backfill only ~60 days of ads when the account
  connects, so older months have vendor sales but no ad data. Show those ad cells as "-" (never
  0), and mark the first ads month "partial" if ads start mid-month.
- Monthly grouping: `groupBy ["date"]` with `dateInterval MONTH`. Both sources require
  `from` / `to` (YYYY-MM-DD).
- Window: the last 12 full calendar months (`from` = 1st of the month 12 months ago, `to` = last
  day of last month). If today is within the first ~5 days of a month, last month's vendor data
  may still be arriving - mark that month "provisional".
- Currency: group by the vendor `*_currency` column as well and merge the rows of each month in
  code - some rows (ordered revenue without shipments) have no currency, and they still belong
  to the month. Never hardcode a symbol.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the vendor account (`accountType = VENDOR`; it needs an
   Amazon Ads connection for the advertising rows).
2. `exports_sources_get` (queries "vendor sales", "campaign") -> resolve both sources;
   `exports_source_get` to confirm the columns.
3. **Sales export:** vendor table, the 12-month window, `groupBy ["date",
   "manufacturing_retail_shipped_revenue_currency"]`, `dateInterval MONTH`, sum
   `manufacturing_retail_shipped_revenue` (alias `total_shipped_revenue`), sum
   `manufacturing_retail_ordered_revenue_amount` (`total_ordered_revenue`), min `date`
   (`first_day`), max `date` (`last_day`), order by `date` ASC, `limit 50`, JSON.
4. **Ads export:** ads table, same window, `groupBy ["date"]`, `dateInterval MONTH`, sum
   `ad_spend` (`total_ad_spend`), `ad_sales` (`total_ad_revenue`), `ad_impressions`
   (`total_impressions`), `ad_clicks` (`total_clicks`), min `date` (`first_ad_day`), max `date`
   (`last_ad_day`), order by `date` ASC, `limit 50`, JSON.
5. Download, merge by month, compute the derived metrics (ad metrics `null` where the month has
   no ad rows). Use `first_ad_day` to mark the first ads month "partial" and `last_day` to mark
   a month "provisional" when its vendor data stops before the month's end.
   **Partial first ads month:** if `first_ad_day` isn't the 1st, run one more vendor export from
   `first_ad_day` to that month's end (same sums, no `dateInterval`) and use that revenue for the
   month's ad ratios and Net Rev After Ads, and in the ad-based totals. The month's Shipped and
   Ordered Revenue rows still show the full month.
6. Build the dashboard:
   - **Claude Cowork:** a live artifact - embed the merged months so it renders at once (label
     "Last snapshot {time}"); the Refresh button re-runs steps 3-5 through
     `window.cowork.callMcpTool('<DataDoe tool name exactly as in your tool list>', args)`,
     with exports_create / exports_get / exports_raw_download declared in the artifact's MCP
     tool list; parse the MCP envelope (`content[0].text` -> JSON, id field `exportId`).
   - **Other clients:** one self-contained HTML file with the data embedded; refresh = re-run
     the skill.
   - Never embed a DataDoe key, MCP URL key or Anthropic key. Outside Cowork, Refresh says live
     refresh runs inside Claude Cowork and keeps the last snapshot on screen.
7. Report the path / show the artifact.
8. **Offer the updated version** (see below): "There's an updated version of this P&L - below the
   current view it adds what Amazon actually pays you (shipped COGS), co-op deductions, your
   margin after ads, and Amazon's Net PPM on your products. Want it?" Build it only on a yes.

## Output format

Clean light theme (background `#f4f5f7`, white cards, coloured top border per KPI), Chart.js 4
via CDN:

1. **Header:** "Amazon Vendor P&L" · vendor name + marketplace · period · Refresh · last
   snapshot time.
2. **KPI row 1 (7 cards, each with a MoM badge):** Shipped Revenue ("{ordered revenue}
   ordered") · Net Rev After Ads ("{x}% margin") · Ad Spend ("{TACoS} TACoS") · Ad Revenue
   ("ROAS {x}") · TACoS ("Ad Spend ÷ Shipped Rev") · ACoS ("Ad Spend ÷ Ad Revenue") · ROAS
   ("Ad Rev ÷ Ad Spend"). **Row 2:** Impressions ("{clicks} clicks").
3. **Charts:** *Revenue Trend* - shipped revenue bars + net revenue after ads line, by month.
   *Ad Efficiency* - ad spend bars + TACoS % line + ACoS % dashed line.
4. **Monthly P&L Statement** (months as columns, scrollable):
   - Revenue: Ordered Revenue · Shipped Revenue
   - Advertising: Ad Spend · Ad-Attributed Revenue · ROAS · ACoS · TACoS
   - Contribution: **Net Revenue After Ads** · Ad Spend % of Rev
   - Reach: Impressions · Clicks · CTR
   Months without ads show "-"; a partial or provisional month carries a small badge.
5. Footer: "Data via DataDoe" and a one-line note that ads history starts {first ads month}.

## Updated version (offer after the standard dashboard)

Everything above stays exactly as it is. The updated version adds a **Vendor Margin** section
below the P&L statement, because shipped revenue is Amazon's retail revenue - what the vendor
actually earns is what Amazon pays for the goods. Build it only when the user says yes.

- Add to the monthly sales export: sum `manufacturing_retail_shipped_cogs` (alias
  `vendor_revenue`), `sourcing_retail_contra_cogs_amount` (`contra_cogs`) and
  `sourcing_retail_sales_discount_amount` (`sales_discount`). Contra-COGS and the sales discount
  are populated under the **sourcing** view (the manufacturing columns came back empty in
  testing); if a sourcing column is empty for the account, use the manufacturing one instead.
  Contra-COGS is Amazon's estimate of co-op and similar vendor-funded terms, not your actual
  remittance deductions.
- **Rows (months as columns, same table style):**
  - **Vendor Revenue (paid by Amazon)** = shipped COGS.
  - **Co-op / Contra-COGS (est.)** = contra-COGS.
  - **Ad Spend** (same as above).
  - **Vendor Margin after Ads** = vendor revenue - contra-COGS - ad spend, and its % of vendor
    revenue. Months without ad data show "-" for this row.
  - **Product cost and Margin after Product Cost** - only if the user has costs in DataDoe:
    `amazon_vendor_listings`.`cogs_item_value` per SKU x shipped units by ASIN. That table is not
    in the default dataset, and it can be enabled with every cost at 0 - check `max` of
    `cogs_item_value` first and skip these rows (saying so) unless it is above 0.
  - **Amazon Net PPM** = (shipped revenue - shipped COGS + contra-COGS - sales discount) /
    shipped revenue - Amazon's own margin on your products. A falling or negative Net PPM is
    the "CRaP" warning sign: Amazon may stop ordering or ask for margin support.
- **One KPI card** added in row 2: "Vendor Margin after Ads" (total, with MoM badge).
- **Chart:** Net PPM line by month next to the Ad Efficiency chart.

## Worked example (illustrative)

A German vendor account whose ads were connected in mid-June: vendor revenue goes back 12
months, ads only from 14 June. Revenue cards (12 months): Shipped Revenue €781K, Ordered
Revenue €781K - the two rows differ every month (September: €52.2K shipped vs €50.4K ordered).
Ad cards (Jun-Sep only): Ad Spend €9.8K, Ad Revenue €77.2K, ROAS 7.86x, ACoS 12.7%, TACoS 4.1%,
Net Rev After Ads €228K on €238K of shipped revenue for 14 Jun - 30 Sep (June counted from the
14th only). The P&L table shows ad rows "-"
before June and June marked partial.

## Quality self-check

- Is Ordered Revenue taken from `manufacturing_retail_ordered_revenue_amount` (not a copy of
  shipped revenue)?
- Months without ad data shown as "-" (not 0), first ads month marked partial, and its ad
  ratios computed on revenue for the covered dates only?
- Ratios recomputed from sums per month and for the totals?
- Only the manufacturing view used? Currency from the data?
- Last month marked provisional when run in the first days of a month?
- No credentials in the page?
- Did I offer the updated version at the end - and change nothing unless the user said yes?

## Common mistakes

- Filling the Ordered Revenue row with shipped revenue.
- Showing 0 ad spend for months before the ads connection (it reads as "no ads" and inflates
  net revenue after ads).
- Using the removed 14-day ad columns - the export fails.
- Averaging monthly TACoS / ACoS into the KPI instead of dividing the totals - or dividing
  ad totals by revenue from months without ads.
- Naming a total after its column (`glance_views` -> ALIAS_COLLISION, the export is rejected).
- Adding manufacturing and sourcing views together.

## Notes

- Read-only. Vendor Central + Amazon Ads.
- Shipped revenue is Amazon's retail revenue from your products. What Amazon pays you is
  `manufacturing_retail_shipped_cogs` (Amazon's cost) - keep that in mind when reading
  "Net Revenue After Ads"; it is a revenue-after-ads view, not your margin.
- A DataDoe skill, built on `amazon_vendor_sales_traffic_and_inventory_by_child_and_date` and
  `amazon_ads_performance_by_campaign_by_date`.
