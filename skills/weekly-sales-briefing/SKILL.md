---
name: weekly-sales-briefing
description: >-
  Generate a structured weekly Amazon sales briefing as an interactive HTML card. Use this skill whenever the user asks for a weekly sales report, weekly briefing, weekly summary, sales overview, or any request combining "week" with sales/revenue/performance. Also trigger when the user says things like "how did we do this week", "give me the weekly numbers", "show me this week's sales", or "weekly recap". The skill fetches live data from DataDoe (production) for pointed seller and renders a polished interactive HTML card with KPIs, top SKUs, biggest drops, and AI-generated insights.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
---

# Weekly Sales Briefing Skill

## Generates a structured Amazon sales briefing for **{{seller_name}}** from DataDoe production data, rendered as an interactive HTML card artifact.

## Configuration (hardcoded)

- **Seller**: `{{seller_name}}`
- **Seller ID**: `{{seller_id}}`
- **MCP base**: https://mcp.datadoe.com/mcp/v1
- **Currency**: `{{currency_code}}` (`{{currency_symbol}}`)
- **"This week"**: Rolling last 7 days (today - 7 through yesterday, inclusive)
- **"Last week"**: The 7 days before that (today - 14 through today - 8)
- **"Last month"**: Same 7-day window from 4 weeks ago (today - 35 through today - 29)
  Use today's actual date from the system context to compute all date ranges at runtime.

---

## Data Source

Use **Export source ID 401ffcd7e5** — "Sales & Traffic by ASIN & Date".
Key columns to request:
date, child_asin, product_name, total_sales, total_units, total_orders

You need **three separate exports** covering three date windows:

1. **This week**: `[today-7, today-1]` (7 days)
2. **Last week**: `[today-14, today-8]` (7 days)
3. **Last month (same window)**: `[today-35, today-29]` (7 days)
   > Tip: Fire all three exports concurrently, then poll them together. Each export typically completes in under 30 seconds. Poll every 5 seconds. Never give up before completion.

---

## Step-by-step Workflow

### 1. Compute date ranges

Calculate the three date windows using today's date. Format as `YYYY-MM-DD`.

### 2. Create three exports

Call `exports_create` three times (concurrently if possible) with:

- `sellerOrVendorId`: `{{seller_id}}`
- `sourceId`: `{{export_source_id}}`
- `columns`: `["date", "child_asin", "product_name", "total_sales", "total_units", "total_orders"]`
- `dateFrom` / `dateTo`: the appropriate window per export

### 3. Poll until complete

Poll each export's status every 5 seconds. When all three are `COMPLETED`, download the raw CSV/JSON content.

### 4. Aggregate per ASIN

For each of the three windows, aggregate `total_sales` per `child_asin` + `product_name`. This gives you revenue per ASIN per period.
Also compute total revenue across all ASINs for each window.

### 5. Compute KPIs

- **This week revenue**: sum of `total_sales` for this week
- **vs last week**: absolute `{{currency_symbol}}` change + % change
- **vs last month (same window)**: absolute` {{currency_symbol}}` change + % change

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
  1. **KPI Block** — three metric tiles: This Week Revenue / vs Last Week / vs Last Month. Use color coding: green for positive, red for negative, neutral for flat.
  2. **Top 5 SKUs by Revenue** — clean table or card list. Show rank, product name (truncated), ASIN, revenue (`{{currency_symbol}}`), units sold.
  3. **Biggest Drops vs Last Week** — top 3 ASINs with largest `{{currency_symbol}}` decline. Show name, this week `{{currency_symbol}}`, last week `{{currency_symbol}}`, Δ`{{currency_symbol}}`, Δ%.
  4. **Insights** — 1–2 bullet points in a highlighted panel.
- **Header**: "{{seller_name}} — Weekly Sales Briefing", subtitle showing the date range (e.g. "27 Apr – 3 May 2025")
- **Footer**: "Data via DataDoe · Generated [today's date]"
- No external dependencies (pure HTML/CSS/JS, inline everything)
- Responsive — readable at typical desktop artifact width

---

## Error Handling

- If an export fails, retry once. If it fails again, note the error in the artifact and show partial data.
- If a date range returns zero rows (e.g. data not yet available for very recent dates), shift the window back one day and note this in the artifact.
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
