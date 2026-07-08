---
name: restock-priority-alert
description: >-
  Rank the Amazon FBA SKUs about to stock out by urgency - days of supply vs sales
  velocity, inbound-aware - with how many units to ship and by when, straight from
  DataDoe's FBA Inventory Health. Live from DataDoe. Use for "restock", "what's about
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
when - straight from DataDoe's FBA Inventory Health (Amazon's own restock
recommendations, plus a velocity fallback). Stops the silent revenue loss of a
hero SKU going to zero.

## When to use this

- Weekly (or daily) restock planning.
- Before a promo or peak season.
- "What's about to run out / what do I need to ship."
- Trigger phrases: "restock", "what's about to stock out", "days of supply",
  "reorder", "low inventory", "how much to ship in", "stockout risk".

## The framework. Rank by time-to-zero, not by units

1. **Out now** - `available = 0` with recent velocity (`units_shipped_t30 > 0`) and
   little/no inbound. Losing sales right now. Top priority.
2. **Imminent** - `days_of_supply` below your lead time (default 30d) and not enough
   inbound to cover.
3. **Covered** - enough on-hand + inbound. Skip.
Order by fewest days of supply. Attach Amazon's `recommended_ship_in_quantity` +
`recommended_ship_in_date`.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data source: `FBA Inventory Health` (`amazon_fba_inventory_health`). Daily snapshot - use the latest `date`. Not
  available in MX.
- Lead time / target cover: ask the user (default 30 days).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` (query "inventory health") -> confirm `amazon_fba_inventory_health` enabled.
3. `exports_create` for `amazon_fba_inventory_health`, latest snapshot (from/to = last ~2 days),
   columns: `sku`, `product_name`, `available`, `inbound_quantity`,
   `days_of_supply`, `units_shipped_t30`, `units_shipped_t7`,
   `recommended_ship_in_quantity`, `recommended_ship_in_date`,
   `fba_inventory_level_health_status`. Order by `days_of_supply` ASC. Pull ~500.
4. Poll, download, keep the latest date per SKU.
5. **Handle nulls** (real data quirk): slow/near-zero SKUs often have
   `days_of_supply = null`. Fallback: daily velocity = `units_shipped_t30 / 30`;
   days left = `available / velocity` (skip SKUs with no velocity - they are dead
   stock, not restock). Prefer Amazon's `recommended_ship_in_quantity` when present.
6. Bucket (out-now / imminent / covered) and render, most urgent first.

## Output format

```
Restock Priority - {marketplace} - {date}   (lead time {L}d)

OUT NOW (losing sales)
SKU                     avail  t30   inbound  ship-in   by
{sku}                   0      {n}    {n}      {qty}     {date}

IMMINENT (< {L} days)
SKU                     avail  DoS   t30   inbound  ship-in  by
{sku}                   {n}    {d}   {n}   {n}      {qty}    {date}

Covered: {count} SKUs OK. Dead stock (no sales): {count} - not restocked.
```

## Worked example (illustrative)

SKU A: available 1, sold ~24 in the last 30d (~0.8/day), only 18 inbound, days of
supply ~0. Amazon recommends shipping in ~86 units by a date this week -> OUT-NOW
priority; ship the recommended quantity.
SKU B: available 0, sells ~65/mo, but ~418 already inbound -> covered soon, lower
priority despite being at zero (inbound covers it).
That inbound-aware ranking is the point: at-zero alone isn't the trigger; at-zero
*without enough inbound* is.

## Quality self-check

- Did I use the latest snapshot date only?
- Did I subtract inbound before crying "stockout"?
- Did I fall back to t30 velocity when `days_of_supply` is null, and skip no-velocity
  dead stock (don't tell them to restock a non-seller)?
- Did I surface Amazon's ship-in qty/date rather than guessing?

## Common mistakes

- Flagging at-zero SKUs that already have plenty inbound.
- Recommending restock for dead stock (0 sales) - that's a removal decision, not restock.
- Ignoring null days_of_supply instead of computing from velocity.
- Using a stale snapshot (multiple dates) - collapse to MAX(date).

## Notes

- Read-only.
- Pairs with a removal / excess-inventory skill for the opposite problem (overstock).
- A DataDoe skill, built on the DataDoe FBA Inventory Health source (uses Amazon's
  native restock recommendations where available).
