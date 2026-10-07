---
name: vendor-performance-dashboard
description: >-
  Build a live Amazon Vendor Central performance dashboard - KPI scorecards for vendor
  sales, ad spend, ad sales, ROAS and orders for the last 30 days vs the previous 30 days, a
  daily trend of vendor sales and ad spend, and an ASIN table with sales, ordered units,
  glance views and conversion rate - from DataDoe's Vendor Central and Amazon Ads data. In
  Claude Cowork it is a live artifact with a Refresh button; elsewhere a self-contained HTML
  file; both can be saved as PDF. Use for "vendor dashboard", "vendor central dashboard",
  "vendor performance", "1P performance", "vendor sales and ads", "glance views and
  conversion", or "live vendor report". Then offers an updated version with ordered revenue,
  TACoS, and per-ASIN lost Buy Box and out-of-stock rates.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Vendor Performance Dashboard
  access: read
  category: Reporting
  interface: mcp
  output: report
  youtube-video-embed-url: https://www.youtube.com/embed/mOCjbfS7c14
---

# Vendor Performance Dashboard

A simple vendor performance dashboard that shows the main factors in one screen and takes a
few minutes to build: KPI scorecards (vendor sales, ad spend, ad sales, ROAS, orders) for the
last 30 days against the 30 before, a daily trendline of vendor sales and ad spend, and an
ASIN breakdown with sales, ordered units, glance views and conversion. It is interactive - one
Refresh pulls the newest data in seconds. Live from DataDoe.

## When to use this

- A weekly or monthly look at a Vendor Central account, or before a vendor / client meeting.
- Spotting the ASIN that is not converting, or ad spend rising while sales stay flat.
- Trigger phrases: "vendor dashboard", "vendor central dashboard", "vendor performance",
  "1P performance", "vendor sales and ads", "glance views and conversion".

## The framework. Same days on both sides

1. **Two equal windows, anchored on the newest vendor data.** Vendor data arrives ~4 days
   later than ads data. Find the newest `date` with vendor shipped revenue (`D`); current window =
   `D`-29 to `D`, previous window = the 30 days before. Use the same windows for ads, so a
   ROAS or a sales change is never computed against days that have ad spend but no vendor
   sales yet.
2. **KPIs** for each window, with the change vs previous (green good / red bad; for Ad Spend a
   fall is green, a rise under 10% neutral grey, 10% or more red; ratio changes such as ROAS
   are shown as the ratio change, percentages such as TACoS in points):
   - **Total Vendor Sales** = sum `manufacturing_retail_shipped_revenue`.
   - **Ad Spend** = sum `ad_spend`; **Ad Sales** = sum `ad_sales`.
   - **ROAS** = Ad Sales / Ad Spend (computed from the sums, never averaged).
   - **Total Orders (Units)** = sum `manufacturing_retail_ordered_units` (customer-ordered units).
3. **Trend:** daily vendor sales and daily ad spend across the current window (two axes).
4. **ASIN breakdown (current window):** sales, ordered units, glance views, and
   **CVR = ordered units / glance views**. Colour CVR: >= 15% high, >= 8% medium, below that low.
   If those bands put nearly every ASIN in one colour, colour against the account's median CVR
   instead (>= 1.25x median high, <= 0.75x low) and say so in a footnote.

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
  (`amazon_vendor_sales_traffic_and_inventory_by_child_and_date`) - `date`, `child_asin`,
  `manufacturing_retail_shipped_revenue` (+ `manufacturing_retail_shipped_revenue_currency`),
  `manufacturing_retail_ordered_units`, `glance_views`. Use the manufacturing view only (the
  `sourcing_retail_*` columns overlap it - never add them). Glance views are manufacturing
  traffic only.
- **Ads data:** `Ad Performance by Campaign & Date` (`amazon_ads_performance_by_campaign_by_date`)
  - `date`, `ad_spend`, `ad_sales`, `ad_orders` (all campaign types; Sponsored Products
  attribute 7 days, Brands / Display 14 days). The old 14-day column names no longer exist -
  use `ad_sales` and `ad_orders`.
- Both sources require `from` / `to` (YYYY-MM-DD). Row caps: 1,000 rows per JSON export, 5,000
  per CSV - daily totals for 60 days fit easily in JSON.
- No Amazon Ads connection, or no ad rows for a window: show ad KPIs as "-" with a note,
  never as 0.
- Currency: from the vendor `*_currency` column; check the ads budget currency
  (`ad_campaign_budget_currency`, null on Sponsored Brands rows) matches before computing ROAS.
- Some marketplaces report no shipped revenue on Sundays (seen on a German account): draw those
  days as gaps in the trend line, not as 0, and footnote them.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the vendor account (`accountType = VENDOR`, with an Amazon
   Ads connection for the ad KPIs).
2. `exports_sources_get` (queries "vendor sales", "campaign") -> resolve both sources;
   `exports_source_get` to confirm the columns above.
3. **Newest vendor date `D`:** `exports_create` on the vendor table, `from` = 14 days ago,
   `to` = today, `groupBy ["date"]`, sum `manufacturing_retail_shipped_revenue` (alias
   `shipped_revenue_sum`). `D` = the newest date whose sum is above 0 - rows can exist a day
   before their revenue does, and a `count` would end the window on an empty day.
4. Three exports over `from` = `D`-59, `to` = `D` (current + previous window):
   - **Vendor daily:** `groupBy ["date", "manufacturing_retail_shipped_revenue_currency"]`, sum
     `manufacturing_retail_shipped_revenue` (`total_revenue`), `manufacturing_retail_ordered_units`
     (`total_units`), `glance_views` (`total_glance_views`), order by `date`, JSON. Merge the rows
     of each date in code (rows without a currency belong to the same date).
   - **Ads daily:** `groupBy ["date", "ad_campaign_budget_currency"]`, sum `ad_spend`
     (`total_ad_spend`), `ad_sales` (`total_ad_sales`), `ad_orders` (`total_ad_orders`), order
     by `date`, JSON. Sponsored Brands rows have no budget currency - treat a null as the
     account's currency and merge per date.
   - **ASIN breakdown:** `from` = `D`-29, `to` = `D`, `groupBy ["child_asin"]`, the three
     vendor sums, `orderByColumn total_revenue DESC`, `limit` 25 (top 25 by sales).
5. Download the results, split the daily rows at `D`-29 into current / previous, compute KPIs
   and deltas.
6. Build the dashboard for the client:
   - **Claude Cowork:** a live artifact - embed the current data so it renders at once; the
     Refresh button re-runs steps 3-5 through `window.cowork.callMcpTool('<DataDoe tool name
     exactly as in your tool list>', args)` and re-renders; declare exports_create /
     exports_get / exports_raw_download in the artifact's MCP tool list; parse the MCP envelope
     (`content[0].text` -> JSON, id field `exportId`).
   - **Other clients:** one self-contained HTML file with the data embedded; refresh = re-run
     the skill.
   - Never embed a DataDoe key, MCP URL key or Anthropic key. Outside Cowork the Refresh button
     explains that live refresh runs inside Claude Cowork.
7. Report the path / show the artifact; offer the PDF and, if wanted, a routine that sends it.
8. **Offer the updated version** (see below): "There's an updated version of this dashboard - it
   adds ordered revenue and TACoS to the scorecards, and each ASIN's lost Buy Box share and
   out-of-stock rate, so you can see why an ASIN isn't converting. Want it?" Build it only on a
   yes.

## Output format

Modern dark style matching datadoe.com (background `#0d1117`, cards `#161c2c`, DataDoe green
`#22c55e` accents, blue `#60a5fa` for ad spend, Inter / system font), Chart.js 4 via CDN:

1. **Header:** vendor pill (account name + marketplace) · "{current from} - {current to} vs
   {previous from} - {previous to}" · "Updated {date}" · Refresh · Download PDF.
2. **KPI scoreboard (5 cards):** Total Vendor Sales · Ad Spend · Ad Sales · ROAS · Total Orders
   (Units); each with the value, a delta chip (+/- %) and "vs {previous value}".
3. **Trend chart:** "Vendor Sales & Ad Spend - daily" - green area line for vendor sales (left
   axis), blue area line for ad spend (right axis), shared tooltip.
4. **Performance by ASIN (top 25):** # · ASIN · Total Sales · Ordered Units · Glance Views ·
   CVR (coloured pill).
5. Footer: "Data via DataDoe".

PDF: Download PDF uses `window.print()` with print CSS (light background, A4 landscape) so the
user can restyle it for a client's brand and share it. If the user wants it sent on a schedule,
create a routine (scheduled task) that rebuilds the dashboard and emails the PDF to the
recipients they name - weekly or monthly.

## Updated version (offer after the standard dashboard)

Same layout - the updated version adds two scorecards and the "why" behind each ASIN. Build it
only when the user says yes (the Refresh button then re-runs the extra export too).

- **Scorecards 6 and 7:** **Ordered Revenue** (add sum `manufacturing_retail_ordered_revenue_amount`,
  alias `total_ordered_revenue`, to the vendor daily export so both windows have it - customer
  orders; shipped revenue lags it) and **TACoS** (Ad Spend / Total Vendor Sales, change in
  points), both with the delta vs the previous 30 days.
- **ASIN table, two new columns** for the top 25 ASINs:
  - **Lost Buy Box %** - `lost_featured_offer` (share of glance views where Amazon Retail lost
    the Featured Offer), averaged per ASIN weighted by daily `glance_views`.
  - **Out of Stock %** - `manufacturing_retail_procurable_product_oos`, weighted the same way.
  - Pull them with one extra export: current window, filter `child_asin in <top 25,
    comma-separated>`, `groupBy ["date", "child_asin"]`, aggregations avg `lost_featured_offer`
    (`lost_bb_rate`), avg `manufacturing_retail_procurable_product_oos` (`oos_rate`), sum
    `glance_views` (`day_glance_views`) - one row per ASIN-day, 25 x 30 rows fits in JSON. Weight
    in code by glance views and skip days with a null rate or 0 glance views - never average
    the daily rates unweighted.
  - Colour: amber from 10%, red from 25%.
- **Reading hint** under the table: low CVR + high Lost Buy Box -> a price / offer problem; low
  CVR + high Out of Stock -> an availability problem; both low -> look at content and reviews.

## Worked example (illustrative)

German vendor account, newest vendor data 12 May. Current window 13 Apr - 12 May vs 14 Mar -
12 Apr: Vendor Sales €182,400 (+6.1%), Ad Spend €14,900 (+18%), Ad Sales €61,300 (+4%), ROAS
4.11x (vs 4.66x), Orders 9,870 units (+3.2%). The trend shows spend stepping up from 1 May
while sales stay flat. In the ASIN table, ASIN C has the third-highest glance views but a 3.1%
CVR (red) - the one to look at first (price, content or availability).

## Quality self-check

- Did I anchor both windows on the newest date with vendor shipped revenue (not yesterday,
  not just the newest row) and use the same days for ads?
- Are ROAS and CVR computed from summed values, not averaged daily ratios?
- Did I use `ad_sales` / `ad_orders` and the manufacturing-view vendor columns only?
- Ads missing -> "-" with a note, not zeros?
- Currency from the data? No credentials in the page?
- Did I offer the updated version at the end - and change nothing unless the user said yes?

## Common mistakes

- Ending both windows yesterday - the last ~4 days have ad spend but no vendor sales, so sales
  and ROAS look worse than they are.
- Using the removed 14-day ad columns (`ad_sales_14d`) - the export fails.
- Averaging daily ROAS or CVR.
- Adding sourcing-view and manufacturing-view revenue together.
- JSON `limit` above 1,000.
- Finding the newest date with `count` - rows can arrive a day before their revenue, which ends
  the window on a €0 day.
- Plotting Sundays without shipped revenue as 0 (draw gaps).

## Notes

- Read-only. Vendor Central + Amazon Ads.
- Want more than the main factors? Ask in the same chat - filters, sorting or more marketplaces
  can be added; ordered revenue, TACoS, lost Buy Box and out-of-stock rates come with the
  updated version.
- A DataDoe skill, built on `amazon_vendor_sales_traffic_and_inventory_by_child_and_date` and
  `amazon_ads_performance_by_campaign_by_date`.
