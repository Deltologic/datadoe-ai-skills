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

## Bundled files

| File | Use |
| --- | --- |
| `references/data-completeness.md` | The rules for the last complete day, the three windows, effective days, provisional comparisons, export checks and the currency table. Read it before step 1 if you can't run code. |
| `references/report-data-format.md` | The report data the card is built from, field by field. |
| `scripts/compute-briefing.js` | Applies those rules: `calibrate` picks the windows, `report` builds the report data. |
| `scripts/render-briefing.js` | Pastes the report data into the card template. |
| `references/briefing-template.html` | The card: layout, colours and formatting. |

**If you can run code (Node 18+), use the scripts. Otherwise apply `references/data-completeness.md` yourself and fill `references/briefing-template.html` as `references/report-data-format.md` describes.** Both paths give the same card.

## Configuration

- **MCP base**: https://mcp.datadoe.com/mcp/v1
- **Seller**: resolve at run time with `sellers_and_vendors_list` - pick the seller the user
  means (ask if several match), keep its `id` as `sellerOrVendorId`, its `name` for the
  header, and its `marketplaceCountryCode` for the currency. Never hardcode a seller.
- **Currency**: derive from the marketplace with the table in `references/data-completeness.md`
  (`sellers_and_vendors_list` says `UK` where table rows say `GB`; map both). It is written as
  `{cur}` below. Never hardcode one symbol.
- **Data cost**: both tables used below are premium export (5 AI Tokens instead of 2;
  always-on default dataset, never disabled). Do not print the token cost in the card.
- **Anchor to the last complete day, not to "today".** Sales run ~1 day behind, traffic up to
  3 days or more, and mid-window gaps happen, so windows counted from today fake a collapse.
  The calibration pull (step 1) finds the last complete day; the windows are:
  - **"This week"**: the 7 days ending on the last complete day.
  - **"Last week"**: the 7 days before that.
  - **"Last month"**: the same 7-day window 4 weeks before "this week".
  Each window counts its **effective days** (days actually present) - never assume all 7.
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
sku") and confirm the hit on `tableName`; do not hardcode the ids. Call `exports_source_get`
on each before `exports_create`. Both sit in the always-on default dataset, so there is no
deprecation warning to carry into the card. Key columns:

- `amazon_profit_by_date`: date, currency, total_sales, total_units_sold, total_orders,
  total_sessions, unshipped_sales
- `amazon_profit_by_sku_and_date`: date, child_asin, sku, product_name, total_sales,
  total_units_sold, total_orders (and sales_tax if the user wants ex-VAT)

`total_sales` is sales from **shipped** order items and is **VAT-inclusive** on marketplaces
where Amazon reports prices with tax (all except US/CA); for ex-VAT revenue also sum
`sales_tax` and subtract it. The traffic columns (`total_sessions`, `total_page_views`,
`avg_buybox_percentage`) come from Amazon's Sales and Traffic report and lag far more than
sales; judge their completeness separately (`references/data-completeness.md`).

---

## Step-by-step Workflow

Keep every downloaded export as a file (the scripts read CSV or JSON by column name). Prefer
`exports_raw_url_get` and a GET request for the large window CSVs; `exports_raw_download`
returns the content inline. Run the commands below from this skill's folder, or give the
scripts' full paths; pass the full paths of your data files.

### 1. Calibration pull and windows

One `exports_create` on `amazon_profit_by_date` over the last **~50 days** (lag + 35 days -
it must cover the 4-weeks-ago window too, which a 30-day pull misses):

- `groupBy: ["date", "currency"]` (account rows are per date *and* per currency; grouping on
  `date` alone would merge currencies);
- aggregations `sum(total_sales)` as `sales`, `sum(total_units_sold)` as `units`,
  `sum(total_orders)` as `orders`, `max(total_sessions)` as `sessions` (account-level rows
  are already one per date, so `max` just carries the day's value through) and
  `sum(unshipped_sales)` as `unshipped` (the still-filling check);
- `orderByColumn: date`, JSON, `limit: 100` (one row per day per currency, ~50 rows).

Then find the last complete day and the three windows:

```bash
node scripts/compute-briefing.js calibrate --calibration calibration.json --marketplace UK
```

Without code, apply `references/data-completeness.md`. The result is the card currency, the
anchor (`lastCompleteDay`), the `from` / `to` of each window, its effective days, its
`exportFilter` (the incomplete days to leave out) and the days that failed the completeness
test with the reason. Check that all three windows fall inside the calibration span.

### 2. Create three exports

Call `exports_create` three times (one per window, concurrently if possible) with:

- `sellerOrVendorIds`: `[<id from sellers_and_vendors_list>]` (an array, not a singular key)
- `sourceId`: the id resolved above for `amazon_profit_by_sku_and_date`
- `groupBy`: `["child_asin", "product_name"]` - one row per ASIN for the whole window
  (~2,500-3,000 rows on a large catalog), so the export stays under the 5,000-row CSV cap;
  it also folds an ASIN's several SKU rows into one. Do **not** request `date` ungrouped per
  ASIN: rows on this table are per SKU per day, so a 7-day window at ~1,600 ASINs is well
  over 11k rows and silently overflows the cap (the server returns exactly the limit and
  warns that rows may be missing).
- `aggregations`: `sum(total_sales)` as `sales`, `sum(total_units_sold)` as `units`,
  `sum(total_orders)` as `orders` (optionally `countDistinct(date)` as `days` to see how
  many days each ASIN sold on, and `sum(sales_tax)` as `tax` for an ex-VAT view).
  **`sum` is only right for sales, units and orders.** `total_sessions`,
  `total_page_views` and `avg_buybox_percentage` are "for the child ASIN on this date"
  and are **repeated on every SKU row of that ASIN**, so summing them over SKU rows
  double-counts every multi-SKU ASIN. If you need traffic, run a separate export
  `groupBy ["date", "child_asin"]` with `max()` for those three columns and add them
  across days in code - never `sum()` them in the grouped export.
- `outputType`: `"CSV"`, `limit`: `5000` (both are required by `exports_create`). The rows
  include ASINs with 0 sales in the window; that is expected.
- `filters`: the window's `exportFilter` from step 1 when it has incomplete days
  (`date notIn <dates>`), so their partial sales don't inflate the per-day comparison; and,
  if the calibration shows sales in more than one currency, `currency = <card currency>`
  (the currency from step 1), so the card keeps one currency
- `from` / `to`: the window's dates from step 1 - mandatory on this table
  (`requiresDatePeriod: true`); these are the only accepted date keys, the legacy camelCase
  names are rejected and a `date` filter does not replace them

> Tip: Fire the three window exports concurrently, then poll them together. Each
> typically completes in under 30 seconds. Poll every 5 seconds. Never give up before completion.

### 3. Poll until complete

Poll each export's status every 5 seconds. When all three are `COMPLETED`, download the raw
content and save each as a file.

### 4. Build the report data

```bash
node scripts/compute-briefing.js report --calibration calibration.json \
  --this-week this-week.csv --last-week last-week.csv --last-month last-month.csv \
  --seller "<seller name>" --marketplace UK --generated <today, YYYY-MM-DD> \
  --out report-data.json
```

Without code, build the same object by hand from `references/report-data-format.md`. Either
way the report data holds:

- **KPIs**: this week's revenue, and the change vs last week and vs last month (same window)
  in `{cur}` and %. A comparison with a provisional window (< 7 effective days) is made per
  present day, scaled to 7 days, and labelled provisional - never present a partial-week
  delta as a real move.
- **Top 5 SKUs** by this week's revenue (one row per child ASIN, its SKUs folded together):
  ASIN, product name (cut to 40 characters), revenue, units.
- **Top 3 drops vs last week**: ASINs with revenue in both weeks and the most negative
  `{cur}` change, with this week, last week, `{cur}` and % change. If either week is
  provisional, the drops are ranked per present day and labelled provisional (a 3/7 week
  would otherwise print every hero SKU as a -50..-80% drop).
- **Checks**: each window's export total against the calibration total for the same dates
  (a material gap means an export was truncated), and any export whose row count equals its
  `limit`. The script puts both on the card as footer notes and lists them in `warnings`;
  say so in your reply too, and do not treat truncated totals as complete.

### 5. Rate metrics (only if the user asks)

There is no conversion column on these tables. Compute conversion as
`total_units_sold / total_sessions` (or `total_orders / total_sessions`) from the per-ASIN
`max()` traffic export (step 2), use traffic-present days only (the newest days of traffic
are provisional even when sales are complete) and flag it provisional too.

### 6. Write 1–2 insights

Write 1–2 short, sharp observations (required, one sentence each) from the report data,
including `insightFacts` (top risers, top-5 share) and `warnings`. Pass them to the renderer
with `--insight` (step 7), or write them into the report data's `insights` array. Examples:

- "Revenue down 8% WoW, driven by SKU X dropping {cur}Y"
- "Top performer [SKU] up {cur}Z vs last week"
- "3 SKUs declined >20% WoW — may indicate stock or ranking issues"

### 7. Render the HTML card artifact

```bash
node scripts/render-briefing.js --data report-data.json --out briefing.html \
  --insight "<first insight>" --insight "<second insight>"
```

Without code, paste the report data into a copy of `references/briefing-template.html` as
`references/report-data-format.md` describes. Deliver the single-file HTML as the artifact.

## Output Format

The template already implements the card; don't redesign it unless the user asks:

- Dark, neutral seller-dashboard palette; self-contained (no external dependencies);
  readable at desktop artifact width and on a phone.
- **Header**: "<seller name> — Weekly Sales Briefing" with the anchored date range and
  completeness (e.g. "14–20 Jul 2026 · this week 6/7 days present, last week 7/7 — provisional").
- **Four sections**: KPI tiles (green up, red down, neutral flat, provisional badge when a
  window has < 7 effective days), Top 5 SKUs by revenue, Biggest drops vs last week
  (provisional label when a week is incomplete), Insights.
- **Footer**: "Data via DataDoe · Generated [today's date] · sales complete through
  [last complete day]", one line per provisional window with how many days it reflects, and
  any export-check notes. If you add any traffic or rate figure whose window includes days
  after the last traffic-complete day, add: "Sessions / page views for [dates] are
  provisional - Amazon traffic data lags sales by {n} days here and may be revised." Do not
  print token costs.

---

## Error Handling

- If an export fails, retry once. If it fails again, note the error in the artifact and show partial data.
- If `exports_create` rejects the request over a missing date period, you omitted `from` / `to` - both tables require them (`requiresDatePeriod: true`).
- Lag and gaps are handled up front by anchoring to the last complete day (step 1), not by ad-hoc shifting afterwards. The newest day (sometimes two) failing the completeness test is the normal shipped-sales lag, and traffic trailing sales is normal too - neither is an error. A missing date inside a window lowers that window's effective days (disclosed on the card); it does not shift the whole window.
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
card as well. The three-window rolling comparison (this week / last week / same window 4
weeks ago) works for any marketplace and any granularity.
