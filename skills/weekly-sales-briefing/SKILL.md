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
- **Anchor to the last complete day, not to "today".** The source lags (typically 4-14
  days observed) and has mid-window gaps, so calendar windows off "today" capture only a
  few real data days and fake a collapse. First detect the last complete day and which
  days are actually present (workflow step 1). The **last complete day is the last day of
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

Use **"Sales & Traffic by ASIN & Date"** - table `amazon_sales_and_traffic_with_cogs`. Resolve its
`sourceId` with `exports_sources_get` (query "sales and traffic") and confirm it is `enabled`;
do not hardcode the id. **Also read the source's `issues` array**: this table is
server-flagged as deprecated and may contain incomplete data (the same warning is repeated as
`dataSourceIssues` on every download). If `issues` is non-empty, keep going but quote the
warning in the card footer so the reader knows the numbers may be incomplete.
Key columns to request:
date, child_asin, product_name, total_sales, total_units, total_orders

First a **calibration pull** to find the real data days, then **three window exports**:

0. **Calibration**: one `exports_create` over the last **~50 days** (lag + 35 days - it
   must cover the 4-weeks-ago window too, which a 30-day pull misses), `groupBy: ["date"]`
   with `count(child_asin)` as the day's row count plus `sum(total_sales)` and
   `sum(total_units)`, `orderByColumn: date`, JSON, `limit: 100` (one row per day, ~50
   rows). A date is **present** when its row count is at or above ~60% of the median daily
   row count (relative, per account); on this source row-count and sales agree, so a
   present date is a complete date. The **last complete day** = the last day of the
   **longest recent contiguous run** of present days. Walk back from the tail: skip any
   isolated present day that sits after a hole and anchor on the run before it (e.g.
   present 08-30..09-20, hole 09-21..09-24, isolated 09-25 -> anchor 09-20, not 09-25).
   Only if no 7-day contiguous run exists in range, fall back to the latest present day
   and label every window provisional. Anchor the windows below to the last complete day.
1. **This week**: the 7 days ending on the last complete day.
2. **Last week**: the 7 days before that.
3. **Last month (same window)**: the same 7-day window 4 weeks before "this week".
   Each window is **one grouped export** (`groupBy [child_asin, product_name]`, see step 2)
   - never an ungrouped per-day pull: at ~1,500 ASIN rows per day a 7-day window is ~11k
   rows and silently overflows the 5,000-row CSV cap (the server returns exactly the
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
- `sourceId`: the id resolved above for `amazon_sales_and_traffic_with_cogs`
- `groupBy`: `["child_asin", "product_name"]` - one row per ASIN for the whole window
  (~2,500 rows here), so the export stays under the 5,000-row CSV cap. Do **not** request
  `date` ungrouped per ASIN: a 7-day window is ~11k rows and gets truncated at the cap.
- `aggregations`: `sum(total_sales)` as `sales`, `sum(total_units)` as `units`,
  `sum(total_orders)` as `orders` (optionally `countDistinct(date)` as `days` to see how
  many days each ASIN sold on)
- `outputType`: `"CSV"`, `limit`: `5000` (both are required by `exports_create`)
- `from` / `to`: the appropriate window per export (these are the only accepted date keys; the legacy camelCase names are rejected)

If any export returns `rowCount` equal to the limit, the catalog is larger than the cap -
say so and do not treat the totals as complete.

### 3. Poll until complete

Poll each export's status every 5 seconds. When all three are `COMPLETED`, download the raw CSV/JSON content.

### 4. Aggregate per ASIN

Each window export already comes back as one row per `child_asin` + `product_name` with
summed `sales` / `units` / `orders` - that is the revenue per ASIN per period. Sum the rows
for the window total; it should match the calibration's per-day `sum(total_sales)` over the
same dates (a cheap reconciliation - if it doesn't, an export was truncated).
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
buy-box), compute it from present days only and flag it provisional too.

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
- **Footer**: "Data via DataDoe · Generated [today's date]". When the source's `issues`
  array is non-empty, add its warning here (e.g. "Source flagged by DataDoe: this table is
  deprecated and may contain incomplete data") so the reader can weigh the numbers.
- No external dependencies (pure HTML/CSS/JS, inline everything)
- Responsive — readable at typical desktop artifact width

---

## Error Handling

- If an export fails, retry once. If it fails again, note the error in the artifact and show partial data.
- Lag/gaps are handled up front by anchoring to the last complete day (step 1 - the end of the longest contiguous run, so a hole right before the tail moves the anchor back past it), not by ad-hoc shifting afterwards. If a specific date inside a window is still missing, treat it as a gap (reduce that window's effective-day count and disclose it) rather than blindly shifting the whole window.
- If `product_name` is empty for an ASIN, display the ASIN itself as the label.
- Rate limit (HTTP 429): wait the `Retry-After` seconds, then retry.

---

## Multiple sellers / marketplaces

Nothing in this skill is seller-specific: the seller, its name and its currency all come
from `sellers_and_vendors_list` at run time, and the table and column names are the same
for every seller. For a multi-account org, run the briefing once per seller (one
`sellerOrVendorIds` entry per run) rather than mixing currencies in one card. The
three-window rolling comparison (this week / last week / same window 4 weeks ago) works for
any marketplace and any granularity.
