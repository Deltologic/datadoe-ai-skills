---
name: weekly-sales-briefing
description: >-
  Generate a structured weekly Amazon sales briefing as an interactive HTML card. Use this skill whenever the user asks for a weekly sales report, weekly briefing, weekly summary, sales overview, or any request combining "week" with sales/revenue/performance. Also trigger when the user says things like "how did we do this week", "give me the weekly numbers", "show me this week's sales", or "weekly recap". The skill fetches live data from DataDoe (production) for pointed seller and renders a polished interactive HTML card with KPIs, top SKUs, biggest drops, and AI-generated insights.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Weekly Sales Briefing
  access: read
  category: Reporting
  interface: mcp
  output: report
---

# Weekly Sales Briefing Skill

Generates a structured Amazon sales briefing for the selected seller from DataDoe production data, rendered as an interactive HTML card artifact.

## Configuration

- **MCP base**: https://mcp.datadoe.com/mcp/v1
- **Seller**: resolve at run time with `sellers_and_vendors_list` - pick the seller the user
  means (ask if several match), keep its `id` as `sellerOrVendorId`, its `name` for the
  header, and its `marketplaceCountryCode` for the currency. Never hardcode a seller.
- **Currency**: derive from the marketplace. Note the two spellings: `sellers_and_vendors_list`
  returns `marketplaceCountryCode: UK` while table columns return `GB` for the same rows -
  map both (`UK`/`GB` -> GBP £, `DE`/`FR`/`IT`/`ES`/`NL` -> EUR €,
  `US` -> USD $, `CA` -> CAD $, and so on) and use that symbol everywhere below (written as
  `{cur}` in this document). Never hardcode one symbol.
- **Data cost**: both tables used below are premium export (5 AI Tokens instead of 2;
  always-on default dataset, never disabled). Do not print the token cost in the card.
- **Anchor to the last complete day, not to "today".** Sales on the profit tables run
  **~1 day behind** (shipped-order sales, refreshed intraday at 10am / 1pm / 4pm - the
  newest day is still filling), traffic (sessions / page views / buy box) runs **up to 3
  days behind** and can be revised for up to 30 days, and mid-window gaps still happen.
  Calendar windows off "today" therefore include partial days and fake a collapse. First
  detect the last complete day and which days are actually present (workflow step 1). The **last complete day is the last day of
  the longest recent contiguous run of present days** - not simply the latest present
  day. An isolated present day after a hole (e.g. one day of data after a 4-day gap) is
  not an anchor: anchoring there yields a 3/7 "this week" and a fake -58%. Then:
  - **"This week"**: the 7 days ending on the last complete day.
  - **"Last week"**: the 7 days before that.
  - **"Last month"**: the same 7-day window 4 weeks before "this week".
- Build each window from the **days actually present** and count how many of the 7 have
  data (effective days) - never assume all 7 are there.
- Lightweight by design (the quick sales-only read). For the deep profit / margin / TACoS
  / fee-settlement drill, use **`weekly-business-review`**.

---

## Data Source

Two tables, both with `requiresDatePeriod: true` - top-level `from` / `to` are mandatory
on every export (a filter on `date` does not replace them):

- **"Profit by Date"** - table `amazon_profit_by_date`: account level, **one row per date
  and currency**. Used for the calibration pull (which days are complete).
- **"Profit by SKU & Date"** - table `amazon_profit_by_sku_and_date`: **one row per SKU,
  child ASIN and date**. Used for the three window exports.

Resolve each `sourceId` with `exports_sources_get` (query "profit by date" / "profit by
sku") and confirm the hit on `tableName`; do not hardcode the ids. Both sit in the
always-on default dataset, so there is no deprecation warning to carry into the card.
Key columns:

- `amazon_profit_by_date`: date, currency, total_sales, total_units_sold, total_orders,
  total_sessions
- `amazon_profit_by_sku_and_date`: date, child_asin, sku, product_name, total_sales,
  total_units_sold, total_orders (and sales_tax if the user wants ex-VAT)

`total_sales` is sales from **shipped** order items and is **VAT-inclusive** on marketplaces
where Amazon reports prices with tax (all except US/CA); for ex-VAT revenue also sum
`sales_tax` and subtract it. The traffic columns (`total_sessions`, `total_page_views`,
`avg_buybox_percentage`) come from Amazon's Sales and Traffic report and lag **up to 3
days** (revisable for 30) while sales lag ~1 day - judge their completeness separately
(step 0).

First a **calibration pull** to find the real data days, then **three window exports**:

0. **Calibration**: one `exports_create` on `amazon_profit_by_date` over the last **~50
   days** (lag + 35 days - it must cover the 4-weeks-ago window too, which a 30-day pull
   misses), `groupBy: ["date", "currency"]` (account rows are per date *and* per currency;
   grouping on `date` alone would merge currencies), aggregations `sum(total_sales)`,
   `sum(total_units_sold)`, `sum(total_orders)` and `max(total_sessions)` (account-level
   rows are already one per date, so `max` just carries the day's value through),
   `orderByColumn: date`, JSON, `limit: 100` (one row per day per currency, ~50 rows).
   This table has no per-ASIN row count, so completeness is judged on the values:
   - **Sales-present day**: `total_sales` *and* `total_units_sold` at or above ~60% of
     their median over the span (relative, per account - never a fixed amount). Sales are
     shipped-order sales that run ~1 day behind, so expect the newest day (sometimes two)
     to fall under the threshold - that is the normal lag, not an outage. A day under the
     threshold inside the span is a gap. **Mandatory cross-check:** add `sum(unshipped_sales)`; a day where it exceeds ~10% of `total_sales + unshipped_sales` is still filling and is NOT complete even if it passes the 60% test (observed: a day at 74% of median sales with 18.5% unshipped flipped the week-over-week sign).
   - **Traffic-present day**: judged **separately** - `total_sessions` at or above ~60% of
     its median. Traffic lags far more than sales (Amazon says up to 3 days; measured 11-13
     days behind on a UK account, with holes), so the traffic-present tail is whatever this
     detection finds, and the days after it are **traffic-provisional even when their sales
     are complete**. This briefing is
     sales-only and anchors on sales presence; if you show any traffic or rate metric,
     compute it from traffic-present days only and say so in the card.
   - The **last complete day** = the last day of the **longest recent contiguous run** of
     sales-present days. Walk back from the tail: skip any isolated present day that sits
     after a hole and anchor on the run before it (e.g. present 08-30..09-20, hole
     09-21..09-24, isolated 09-25 -> anchor 09-20, not 09-25). Only if no 7-day contiguous
     run exists in range, fall back to the latest present day and label every window
     provisional. Anchor the windows below to the last complete day.
1. **This week**: the 7 days ending on the last complete day.
2. **Last week**: the 7 days before that.
3. **Last month (same window)**: the same 7-day window 4 weeks before "this week".
   Each window is **one grouped export** on `amazon_profit_by_sku_and_date`
   (`groupBy [child_asin, product_name]`, see step 2) - never an ungrouped per-day pull:
   rows on this table are per SKU per day, so a 7-day window at ~1,600 ASINs is well over
   11k rows and silently overflows the 5,000-row CSV cap (the server returns exactly the
   limit and warns that rows may be missing).
   > Tip: Fire the three window exports concurrently, then poll them together. Each
   > typically completes in under 30 seconds. Poll every 5 seconds. Never give up before completion.

---

## Step-by-step Workflow

### 1. Calibrate, then compute date ranges

First run the calibration pull (Data Source step 0): list the dates actually present in
the last ~50 days and pick the **last complete day** (end of the longest recent contiguous
run of present days - not an isolated day after a hole). Compute the three windows anchored
to that day (not to "today"), formatted `YYYY-MM-DD`, check that all three fall inside the
calibration span, and note which dates inside each window are missing - you'll disclose
effective days per window later.

### 2. Create three exports

Call `exports_create` three times (one per window, concurrently if possible) with:

- `sellerOrVendorIds`: `[<id from sellers_and_vendors_list>]` (an array, not a singular key)
- `sourceId`: the id resolved above for `amazon_profit_by_sku_and_date`
- `groupBy`: `["child_asin", "product_name"]` - one row per ASIN for the whole window
  (~2,500 rows here), so the export stays under the 5,000-row CSV cap; it also folds an
  ASIN's several SKU rows into one. Do **not** request `date` ungrouped per ASIN: a
  7-day window is 11k+ rows and gets truncated at the cap.
- `aggregations`: `sum(total_sales)` as `sales`, `sum(total_units_sold)` as `units`,
  `sum(total_orders)` as `orders` (optionally `countDistinct(date)` as `days` to see how
  many days each ASIN sold on, and `sum(sales_tax)` as `tax` for an ex-VAT view).
  **`sum` is only right for sales, units and orders.** `total_sessions`,
  `total_page_views` and `avg_buybox_percentage` are "for the child ASIN on this date"
  and are **repeated on every SKU row of that ASIN**, so summing them over SKU rows
  double-counts every multi-SKU ASIN. If you need traffic, run a separate export
  `groupBy ["date", "child_asin"]` with `max()` for those three columns and add them
  across days in code - never `sum()` them in the grouped export.
- `outputType`: `"CSV"`, `limit`: `5000` (both are required by `exports_create`)
- `from` / `to`: the appropriate window per export - mandatory on this table
  (`requiresDatePeriod: true`); these are the only accepted date keys, the legacy camelCase
  names are rejected and a `date` filter does not replace them

If any export returns `rowCount` equal to the limit, the catalog is larger than the cap -
say so and do not treat the totals as complete.

### 3. Poll until complete

Poll each export's status every 5 seconds. When all three are `COMPLETED`, download the raw CSV/JSON content.

### 4. Aggregate per ASIN

Each window export already comes back as one row per `child_asin` + `product_name` with
summed `sales` / `units` / `orders` - that is the revenue per ASIN per period. Sum the rows
for the window total; it should closely match the calibration's per-day `sum(total_sales)`
from `amazon_profit_by_date` over the same dates and currency (a cheap reconciliation - a
material gap means an export was truncated).
**Count effective (present) days per window** (out of 7) from the calibration data. If a
window has < 7 present days, either normalize the comparison to a per-present-day basis OR
label that window **provisional** and state how many days it reflects. Check ALL windows -
an under-counted last week fakes a boom just as a partial this week fakes a collapse.

### 5. Compute KPIs

- **This week revenue**: sum of `total_sales` for this week
- **vs last week**: absolute `{cur}` change + % change
- **vs last month (same window)**: absolute `{cur}` change + % change

If any window is provisional (< 7 present days), mark the affected KPI provisional and do
NOT present a partial-week delta as a real move. If you show any rate metric (conversion /
buy-box), remember there is no conversion column on this table - compute conversion as
`total_units_sold / total_sessions` (or `total_orders / total_sessions`) from the
per-ASIN `max()` traffic export (step 2), use traffic-present days only (the newest ~3
days of traffic are provisional even when sales are complete) and flag it provisional too.

### 6. Rank SKUs

- **Top 5 by revenue this week**: sort by this week's `total_sales` descending, take top 5. Show ASIN, product name (truncated to ~40 chars), revenue, units.
- **Top 3 drops vs last week**: compute `this_week_revenue - last_week_revenue` per ASIN. Sort ascending (most negative first), take top 3. Show ASIN, name, this week revenue, last week revenue, and `{cur}` / % drop. Only include ASINs that had revenue in both periods.
  **Same provisional guard as the KPI block:** if either window has < 7 effective days,
  the "drops" are just the biggest SKUs seen for fewer days (a 3/7 week prints every hero
  SKU as a -50..-80% drop). Either rank on per-present-day revenue and label the section
  provisional, or suppress the section and say why - never present partial-week drops as
  real moves.

### 7. Generate 1–2 insights

Write short, sharp observations using the data. Examples:

- "Revenue down 8% WoW, driven by SKU X dropping {cur}Y"
- "Top performer [SKU] up {cur}Z vs last week"
- "3 SKUs declined >20% WoW — may indicate stock or ranking issues"
  Keep each insight to one sentence.

### 8. Render the HTML card artifact

## Produce a single-file HTML artifact. See the **Output Format** section below.

## Output Format

Render a polished, self-contained HTML card. Requirements:

- **Dark/neutral palette** — professional seller-dashboard aesthetic
- **Four sections** clearly delineated:
  1. **KPI Block** — three metric tiles: This Week Revenue / vs Last Week / vs Last Month. Use color coding: green for positive, red for negative, neutral for flat. Mark a KPI **provisional** when its window has < 7 present days.
  2. **Top 5 SKUs by Revenue** — clean table or card list. Show rank, product name (truncated), ASIN, revenue (`{cur}`), units sold.
  3. **Biggest Drops vs Last Week** — top 3 ASINs with largest `{cur}` decline. Show name, this week `{cur}`, last week `{cur}`, Δ`{cur}`, Δ%. Label the section **provisional** (or replace it with a one-line explanation) when either window has < 7 present days.
  4. **Insights** — 1–2 bullet points in a highlighted panel.
- **Header**: "<seller name from `sellers_and_vendors_list`> — Weekly Sales Briefing", subtitle showing the anchored date range and completeness (e.g. "14–24 Jul 2026 · this week 5/7 days present — provisional")
- **Footer**: "Data via DataDoe · Generated [today's date] · sales complete through
  [last complete day]". When a window is provisional, say how many days it reflects. If
  the card shows any traffic or rate figure and its window includes days after the last
  traffic-complete day, add one line: "Sessions / page views for [dates] are provisional -
  Amazon traffic data lags sales by {n} days here and may be revised." Do not print token costs.
- No external dependencies (pure HTML/CSS/JS, inline everything)
- Responsive — readable at typical desktop artifact width

---

## Error Handling

- If an export fails, retry once. If it fails again, note the error in the artifact and show partial data.
- If `exports_create` rejects the request over a missing date period, you omitted `from` / `to` - both tables require them (`requiresDatePeriod: true`).
- Lag/gaps are handled up front by anchoring to the last complete day (step 1 - the end of the longest contiguous run, so a hole right before the tail moves the anchor back past it), not by ad-hoc shifting afterwards. The newest day (sometimes two) falling under the sales threshold is the normal ~1-day shipped-sales lag; traffic trailing by up to 3 days is normal too - neither is an error. If a specific date inside a window is still missing, treat it as a gap (reduce that window's effective-day count and disclose it) rather than blindly shifting the whole window.
- If `product_name` is empty for an ASIN, display the ASIN itself as the label.
- Rate limit (HTTP 429): wait the `Retry-After` seconds, then retry.

---

## Multiple sellers / marketplaces

Nothing in this skill is seller-specific: the seller, its name and its currency all come
from `sellers_and_vendors_list` at run time, and the table and column names are the same
for every seller. For a multi-account org, run the briefing once per seller (one
`sellerOrVendorIds` entry per run) rather than mixing currencies in one card; both
profit tables carry a `currency` column (the calibration rows are per date and
currency), so if one seller reports in more than one currency, keep one currency per
card as well. The
three-window rolling comparison (this week / last week / same window 4 weeks ago) works for
any marketplace and any granularity.
