---
name: fba-stock-restock-planner
description: >-
  Build an FBA Stock & Restock planning workbook (Excel) for your top ASINs - last-30-day
  sales, a restock target of 1.5x those sales, FBA available and inbound units, a yellow
  column for the stock in your own warehouse (pasted from your ERP), then the total, the
  gap and a Critical / Low / OK status per ASIN - live from DataDoe, with an optional
  daily refresh routine. Use for "stock and restock report", "restock planner", "inventory
  planning spreadsheet", "stock report by SKU", "how much stock do I need", "warehouse
  stock vs FBA", or "restock excel". Then offers an updated version with sales velocity,
  days of stock left, an order-by date and a lead-time-based restock target. For a ranked
  in-chat stockout list, use Restock Priority Alert instead.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: FBA Stock & Restock Planner
  access: read
  category: Inventory
  interface: both
  output: report
  youtube-video-embed-url: https://www.youtube.com/embed/O_xJgozvrEc
---

# FBA Stock & Restock Planner

A stock report by ASIN that the people ordering stock can open every morning: how much you
sold in the last 30 days, how much you want to keep (1.5x those sales), what Amazon holds
(FBA available + inbound), what your own warehouse holds (pasted from your ERP), and the
gap - with a Critical / Low / OK status so the critical ASINs jump out. Built as an Excel
workbook with live formulas, so pasting your warehouse quantities recalculates everything.
Live from DataDoe.

DataDoe knows everything Amazon knows about your FBA stock. It does not know what sits in
your own warehouse - that column is yours to fill (paste from your ERP, or pull it from an
ERP/WMS connector if your assistant has one).

## When to use this

- Daily or weekly stock planning across many ASINs.
- Before a busy season, so you never run out and never overstock into storage fees.
- When the warehouse or purchasing team needs one sheet that says what to order.
- Trigger phrases: "stock and restock report", "restock planner", "inventory planning
  spreadsheet", "stock report by SKU", "how much stock do I need", "warehouse stock vs FBA".

## The framework. Restock need vs everything you have

Per ASIN (top 50 by last-30-day units, adjustable):

1. **30d Sales** - units sold in the last 30 complete days.
2. **Restock Need** = `CEILING(30d Sales x 1.5)` - the stock you want on hand: 1.5 months of
   sales. The 1.5 multiplier is a plain default; the user can swap in their own rule (it is
   one formula).
3. **Total Available** = FBA Available + Inbound Qty + Warehouse Stock.
4. **Gap** = Total Available - Restock Need.
5. **Status**:
   - **Critical** - Gap < 0: you will run out before you can restock. Order now.
   - **Low** - Gap is under 50% of 30d Sales: thin buffer.
   - **OK** - enough stock. A very large positive gap means overstock (months of cover).

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
- **Sales (30d units):** `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`) **[premium]** -
  sum `total_units_sold` per `child_asin` (units from shipped order items). Premium note: a
  premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part
  of the always-on default dataset, so it is never disabled. A 0-row export means no data in
  the window or an initial load still in progress - say which and use the fallback; never
  render zeros.
  - Fallback: `Order Line Items` (`amazon_order_items_with_cogs`, free) - sum `quantity` per
    `child_asin`, excluding `amazon_order_status = Canceled`.
  - The old video build read units from the deprecated Sales & Traffic table; use the profit
    table instead of `amazon_sales_and_traffic_with_cogs`.
- **FBA stock:** `FBA Inventory Health` (`amazon_fba_inventory_health`) **[premium]** - a daily
  snapshot per SKU: `child_asin`, `sku`, `product_name`, `available`, `inbound_quantity`
  (`inbound_quantity` already equals `inbound_working` + `inbound_shipped` +
  `inbound_received` - never add those on top). Not additive across dates: use one snapshot
  date only. The snapshot refreshes during the day, so today's may not exist yet - always
  take the newest date that exists.
  - Fallback: `FBA Restock Recommendations` (`amazon_fba_restock_recommendations`, free) -
    `available`, `inbound`, filtered to `country = <marketplace>` (multi-country table) and
    collapsed to its newest `date`. Say which source the FBA columns came from.
- **Several SKUs per ASIN:** both stock tables are per SKU. Sum `available` and
  `inbound_quantity` over all of an ASIN's SKUs on the snapshot date - keeping one SKU's row
  undercounts the ASIN.
- Row caps: 1,000 rows per JSON export, 5,000 per CSV. Use CSV for the inventory snapshot and
  page with `skip` if a page comes back full.
- Marketplace: one workbook per marketplace (`marketplace_country_code`). If an export returns
  rows for more than one marketplace, filter to the account's marketplace.
- Defaults the user can change: top N = 50, multiplier = 1.5, Low buffer = 50% of 30d sales.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller account (ask if there are several).
2. `exports_sources_get` (queries "profit by sku", "inventory health") -> resolve the source ids
   for `amazon_profit_by_sku_and_date` and `amazon_fba_inventory_health`, then
   `exports_source_get` for each to confirm the columns above exist and the source is
   `enabled`.
3. **30-day sales.** `exports_create` on `amazon_profit_by_sku_and_date`: `from` = yesterday
   - 29 days, `to` = yesterday (30 complete days), `groupBy ["child_asin"]`, sum
   `total_units_sold` as `units_30d`, `orderByColumn units_30d DESC`, `limit` = top N, JSON.
   Poll `exports_get` every ~5 s until `COMPLETED`, then `exports_raw_download`. If 0 rows,
   run the Order Line Items fallback and say so.
4. **FBA stock for the top ASINs (one export).** `exports_create` on
   `amazon_fba_inventory_health`: `from` = 3 days ago, `to` = today, filter `child_asin in <the
   top-N ASINs, comma-separated>`, `groupBy ["date", "child_asin", "product_name"]`, sum
   `available` (alias `fba_available`) and `inbound_quantity` (alias `fba_inbound`), CSV. In
   code, keep only the **newest `date`** (that is the snapshot - today's may not exist yet),
   merge the rows of each ASIN (sum the two numbers, keep one name). A null `available` is 0.
   ASINs with no FBA row show 0 FBA stock and take their name from `Product Catalog by ASIN`
   (`amazon_products_by_child_asin`). No rows at all -> use the restock-recommendations
   fallback and say so.
5. **(Updated version only)** per-SKU Amazon recommendations for the same newest date: columns
   `child_asin`, `sku`, `units_shipped_t30`, `recommended_ship_in_quantity`,
   `recommended_ship_in_date`, same `child_asin in` filter.
6. **Build the workbook** exactly as in Output format. Write the data, then the formulas -
   never hardcode the formula results, so pasting warehouse stock recalculates the sheet.
7. **Warehouse stock (column G).** If the user has an ERP / WMS connector, offer to pull
   on-hand quantities per ASIN or SKU into column G (confirm the mapping first). Otherwise
   leave G at 0, highlighted yellow, for a paste.
8. Save the `.xlsx`, report its path, and open it if you can. Offer the daily refresh routine
   (see Scheduling).
9. **Offer the updated version** (see below): "There's an updated version of this planner -
   it adds daily sales velocity, days of stock left and an order-by date, and sets the
   restock target from your lead time instead of a fixed 1.5x. Want it?" Build it only on a
   yes; otherwise the workbook stays exactly as above.

## Output format

An Excel workbook, sheet **Summary** (Arial, gridlines off, header row frozen, auto-filter on
the table):

```
Row 1  {SELLER} - Stock & Restock Report                         (dark banner, merged A:J)
Row 2  Amazon {marketplace} · Sales: {from} – {to} · Restock Need = 30d Sales × 1.5
Row 4-5 KPI tiles: Top SKUs Shown | SKUs with Sales | Total 30d Sales | Total Restock Need | Critical SKUs
Row 7  ASIN | Product Name | 30d Sales | Restock Need | FBA Available | Inbound Qty |
       Warehouse Stock ✎ | Total Available | Gap | Status
Row 8+ one row per ASIN, sorted by 30d Sales desc
```

| Col | Header | Content |
| --- | --- | --- |
| A | ASIN | `child_asin` |
| B | Product Name | from the inventory snapshot / catalog |
| C | 30d Sales | units, value (blue font = input from DataDoe) |
| D | Restock Need | `=CEILING(C8*1.5,1)` |
| E | FBA Available | value |
| F | Inbound Qty | value |
| G | Warehouse Stock ✎ | yellow input cell, default 0 (or ERP value) |
| H | Total Available | `=E8+F8+G8` |
| I | Gap | `=H8-D8`, red when negative, green otherwise |
| J | Status | `=IF(I8<0,"Critical",IF(I8<C8*0.5,"Low","OK"))`, bold red / orange / green |

KPI formulas: Top SKUs Shown `=COUNTA(A8:A{last})`, SKUs with Sales `=COUNTIF(C8:C{last},">0")`,
Total 30d Sales `=SUM(C..)`, Total Restock Need `=SUM(D..)`, Critical SKUs
`=COUNTIF(J..,"Critical")` (red). (The tile labels say SKUs as in the original report; each row
is one ASIN with its SKUs added together.)
Footer: legend ("Critical = stock will run out before restock arrives | Low = <50% buffer |
OK = sufficient | Yellow column = enter your warehouse qty") and "Source: DataDoe · {seller}
({marketplace}) · FBA snapshot {date} · Refreshed {date}".

If the client cannot write files, render the same table in chat and say the workbook needs a
file-capable client. A workbook written by code stores formulas without results: Excel, Numbers
and Google Sheets calculate them on open, but a file preview (e.g. Quick Look) shows 0s - tell
the user to open it.

## Updated version (offer after the standard workbook)

Same workbook, same 10 columns - the updated version adds planning by time instead of a flat
multiplier. Build it only when the user says yes.

- **Settings sheet** ("Settings"): B2 Lead time (days, default 30), B3 Safety stock (days,
  default 15), B4 Target cover `=B2+B3`. Define workbook names `LeadTime` (=Settings!B2),
  `SafetyStock` (=Settings!B3) and `TargetCover` (=Settings!B4). The defaults give 45 days -
  exactly the 1.5 x 30-day rule - so nothing changes until the user edits them (e.g. 60 + 20 = 80
  days for a slow manufacturer). Mention the target in row 2: "Restock Need = 30d velocity x
  {TargetCover} days (edit on Settings)".
- **Restock Need (D)** becomes `=CEILING(C8*TargetCover/30,1)` - multiply before dividing, so
  floating-point noise can't round a whole number up (294/30*45 gives 442 instead of 441).
- **New columns after Status:**
  - K **Velocity / day** `=C8/30`
  - L **Days of Stock Left** `=IF(K8>0,H8/K8,"no sales")`
  - M **Order By** `=IF(K8>0,TODAY()+L8-TargetCover,"-")` as a date - the day to order so stock
    arrives with the safety stock still on hand; conditional formatting turns it red when it is
    today or earlier ("order now").
  - N **Amazon Ship-in Qty** - Amazon's `recommended_ship_in_quantity` for the ASIN's **main
    SKU** (the one with the most `units_shipped_t30`; ignore SKUs starting `amzn.gr.`). Amazon
    repeats recommendations on inactive and Grade & Resell SKUs, so summing all SKUs inflates it
    (69,221 units vs 20,245 sold in testing).
  - O **Ship-in By** - that SKU's `recommended_ship_in_date`; "now" when it is in the past.
- KPI tile "Avg days of stock left" (sales-weighted) added to the row of tiles.
- If the user prefers a web page over Excel, the same planner can be an interactive HTML file
  (status filter, inline warehouse inputs saved in the browser, sortable columns).

## Scheduling (optional daily refresh)

Ask for the time and time zone (suggest late morning - the inventory snapshot refreshes during
the day, around 10am, 1pm and 4pm, and the skill falls back to the newest snapshot that exists),
then create a recurring routine with the client's scheduler (a scheduled task / routine in
Claude Code, the Claude desktop app or Cowork; a scheduled task in ChatGPT). A routine runs
with no chat history, so its prompt must be self-contained - and the skill must be installed
where the routine runs (otherwise paste the full skill text into the routine):

```
Every day at {10:30} {Europe/London}: refresh the FBA Stock & Restock workbook at {path} for
DataDoe seller {seller name} ({sellerOrVendorId}, {marketplace}). Follow the
fba-stock-restock-planner skill: 30 complete days of units from amazon_profit_by_sku_and_date
(top {N} ASINs), newest amazon_fba_inventory_health snapshot, multiplier {1.5}
{updated version: Settings sheet values}. Keep every Warehouse Stock (column G) value already
in the file, matched by ASIN. {If an ERP connector is set up: pull warehouse stock from it first.}
```

- **Preserve what the team typed on refresh** - read the existing workbook first and carry over
  each ASIN's Warehouse Stock (column G) and, in the updated version, the Settings sheet values.
  If an ASIN with a non-zero warehouse quantity drops out of the top N, keep its row at the
  bottom marked "outside top N" instead of losing the number.
- Local routines need the computer awake and the app running; cloud routines need the DataDoe
  connector available there. If the cloud scheduler is unavailable, a local routine is fine.
- No scheduler at all: write a small refresh script that calls the DataDoe REST API
  (`POST /api/v1/exports`, poll `GET /api/v1/exports/{id}`, then `GET /api/v1/exports/{id}/raw`,
  header `datadoe-api-key` read from an environment variable - never written into the file)
  and schedule it with cron / Task Scheduler.
- Run it once immediately so the user sees it work.

## Worked example (illustrative)

ASIN A: 30d Sales 1,933 -> Restock Need 2,900. FBA Available 1, Inbound 0, Warehouse 100 ->
Total 101, Gap -2,799 -> **Critical**: order now.
ASIN B: 30d Sales 1,933, Total Available 3,200 -> Gap +300, under 50% of monthly sales (967)
-> **Low**: thin buffer, plan the next order.
ASIN C: 30d Sales 1,000, Total Available 4,000 -> Gap +2,500 -> **OK**, actually overstocked
for the next 2-3 months - don't send more in.

## Quality self-check

- Did the 30 days end yesterday (complete days only)?
- Did I use the newest inventory snapshot that exists (not "today", which may be empty) and
  only that one date?
- Did I sum `available` and `inbound_quantity` across all SKUs of each ASIN?
- Are D, H, I, J and the KPI tiles real formulas, so a paste into G recalculates?
- On a refresh, did I keep the existing Warehouse Stock values?
- Did I say which source each column came from when a fallback was used?
- Did I offer the updated version at the end - and change nothing unless the user said yes?

## Common mistakes

- Pulling the inventory snapshot for today only - before the morning refresh it is empty and
  every ASIN reads 0 FBA stock (all "Critical").
- Keeping one SKU row per ASIN instead of summing the ASIN's SKUs.
- Adding `inbound_working` + `inbound_shipped` + `inbound_received` to `inbound_quantity`
  (double count).
- Summing inventory snapshots across several dates.
- Hardcoding computed values instead of formulas.
- Overwriting the warehouse column with zeros on the daily refresh.
- Using a JSON `limit` above 1,000 (the export fails) - use CSV for big pulls.
- "SKUs with Sales" as `COUNTA` - it counts zero-sales rows too; use `COUNTIF(...,">0")`.
- Updated version: `C8/30*TargetCover` (floating-point noise rounds some rows up by 1), and
  summing Amazon's ship-in recommendations over all SKUs (inactive / `amzn.gr.` SKUs repeat it).

## Notes

- Read-only. Never changes anything on Amazon.
- Your warehouse stock is not in Amazon's data; it comes from the user (or their ERP).
- Pairs with Restock Priority Alert (ranked stockout list in chat) for the "what is about to
  run out" view.
- A DataDoe skill, built on `amazon_profit_by_sku_and_date` and `amazon_fba_inventory_health`,
  with `amazon_order_items_with_cogs` and `amazon_fba_restock_recommendations` as fallbacks.
