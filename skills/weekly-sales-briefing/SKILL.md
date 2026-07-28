---
name: weekly-sales-briefing
description: >-
  Generate a structured weekly Amazon sales briefing as an interactive HTML card. Use this skill whenever the user asks for a weekly sales report, weekly briefing, weekly summary, sales overview, or any request combining "week" with sales/revenue/performance. Also trigger when the user says things like "how did we do this week", "give me the weekly numbers", "show me this week's sales", or "weekly recap". The skill fetches live data from DataDoe (production) for pointed seller and renders a polished interactive HTML card with KPIs, top SKUs, biggest drops, and AI-generated insights.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  access: read
  category: Reporting
  interface: mcp
  output: report
---

# Weekly Sales Briefing Skill

## Generates a structured Amazon sales briefing for **{{seller_name}}** from DataDoe production data, rendered as an interactive HTML card artifact.

## Configuration (hardcoded)

- **Seller**: `{{seller_name}}`
- **Seller ID**: `{{seller_id}}`
- **MCP base**: https://mcp.datadoe.com/mcp/v1
- **Currency**: `{{currency_code}}` (`{{currency_symbol}}`)
- **Anchor to the last complete day, not to "today".** The source lags a few days (3+
  observed) and has mid-window gaps, so calendar windows off "today" capture only a few
  real data days and fake a collapse. First detect the last complete day and which days
  are actually present (workflow step 1), then:
  - **"This week"**: the 7 days ending on the last complete day.
  - **"Last week"**: the 7 days before that.
  - **"Last month"**: the same 7-day window 4 weeks before "this week".
- Build each window from the **days actually present** and count how many of the 7 have
  data (effective days) - never assume all 7 are there.
- Lightweight by design (the quick sales-only read). For the deep profit / margin / TACoS
  / fee-settlement drill, use **`weekly-business-review`**.

---

## Data Source

Use **Export source ID 401ffcd7e5** — "Sales & Traffic by ASIN & Date".
Key columns to request:
date, child_asin, product_name, total_sales, total_units, total_orders

First a **calibration pull** to find the real data days, then **three window exports**:

0. **Calibration**: one `exports_create` over ~30 days, grouped by `date`, to see which
   dates are actually present (with each day's row count / `total_sales`). The **last
   complete day** = the most recent present date within normal range. On this source
   row-count and sales agree, so **a present date is a complete date** - presence alone is
   enough; the only guard is to treat a date below ~60% of the median daily row count /
   sales as absent, in case a rare partial day ever appears. Anchor the windows below to
   the last complete day.
1. **This week**: the 7 days ending on the last complete day.
2. **Last week**: the 7 days before that.
3. **Last month (same window)**: the same 7-day window 4 weeks before "this week".
   > Tip: Fire the three window exports concurrently, then poll them together. Each
   > typically completes in under 30 seconds. Poll every 5 seconds. Never give up before completion.

---

## Step-by-step Workflow

### 1. Calibrate, then compute date ranges

First run the calibration pull (Data Source step 0): list the dates actually present in
the last ~30 days and pick the **last complete day**. Compute the three windows anchored
to that day (not to "today"), formatted `YYYY-MM-DD`, and note which dates inside each
window are missing - you'll disclose effective days per window later.

### 2. Create three exports

Call `exports_create` three times (concurrently if possible) with:

- `sellerOrVendorId`: `{{seller_id}}`
- `sourceId`: `{{export_source_id}}`
- `columns`: `["date", "child_asin", "product_name", "total_sales", "total_units", "total_orders"]`
- `from` / `to`: the appropriate window per export (the API rejects `dateFrom` / `dateTo`)

### 3. Poll until complete

Poll each export's status every 5 seconds. When all three are `COMPLETED`, download the raw CSV/JSON content.

### 4. Aggregate per ASIN

For each of the three windows, aggregate `total_sales` per `child_asin` + `product_name`. This gives you revenue per ASIN per period.
Also compute total revenue across all ASINs for each window.
**Count effective (present) days per window** (out of 7) from the calibration data. If a
window has < 7 present days, either normalize the comparison to a per-present-day basis OR
label that window **provisional** and state how many days it reflects. Check ALL windows -
an under-counted last week fakes a boom just as a partial this week fakes a collapse.

### 5. Compute KPIs

- **This week revenue**: sum of `total_sales` for this week
- **vs last week**: absolute `{{currency_symbol}}` change + % change
- **vs last month (same window)**: absolute` {{currency_symbol}}` change + % change

If any window is provisional (< 7 present days), mark the affected KPI provisional and do
NOT present a partial-week delta as a real move. If you show any rate metric (conversion /
buy-box), compute it from present days only and flag it provisional too.

### 6. Rank SKUs

- **Top 5 by revenue this week**: sort by this week's `total_sales` descending, take top 5. Show ASIN, product name (truncated to ~40 chars), revenue, units.
- **Top 3 drops vs last week**: compute `this_week_revenue - last_week_revenue` per ASIN. Sort ascending (most negative first), take top 3. Show ASIN, name, this week revenue, last week revenue, and `{{currency_symbol}}` / % drop. Only include ASINs that had revenue in both periods.

### 7. Generate 1–2 insights

Write short, sharp observations using the data. Examples:

- "Revenue down 8% WoW, driven by SKU X dropping £Y"
- "Top performer [SKU] up £Z vs last week"
- "3 SKUs declined >20% WoW — may indicate stock or ranking issues"
  Keep each insight to one sentence.

### 8. Render the HTML card artifact

## Produce a single-file HTML artifact. See the **Output Format** section below.

## Output Format

Render a polished, self-contained HTML card. Requirements:

- **Dark/neutral palette** — professional seller-dashboard aesthetic
- **Four sections** clearly delineated:
  1. **KPI Block** — three metric tiles: This Week Revenue / vs Last Week / vs Last Month. Use color coding: green for positive, red for negative, neutral for flat. Mark a KPI **provisional** when its window has < 7 present days.
  2. **Top 5 SKUs by Revenue** — clean table or card list. Show rank, product name (truncated), ASIN, revenue (`{{currency_symbol}}`), units sold.
  3. **Biggest Drops vs Last Week** — top 3 ASINs with largest `{{currency_symbol}}` decline. Show name, this week `{{currency_symbol}}`, last week `{{currency_symbol}}`, Δ`{{currency_symbol}}`, Δ%.
  4. **Insights** — 1–2 bullet points in a highlighted panel.
- **Header**: "{{seller_name}} — Weekly Sales Briefing", subtitle showing the anchored date range and completeness (e.g. "14–24 Jul 2026 · this week 5/7 days present — provisional")
- **Footer**: "Data via DataDoe · Generated [today's date]"
- No external dependencies (pure HTML/CSS/JS, inline everything)
- Responsive — readable at typical desktop artifact width

---

## Error Handling

- If an export fails, retry once. If it fails again, note the error in the artifact and show partial data.
- Lag/gaps are handled up front by anchoring to the last complete day (step 1), not by ad-hoc shifting. If a specific date inside a window is missing, treat it as a gap (reduce that window's effective-day count and disclose it) rather than blindly shifting the whole window.
- If `product_name` is empty for an ASIN, display the ASIN itself as the label.
- Rate limit (HTTP 429): wait the `Retry-After` seconds, then retry.

---

## Adapting for Other Sellers (Universal Pattern)

This skill is hardcoded for {{seller_name}} but the pattern is universal. To adapt for another Amazon seller:

1. Replace the Seller ID with the target seller's ID (retrieve via `sellers_and_vendors_list`).
2. Update the currency symbol to match the `{{marketplace}}` (e.g. € for DE, $ for US).
3. Adjust the header branding.
4. The DataDoe export source ID (`401ffcd7e5`) and column names are universal across all sellers.
   The three-window rolling comparison approach (this week / last week / same window 4 weeks ago) works for any Amazon `{{marketplace}}` and any granularity.
