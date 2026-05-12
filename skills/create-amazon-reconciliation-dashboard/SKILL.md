---
name: create-amazon-reconciliation-dashboard
description: >-
  Build a self-contained, interactive Amazon Reconciliation Dashboard powered by
  the DataDoe MCP tools. Use when the user asks to create, generate, scaffold, or
  build an Amazon reconciliation dashboard, settlements dashboard, orders-vs-settlements
  report, or any "reconcile my Amazon orders" deliverable using DataDoe.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  youtube-video-embed-url: https://www.youtube.com/embed/nJ6nsem-erY?si=yPLJ-biUZVCPFZxU
---

# DataDoe Amazon Reconciliation Dashboard

Build a complete, single-file interactive HTML dashboard that reconciles 6 months of Amazon Order Line Items against Settlements & P&L Components, using the DataDoe MCP toolchain. The dashboard must be functional after a single execution — the user opens one HTML file in a browser and gets KPIs, charts, a daily table, and an Order Explorer with a month selector wired across all sections.

API docs: https://api.datadoe.com/api/v1/docs
Data scheme: https://api.datadoe.com/api/v1/spec/data-scheme

## Agent Type Detection

Determine your agent type before starting:

- **MCP-enabled assistant** (Claude Desktop, ChatGPT with MCP, Cursor with MCP, etc.): follow this entire skill — all data is pulled live through DataDoe MCP tools. This is the **primary supported path**.
- **Low-level coding agent without MCP** (Cursor, Claude Code, Codex, Aider in environments without DataDoe MCP): substitute the equivalent DataDoe REST endpoints described in the **REST Fallback** section. The dashboard output is identical.
- **High-level vibe coding assistant** (Lovable, Base44, Bolt, v0, etc.): ignore the tech stack section entirely; use whatever the platform provides. Follow only the **Dashboard Features**, **DataDoe Data Integration**, and **Implementation Rules** sections.

## Dashboard Features

### 1. Month Selector (Sticky Header)

- Always visible at the top of the dashboard while scrolling.
- Renders a prominent pill-group or styled `<select>` showing all 6 months in the window (e.g., `Sep 2025 | Oct 2025 | Nov 2025 | Dec 2025 | Jan 2026 | Feb 2026`).
- Includes an **"All 6 Months"** option for the aggregate view.
- The most recent month is selected by default.
- Changing the selection **instantly updates every section below**: KPI cards, trend chart, daily overlay, donut, waterfall, daily table, and Order Explorer.
- Visually prominent: large styled buttons or a pill-group — not a tiny native dropdown.

### 2. Summary KPI Cards

A grid of cards that recompute on every month change:

- Shipped Orders | Settled Orders | Order Gap
- Order Revenue (£) | Settled Revenue (£) | Revenue Gap (£)
- Total Refunds (count + £) | Cancelled Orders | Reconciliation Rate (%)
- When "All 6 Months" is selected, show aggregate totals across the full window.

### 3. Monthly Trend Mini-Chart

- Visible only when a single month is selected.
- Small sparkline or bar chart showing the selected KPI (default: shipped orders) across all 6 months, with the currently selected month highlighted.
- Lets the user see the trend at a glance without switching months.

### 4. Daily Overlay Chart

- Grouped bar chart with three data layers per day:
  - Amber/yellow bars: daily shipped order count.
  - Red/coral bars: daily ORDER-type settlement count.
  - Blue line with markers: daily refund count (secondary Y axis).
- Toggle buttons switch between "Order Counts" and "Revenue (£)" views.
- Legend explains each colour.
- When "All 6 Months" is selected, show **monthly aggregates** instead of daily.

### 5. Reconciliation Status Donut

- Green: Settled (orders with a matching ORDER settlement entry).
- Amber: Pending (shipped, no settlement yet).
- Red: Cancelled (no settlement expected).
- Blue: Refunded.

### 6. Revenue Waterfall

- Bars: Gross Revenue → + Tax → − Referral Fees → − FBA Fees → − Refunds → − Other → = Net Payout.
- Green bars for positive contributions, red for deductions, blue for the net total.

### 7. Daily Summary Table

- One row per day. Sortable.
- Columns: Date | Orders | Settled | Gap | Order Rev | Settled Rev | Rev Gap | Refunds | Refund £ | Net Total | Status.
- Status dot: green (gap ≤5), amber (gap ≤20), red (gap >20).
- Scrollable with sticky header.

### 8. Order Explorer (Critical Section)

The most prominent and functional section. Every order across all 6 months in a single client-side table.

**Columns:**

| Column       | Source      | Description                                                            |
| ------------ | ----------- | ---------------------------------------------------------------------- |
| Order ID     | orders      | `amazon_order_id` — clickable to copy                                  |
| Order Date   | orders      | `order_date`                                                           |
| Order Month  | computed    | derived from `order_date`, e.g. "Feb 2026"                             |
| Status       | orders      | `order_status` (Shipped / Cancelled / Pending)                         |
| Channel      | orders      | `fulfillment_channel` (Amazon / Merchant)                              |
| B2B          | orders      | `order_is_business` (Yes/No badge)                                     |
| Items        | orders      | `sum_qty`                                                              |
| Revenue      | orders      | `sum_item_price` formatted as £                                        |
| Tax          | orders      | `sum_item_tax` formatted as £                                          |
| Recon Status | computed    | Settled ✓ / Refunded ↩ / Settled+Refunded / Pending ⏳ / Cancelled ✗    |
| Sett. Date   | settlements | `date` when settlement was posted                                      |
| Sett. Month  | computed    | derived from settlement date — may differ from Order Month             |
| Settled £    | settlements | settlement `sum_item_price`                                            |
| Fees         | settlements | `sum_referral_fee` + `sum_fba_fee`                                     |
| Refund £     | settlements | `sum_refunded_amount` (if any)                                         |
| Net Payout   | settlements | settlement `sum_total`                                                 |
| Delta        | computed    | order revenue − settled revenue                                        |
| Cross-Month  | computed    | badge showing "↗ Settled in [Month]" if settlement month ≠ order month |

**Required interactive features:**

- **Synced with month selector**: when a month is selected in the header, the Order Explorer auto-filters to that month's orders. "All 6 Months" shows everything.
- **Global text search**: live filter as the user types — searches Order ID and all text fields. Debounce ~200ms.
- **Column filters** (dropdowns above the table):
  - Status: All / Shipped / Cancelled / Pending.
  - Channel: All / Amazon / Merchant.
  - Recon Status: All / Settled / Refunded / Pending / Cancelled.
  - B2B: All / Yes / No.
  - Cross-Month: All / Same Month / Cross-Month Only.
- **Date range filter**: From/To date pickers.
- **Sortable columns**: click any header to sort asc/desc with a sort-indicator arrow.
- **Pagination**: 50 rows per page with Prev / 1 2 3 ... / Next.
- **Row count display**: "Showing X of Y orders (Z filtered)".
- **Row colour coding** (subtle background tint by recon status):
  - Settled: faint green | Refunded: faint blue | Pending: faint amber | Cancelled: faint red.
- **Click-to-copy** Order ID with a brief toast notification.
- **Export filtered results**: a button that downloads the currently visible rows as CSV.

**Implementation notes:**

- Embed the full 6-month merged order data as a JavaScript array inline in the HTML.
- All filtering, sorting, and pagination happen client-side.
- Use efficient DOM updates — rebuild only the visible page, not the entire table.
- Default sort: Order Date descending (newest first).
- Default filter: selected month's orders, all statuses.

### 9. Global Interactive Behaviour

- The month selector controls every other section simultaneously.
- Clicking an overlay-chart bar highlights the corresponding row in the Daily Summary Table.
- Hover tooltips show the full breakdown.
- Toggle buttons work for the counts vs revenue view.
- Smooth scroll between sections via in-page navigation.

### 10. Loading & Error States

- Show a progress message during MCP discovery, export polling, and download.
- Show user-friendly error messages on MCP tool failures, export `ERROR` status, or empty datasets.
- On poll timeout (10 attempts × 5s), surface a clear error and abort rather than retrying indefinitely.

## DataDoe Data Integration

### MCP-First Workflow

The dashboard is generated by chaining DataDoe MCP tool calls. The same data shape and rules apply if you fall back to REST — the only thing that changes is the transport.

### Phase 1: Discovery

**1. Read the DataDoe instructions resource first (REQUIRED before any other DataDoe call).**

- Fetch MCP resource `resource://datadoe/datadoe_mcp.md`.
- If resources are unavailable, call the tool `datadoe_mcp_md_use_before_exports_reports_sellers_vendors_or_ai`.
- These instructions describe seller/vendor scoping, rate limits, and required fields — do not skip them.

**2. List sellers/vendors.**

- Call `sellers_and_vendors_list`.
- If only one seller exists, use it automatically.
- If multiple sellers exist, ask the user which one to use (show names).
- Save the `sellerOrVendorId` (UUID).

**3. Determine the time period.**

- The dashboard always covers **6 full calendar months**.
- If the user says "February" or "last month", calculate the 6-month window ending with that month. E.g., "February 2026" → September 2025 through February 2026.
- If the user just says "generate my dashboard" with no month, use the most recent 6 full calendar months from today.
- Calculate the overall `from` (1st of the earliest month, `00:00:00.000Z`) and `to` (last day of the latest month, `23:59:59.999Z`).
- Also calculate the explicit list of months in the window (e.g., `["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]`) — required for the month selector.

### Phase 2: Data Export

**1. Get available export sources.**

- Call `exports_sources_get` with the `sellerOrVendorId`.
- Find and save the source IDs for:
  - **"Order Line Items"** (underlying table: `integrated_amazon_order_items_with_cogs_view`).
  - **"Settlements & P&L Components"** (underlying table: `integrated_amazon_settlements_with_cogs_view`).

**2. Create Daily Summary exports** (these cover the full 6-month range — small enough to fit in one export each):

- **Daily Summary — Orders**: ~180 days × ~4 status combos = ~720 rows.
- **Daily Summary — Settlements**: ~180 days × 3 types = ~540 rows.

**3. Create Order-Level Detail exports** (for the Order Explorer):

- Provide individual order granularity across all 6 months.
- Batch by month if the seller's volume requires it.

**4. Poll and download ALL exports.**

- For each export, check status via `exports_get`.
- If not `COMPLETED`, wait 5 seconds and poll again (up to 10 attempts, ~50s total per export).
- When `COMPLETED`, call `exports_raw_download` to get the data.
- Parse the JSON `rawContent` from each export.
- Combine all batched order-level results into one unified orders array.
- Combine all batched settlement-level results into one unified settlements array.
- **Deduplicate by `amazon_order_id`** if the same order appears in overlapping batches.

### Phase 3: Analysis

All data must be organised **per calendar month** so the dashboard can switch between months instantly.

**A) Daily Summary processing** (for charts and daily table):

For each of the 6 months, filter the daily summary data to that month's dates and aggregate.

Orders — group by date:

- Sum shipped orders, cancelled orders, pending orders.
- Calculate daily shipped revenue (`total_item_price`) and tax (`total_item_tax`).
- Track Amazon vs Merchant `fulfillment_channel` breakdown.

Settlements — group by date, separated by `settlement_type`:

- `ORDER` entries: count, `item_price`, `item_tax`, `referral_fee`, `fba_fee`, total.
- `REFUND` entries: count, refunded amount, total.
- `OTHER` entries: total (fees, reimbursements, etc.).

**B) Order-Level reconciliation** (for the Order Explorer):

For each unique `amazon_order_id` across all 6 months:

1. Record which month the order belongs to (by `order_date`).
2. Look up whether it has a matching settlement entry (by `amazon_order_id` in settlement exports).
3. Note that the settlement `date` (posted-date) may be in a **different month** than `order_date` — this is normal and critical for cross-month reconciliation.
4. Assign a reconciliation status:
   - **Settled** → order has a matching `ORDER` settlement entry.
   - **Refunded** → order has a matching `REFUND` settlement entry.
   - **Settled + Refunded** → order has both (partial refund).
   - **Pending** → shipped order with no settlement match (expected for recent month-end orders).
   - **Cancelled** → `order_status` is `Cancelled` (no settlement expected).
5. Calculate per-order:
   - Order side: revenue (`sum_item_price`), tax (`sum_item_tax`), quantity (`sum_qty`).
   - Settlement side: settled revenue, fees (referral + FBA), refund amount, net total.
   - Delta: order revenue − settled revenue.
6. **Flag cross-month orders**: if settlement posted-date month ≠ `order_date` month, tag the row as "cross-month settlement".

**C) Reconciliation logic — business rules:**

- Settlement entries use "posted-date" (when Amazon processed them); orders use "purchase-date" (when the customer ordered).
- Orders placed at month-end frequently settle in the next month — the 6-month window makes this visible instead of hiding it.
- Cancelled orders should NOT be expected in settlements.
- The order count gap between Orders and Settlements is normal due to date-shifting and MCF orders.

**D) Summary KPIs** (per month AND overall 6-month totals):

- Total shipped orders vs total settled orders (and gap).
- Total order revenue vs total settled revenue (and gap).
- Total refund count and amount.
- Total cancelled orders.
- Net payout (sum of all settlement totals).
- Total fees breakdown: referral fees, FBA fees, other.
- Reconciliation rate: % of shipped orders with a settlement match.
- Cross-month settlements count: orders placed in month X that settled in month Y.

### Phase 4: Dashboard Generation

Generate a **single, self-contained HTML file** with the interactive dashboard:

- Chart.js 4.x loaded from CDN: `https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js`.
- All CSS inline.
- All 6 months of data embedded as inline JavaScript objects keyed by month (e.g., `dashboardData["2026-02"]`).
- Save the HTML file and present it to the user. If shell access is available, open it in the browser. Otherwise provide it as a downloadable file.

### Data Shape — Required Fields

**Order Line Items (per-order detail) — required columns:**

| Field                  | Role        | Notes                                                                                  |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `amazon_order_id`      | Key         | Primary grouping key — unique per order                                                |
| `order_date`           | Order       | Purchase date (used for "Order Month" assignment)                                      |
| `order_status`         | Order       | `Shipped` / `Cancelled` / `Pending` / etc.                                             |
| `fulfillment_channel` | Order       | `Amazon` / `Merchant`                                                                   |
| `order_is_business`    | Order       | Boolean → "Yes" / "No" badge in UI                                                     |
| `sum_qty`              | Aggregate   | Total units in the order                                                               |
| `sum_item_price`       | Aggregate   | Order revenue                                                                          |
| `sum_item_tax`         | Aggregate   | Order tax                                                                              |

**Settlements & P&L Components — required columns:**

| Field                  | Role        | Notes                                                                                  |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `amazon_order_id`      | Join key    | Matches the orders table; nullable for non-order settlement rows                       |
| `date`                 | Settlement  | Posted-date (when Amazon processed the settlement)                                     |
| `settlement_type`      | Settlement  | `ORDER` / `REFUND` / `OTHER`                                                           |
| `sum_item_price`       | Aggregate   | Settled revenue for the row                                                            |
| `sum_item_tax`         | Aggregate   | Settled tax                                                                            |
| `sum_referral_fee`     | Aggregate   | Amazon referral fee                                                                    |
| `sum_fba_fee`          | Aggregate   | FBA fulfilment fee                                                                     |
| `sum_refunded_amount`  | Aggregate   | Refund amount (only populated on `REFUND` rows)                                        |
| `sum_total`            | Aggregate   | Net amount for the row                                                                 |

For the full column reference, see: https://api.datadoe.com/api/v1/spec/data-scheme

### CRITICAL — Export Request Rules (Discovered Through Testing)

- **`columns: []` (empty array) does NOT return all columns.** It returns only implicit seller-context metadata (`seller_id`, `seller_name`, `marketplace_name`, etc.) and none of the table fields. **Always specify the required columns explicitly.**
- Date range uses **top-level** `from` and `to` fields (ISO 8601 datetime strings like `2025-09-01T00:00:00.000Z`) — **not** inside `filters`.
- `filters.combinator` uses **lowercase** values: `"and"` or `"or"` (not `"AND"` / `"OR"`).
- Each filter rule must include the `not` field (boolean): `{ "field": "...", "operator": "...", "value": "...", "not": false }`.
- If no filter rules are needed, either omit `filters` entirely or pass `{ "combinator": "and", "rules": [] }`.
- `sendToAllOrganizationMembers` is required — set it to `false` for dashboard generation.
- Use `outputType: "JSON"` for every export.

### Anti-Rate-Limit Guardrails (Mandatory)

DataDoe limits to 2 req/s per organisation. The reconciliation workflow creates multiple exports back-to-back, so pacing matters:

1. **Global pacing**: cap all DataDoe calls to **max 1 request every 600ms** (~1.67 req/s), leaving headroom under 2 req/s.
2. **Serialize export creation**: create exports one at a time, not in parallel.
3. **Single in-flight poll per export**: do not stack poll loops.
4. **Respect `Retry-After` exactly** on `429`, then add incremental delay for subsequent retries.
5. **Bounded poll loop**: 10 attempts × 5s per export, then abort with a clear error.

## REST Fallback (No-MCP Agents Only)

If the agent does not have DataDoe MCP access, substitute these REST endpoints — the data shape and rules are identical:

| MCP tool                                                          | REST equivalent                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `datadoe_mcp_md_use_before_exports_reports_sellers_vendors_or_ai` | (No-op; read the instructions doc directly)                    |
| `sellers_and_vendors_list`                                        | `GET /api/v1/util/sellers-and-vendors`                         |
| `exports_sources_get`                                             | `GET /api/v1/exports/sources?sellerOrVendorIds=<sellerId>`     |
| Create export                                                     | `POST /api/v1/exports`                                         |
| `exports_get`                                                     | `GET /api/v1/exports/<exportId>`                               |
| `exports_raw_download`                                            | `GET /api/v1/exports/<exportId>/raw`                           |

Auth: send `datadoe-api-key: <key>` (mutually exclusive with `datadoe-organization-id`). Always attach `Content-Type: application/json` and `Accept: application/json`. The same anti-rate-limit guardrails apply.

## Design Requirements

- Dark professional theme: background `#0f1729`, cards `#1e293b`, text `#e2e8f0`.
- Rounded corners (12px), subtle shadows.
- System font stack: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- All monetary values in GBP with `£` symbol and thousand separators.
- Responsive grid layout.
- The month selector must be visually prominent (large styled buttons or a pill-group — not a tiny native dropdown).
- Order Explorer table uses alternating row shading for readability.
- Filter/search bar visually prominent with a search icon.
- Active filters render as coloured pills/badges that can be clicked to clear.
- Cross-month settlement badges are visually distinct (e.g., orange outline pill).
- Footer: "Data powered by DataDoe".

## Important Business Context

Settlement reports and order reports will NEVER match exactly. This is expected. The dashboard exists to make the gaps visible and explainable, not to alarm the user about normal discrepancies.

Common reasons for gaps:

- **Date shifting**: orders placed on Jan 31 may appear in the Feb settlement; Feb 28 orders may settle in March.
- **MCF / Multi-Channel Fulfillment orders**: appear in settlements with fulfilment fees but with £0 `item_price` in the orders report.
- **B2B deferred orders**: business orders may be deferred for 30 days before settlement.
- **Cancelled orders**: appear in orders (status = Cancelled) but not in settlements.
- **Refunds**: processed as separate `REFUND` settlement entries, not linked back to the original order date.

The dashboard should help the user **build confidence** that the data is correct.

## Implementation Rules

1. **Single run**: the dashboard must work after one execution. Do not leave TODOs or placeholders.
2. **Read the DataDoe instructions resource first** before any other DataDoe MCP call.
3. **Always specify `columns` explicitly** in every export — never pass `columns: []`.
4. **6 full calendar months** is the fixed window — never less, never partial months.
5. **Date defaults**: from = first day of earliest month at `00:00:00.000Z`; to = last day of latest month at `23:59:59.999Z`.
6. **Use `outputType: "JSON"`** for every export.
7. **Poll interval**: 5 seconds per status check; abort after 10 attempts with a clear error.
8. **Retry on 429** using `Retry-After`, with incrementally increasing delays.
9. **Group orders by `amazon_order_id`** before assigning reconciliation status — deduplicate across batches.
10. **Cross-month settlements are normal** — flag them visually, do not treat them as errors.
11. **Embed all 6 months of data inline** in the HTML — the dashboard must not require any runtime fetch.
12. **All filtering, sorting, and pagination happen client-side** in the Order Explorer.
13. **Render with Chart.js 4.x via CDN** (`https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js`) — no other charting library.
14. **Self-contained output**: one `.html` file. No external CSS, no separate JS, no build step.
15. **Report the output file path** explicitly to the user; open it in the browser if shell access is available.

## Example User Interactions

| User says                                                | Agent does                                                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| "Generate my reconciliation dashboard"                   | Pull last 6 months of data, generate the full dashboard. Default view: most recent month.                                            |
| "Generate dashboard for February 2026"                   | Pull 6 months ending in February 2026 (Sep 2025 – Feb 2026), generate dashboard. Default view: February 2026.                        |
| "Why don't my orders match settlements?"                 | Pull the data, analyse gaps, explain with specific numbers, generate the dashboard as supporting evidence, point out cross-month.   |
| "What happened with order 123-456-789?"                  | If the dashboard exists, tell the user to search the Order Explorer. If not, generate the dashboard first, then guide them.          |
| "Show me all orders that haven't settled yet"            | Generate the dashboard, instruct the user to set the Recon Status filter to "Pending".                                              |
| "Show me orders from January that settled in February"   | Generate the dashboard, instruct the user to select January in the month selector and filter Cross-Month = "Cross-Month Only".      |

## Verification Checklist

After implementation, verify:

- The DataDoe instructions resource was fetched before any other MCP call.
- A `sellerOrVendorId` was resolved (auto if single seller, asked if multiple).
- Both source IDs were found: "Order Line Items" and "Settlements & P&L Components".
- All exports reached `COMPLETED` status and were downloaded.
- Order data was deduplicated by `amazon_order_id`.
- Each unique order received a reconciliation status (Settled / Refunded / Settled+Refunded / Pending / Cancelled).
- Cross-month settlements are flagged.
- The HTML file opens standalone and renders without console errors.
- The month selector switches every section (KPIs, charts, daily table, Order Explorer) on change.
- "All 6 Months" aggregates correctly.
- Order Explorer search, column filters, date range, sort, pagination, click-to-copy, and CSV export all work.
- Row colour coding by recon status is visible.
- Cross-month badges are visually distinct.
- All monetary values display in GBP with the `£` symbol and thousand separators.
- The output file path is reported to the user.
