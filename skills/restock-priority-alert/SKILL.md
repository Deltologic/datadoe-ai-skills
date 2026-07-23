---
name: restock-priority-alert
description: >-
  Rank the Amazon FBA SKUs about to stock out by urgency - days of supply vs sales
  velocity, inbound-aware - with how many units to ship and by when, straight from
  Amazon's FBA restock recommendations. Live from DataDoe. Use for "restock", "what's about
  to stock out", "days of supply", "reorder", "low inventory", "how much to ship in",
  or "stockout risk".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  access: read
  category: Inventory
  interface: mcp
  output: report
---

# Restock Priority Alert

The SKUs about to stock out, ranked by urgency, with how many units to ship and by
when - straight from Amazon's own FBA restock recommendations (via DataDoe), with a
velocity sanity-check and fallback. Stops the silent revenue loss of a hero SKU going
to zero.

## When to use this

- Weekly (or daily) restock planning.
- Before a promo or peak season.
- "What's about to run out / what do I need to ship."
- Trigger phrases: "restock", "what's about to stock out", "days of supply",
  "reorder", "low inventory", "how much to ship in", "stockout risk".

## The framework. Rank by time-to-zero, not by units

1. **Out now** - Amazon's `alert = out_of_stock` (or `available = 0`) with recent
   velocity (real 30-day units sold, cross-checked against `amazon_profit_by_sku_and_date`
   - see workflow) and little/no `inbound`. Losing sales right now. Top priority.
2. **Imminent** - `alert = low_stock`, or
   `total_days_of_supply_including_units_from_open_shipments` (the inbound-aware DoS)
   below your lead time (default 30d) - on-hand + inbound won't cover it in time.
3. **Covered** - `alert = ""` (empty) and healthy days-of-supply. Skip.
Order by alert severity, then fewest days of supply. Attach Amazon's
`recommended_replenishment_qty` + `recommended_ship_date` - but sanity-check the qty
against `units_sold_last_30_days` first (an implausible reco is noise, not a signal).

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Primary source: `FBA Restock Recommendations` (`amazon_fba_restock_recommendations`,
  id `542b4c4b4e`) - Amazon's own restock report. Per SKU/day: `sku`, `child_asin`,
  `product_name`, `available`, `inbound` (+ `working` / `shipped` / `receiving`
  breakdown), `days_of_supply_at_amazon_fulfillment_network`,
  `total_days_of_supply_including_units_from_open_shipments`, `alert` (`out_of_stock` /
  `low_stock` / `""`), `recommended_replenishment_qty`, `recommended_ship_date`,
  `units_sold_last_30_days`. Multiple dates per SKU - collapse to `MAX(date)`; state the
  snapshot date and flag staleness (the data can lag - a July run has shown mid-June as
  the latest snapshot).
- Secondary / enrichment (optional): `FBA Inventory Health` (`amazon_fba_inventory_health`,
  id `44fc5ba0ce`) for storage-cost / aged-inventory detail. **Guard for emptiness** - it
  is currently returning 0 rows; if it comes back empty, skip the enrichment and say so -
  never report an empty catalog or fail. Do NOT make it the primary source. Not in MX.
- Velocity cross-check: `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`,
  id `57a0cb319c`) - real per-SKU units sold. The recommendations table's
  `units_sold_last_30_days` **under-reports** (in testing it read 0 for ~99% of the
  catalog while those SKUs were genuinely selling), so use the profit table as the
  authoritative velocity - otherwise genuine sellers get suppressed as "dead stock".
- Lead time / target cover: ask the user (default 30 days).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` (query "restock") -> confirm `amazon_fba_restock_recommendations`
   enabled.
3. `exports_create` for `amazon_fba_restock_recommendations`, columns: `sku`,
   `child_asin`, `product_name`, `available`, `inbound`,
   `days_of_supply_at_amazon_fulfillment_network`,
   `total_days_of_supply_including_units_from_open_shipments`, `alert`,
   `recommended_replenishment_qty`, `recommended_ship_date`, `units_sold_last_30_days`,
   `date`. The catalog is thousands of SKUs - pull to the **3,500-row cap or paginate**,
   do NOT cap at ~500. Sort so the most-urgent rows survive truncation: by `alert`
   (out_of_stock first) then `total_days_of_supply_including_units_from_open_shipments` ASC.
4. Poll, download, and **collapse to `MAX(date)` per SKU** so you rank on one current
   snapshot, not a mix of days. Record the snapshot date; flag the lag if it's well
   behind today.
5. **Velocity cross-check + fallbacks + sanity checks:**
   - **Cross-check velocity (important):** the recommendations table's
     `units_sold_last_30_days` under-reports - in testing it read 0 for ~99% of the
     catalog while those SKUs were genuinely selling. Pull real 30-day units sold per SKU
     from `amazon_profit_by_sku_and_date` and use it as the authoritative velocity. Treat
     a SKU as dead stock (skip it) only if BOTH sources show no sales; if the profit table
     shows sales, it's a live seller regardless of this table.
   - If days-of-supply is null/empty: daily velocity = (cross-checked 30-day units) / 30;
     days left = `available / velocity`.
   - Sanity-check `recommended_replenishment_qty` against the cross-checked velocity: a
     reco wildly out of line (e.g. a 4,000-unit reco on a SKU truly selling ~0) is flagged
     "verify against sales velocity", not surfaced blindly. Prefer Amazon's reco when it's
     plausible.
   - `recommended_ship_date` is frequently null in this source (100% null in testing) -
     render "n/a", don't imply a date exists; drive urgency off days-of-supply, not the
     ship date.
6. Bucket (out-now / imminent / covered) via `alert` + days-of-supply + `inbound`, and
   render most urgent first.
7. (Optional) enrich with `amazon_fba_inventory_health` for storage-cost / aged detail -
   but if that source returns 0 rows, skip it and note it; never block on it.

## Output format

```
Restock Priority - {marketplace} - snapshot {date} {STALE if lagging}   (lead time {L}d)

OUT NOW (alert: out_of_stock, losing sales)
SKU                     avail  30d-sold  inbound  ship-in   by        qty check
{sku}                   0      {n}       {n}      {qty}     {date}    ok / verify vs velocity

IMMINENT (alert: low_stock / DoS < {L}d)
SKU                     avail  DoS   30d-sold  inbound  ship-in  by
{sku}                   {n}    {d}   {n}       {n}      {qty}    {date}

Covered: {count} SKUs OK. Dead stock (no sales): {count} - not restocked.
```

## Worked example (illustrative)

SKU A: `available` 1, `units_sold_last_30_days` ~24 (~0.8/day), only 18 `inbound`, DoS
~0, `alert = out_of_stock`. Amazon's `recommended_replenishment_qty` ~86 by a date this
week -> OUT-NOW priority; ship the recommended quantity.
SKU B: `available` 0, sells ~65/mo, but ~418 already `inbound` -> covered soon, lower
priority despite being at zero (inbound covers it).
SKU C: `alert = out_of_stock`, `units_sold_last_30_days` 0, `recommended_replenishment_qty`
4357 -> implausible for a non-seller; flag "verify against sales velocity", don't ship it.
That inbound-aware ranking is the point: at-zero alone isn't the trigger; at-zero
*without enough inbound* is - and Amazon's reco is a suggestion to sanity-check, not gospel.

## Quality self-check

- Did I collapse to `MAX(date)` per SKU and state the snapshot date (and flag it if stale)?
- Did I rank on Amazon's `alert` + days-of-supply + `inbound` (subtract inbound before
  crying "stockout")?
- Did I fall back to `units_sold_last_30_days` velocity when days-of-supply is null, and
  skip no-velocity dead stock (don't restock a non-seller)?
- Did I sanity-check `recommended_replenishment_qty` against velocity before surfacing it?
- Did I cross-check velocity against `amazon_profit_by_sku_and_date` instead of trusting
  the recommendations table's `units_sold_last_30_days` (which under-reports)?
- Did I pull past ~500 rows (to the 3,500 cap / paginate) so the full catalog is covered?
- If I used `amazon_fba_inventory_health` for enrichment, did I handle it returning 0 rows?

## Common mistakes

- Flagging at-zero SKUs that already have plenty inbound.
- Recommending restock for dead stock (0 sales) - that's a removal decision, not restock.
- Ignoring null days-of-supply instead of computing from velocity.
- Using a stale snapshot (multiple dates) - collapse to MAX(date), and flag the lag.
- Capping the pull at ~500 rows on a multi-thousand-SKU catalog - pull to the 3,500 cap
  or paginate, sorted so the most-urgent rows survive truncation.
- Surfacing Amazon's `recommended_replenishment_qty` blindly - sanity-check it against
  `units_sold_last_30_days` (a 4,000-unit reco on a 0-sales SKU is noise).
- Building on `amazon_fba_inventory_health` as the primary source - it's empty right now;
  use `amazon_fba_restock_recommendations` and treat inventory-health as optional.
- Trusting the recommendations table's `units_sold_last_30_days` alone - it under-reports
  (0 for ~99% of the catalog in testing); cross-check real velocity from
  `amazon_profit_by_sku_and_date` or you'll suppress genuine sellers as "dead stock".
- Promising a ship date - `recommended_ship_date` is often null (100% in testing); render
  "n/a" and rank on days-of-supply instead.

## Notes

- Read-only.
- Pairs with a removal / excess-inventory skill for the opposite problem (overstock).
- A DataDoe skill, built on `amazon_fba_restock_recommendations` (Amazon's native restock
  report), cross-checking velocity against `amazon_profit_by_sku_and_date`, with
  `amazon_fba_inventory_health` as optional enrichment (empty at present).
