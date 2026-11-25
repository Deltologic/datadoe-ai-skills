---
name: restock-priority-alert
description: >-
  Rank the Amazon FBA products about to stock out by urgency - stock and inbound added up
  per product, set against 30-day sales and your lead time - with how many units to ship
  and the latest day to ship them, next to Amazon's own recommended quantity. From
  DataDoe's FBA Inventory Health, with Amazon's FBA restock recommendations as the
  fallback. Live from DataDoe, read-only. Use for "restock", "what's about to stock out",
  "days of supply", "reorder", "low inventory", "how much to ship in", or "stockout risk".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Restock Priority Alert
  access: read
  category: Inventory
  interface: mcp
  output: report
---

# Restock Priority Alert

The products that are out of stock or will run out before a new shipment can arrive,
most urgent first, with how many units to ship and by when. One row per product, not per
SKU: stock, inbound and sales are added up over all SKUs of the product first, so a spare
SKU at zero does not raise a false alarm. From DataDoe's FBA Inventory Health, with
Amazon's own FBA Restock Recommendations as the fallback. Read-only.

## When to use this

- Weekly (or daily) restock planning.
- Before or during a promotion or a peak season.
- "What's about to run out / what do I need to ship."
- Trigger phrases: "restock", "what's about to stock out", "days of supply", "reorder",
  "low inventory", "how much to ship in", "stockout risk".

## The framework. One row per product, time to zero, your lead time

### 1. Judge a product, not a SKU

One product (`child_asin`) often has several FBA SKUs: an old SKU, a second fee
programme, Amazon "Grade and Resell" SKUs, found-inventory SKUs. Shoppers buy the
product, and any SKU with new stock can fill the order. So:

- Add up stock, inbound and units shipped over **all SKUs of the product** before you
  judge it. A SKU at zero next to a sibling SKU with stock is not out of stock.
- Leave out used stock: SKUs that start with `amzn.gr.` (Grade and Resell: returns Amazon
  resells as used) and rows with `condition` = `Used`. They cannot be restocked.
- Amazon prints a recommended quantity on every SKU of a product, also on SKUs that no
  longer sell, and repeats the product's demand on each. Take Amazon's quantity from
  **the SKU that shipped the most units in 30 days** (the selling SKU) only. Never add
  recommendations up over SKUs.
- **Stock** = `available` + units in transfer between Amazon warehouses
  (`reserved_fc_transfer`): those come back on sale without a shipment.

### 2. Pace

- **30-day pace** = units shipped in the last 30 days (all SKUs of the product) / 30.
  Buckets, order, the units to ship and the bucket totals use this pace, the same for
  every product, so that the rows add up to the totals.
- Two things make that pace wrong for a single product. Each gives a listed row an
  **adjusted quantity** next to its units to ship (framework 4):
  - **Out of stock part of the month.** It sold less than its demand. Count the days
    its selling SKU stood at zero in the last 30 daily snapshots (step 7); days in stock
    = 30 - those days. In stock on at least 14 days and at zero on at least 3: the
    **in-stock pace** = 30-day units / days in stock. In stock on fewer than 14 days: no
    adjusted quantity; write "it sold its {u} units in the {n} days it had stock - the
    quantity is a minimum". Do this only where the selling SKU shipped at least 80% of
    the product's 30-day units; where two SKUs share the sales, one of them at zero does
    not mean the product was out.
  - **In a deal that ends before the shipment lands** (framework 5): the pace outside
    the deal.
- **Selling faster this week** = 7-day units / 7 is at least 1.5 times the 30-day pace,
  with at least 7 units in the 7 days, on a product that has stock and is not in a
  running deal (the deal note covers that case). It will run out sooner than the cover
  says.
- A product with no unit shipped in 30 days is not a restock question. Leave it out.

### 3. Buckets

`L` is the lead time in days: from the day you ship until the units can be sold at
Amazon. Take it from the user; default 30.

**Cover** = (stock + inbound) / 30-day pace, in days. **Gap** = `L` - cover: the days
without stock before a shipment sent today can be sold. **Units at risk** = 30-day pace x
gap: the sales lost in the gap. Decide the bucket in whole numbers, so that a cover of
exactly `L` does not fall on the wrong side: cover is under `L` when 30 x (stock +
inbound) < `L` x 30-day units. Print days as whole days, rounded down.

1. **Out now** - `available` is 0 over all SKUs and the product shipped units in the last
   30 days. It is losing sales today. Say what is on the way: nothing, or the inbound and
   the days it covers, or units in transfer.
2. **Runs out before a new shipment arrives** - `available` above 0 and cover under `L`.
   A shipment sent today is already late.
3. **Ship soon** - cover from `L` to `L` + 14 days, both included. Ship by today +
   (cover - `L`) days, rounded down.
4. **Covered** - everything else. Not listed.

Order: out now by units to ship, largest first (a product whose inbound already covers
it needs no new shipment and goes last); the second bucket by units at risk, largest
first; ship soon by 30-day units, largest first. Break a tie by 30-day units, then by
ASIN. List at most 10 products in each of the first two buckets and 5 in the third
(more when the user asks). Print for every bucket how many products it holds, the units
they shipped in 30 days and the units to ship for all of them together, so that the rows
not listed are still counted; for out now, also how many need no new shipment. Say so
when most of a bucket ships under 5 units a month. The ship-soon bucket is always "at
least": products that Amazon puts above twice the lead time are not checked.

Inbound counts as stock although it is not on the shelf yet. When a listed product has
stock for fewer than 7 days and inbound on top, write "on hand for {d} days - check when
the inbound lands".

### 4. How many

- **Units to ship** = 30-day pace x (`L` + `C`) - stock - inbound, rounded up, never
  below 0. `C` is the cover you want left when the shipment lands; default 30 days, the
  user may change it. Print the formula once with the user's numbers.
- **Adjusted quantity** = the same formula at the other pace of framework 2. At most one
  per row, and the note says which:
  - out of stock part of the month, and no deal or a deal with no unit sold: at the
    in-stock pace ("out of stock on {n} of 30 days"). Plan on it: the demand was higher
    than the 30-day sales show;
  - in a deal that ends before the shipment lands, at zero on fewer than 3 days: at the
    pace outside the deal, printed only when the quantity comes out lower than the units
    to ship ("in a deal until {date}: {x} of the {y} units sold at the deal price").
    Plan on it: the shipment lands after the deal. When it does not come out lower:
    the same note with "the deal did not raise its pace", and no adjusted quantity;
  - both, with units sold at the deal price: at the in-stock pace, with "out of stock
    on {n} of 30 days; {x} of its {y} units sold at the deal price - an upper figure".
    Plan between the two numbers.
  The bucket totals do not hold the adjustments: for products that were out of stock
  they are a floor.
- **Amazon's quantity** stands next to it (framework 1). Mark it "(differs)" when it and
  the units to ship are at least 20 units apart and the larger is more than 2 times the
  smaller (or the smaller is 0). Below the tables, tell the user to check the product's
  forecast in Seller Central before shipping the larger number. A recommendation made
  before an inbound shipment was created can be stale.
- **Inbound that has not shipped.** `inbound_working` counts units in a shipment plan
  that has not left yet. They are part of inbound; print "of which {n} not shipped yet"
  when it is above 0, because they will arrive later than the rest.

### 5. Promotions on the listed products

When the promotion tables are enabled, mark the listed products that are in a running or
coming deal (step 8). Two things follow:

- A deal on a product that is out of stock sells nothing while it runs: say so on the
  out-now rows.
- The 30 days behind the pace hold the deal's sales. When the deal ends before today +
  `L`, a shipment sent today lands after it. **Pace outside the deal** = (30-day units -
  units sold at the deal price) / (30 - the deal's days inside the 30 days up to the
  snapshot, from its first day to the snapshot day, both included), never below 0. Use it only when the deal started inside those 30 days and
  at least 7 of them lie outside it; otherwise write "in a deal until {date} - the
  30-day sales include it". On a ship-soon row whose
  cover at that pace is above `L` + 14 days, write "covered at the pace outside the
  deal".

Skip this silently when the tables are disabled.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- **Primary source:** `FBA Inventory Health` (`amazon_fba_inventory_health`)
  **[premium]**, one row per SKU and day. Columns used: `date`,
  `marketplace_country_code`, `sku`, `child_asin`, `product_name`, `condition`,
  `available`, `inbound_quantity` (working + shipped + received), `inbound_working`,
  `reserved_fc_transfer`, `units_shipped_t30`, `units_shipped_t7`,
  `total_days_of_supply_including_units_from_open_shipments`,
  `recommended_ship_in_quantity`. `requiresDatePeriod: true`. The planning columns are
  not available in MX. A premium export costs 5 AI Tokens instead of 2; nothing else
  differs.
  - `days_of_supply` and `total_days_of_supply_including_units_from_open_shipments` can
    hold the same value. Do not print one as "on hand" and the other as "with inbound".
  - Amazon's days of supply follow its own forecast and can jump from one day to the
    next. They pre-select the products to check; the cover printed is the skill's own.
  - `units_shipped_t30` is empty on SKUs with no sales; a sum skips empty values.
  - Do not print Amazon's recommended ship date: it ignores the user's lead time and is
    often already past.
- **Fallback source:** `FBA Restock Recommendations`
  (`amazon_fba_restock_recommendations`), Amazon's own restock report, one row per SKU,
  day and **country**: always filter `country` to the marketplace code, or the list is
  built from other marketplaces. Column map: `inbound` for `inbound_quantity`, `working`
  for `inbound_working`, `fc_transfer` for `reserved_fc_transfer`,
  `units_sold_last_30_days` for `units_shipped_t30`, `recommended_replenishment_qty` for
  Amazon's quantity. It has no 7-day units: leave that note out and say so. Its newest
  date can be days behind: print it.
- **Promotions (optional):** `Promotion Performance` (`amazon_promotion_performance`):
  `asin`, `promotion_name`, `promotion_type`, `promotion_status`, `start_date_time`,
  `end_date_time`, `product_units_sold` (units at the deal price). Not in the default
  dataset; it can be disabled.
- Resolve each source with `exports_sources_get`, passing the table name as `query` and
  `pageSize: 1`. The column names above were checked against the schema: call
  `exports_source_get` only when an export is rejected for a column.
- **Empty is not "nothing to restock".** A probe with no row for the marketplace means
  the table has no data yet (an initial load can still be running): switch to the
  fallback and say "FBA Inventory Health returned no rows - using Amazon's restock
  recommendations". Never print an empty catalogue as good news.
- **Every export is grouped and small.** A snapshot holds one row per SKU, often
  thousands, and does not fit a chat. The steps below let the server add up the SKUs of
  each product and return only the products that matter: no export passes 200 short
  rows. Do not pull the whole snapshot.
- Call details: `outputType: "CSV"`; `columns` = the `groupBy` fields and the aliases;
  an `in` value is a comma-separated list; a date value is `YYYY-MM-DD`; an aggregation
  alias must differ from every column name. Create one or two exports at a time and
  retry once when the server answers that it is rate-limiting. The seller list can name
  the United Kingdom `UK` while table columns use `GB`: the probe in step 3 shows which.
- The low-cover export returns up to 200 rows that need a cover each. Use a code or
  calculation tool for that arithmetic when the client has one.
- Inputs: lead time `L` (default 30 days) and cover after arrival `C` (default 30 days).

## Step-by-step workflow (MCP-native)

Five or six exports, each grouped. `{used-stock filters}` below means the two row
filters `sku` `doesNotBeginWith` `amzn.gr.` and `condition` `!=` `Used` (rows with an
empty condition stay).

1. `sellers_and_vendors_list` -> pick the seller and its marketplace.
2. `exports_sources_get` for `amazon_fba_inventory_health`. Not `enabled`, or
   `accessAllowed: false` -> run the same steps on the fallback source and say so.
3. **Snapshot probe.** `from` = 3 days ago, `to` = today, `groupBy: ["date",
   "marketplace_country_code"]`, `count(sku)` as `sku_rows`, `limit: 50`. No row for the
   marketplace -> fallback. The newest `date` is the snapshot; print it, and say so when
   it is more than 2 days old. Steps 4 to 6 use `from` = `to` = that date and the filter
   `marketplace_country_code` = the marketplace.
4. **Out now.** `{used-stock filters}`, `groupBy: ["child_asin"]`, `sum(available)` as
   `avail`, `sum(inbound_quantity)` as `inbound`, `sum(inbound_working)` as
   `inbound_planned`, `sum(reserved_fc_transfer)` as `in_transfer`,
   `sum(units_shipped_t30)` as `sold30`, `sum(units_shipped_t7)` as `sold7`; `having`
   `avail = 0` and `sold30 > 0`; ordered by `sold30` descending, `limit: 100`. One row
   per product that is out of stock and was selling. Exactly 100 rows means there are
   more: say "at least 100" and name the 30-day units of the last row.
5. **Low cover.** The same export with
   `max(total_days_of_supply_including_units_from_open_shipments)` as `amz_days` added;
   `having` `avail > 0`, `sold30 > 0` and `amz_days <` 2 x `L`; ordered by `sold30`
   descending, `limit: 200`. These are the products Amazon puts under twice the lead
   time, largest sellers first. Work out the cover of each row at the 30-day pace and
   sort it into bucket 2, bucket 3 or covered (framework 3); add up each bucket's
   products, 30-day units and units to ship. Exactly 200 rows means the smallest sellers
   were cut: say "at least" with the counts and name the 30-day units of the last row.
   Then pick the rows to list: 10 + 10 + 5.
6. **Names, selling SKU and Amazon's quantity** for the listed products.
   `{used-stock filters}` plus `child_asin` `in` those products; `groupBy:
   ["child_asin", "sku", "product_name"]`, `sum(available)` as `avail`,
   `sum(inbound_quantity)` as `inbound`, `sum(units_shipped_t30)` as `sold30`,
   `max(recommended_ship_in_quantity)` as `amz_qty`; `having` with combinator `or`:
   `sold30 > 0`, `avail > 0`, `inbound > 0` (it drops the SKUs with nothing on them);
   `limit: 150`. Per product, the selling SKU is the row with the largest `sold30`: take
   Amazon's quantity from that row and ship to that SKU. Shorten `product_name` to brand,
   product and size.
7. **Days at zero** for the same products (framework 2). `from` = the snapshot date minus
   29 days, `to` = the snapshot date; `{used-stock filters}`, the marketplace,
   `child_asin` `in` the listed products and `available` `=` `0`; `groupBy:
   ["child_asin", "sku"]`, `count(date)` as `zero_days`; ordered by `zero_days`
   descending, `limit: 300`. Read the row of each product's selling SKU; no row means it
   was never at zero. Spare SKUs show up here with 30 days at zero: ignore them.
8. **Promotions on the listed products** (framework 5, only when
   `amazon_promotion_performance` is enabled). Filters: `asin` `in` the listed products,
   `end_date_time >=` today, `promotion_status != CANCELED`; `groupBy: ["asin",
   "promotion_name", "promotion_type", "start_date_time", "end_date_time"]`,
   `sum(product_units_sold)` as `deal_units`; `limit: 100`. This table has no `date`
   column: send no `from` / `to`. A start after today is a coming deal. Add up the
   `deal_units` of a product's deals.
9. **Adjusted quantities and notes** for the listed products (framework 2, 4 and 5),
   then the report.

The fallback source runs the same steps with its own column names (Configuration) and
`country` in place of `marketplace_country_code`.

## Output format

Start with the snapshot date, the source, and the lead time and cover used.

```
Restock Priority - {seller} ({marketplace}) - snapshot {date}{, {n} days old}
Source: FBA Inventory Health | FBA Restock Recommendations (fallback - {reason})
Lead time {L} days, cover after arrival {C} days: units to ship = 30-day pace x {L + C} days - stock - inbound.
{x} products are out of stock and were selling. {At least }{y} more run out before a shipment sent today can be sold ({today + L}). At least {z} more need a shipment within 14 days.
{k} of the listed products are in a deal that ends before {today + L}: their 30-day sales include the deal.

OUT NOW - no stock on any SKU: {x} products, {u} units shipped in 30 days, at least {s} units to ship together; {n} of them need no new shipment (inbound or units in transfer cover them)
  product ({asin})   30-day units   on the way                                           units to ship   adjusted   Amazon's qty      ship to SKU   notes
  {name}             {n}            {nothing | {n} inbound{ + {n} in transfer}, covers {d} days}   {n}     {n | -}    {n}{ (differs)}   {sku}         {out of stock on {n} of 30 days | it sold its {u} units in the {n} days it had stock - the quantity is a minimum | in a deal until {date}: it sells nothing while out of stock{; {x} of its {y} units sold at the deal price - an upper figure}}
  ...
  {+ {k} more products}

RUNS OUT BEFORE A NEW SHIPMENT ARRIVES - cover under {L} days: {at least }{y} products, {u} units shipped in 30 days, about {s} units to ship together
  product ({asin})   stock + inbound   30-day units   cover   units at risk   units to ship   adjusted   Amazon's qty      ship to SKU   notes
  {name}             {n} + {n}         {n}            {d} d   {n}             {n}             {n | -}    {n}{ (differs)}   {sku}         {in a deal until {date}: {x} of the {y} units sold at the deal price{ - the deal did not raise its pace} | out of stock on {n} of 30 days | selling faster this week | of which {n} inbound not shipped yet | on hand for {d} days - check when the inbound lands}
  ...
  {+ {k} more products}

SHIP SOON - cover {L} to {L + 14} days: at least {z} products, {u} units shipped in 30 days, about {s} units to ship together
  product ({asin})   stock + inbound   30-day units   cover   ship by   units to ship   adjusted   Amazon's qty      ship to SKU   notes
  ...

Adjusted = the same formula at the pace while in stock (the product was out of stock part of the month) or at the pace outside a deal that ends before the shipment lands; the note says which. Where a row has an adjusted quantity, plan on it ("upper figure": between the two). Totals use the 30-day pace and do not hold the adjustments.
(differs) = Amazon's forecast is far from this one: check the product's forecast in Seller Central before shipping the larger number.
Checked: every product that is out of stock, and the {n} best sellers that Amazon puts under {2L} days of supply{ (cut at 200; the last one shipped {n} units in 30 days)}. Used-condition SKUs left out.
```

Leave out a bucket that is empty with one line ("No product is out of stock"). No
token-cost lines.

## Scheduled runs

The same steps. Ask for the lead time once and keep it in the task. A short message
holds the three counts and the first 5 rows of "out now" and of "runs out before a new
shipment arrives", each with its units to ship and the SKU to ship to. When both
buckets are empty, say so in one line.

## Worked example (illustrative)

Lead time 30 days, cover 30 days.

- Product A has three SKUs. Two are at zero and Amazon recommends 3,500 units on one of
  them. The third holds 4,000 units and ships 2,400 a month. Added up, the product has
  50 days of cover: **covered**, not listed, and the 3,500 is not a quantity to ship.
- Product B: no stock on any SKU, 240 units shipped in 30 days, 300 inbound. **Out
  now**; the inbound covers 37 days. Units to ship: 8 x 60 - 300 = 180. Its selling SKU
  stood at zero on 6 of the 30 days, so the in-stock pace is 240 / 24 = 10 a day and the
  adjusted quantity is 10 x 60 - 300 = 300. Amazon shows 0, because it counts the
  inbound: "0 (differs)".
- Product C: 45 in stock, nothing inbound, 90 units in 30 days: cover 15 days, gap 15
  days, 45 units at risk. Units to ship: 3 x 60 - 45 = 135; Amazon recommends 110.
- Product D: 100 in stock, 150 units in 30 days: cover 20 days, 50 units at risk, units
  to ship 5 x 60 - 100 = 200. It is in a deal that started 10 days ago and ends in 5,
  and 90 of the 150 units sold at the deal price. Outside the deal it sold 60 units in
  20 days, 3 a day: the adjusted quantity is 3 x 60 - 100 = 80. The shipment lands after
  the deal, so 80 is the number to plan on and 200 the upper figure.
- Product E: 200 in stock, 150 units in 30 days: cover 40 days. **Ship soon**: ship
  within 10 days. Units to ship: 5 x 60 - 200 = 100.
- Product F: no stock, 2 units in 30 days. It is counted in the bucket line, not listed.

## Quality self-check

- Is every row a product, with stock, inbound and units added up over its SKUs?
- Did I leave out `amzn.gr.` SKUs and used-condition rows?
- Is Amazon's quantity taken from the selling SKU only, and never added up?
- Did I state the snapshot date, and use the fallback (saying so) when the probe had no
  row?
- Did I filter the marketplace (`country` on the fallback)?
- Did I bucket, rank and size on the 30-day pace, rank out now by units to ship and the
  second bucket by units at risk, not by the shortest cover?
- Does every bucket line carry its products, 30-day units and units to ship, so that
  the rows not listed are counted?
- Is the adjusted quantity at the in-stock pace only where the selling SKU was at zero
  on 3 or more days, in stock on 14 or more, and ships 80% or more of the product?
- For a product in a deal that ends before the shipment lands and at zero on fewer than
  3 days: did I print the adjusted quantity at the pace outside the deal, when it comes
  out lower?
- Did I decide the buckets in whole numbers, so that a cover of exactly the lead time is
  "ship soon"?
- Do the units to ship of the listed rows use the same pace as the bucket totals?
- Did I use the user's lead time in the buckets, the ship-by date and the quantity?
- Did I mark Amazon's quantity "(differs)" only where the two are 20 units and 2 times
  apart?
- Is every export grouped, with no whole-snapshot pull?

## Common mistakes

- Calling a SKU out of stock while another SKU of the same product has stock.
- Giving a spare SKU the sales of the whole product, or its quantity to the product.
- Adding up Amazon's recommended quantities over the SKUs of one product.
- Listing Grade and Resell (`amzn.gr.`) SKUs: they are used stock, not restockable.
- Pulling the whole snapshot into a chat, or ranking one sorted page of it.
- Reporting "nothing to restock" because the table came back empty.
- Listing the products with the shortest cover first: a product with one unit left that
  sells five a month then hides the one that sells 300.
- Showing ten rows and no total: the seller asked how much to ship, not for a sample.
- Printing rows at one pace and totals at another: the seller cannot add them up.
- Putting an out-of-stock product whose inbound already covers it on top of the list.
- Sizing a shipment on the sales of a month in which the product was out of stock half
  the time, or on the sales of a deal for a shipment that lands after it.
- Recommending a restock for a product with no sales in 30 days.
- Printing Amazon's ship date: it ignores the lead time and is often past.
- Forgetting the `country` filter on `amazon_fba_restock_recommendations`.

## Notes

- Read-only.
- 30-day units come from the inventory table, added up per product. Stock with no sales
  is a removal question, not a restock one: it is not listed here.
- One lead time is applied to every product. Ask for it; products from different
  suppliers can need separate runs.
- The pre-selection follows Amazon's days of supply: a product that Amazon puts above
  twice the lead time, or gives no value, is not checked. Days in stock assume a
  snapshot row on each of the 30 days.
- The limits (10 and 5 rows per bucket, 200 best sellers, twice the lead time for the
  pre-selection, 14 in-stock days, 80% for the selling SKU, 1.5 times for "selling
  faster", 20 units and 2 times for a quantity that differs) are defaults from a test
  on one large UK account in November 2026. Say which you used when asked.
- A DataDoe skill, built on `amazon_fba_inventory_health` (premium) with
  `amazon_fba_restock_recommendations` (Amazon's own restock report) as the fallback.
