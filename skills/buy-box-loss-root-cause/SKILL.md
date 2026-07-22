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

1. **Ownership** - the **latest-day** `buybox_percentage` well below 100 on a SKU with
   sales/traffic = you're sharing or losing the box *right now*. Use the most recent
   complete day (optionally a short 3-7 day trend), never a 30-day average - averaging
   masks a dip-then-recovery and flags SKUs that already hold the box again.
2. **Price** - `your_price` above `featuredoffer_price` (or `lowest_price_new_plus_
   shipping`) = you're priced out of the box.
3. **Stock** - `available = 0` / very low = Amazon can suppress your offer.
4. **Fulfilment/health** - FBM vs FBA and account-health issues also cost the box
   (flag as "check" - not in these tables).
Report the first gate that fails, biggest-revenue SKU first.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (no dedicated buy-box table - synthesize):
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`, id `57a0cb319c`) -
    `buybox_percentage` (a **per-day series** - also in `amazon_sales_and_traffic_with_cogs`,
    id `401ffcd7e5`), `total_sales`, `page_views`, per SKU/day. Read the latest complete
    day, not a window average.
  - `FBA Inventory Health` (`amazon_fba_inventory_health`) - `your_price`, `sales_price`,
    `featuredoffer_price`, `lowest_price_new_plus_shipping`, `available`.
- Currency/marketplace: localise (e.g. a German marketplace = EUR).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm `amazon_profit_by_sku_and_date` + `amazon_fba_inventory_health` enabled.
3. `exports_create` on `amazon_profit_by_sku_and_date`, last 30d, **daily** (do NOT
   average bb over the window): pull the per-day `buybox_percentage` series per
   `[sku, product_name]`, plus `sum total_sales`, `sum page_views`, filter
   `total_units_sold > 0`. Then per SKU derive:
   - **bb_now** = the most recent *complete* day's `buybox_percentage` (the headline).
   - **bb_trend** (optional) = last 3-7 days vs the prior span, to tell "just lost it"
     from "chronically low".
   Flag a SKU as a *current* buy-box loss only if **bb_now** is low - not if only its
   30-day average is (a 30-day mean would flag a SKU that dipped and has since recovered).
4. `exports_create` on `amazon_fba_inventory_health`, latest snapshot: `sku`, `your_price`,
   `featuredoffer_price`, `lowest_price_new_plus_shipping`, `available`. This is a
   **current** snapshot (one day) - price lives here, not in the profit/sales table.
5. Join the two on `sku`, **matching time bases**: pair the current price snapshot with
   **bb_now** (the latest-day buy-box read from step 3), never the 30-day average - both
   sides of the join must describe the same recent moment. For each SKU whose **bb_now**
   is low (< ~90) with meaningful sales, diagnose: price gap =
   `your_price - featuredoffer_price` (>0 -> priced out); `available = 0` -> stock;
   else -> fulfilment/health check.
6. Rank by sales at risk (sales x (1 - bb/100)) and render.

## Output format

```
Buy Box Loss - {marketplace} - buy-box as of {latest day}  (sales over last 30d)

SKU                 BB%(now) Sales    Likely cause            Fix
{sku}               {bb}%    {cur}..  priced out (+{cur}gap)  match/beat {cur}{feat}
{sku}               {bb}%    {cur}..  out of stock            restock (see restock skill)
{sku}               {bb}%    {cur}..  fulfilment/health       check FBM/AHR

Biggest sales at risk: {sku} ({cur}.. exposed).
```

## Worked example (illustrative)

Reading each SKU's **latest-day** buy-box % (not a 30-day average) surfaces the ones
losing the box *now* with real sales - a SKU that dipped mid-month but sits at 98% today
is not flagged. The skill then joins today's prices: if `your_price` 12.90 >
`featuredoffer_price` 11.95, the
cause is "priced out by 0.95" and the fix is to match/beat 11.95 (or hold price if
margin matters more than the box). If instead `available = 0`, the cause is stock,
routed to the restock skill. Same signal, different fix - the skill picks the right
one.

## Quality self-check

- Did I only flag SKUs with real sales/traffic (ignore dead SKUs at bb 0)?
- Did I key off the latest-day `buybox_percentage` (or a short trend), NOT a 30-day
  average, so recoveries aren't misread as current losses?
- Did I pair today's price snapshot with the current buy-box read (same time basis)?
- Did I check price gap AND stock before blaming "fulfilment"?
- Did I rank by revenue at risk, not by lowest bb%?
- Did I keep margin in mind (winning the box below cost isn't a win)?

## Common mistakes

- Chasing buy-box on tiny long-tail SKUs (bb 0 but 1 unit/mo) - not worth it.
- Recommending a price cut when the real cause is a stockout.
- Averaging buy-box % across the window - `buybox_percentage` is a daily series; a SKU
  that dipped and recovered reads as a chronic loss. Use the latest-day value (or a short
  trend), not a 30-day mean.
- Comparing a 30-day average buy-box to a single-day price snapshot - two different time
  bases; pair current with current.
- Treating a null `buybox_percentage` as a lost box - null usually means no
  competition data (often you're the sole seller); skip it, don't flag it.
- Racing a hijacker to the bottom instead of enforcing (flag for enforcement).

## Notes

- Read-only. No auto-repricing (a price change would be `bulk-price-update`, dryRun-gated).
- Buy box is synthesized (no first-class table) - state assumptions in the output.
- A DataDoe skill, built on DataDoe buy-box % + price columns.
