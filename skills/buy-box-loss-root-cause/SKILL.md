---
name: buy-box-loss-root-cause
description: >-
  Find the Amazon SKUs losing the Buy Box (Featured Offer) and the most likely reason
  - price vs the featured offer, out of stock, or fulfilment - so you can win it back.
  Live from DataDoe. Use for "buy box", "featured offer", "lost the buy box", "buy box
  percentage", "why did sales drop but traffic did not", or "someone else has my listing".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  access: read
  category: Listings & Content
  interface: mcp
  output: report
---

# Buy Box Loss Root Cause

Finds the SKUs where you're losing the Featured Offer (Buy Box) and tells you the
most likely reason - price vs the featured offer, out-of-stock, or fulfilment -
so you can win it back. DataDoe has no single "buy box" table, so this skill
synthesizes it from the buy-box % and price columns.

## When to use this

- Sales dropped on a SKU that still gets traffic (classic buy-box loss).
- Weekly check on hero SKUs' buy-box ownership.
- After a competitor/reseller appears on your listing.
- Trigger phrases: "buy box", "featured offer", "lost the buy box", "buy box
  percentage", "why did sales drop but traffic didn't", "someone else has my listing".

## The framework. The Buy Box gates (check in order)

1. **Ownership** - `buybox_percentage` well below 100 on a SKU with sales/traffic =
   you're sharing or losing the box.
2. **Price** - `your_price` above `featuredoffer_price` (or `lowest_price_new_plus_
   shipping`) = you're priced out of the box.
3. **Stock** - `available = 0` / very low = Amazon can suppress your offer.
4. **Fulfilment/health** - FBM vs FBA and account-health issues also cost the box
   (flag as "check" - not in these tables).
Report the first gate that fails, biggest-revenue SKU first.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (no dedicated buy-box table - synthesize):
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`) - `buybox_percentage`, `total_sales`,
    `page_views`, per SKU/day.
  - `FBA Inventory Health` (`amazon_fba_inventory_health`) - `your_price`, `sales_price`,
    `featuredoffer_price`, `lowest_price_new_plus_shipping`, `available`.
- Currency/marketplace: localise (e.g. a German marketplace = EUR).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm `amazon_profit_by_sku_and_date` + `amazon_fba_inventory_health` enabled.
3. `exports_create` on `amazon_profit_by_sku_and_date`, last 30d: `groupBy [sku, product_name]`,
   `avg buybox_percentage` (alias bb), `sum total_sales`, `sum page_views`. Filter
   `total_units_sold > 0`. This finds SKUs with traffic/sales but low buy-box %.
4. `exports_create` on `amazon_fba_inventory_health`, latest snapshot: `sku`, `your_price`,
   `featuredoffer_price`, `lowest_price_new_plus_shipping`, `available`.
5. Join the two on `sku`. For each low-bb SKU (bb < ~90 with meaningful sales),
   diagnose: price gap = `your_price - featuredoffer_price` (>0 -> priced out);
   `available = 0` -> stock; else -> fulfilment/health check.
6. Rank by sales at risk (sales x (1 - bb/100)) and render.

## Output format

```
Buy Box Loss - {marketplace} - last 30d

SKU                 BuyBox%  Sales    Likely cause            Fix
{sku}               {bb}%    {cur}..  priced out (+{cur}gap)  match/beat {cur}{feat}
{sku}               {bb}%    {cur}..  out of stock            restock (see restock skill)
{sku}               {bb}%    {cur}..  fulfilment/health       check FBM/AHR

Biggest sales at risk: {sku} ({cur}.. exposed).
```

## Worked example (illustrative)

Pulling buy-box % per SKU surfaces the low-ownership ones with real sales. The skill
then joins today's prices: if `your_price` 12.90 > `featuredoffer_price` 11.95, the
cause is "priced out by 0.95" and the fix is to match/beat 11.95 (or hold price if
margin matters more than the box). If instead `available = 0`, the cause is stock,
routed to the restock skill. Same signal, different fix - the skill picks the right
one.

## Quality self-check

- Did I only flag SKUs with real sales/traffic (ignore dead SKUs at bb 0)?
- Did I check price gap AND stock before blaming "fulfilment"?
- Did I rank by revenue at risk, not by lowest bb%?
- Did I keep margin in mind (winning the box below cost isn't a win)?

## Common mistakes

- Chasing buy-box on tiny long-tail SKUs (bb 0 but 1 unit/mo) - not worth it.
- Recommending a price cut when the real cause is a stockout.
- Averaging buy-box % across a stockout gap and misreading it.
- Treating a null `buybox_percentage` as a lost box - null usually means no
  competition data (often you're the sole seller); skip it, don't flag it.
- Racing a hijacker to the bottom instead of enforcing (flag for enforcement).

## Notes

- Read-only. No auto-repricing (a price change would be `bulk-price-update`, dryRun-gated).
- Buy box is synthesized (no first-class table) - state assumptions in the output.
- A DataDoe skill, built on DataDoe buy-box % + price columns.
