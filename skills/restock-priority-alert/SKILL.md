---
name: restock-priority-alert
description: >-
  Rank the Amazon FBA SKUs about to stock out by urgency - days of supply vs sales
  velocity, inbound-aware - with how many units to ship and by when, from DataDoe's FBA
  Inventory Health with Amazon's FBA restock recommendations as the fallback. Live from DataDoe. Use for "restock", "what's about
  to stock out", "days of supply", "reorder", "low inventory", "how much to ship in",
  or "stockout risk".
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

The SKUs about to stock out, ranked by urgency, with how many units to ship and by
when - from DataDoe's FBA Inventory Health (premium) with Amazon's own FBA Restock
Recommendations as the fallback, plus a velocity sanity-check against real sales. Stops
the silent revenue loss of a hero SKU going to zero.

<!-- TODO(Riegel, Q5): primary restock source still to be decided - inventory_health
(premium; the empty table seen in July was most likely an initial-load state) vs
restock_recommendations (free, optional, multi-country). Until answered,
inventory_health is primary with an emptiness guard that falls back to
restock_recommendations. -->

## When to use this

- Weekly (or daily) restock planning.
- Before a promo or peak season.
- "What's about to run out / what do I need to ship."
- Trigger phrases: "restock", "what's about to stock out", "days of supply",
  "reorder", "low inventory", "how much to ship in", "stockout risk".

## The framework. Rank by time-to-zero, not by units

1. **Out now** - `available = 0` (or, on the fallback source, `alert = out_of_stock`) with
   recent velocity (real 30-day units sold, cross-checked against
   `amazon_profit_by_sku_and_date` - see workflow) and little/no inbound. Losing sales
   right now. Top priority.
2. **Imminent** - inbound-aware days of supply (`days_of_supply` on inventory health;
   `total_days_of_supply_including_units_from_open_shipments` on the fallback, or
   `alert = low_stock`) below your lead time (default 30d) - on-hand + inbound won't cover
   it in time.
3. **Covered** - healthy days of supply (fallback: `alert = ""`). Skip.
Order by severity, then fewest days of supply. Attach Amazon's recommended ship-in
quantity and date - but sanity-check the quantity against real 30-day velocity first (an
implausible reco is noise, not a signal).

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- **Primary source:** `FBA Inventory Health` (`amazon_fba_inventory_health`) **[premium]**.
  Daily snapshot - use the latest `date`. Columns: `sku`, `child_asin`, `product_name`,
  `available`, `inbound_quantity`, `days_of_supply`, `units_shipped_t30`,
  `units_shipped_t7`, `recommended_ship_in_quantity`, `recommended_ship_in_date`,
  `fba_inventory_level_health_status`. Not available in MX.
  **Emptiness guard:** Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and switch to the fallback below ("FBA Inventory Health returned no rows (initial load may still be running) - using Amazon's restock recommendations instead"); never render zeros.
  Never render an empty catalog as "nothing to restock".
- **Fallback source:** `FBA Restock Recommendations` (`amazon_fba_restock_recommendations`,
  free) - Amazon's own restock report. Per SKU/day: `sku`, `child_asin`, `product_name`,
  `available`, `inbound` (+ `working` / `shipped` / `receiving` breakdown),
  `days_of_supply_at_amazon_fulfillment_network`,
  `total_days_of_supply_including_units_from_open_shipments`, `alert` (`out_of_stock` /
  `low_stock` / `""`), `recommended_replenishment_qty`, `recommended_ship_date`,
  `units_sold_last_30_days`, `country`. **Multi-country table:** one UK seller returned
  DE/ES/FR/GB/IT rows (43k rows a day); always filter `country = <marketplace code, e.g.
  GB>` or a UK ranking is built from other marketplaces' rows and holds zero GB rows.
  Multiple dates per SKU - collapse to `MAX(date)`; state the snapshot date and flag
  staleness (the data can lag - 13 days behind in an October run).
- **Velocity cross-check:** `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`)
  [premium] - real units sold per SKU and per `child_asin`. Velocity columns on the
  inventory tables are **per SKU**: sibling SKUs of a live ASIN read 0 (1,694 "dead" SKUs
  on selling ASINs in testing), so judge velocity per `child_asin` (sum this table over
  the ASIN's SKUs) before calling a SKU dead or a recommendation "noise". If this table is
  unavailable (0 rows), sum `units_shipped_t30` / `units_sold_last_30_days` across the ASIN's
  SKUs and say the velocity is Amazon's own figure.
- Lead time / target cover: ask the user (default 30 days).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` (query "inventory health") -> check `amazon_fba_inventory_health`.
   If `enabled: false`, go straight to the fallback (step 3b). Also check
   `amazon_fba_restock_recommendations` and `amazon_profit_by_sku_and_date`.
3. **a) Primary:** `exports_create` for `amazon_fba_inventory_health`, latest snapshot
   (`from` = `to` = the latest date; a 2-day range returns two snapshots), filter
   `marketplace_country_code = <marketplace>`, columns as listed above. **Row caps are
   1,000 (JSON) / 5,000 (CSV)** and a catalog can exceed them (7,554 rows here), so do not
   rely on sorting: `days_of_supply ASC` puts the nulls first and truncation keeps the
   wrong rows. Pull the urgent sets server-side instead - (i) `available = 0 AND
   units_shipped_t30 > 0` (out now), (ii) `days_of_supply notNull AND days_of_supply <
   <lead time>` (imminent) - and paginate with `skip` if a page fills to `limit`. **If the
   export returns 0 rows, treat the table as unavailable and run step 3b.**
   **b) Fallback:** `exports_create` for `amazon_fba_restock_recommendations`, columns:
   `sku`, `child_asin`, `product_name`, `available`, `inbound`,
   `days_of_supply_at_amazon_fulfillment_network`,
   `total_days_of_supply_including_units_from_open_shipments`, `alert`,
   `recommended_replenishment_qty`, `recommended_ship_date`, `units_sold_last_30_days`,
   `date`, `country`, **filter `country = <marketplace code>`** (multi-country table - see
   Configuration). Same row caps; pull `alert IN (out_of_stock, low_stock)` server-side,
   then sort by `alert` (out_of_stock first) and
   `total_days_of_supply_including_units_from_open_shipments` ASC; paginate if a page
   fills to `limit`. Say in the output which source the ranking is built on.
4. Poll, download, and **collapse to `MAX(date)` per SKU** so you rank on one current
   snapshot, not a mix of days. Record the snapshot date; flag the lag if it is well behind
   today.
5. **Velocity cross-check + fallbacks + sanity checks:**
   - **Cross-check velocity (important):** pull real 30-day units sold per SKU from
     `amazon_profit_by_sku_and_date` (a premium export, 5 AI Tokens) and use it as the authoritative
     velocity. Treat a SKU as dead stock (skip it) only if BOTH sources show no sales; if
     the profit table shows sales, it is a live seller regardless of the inventory table.
   - If days-of-supply is null/empty (slow or near-zero SKUs often are): daily velocity =
     (cross-checked 30-day units, else `units_shipped_t30`) / 30; days left =
     `available / velocity`.
   - Sanity-check the recommended quantity (`recommended_ship_in_quantity` /
     `recommended_replenishment_qty`) against the cross-checked velocity: a reco wildly out
     of line (e.g. a 4,000-unit reco on a SKU truly selling ~0) is flagged "verify against
     sales velocity", not surfaced blindly. Prefer Amazon's reco when it is plausible.
   - The recommended ship date is frequently null (100% null on the fallback source in
     testing) - render "n/a", do not imply a date exists; drive urgency off days-of-supply.
6. Bucket (out-now / imminent / covered) via days-of-supply + inbound (+ `alert` on the
   fallback source), and render most urgent first.

## Output format

```
Restock Priority - {marketplace} - snapshot {date} {STALE if lagging}   (lead time {L}d)
Source: FBA Inventory Health | FBA Restock Recommendations (fallback - inventory health not in plan)

OUT NOW (available 0 / alert out_of_stock, losing sales)
SKU                     avail  30d-sold  inbound  ship-in   by        qty check
{sku}                   0      {n}       {n}      {qty}     {date}    ok / verify vs velocity

IMMINENT (DoS < {L}d / alert low_stock)
SKU                     avail  DoS   30d-sold  inbound  ship-in  by
{sku}                   {n}    {d}   {n}       {n}      {qty}    {date}

Covered: {count} SKUs OK. Dead stock (no sales): {count} - not restocked.
```

## Worked example (illustrative)

SKU A: `available` 1, ~24 units sold in the last 30d (~0.8/day), only 18 inbound, DoS
~0. Amazon's recommended quantity ~86 by a date this week -> OUT-NOW priority; ship the
recommended quantity.
SKU B: `available` 0, sells ~65/mo, but ~418 already inbound -> covered soon, lower
priority despite being at zero (inbound covers it).
SKU C: out of stock, 0 units sold in 30 days on both sources, recommended quantity 4357 ->
implausible for a non-seller; flag "verify against sales velocity", don't ship it.
That inbound-aware ranking is the point: at-zero alone isn't the trigger; at-zero
*without enough inbound* is - and Amazon's reco is a suggestion to sanity-check, not gospel.

## Quality self-check

- Did I check `amazon_fba_inventory_health` for `enabled` and for 0 rows, and fall back to
  `amazon_fba_restock_recommendations` (saying so) instead of reporting "nothing to restock"?
- Did I collapse to `MAX(date)` per SKU and state the snapshot date (and flag it if stale)?
- Did I rank on days-of-supply + inbound (subtract inbound before crying "stockout")?
- Did I fall back to 30-day velocity when days-of-supply is null, and skip no-velocity
  dead stock (don't restock a non-seller)?
- Did I sanity-check the recommended quantity against velocity before surfacing it?
- Did I judge velocity per `child_asin` (sibling SKUs of a live ASIN read 0 on their own)
  using `amazon_profit_by_sku_and_date` where available?
- Did I filter `country` / `marketplace_country_code` to the seller's marketplace?
- Did I pull the urgent sets server-side (and paginate) instead of trusting a sorted
  5,000-row page?

## Common mistakes

- Reporting "nothing to restock" because `amazon_fba_inventory_health` came back empty -
  the initial load may not have finished; use the fallback source and say so.
- Flagging at-zero SKUs that already have plenty inbound.
- Recommending restock for dead stock (0 sales) - that's a removal decision, not restock.
- Ignoring null days-of-supply instead of computing from velocity.
- Using a stale snapshot (multiple dates) - collapse to MAX(date), and flag the lag.
- Trusting one sorted page on a multi-thousand-SKU catalog - caps are 1,000 JSON / 5,000
  CSV and `days_of_supply ASC` sorts nulls first; filter the urgent sets server-side.
- Forgetting the `country` filter on `amazon_fba_restock_recommendations` - a UK ranking
  built from DE/ES/FR rows.
- Surfacing Amazon's recommended quantity blindly - sanity-check it against real velocity
  (a 4,000-unit reco on a 0-sales SKU is noise).
- Calling a SKU dead from its own `units_sold_last_30_days` / `units_shipped_t30` - sibling
  SKUs of a selling ASIN read 0; judge velocity per `child_asin` (and a 4,452-unit reco on a
  sibling SKU of an ASIN selling 2,775 units a month is not noise).
- Promising a ship date - `recommended_ship_date` is often null; render "n/a" and rank on
  days-of-supply instead.

## Notes

- Read-only.
- Pairs with a removal / excess-inventory skill for the opposite problem (overstock).
- A DataDoe skill, built on `amazon_fba_inventory_health` (premium) with
  `amazon_fba_restock_recommendations` (Amazon's native restock report) as the fallback,
  cross-checking velocity against `amazon_profit_by_sku_and_date`.
