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
(premium, empty for non-premium orgs) vs restock_recommendations (free). Until answered,
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
  **Premium / emptiness guard:** check `exports_source_get` first. If `enabled: false`, or
  the export returns **0 rows** (the table is empty for non-premium orgs), tell the user
  "FBA Inventory Health is not available in your plan - using Amazon's restock
  recommendations instead" and switch to the fallback below. Never render an empty
  catalog or zeros as "nothing to restock".
- **Fallback source:** `FBA Restock Recommendations` (`amazon_fba_restock_recommendations`,
  free) - Amazon's own restock report. Per SKU/day: `sku`, `child_asin`, `product_name`,
  `available`, `inbound` (+ `working` / `shipped` / `receiving` breakdown),
  `days_of_supply_at_amazon_fulfillment_network`,
  `total_days_of_supply_including_units_from_open_shipments`, `alert` (`out_of_stock` /
  `low_stock` / `""`), `recommended_replenishment_qty`, `recommended_ship_date`,
  `units_sold_last_30_days`. Multiple dates per SKU - collapse to `MAX(date)`; state the
  snapshot date and flag staleness (the data can lag - a July run showed mid-June as the
  latest snapshot).
- **Velocity cross-check:** `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`)
  [premium] - real per-SKU units sold. The recommendations table's `units_sold_last_30_days`
  **under-reports** (in testing it read 0 for ~99% of the catalog while those SKUs were
  genuinely selling), so when this table is available use it as the authoritative velocity -
  otherwise genuine sellers get suppressed as "dead stock". If it is not in the plan, use
  `units_shipped_t30` (inventory health) and say the velocity is Amazon's own figure.
- Lead time / target cover: ask the user (default 30 days).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` (query "inventory health") -> check `amazon_fba_inventory_health`.
   If `enabled: false`, go straight to the fallback (step 3b). Also check
   `amazon_fba_restock_recommendations` and `amazon_profit_by_sku_and_date`.
3. **a) Primary:** `exports_create` for `amazon_fba_inventory_health`, latest snapshot
   (from/to = last ~2 days), columns as listed above. Order by `days_of_supply` ASC. The
   catalog is thousands of SKUs - pull to the **3,500-row cap or paginate**, do NOT cap at
   ~500; sort so the most-urgent rows survive truncation. **If the export returns 0 rows,
   treat the table as unavailable and run step 3b.**
   **b) Fallback:** `exports_create` for `amazon_fba_restock_recommendations`, columns:
   `sku`, `child_asin`, `product_name`, `available`, `inbound`,
   `days_of_supply_at_amazon_fulfillment_network`,
   `total_days_of_supply_including_units_from_open_shipments`, `alert`,
   `recommended_replenishment_qty`, `recommended_ship_date`, `units_sold_last_30_days`,
   `date`. Same row cap / pagination rule; sort by `alert` (out_of_stock first) then
   `total_days_of_supply_including_units_from_open_shipments` ASC. Say in the output which
   source the ranking is built on.
4. Poll, download, and **collapse to `MAX(date)` per SKU** so you rank on one current
   snapshot, not a mix of days. Record the snapshot date; flag the lag if it is well behind
   today.
5. **Velocity cross-check + fallbacks + sanity checks:**
   - **Cross-check velocity (important):** pull real 30-day units sold per SKU from
     `amazon_profit_by_sku_and_date` (if in the plan) and use it as the authoritative
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
- Did I cross-check velocity against `amazon_profit_by_sku_and_date` instead of trusting
  the recommendations table's `units_sold_last_30_days` (which under-reports)?
- Did I pull past ~500 rows (to the 3,500 cap / paginate) so the full catalog is covered?

## Common mistakes

- Reporting "nothing to restock" because `amazon_fba_inventory_health` came back empty -
  that means the table is not in the plan; use the fallback source.
- Flagging at-zero SKUs that already have plenty inbound.
- Recommending restock for dead stock (0 sales) - that's a removal decision, not restock.
- Ignoring null days-of-supply instead of computing from velocity.
- Using a stale snapshot (multiple dates) - collapse to MAX(date), and flag the lag.
- Capping the pull at ~500 rows on a multi-thousand-SKU catalog - pull to the 3,500 cap
  or paginate, sorted so the most-urgent rows survive truncation.
- Surfacing Amazon's recommended quantity blindly - sanity-check it against real velocity
  (a 4,000-unit reco on a 0-sales SKU is noise).
- Trusting the recommendations table's `units_sold_last_30_days` alone - it under-reports
  (0 for ~99% of the catalog in testing); cross-check real velocity from
  `amazon_profit_by_sku_and_date` or you'll suppress genuine sellers as "dead stock".
- Promising a ship date - `recommended_ship_date` is often null; render "n/a" and rank on
  days-of-supply instead.

## Notes

- Read-only.
- Pairs with a removal / excess-inventory skill for the opposite problem (overstock).
- A DataDoe skill, built on `amazon_fba_inventory_health` (premium) with
  `amazon_fba_restock_recommendations` (Amazon's native restock report) as the fallback,
  cross-checking velocity against `amazon_profit_by_sku_and_date`.
