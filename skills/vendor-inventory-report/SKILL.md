---
name: vendor-inventory-report
description: >-
  Build an Amazon Vendor Central inventory report as a live dashboard - sellable and
  unsellable units, open purchase-order units, net received, aged 90+ days, sellable
  inventory cost and unfilled customer orders, with a Sellable vs Open PO chart and a
  sortable, filterable ASIN table - from DataDoe's Vendor Central data. In Claude Cowork it
  is a live artifact with a Refresh button; elsewhere a self-contained HTML file; both can be
  saved as PDF for stakeholders. Use for "vendor inventory report", "vendor central
  inventory", "1P inventory dashboard", "open PO units", "aged inventory vendor", "sell-through
  by ASIN", or "vendor stock report". Then offers an updated version with product names, weeks
  of cover per ASIN and stockout / overstock flags.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Vendor Inventory Report
  access: read
  category: Inventory
  interface: mcp
  output: report
  youtube-video-embed-url: https://www.youtube.com/embed/6B1CaoMAxtw
---

# Vendor Inventory Report

A simple but powerful ASIN-level view of your Amazon vendor (1P) inventory: what Amazon holds
sellable and unsellable, what is still on open purchase orders, what was received, what is
ageing past 90 days, what the sellable stock is worth, and how fast it sells through. One
dashboard, refreshed from your Vendor Central data in DataDoe - cleaned and aggregated, so the
assistant builds it fast and without burning tokens. Live from DataDoe.

## When to use this

- Weekly (or before a vendor call) inventory check on Vendor Central.
- Spotting ASINs with stock but no open POs, or open POs on slow sellers.
- Watching aged 90+ inventory before Amazon pushes back.
- Trigger phrases: "vendor inventory report", "vendor central inventory", "1P inventory
  dashboard", "open PO units", "aged inventory vendor", "sell-through by ASIN".

## The framework. Snapshots vs flows

Vendor inventory numbers come in two kinds - mixing them up is the classic mistake:

- **Snapshots** (state on one day): sellable units, unsellable units, open PO units, aged 90+
  units, sellable inventory cost, unfilled customer-ordered units. Read them from the **latest
  available date only** - never sum them across days (30 daily snapshots summed = ~30x the
  real stock).
- **Flows** (movement over the window): net received units, shipped units, customer returns.
  Sum these over the 30-day window.
- **Sell-through** for the window = (shipped units - customer returns) / (sellable on hand at
  the **start** of the window + net received in the window), shown as %. Using the start-of-
  window stock matched Amazon's own daily sell-through rate on 116 of 116 checks; end-of-window
  stock pushes fast sellers above 100%.

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
- Data source: `Sales, Traffic & Inventory by ASIN & Date`
  (`amazon_vendor_sales_traffic_and_inventory_by_child_and_date`), one row per `child_asin` and
  `date`. Use the **manufacturing view** columns (`manufacturing_retail_*`); the
  `sourcing_retail_*` columns are an overlapping view of the same facts - pick one view, never
  add the two.
  - Snapshot columns: `manufacturing_retail_sellable_on_hand_inventory_units`,
    `manufacturing_retail_unsellable_on_hand_inventory_units`,
    `manufacturing_retail_open_purchase_order_units`,
    `manufacturing_retail_aged_90_plus_days_sellable_inventory_units`,
    `manufacturing_retail_sellable_on_hand_inventory_cost` (+
    `manufacturing_retail_sellable_on_hand_inventory_cost_currency`),
    `manufacturing_retail_unfilled_customer_ordered_units`.
  - Flow columns: `manufacturing_retail_net_received_inventory_units`,
    `manufacturing_retail_shipped_units`, `manufacturing_retail_customer_returns`.
  - The ASIN column is `child_asin` (older builds used `asin`, which no longer exists).
- `requiresDatePeriod` is true: always send `from` / `to` (YYYY-MM-DD).
- **Data lag:** vendor data arrives ~4 days behind. Anchor the window on the newest `date` that
  has rows, not on today, and show that date as "Data as of".
- Window: last 30 days ending at that newest date (adjustable).
- Currency: from the `*_currency` column; never hardcode a symbol.
- Row caps: 1,000 rows per JSON export, 5,000 per CSV. Pull every ASIN (CSV if large), compute
  totals over all of them, and embed all of them in the page.
- Data hygiene: about half the rows on a given day can be entirely null - drop ASINs with no data
  in either the snapshot or the window; treat a negative value (e.g. open PO -1) as 0.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the **vendor** account (`accountType = VENDOR`); ask if
   there are several.
2. `exports_sources_get` (query "vendor sales") -> resolve
   `amazon_vendor_sales_traffic_and_inventory_by_child_and_date`; `exports_source_get` to
   confirm the columns above (page through all column pages).
3. **Newest date:** `exports_create`, `from` = 14 days ago, `to` = today, `groupBy ["date"]`,
   `count(child_asin)`, JSON. The newest `date` with rows = the snapshot date `D`.
4. **Snapshot export:** `from` = `to` = `D`, `groupBy ["child_asin",
   "manufacturing_retail_sellable_on_hand_inventory_cost_currency"]`, sum each snapshot
   column (aliases `sellable`, `unsellable`, `open_po`, `aged_90`, `sellable_cost`,
   `unfilled`), CSV `limit 5000`.
5. **Start-of-window stock:** the same sellable sum for the day before the window starts
   (`D` - 30; if that date has no rows, the nearest earlier date), `groupBy ["child_asin"]`,
   alias `sellable_start` - used only for sell-through.
6. **Flow export:** `from` = `D` - 29 days, `to` = `D`, `groupBy ["child_asin"]`, sum
   `manufacturing_retail_net_received_inventory_units` (`net_received`),
   `manufacturing_retail_shipped_units` (`shipped`), `manufacturing_retail_customer_returns`
   (`returns`), CSV `limit 5000`.
7. Download each export (`exports_raw_url_get` and save the file when you build the page in
   code). Merge on `child_asin`; compute sell-through per ASIN and for the total; KPIs over
   **all** ASINs; default sort by `sellable` desc.
8. Build the dashboard (Output format) for the client you are in:
   - **Claude Cowork:** a live artifact. Embed the current data so it renders instantly, and
     wire the Refresh button to re-run steps 3-7 through the Cowork runtime
     (`window.cowork.callMcpTool('<the DataDoe exports_create / exports_get /
     exports_raw_download tool names exactly as in your tool list>', args)`), declaring those
     three tools in the artifact's MCP tool list. Parse the MCP envelope (`content[0].text` ->
     JSON; the id field is `exportId`).
   - **Any other client** (Claude Code, Claude.ai, ChatGPT, Cursor): one self-contained HTML file
     with the data embedded; refresh = run the skill again.
   - Never put a DataDoe key, MCP URL key or Anthropic API key into the page. Outside Cowork
     the Refresh button shows "Live refresh works inside Claude Cowork - re-run the skill to
     update" instead of asking for a key.
9. Save, report the path (or show the artifact), and offer the PDF.
10. **Offer the updated version** (see below): "There's an updated version of this report - it
   adds product names, weeks of cover per ASIN and flags for stockout risk and overstock. Want
   it?" Build it only on a yes.

## Output format

Dark theme (background `#0A0F1E`, cards `#111827`, accent DataDoe green `#00C896`, Inter /
system font), Chart.js 4 from a CDN:

1. **Header:** "Vendor Inventory" · vendor name + marketplace · "Last 30 days ({from} -
   {to})" · "Data as of {D}" · Refresh button · Download PDF button.
2. **KPI cards (7):** Total Sellable Units · Total Unsellable Units · Open PO Units · Net
   Received (30d) · Aged 90+ Days · Sellable Cost ({currency}) · Unfilled Customer Orders.
3. **Chart:** "Sellable vs Open PO by ASIN" - grouped bars, top 15-20 ASINs by sellable.
4. **ASIN-level detail table:** ASIN · Sellable · Unsellable · Open PO · Net Received · Aged 90+
   · Unfilled Orders · Sell-through % · Cost. All ASINs are embedded; the table shows the first
   50 rows of the current sort / filter (default: top 50 by sellable) with "show all". Sorting
   and the ASIN filter box work on every ASIN, so an out-of-stock ASIN is never hidden below the
   top 50. Highlight aged 90+ > 0 (amber) and sellable = 0 with open PO = 0 (red - nothing
   coming). A total row at the bottom carries the all-ASIN totals and the total sell-through.
5. Footer: "Data via DataDoe".

**PDF:** the Download PDF button calls `window.print()` with print CSS (A4 landscape, light
background, full table) so the user can send the snapshot to a client or stakeholder. Offer an
optional weekly routine (scheduled task) that regenerates the report and emails the PDF to the
recipients the user names.

Loading and errors (live artifact): show a spinner during exports; on failure keep the last data
on screen with a clear banner ("Refresh failed - showing data as of {D}") instead of blanking
the page.

## Updated version (offer after the standard report)

Same header, KPIs, chart and table - the updated version adds what to do about the stock.
Build it only when the user says yes (the Refresh button then re-runs the extra exports too).

- **Product Name** column next to ASIN, from `Product Catalog by ASIN`
  (`amazon_products_by_child_asin`, vendor catalog: `child_asin`, `product_name`; no date range
  needed). Filter `child_asin in <the report's ASINs>` (comma-separated; split long lists) - an
  unfiltered pull hits the 5,000-row cap because titles repeat per language - and keep one title
  per ASIN (the marketplace's language if you can tell, else the first), cut to ~60 characters.
  ASINs still missing a title keep the ASIN only.
- **Weeks of Cover** = sellable units / weekly demand, where weekly demand = 30-day
  `manufacturing_retail_ordered_units` / 30 x 7 (add it to the flow export). "-" when there was
  no demand.
- **Flag** column (and a KPI card "ASINs at risk" = 🔴 + 🟠):
  - 🔴 Out of stock - sellable 0 with customer demand in the window.
  - 🟠 Stockout risk - under 4 weeks of cover and 0 open PO units.
  - 🟡 Overstock - over 26 weeks of cover, or aged 90+ above 20% of sellable with more than 8
    weeks of cover; also stock with no demand at all ("no demand").
  - ✅ OK otherwise. Thresholds are adjustable.
- A "Flag" filter above the table so the user can show only the ASINs that need action.

## Worked example (illustrative)

German vendor account, data as of 13 May (today 17 May). 412 ASINs; KPIs: 38,950 sellable,
612 unsellable, 9,840 open PO units, 21,300 net received, 2,150 aged 90+, €214,600 sellable
cost, 180 unfilled. ASIN A tops the table with 4,120 sellable, 0 open PO and 61% sell-through -
healthy now, but nothing on order. ASIN B: 900 sellable, 610 of them aged 90+, 4% sell-through
- an overstock conversation for the next vendor call.

## Quality self-check

- Did I take snapshot columns from one date (the newest with data) and sum only the flow
  columns over 30 days? Sell-through on start-of-window stock?
- Did I anchor the window on the newest data date and show "Data as of"?
- Are the KPIs totals over all ASINs, not just the 50 in the table?
- Did I use `child_asin` and only the manufacturing view?
- Is the currency taken from the data?
- No API key or MCP key anywhere in the HTML?
- Did I offer the updated version at the end - and change nothing unless the user said yes?

## Common mistakes

- Summing sellable / open PO / aged units over 30 daily rows (inflates stock ~30x - 30.05x in
  testing).
- Grouping by `asin` - the column is `child_asin`.
- Adding `manufacturing_retail_*` and `sourcing_retail_*` values together (double count).
- Ending the window at today - the last ~4 days are empty for vendors.
- JSON `limit` above 1,000 (the export fails) - use CSV for large catalogs.
- Computing KPIs from the top-50 table only, or embedding only the top 50 (out-of-stock ASINs
  are never in a top 50 by sellable).
- Sell-through on end-of-window stock (fast sellers go above 100%) - use start-of-window stock.
- Embedding credentials to make "Refresh" work in a normal browser.

## Notes

- Read-only. Vendor Central only - for Seller Central FBA stock, use FBA Stock & Restock Planner.
- Sourcing-view metrics (PO fill rates, contra-COGS) live in the `sourcing_retail_*` columns
  of the same table if you need them later.
- A DataDoe skill, built on `amazon_vendor_sales_traffic_and_inventory_by_child_and_date`.
