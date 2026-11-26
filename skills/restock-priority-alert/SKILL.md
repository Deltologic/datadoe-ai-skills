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
- **Clean days.** The 30-day pace is wrong for a product when part of the month was not
  normal. Two kinds of days are not normal:
  - **days with nothing in stock** on its selling SKU (step 7): it could not sell its
    demand;
  - **days inside a deal** that is over before a shipment sent today lands (framework
    5): it sold faster than it will when the shipment is on the shelf.
  The clean days are the rest. Count everything here inside the 28 days that end two
  days before the snapshot: the orders of the last two days have not all shipped. For a
  listed product with at least 3 days that are not clean, the daily sales (step 8) show
  how it sells on a clean day against the whole period: **clean factor** = (units on
  the clean days / clean days) / (units on all 28 days / 28). The factor gives the row
  an **adjusted quantity** (framework 4).
  - A deal that sold no unit at the deal price changed nothing: its days stay clean,
    and the product does not count as "in a deal".
  - When the clean days all lie before a deal, the factor also holds whatever the
    season did since then (a winter product on its way up reads too low). The skill
    cannot separate the two: say so below the tables when products are in a deal.
  - At least 7 clean days are needed. Fewer: no adjusted quantity; write "only {n}
    clean days" and that the units to ship are a minimum (the product was out of stock)
    or an upper figure (it was in a deal), or simply uncertain when both apply.
  - Fewer than 10 units on the clean days make a rough factor: print the adjusted
    quantity with "rough: {u} units on its clean days". With no unit at all on the clean
    days the adjusted quantity is 0: write "it sold only in the deal" (or "only on days
    the snapshot shows no stock"), and leave the decision to the seller.
  - Count the days without stock only where the selling SKU shipped at least 80% of the
    product's 30-day units (where two SKUs share the sales, one of them at zero does not
    mean the product was out) and has a snapshot on at least 28 of the 30 days
    (otherwise the history is incomplete: write "only {n} daily snapshots in the 30
    days"). A day without a snapshot counts as in stock.
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

Inbound counts as stock although it is not on the shelf yet. When a listed product of
the second or third list has stock for fewer than 7 days and inbound on top, write "on
hand for {d} days - check when the inbound lands".

### 4. How many

- **Units to ship** = 30-day pace x (`L` + `C`) - stock - inbound, rounded up, never
  below 0. `C` is the cover you want left when the shipment lands; default 30 days, the
  user may change it. Print the formula once with the user's numbers.
- **Adjusted quantity** = the same formula at the 30-day pace x the clean factor
  (framework 2), rounded up, never below 0. The note gives the reason and the factor,
  so that the number can be checked: "nothing available on {z} days: x{f} of the 30-day
  pace on its {n} clean days", "in a deal until {date}: x{f} ...", or both reasons.
  Where a row has an adjusted quantity, plan on it. When the cover at the adjusted pace
  puts the row in a later bucket, say so, and it replaces the row's list and ship-by
  date for planning: "at that pace the cover is {d} days: ship soon, by {date}" or
  "...: covered - nothing to ship now". The row stays where the 30-day pace put it, so
  that lists and totals add up. The bucket totals do not hold the adjustments: they run
  low where products were out of stock and high where they were in a deal - and the
  products not listed were not checked for either.
- **Amazon's quantity** stands next to it (framework 1), without a mark: it is Amazon's
  own forecast. Below the tables, tell the user to check a product's forecast in Seller
  Central before shipping the larger number where the two are far apart. A
  recommendation made before an inbound shipment was created can be stale.
- **Inbound that has not shipped.** `inbound_working` counts units in a shipment plan
  that has not left yet. They are part of inbound; print "of which {n} not shipped yet"
  when it is above 0, because they will arrive later than the rest.

### 5. Promotions on the listed products

When the promotion tables are enabled, look up the deals of the listed products that ran
inside the 30 days up to the snapshot, run now or are coming (step 8).

- A running deal on a product that is out of stock is mostly wasted: note "in a deal
  until {date} while out of stock" on the out-now rows.
- The 30 days behind the pace hold the deal's sales, and they still do after the deal
  has ended. When the deal has ended, or ends before today + `L`, a shipment sent today
  lands after it: the deal's days are not clean days (framework 2). They run from its
  first local day to its last, or to the snapshot day. Note "in a deal until {date}",
  or "was in a deal until {date}" for one that has ended. A deal that still runs keeps
  selling at its own pace until it ends: add "{d} more days at the deal's pace".
- A deal that starts after today changes nothing in the 30 days: note "a deal starts on
  {date} - it will sell faster than the pace".
- Never take the sales outside a deal as the 30-day units minus the units at the deal
  price: a product also sells at the full price on deal days.

Skip this silently when the tables are disabled; the daily sales are still needed for
the days without stock.

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
  Amazon's quantity; `available`, `sku`, `child_asin`, `product_name`, `condition` and
  `total_days_of_supply_including_units_from_open_shipments` keep their names. It has no
  7-day units: leave the `sold7` sum and the "selling faster" note out and say so. Its newest date can be days behind: print
  it. Its `condition` holds `New`, `Unknown` and four used grades that all start with
  `Used` (`UsedLikeNew`, `UsedVeryGood`, `UsedGood`, `UsedAcceptable`), and it can be
  empty.
- **Promotions (optional):** `Promotion Performance` (`amazon_promotion_performance`):
  `asin`, `promotion_name`, `promotion_type`, `promotion_status`, `start_date_time`,
  `end_date_time` (both UTC), `product_units_sold` (units at the deal price). Not in the
  default dataset; it can be disabled.
- **Daily sales (for the clean factor):** `Profit by SKU & Date`
  (`amazon_profit_by_sku_and_date`) **[premium]**: `date` (the day of the order,
  marketplace-local), `child_asin`, `total_units_sold`. `requiresDatePeriod: true`.
- Resolve each source with `exports_sources_get`, passing the table name as `query` and
  `pageSize: 1`. The column names above were checked against the schema: call
  `exports_source_get` only when an export is rejected for a column.
- **Empty is not "nothing to restock".** A probe with no row for the marketplace means
  the table has no data yet (an initial load can still be running): switch to the
  fallback and say "FBA Inventory Health returned no rows - using Amazon's restock
  recommendations". Never print an empty catalogue as good news.
- **Every export is grouped and small.** A snapshot holds one row per SKU, often
  thousands, and does not fit a chat. The steps below let the server add up the SKUs of
  each product and return only the products that matter: the snapshot exports return
  at most 200 short rows, the two daily exports of steps 7 and 8 a few hundred. Do not
  pull the whole snapshot.
- Call details: `outputType: "CSV"`; `columns` = the `groupBy` fields and the aliases;
  an `in` value is a comma-separated list; a date value is `YYYY-MM-DD`; an aggregation
  alias must differ from every column name of the table it runs on, or the export is
  rejected (`inbound` is a column of the fallback table, so the sum of inbound is
  `inbound_sum` on both sources). Create one or two exports at a time and
  retry once when the server answers that it is rate-limiting. The seller list can name
  the United Kingdom `UK` while table columns use `GB`: the probe in step 3 shows which.
- The low-cover export returns up to 200 rows that need a cover each, and the clean
  factor needs sums over a few hundred daily rows. Use a code or calculation tool for
  that arithmetic (steps 5 and 9) when the client has one.
- Inputs: lead time `L` (default 30 days) and cover after arrival `C` (default 30 days).

## Step-by-step workflow (MCP-native)

Six to eight exports, each grouped. `{used-stock filters}` below means two row filters:
`sku` `doesNotBeginWith` `amzn.gr.`, and on the primary source `condition` `!=` `Used`
(its values are `New`, `Used` or an empty text, and the empty ones stay), on the
fallback source `condition` `doesNotBeginWith` `Used` (there a value can be missing
altogether, and a missing value is dropped by the filter: step 3 checks for that).

1. `sellers_and_vendors_list` -> pick the seller and its marketplace.
2. `exports_sources_get` for `amazon_fba_inventory_health`. Not `enabled`, or
   `accessAllowed: false` -> run the same steps on the fallback source and say so.
3. **Snapshot probe.** `from` = 3 days ago, `to` = today, `groupBy: ["date",
   "marketplace_country_code"]`, `count(sku)` as `sku_rows`, `count(condition)` as
   `cond_rows`, `limit: 50`. No row for the marketplace -> fallback. The newest `date` is
   the snapshot; print it, and say so when it is more than 2 days old. Steps 4 to 6 use
   `from` = `to` = that date and the filter `marketplace_country_code` = the
   marketplace. `cond_rows` below `sku_rows` on the snapshot day means some rows have no
   condition value at all (the fallback table allows that), and the condition filter
   drops them: run step 4b. No row on the fallback either: say that neither source has
   data for the marketplace, and stop.
4. **Out now.** `{used-stock filters}`, `groupBy: ["child_asin"]`, `sum(available)` as
   `avail`, `sum(inbound_quantity)` as `inbound_sum`, `sum(inbound_working)` as
   `inbound_planned`, `sum(reserved_fc_transfer)` as `in_transfer`,
   `sum(units_shipped_t30)` as `sold30`, `sum(units_shipped_t7)` as `sold7`; `having`
   `avail = 0` and `sold30 > 0`; ordered by `sold30` descending, `limit: 200`. One row
   per product that is out of stock and was selling.
   - **Is the list complete?** The rows come in the order of their sales, but the list
     is ranked by units to ship, and a product further down with nothing inbound can
     need more than one near the top whose inbound covers it. Fewer rows than the limit:
     all are read. Exactly 200 rows: a product not read ships at most the last row's
     `sold30` in 30 days, so it needs at most that x (`L` + `C`) / 30. The top 10 are
     final when the 10th of them needs at least that much; if not, read the next page
     (`skip: 200`), up to 3 pages. Still not settled: say that products with a larger
     need may be missing, and print the bucket's products, units and units to ship as
     "at least".
   - **4b. Rows with no condition value** (only when the probe shows them). The same
     export with `condition` `null` in place of the condition filter and `having` with
     combinator `or`: `avail > 0`, `inbound_sum > 0`, `sold30 > 0`; `limit: 200`. Add
     these numbers to the product's row in steps 4 and 5 before judging it: a product
     with stock on such a SKU is not out of stock.
5. **Low cover.** The export of step 4 with
   `max(total_days_of_supply_including_units_from_open_shipments)` as `amz_days` added;
   `having` `avail > 0`, `sold30 > 0` and `amz_days <` 2 x `L`; ordered by `sold30`
   descending, `limit: 200`. These are the products Amazon puts under twice the lead
   time, largest sellers first. Work out the cover of each row at the 30-day pace and
   sort it into bucket 2, bucket 3 or covered (framework 3); add up each bucket's
   products, 30-day units and units to ship. Exactly 200 rows means the smallest sellers
   were cut: say "at least" with the counts and name the 30-day units of the last row.
   The units at risk of a product not read are at most the last row's `sold30` x `L` /
   30: the top 10 of bucket 2 are final when the 10th has at least that; if not, read
   the next page as in step 4. Then pick the rows to list: 10 + 10 + 5.
6. **Names, selling SKU and Amazon's quantity** for the listed products.
   `{used-stock filters}` plus `child_asin` `in` those products; `groupBy:
   ["child_asin", "sku", "product_name"]`, `sum(available)` as `avail`,
   `sum(inbound_quantity)` as `inbound_sum`, `sum(units_shipped_t30)` as `sold30`,
   `max(recommended_ship_in_quantity)` as `amz_qty`; `having` with combinator `or`:
   `sold30 > 0`, `avail > 0`, `inbound_sum > 0` (it drops the SKUs with nothing on
   them); `limit: 150`. Per product, the selling SKU is the row with the largest
   `sold30`: take Amazon's quantity from that row and ship to that SKU. Shorten
   `product_name` to brand, product and size.
7. **Days seen and days without stock** for the selling SKUs (framework 2). `from` = the
   snapshot date minus 29 days, `to` = the snapshot date; the marketplace filter and
   `sku` `in` the selling SKUs of step 6 (not the products: a product can have dozens of
   spare SKUs at zero all month, and they would crowd the selling SKU out of a limited
   list). Two exports:
   - `groupBy: ["child_asin", "sku"]`, `count(date)` as `days_seen`, `limit: 100` - the
     daily snapshots the SKU has in the 30 days;
   - with `available` `=` `0` added: `groupBy: ["child_asin", "sku", "date"]`,
     `count(sku)` as `n_rows`, ordered by `sku`, `limit: 1000` - one row per day
     without stock. No row for a SKU means it was never at zero.
   A SKU with a comma in its name cannot go into an `in` list: leave it out and count no
   days without stock for that product.
8. **Deals and daily sales:**
   - **the deals** (only when `amazon_promotion_performance` is enabled): filters `asin`
     `in` the listed products, `end_date_time >=` the snapshot date minus 29 days,
     `promotion_status != CANCELED`; `groupBy: ["asin", "promotion_name",
     "promotion_type", "start_date_time", "end_date_time"]`,
     `sum(product_units_sold)` as `deal_units`; `limit: 100`. This table has no `date`
     column: send no `from` / `to`. An end before today is a deal that has ended inside
     the 30 days; a start after today is a coming deal. The times are UTC: a start at
     23:00 UTC in a UTC+1 marketplace is the next local day.
   - **daily sales** of the listed products that have at least 3 days that are not
     clean (days without stock, days of a deal): `amazon_profit_by_sku_and_date`,
     `from` = the snapshot date minus 29 days, `to` = the snapshot date, filters
     `child_asin` `in` those products and `sku` `doesNotBeginWith` `amzn.gr.`;
     `groupBy: ["child_asin", "date"]`,
     `sum(total_units_sold)` as `units_day`; `having` `units_day > 0`; ordered by
     `child_asin`, `limit: 1000`. A day with no row sold nothing. Table disabled or not
     accessible: no adjusted quantities; say that the 30-day pace could not be checked
     against the daily sales.
9. **Clean factor, adjusted quantities and notes** for the listed products (framework
   2, 4 and 5), then the report. A row can carry several notes: join them with a
   semicolon.

The fallback source runs the same steps with its own column names (Configuration) and
`country` in place of `marketplace_country_code`.

## Output format

Start with the snapshot date, the source, and the lead time and cover used.

```
Restock Priority - {seller} ({marketplace}) - snapshot {date}{, {n} days old}
Source: FBA Inventory Health | FBA Restock Recommendations (fallback - {reason})
Lead time {L} days, cover after arrival {C} days: units to ship = 30-day pace x {L + C} days - stock - inbound.
{x} products are out of stock and were selling. At least {y} more run out before a shipment sent today can be sold ({today + L}). At least {z} more need a shipment within 14 days.
The first two lists are urgent: no stock today, or none left before a shipment sent today can be sold. The third list has a ship-by date per product.
{k} of the {m} listed products are or were in a deal in the last 30 days that sold units and is over before {today + L}: their 30-day sales hold the deal. Plan on the adjusted quantity where a row has one. The second and third list and their totals run high while such deals are inside the 30 days: the products not listed were not checked for them.

OUT NOW - no stock on any SKU: {x} products, {u} units shipped in 30 days, at least {s} units to ship together; {n} of them need no new shipment (inbound or units in transfer cover them)
  product ({asin})   30-day units   on the way                                           units to ship   adjusted   Amazon's qty   ship to SKU   notes
  {name}             {n}            {nothing | {n} inbound{ + {n} in transfer}, covers {d} days}   {n}     {n | -}    {n}            {sku}         {nothing available on {z} days: x{f} of the 30-day pace on its {n} clean days | in a deal until {date} while out of stock | only {n} clean days - the units to ship are {a minimum | an upper figure | uncertain} | rough: {u} units on its clean days | it sold only in the deal | only {n} daily snapshots in the 30 days}
  ...
  {+ {k} more products}

RUNS OUT BEFORE A NEW SHIPMENT ARRIVES - cover under {L} days: at least {y} products, {u} units shipped in 30 days, about {s} units to ship together
  product ({asin})   stock + inbound   30-day units   cover   units at risk   units to ship   adjusted   Amazon's qty   ship to SKU   notes
  {name}             {n} + {n}         {n}            {d} d   {n}             {n}             {n | -}    {n}            {sku}         {{in | was in} a deal until {date}{, {d} more days at the deal's pace}: x{f} of the 30-day pace on its {n} clean days | nothing available on {z} days: x{f} ... | at that pace the cover is {d} days: {ship soon, by {date} | covered - nothing to ship now} | a deal starts on {date} - it will sell faster than the pace | selling faster this week | of which {n} inbound not shipped yet | on hand for {d} days - check when the inbound lands}
  ...
  {+ {k} more products}

SHIP SOON - cover {L} to {L + 14} days: at least {z} products, {u} units shipped in 30 days, about {s} units to ship together
  product ({asin})   stock + inbound   30-day units   cover   ship by   units to ship   adjusted   Amazon's qty   ship to SKU   notes
  {name}             {n} + {n}         {n}            {d} d   {date}    {n}             {n | -}    {n}            {sku}         {as above}
  ...
  {+ {k} more products}

Adjusted = the same formula at the pace of the product's clean days (days with stock, outside a deal that is over before the shipment lands); the note gives the factor, and "rough" means it rests on fewer than 10 units. Where a row has an adjusted quantity, plan on it; a note "covered" or "ship soon" replaces the row's list and date. Totals use the 30-day pace and do not hold the adjustments.{ For products in a deal the clean days lie before it: a seasonal rise or fall since then is inside the factor.}
Amazon's qty is Amazon's own forecast for the selling SKU: where it is far from the quantity to plan on, check the product's forecast in Seller Central before shipping the larger number.
Checked: every product that is out of stock, and the {n} best sellers that Amazon puts under {2L} days of supply{ (cut at 200; the last one shipped {n} units in 30 days)}. Products that Amazon puts above {2L} days are not checked, so the second and third list are "at least". Used-condition SKUs left out.
```

Leave out a bucket that is empty with one line ("No product is out of stock"). Print the
deal line under the header only when a listed product is in such a deal. No token-cost
lines.

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
  had nothing available on 6 of the 28 days, so 22 days are clean. The daily sales show
  220 units on those 22 days (10 a day) and 224 on all 28 (8 a day): clean factor 1.25,
  adjusted quantity 8 x 1.25 x 60 - 300 = 300. Amazon shows 0, because it counts the
  inbound.
- Product C: 45 in stock, nothing inbound, 90 units in 30 days: cover 15 days, gap 15
  days, 45 units at risk. Units to ship: 3 x 60 - 45 = 135; Amazon recommends 110. No
  day without stock, no deal: no adjusted quantity.
- Product D: 100 in stock, 150 units in 30 days: cover 20 days, 50 units at risk, units
  to ship 5 x 60 - 100 = 200. It is in a deal that has run for 10 days, the snapshot
  day included, and ends in 5: 8 of those days fall inside the 28-day period, and 20
  days are clean. The daily sales show 60 units on
  the clean days (3 a day) and 140 on all 28 (5 a day): clean factor 0.6, adjusted
  quantity 5 x 0.6 x 60 - 100 = 80. The shipment lands after the deal: plan on 80, and
  note "5 more days at the deal's pace". At 3 a day the 100 in stock cover 33 days:
  "at that pace the cover is 33 days: ship soon, by {today + 3 days}".
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
- Did I take the clean factor from the daily sales, over the 28 days that end two days
  before the snapshot, with days without stock and deal days left out of the clean
  days?
- Is there an adjusted quantity only where at least 3 days are not clean and at least 7
  are, and did I count days without stock only for a selling SKU that ships 80% or more
  of the product and has its snapshots?
- Did I look up the deals that ended inside the 30 days, not only the running ones?
- Did I check that the out-now list is complete before ranking it, or mark it "at
  least"?
- Do the units to ship of the listed rows use the same pace as the bucket totals?
- Did I decide the buckets in whole numbers, so that a cover of exactly the lead time is
  "ship soon"?
- Did I use the user's lead time in the buckets, the ship-by date and the quantity?
- Does every adjusted quantity carry its reason and its factor, and a "rough" mark
  where the clean days hold fewer than 10 units?
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
- Cutting the out-of-stock list by sales and then ranking it by units to ship: the
  product that needs the most can sit below the cut.
- Taking the pace outside a deal as 30-day units minus the units at the deal price: the
  full-price units of the deal days stay in.
- Dividing the 30-day units by the days in stock: a product often still sells on a day
  whose snapshot shows nothing available, and the pace comes out too high.
- Using `inbound` as an alias on the fallback table, or `condition != Used` there: the
  export is rejected, and its used grades are `UsedLikeNew`, `UsedGood` and so on.
- Sizing a shipment on the sales of a month in which the product was out of stock half
  the time, or on the sales of a deal for a shipment that lands after it - also in the
  weeks after the deal has ended, while its sales are still inside the 30 days.
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
  twice the lead time, or gives no value, is not checked.
- Daily sales count order lines that have shipped, by the day of the order, while the
  30-day units of the inventory table count shipments: the two do not add up exactly.
  That is why the clean factor is a ratio taken from the daily sales alone, and is then
  applied to the 30-day pace of the inventory table.
- The limits (10 and 5 rows per bucket, 200 best sellers, twice the lead time for the
  pre-selection, 3 days not clean, 7 clean days and 10 units on them for an adjusted
  quantity, 80% for the selling SKU, 1.5 times for "selling faster") are defaults from a
  test on one large UK account in November 2026. Say which
  you used when asked.
- A DataDoe skill, built on `amazon_fba_inventory_health` (premium) with
  `amazon_fba_restock_recommendations` (Amazon's own restock report) as the fallback,
  and on daily sales from `amazon_profit_by_sku_and_date` for the clean factor.
