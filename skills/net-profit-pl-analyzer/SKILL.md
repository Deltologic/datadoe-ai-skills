---
name: net-profit-pl-analyzer
description: >-
  Break down your true Amazon net profit by SKU for any period - after Amazon fees,
  FBA, COGS and ad spend, not just top-line sales - ranking the real winners and
  surfacing the SKUs quietly losing money. Live from DataDoe. Use for "net profit",
  "profit by SKU", "am I making money", "which products are profitable", "profit
  report", "true margin", or "where am I losing money".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  access: read
  category: Profit & Finance
  interface: mcp
  output: report
---

# Net-Profit P&L Analyzer

Your true profit by SKU for any period - after Amazon fees, FBA, COGS and ad
spend, not just top-line sales. It ranks where you actually make money and where
profit is leaking, live from DataDoe. Runs in chat, no spreadsheet.

## When to use this

- Month-end / week-end: "how much did I actually make, and on what."
- When sales look fine but the bank account doesn't.
- To find the SKUs quietly losing money (negative profit, ad spend > margin).
- Trigger phrases: "profit", "net profit", "P&L", "margin by SKU", "am I making
  money", "which products are profitable", "profit report", "true profit".

## The framework. Sales is vanity, profit is sanity

Work top-down, then find the leaks:
1. **Headline** - total sales, total profit, blended margin %, units.
2. **Winners** - top SKUs by profit (not sales) - where the money really is.
3. **Leaks** - SKUs with negative profit, or margin far below the account average,
   or ad spend eating the whole margin (ACoS high, profit thin).
4. **One action per leak** - raise price, cut ad spend, fix COGS, or discontinue.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data source: `Profit by SKU & Date` (table `amazon_profit_by_sku_and_date`). Premium table; already pre-joins settlements +
  COGS + ads, so you do NOT recompute profit yourself - trust the `profit` column.
- Currency/marketplace: read `currency` / `marketplace_country_code` and localise
  (e.g. a German marketplace = EUR). Keep `currency` in the `groupBy` and report per
  currency - EU/pan-EU accounts can span currencies; never sum across them.
- **Window: use a full month or longer.** Amazon fees settle in batches (by
  settlement date, not sale date), so a few days or a single week can badly misstate
  profit/margin - a fee batch can land in one period and make it look terrible, or an
  un-settled period look great. A whole month smooths this; flag any single SKU whose
  margin looks extreme and check it isn't a settlement-timing artifact.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller, keep `sellerOrVendorId`.
2. `exports_sources_get` (query "profit") -> confirm source `amazon_profit_by_sku_and_date` is `enabled`.
3. `exports_create` for `amazon_profit_by_sku_and_date`, the requested date window, aggregated per SKU:
   - `groupBy`: `["sku","product_name","currency"]`
   - `aggregations` (sum): `total_sales`, `profit`, `total_cost`, `ad_spend`,
     `total_fees`, `cogs_total`, `total_units_sold`
   - `orderByColumn` the profit-sum alias, `DESC`; `limit` ~200.
   Do NOT sum `acos`/`tacos`/`roi` (they are ratios) - recompute them from the
   summed columns if needed (e.g. margin% = profit / sales).
4. Poll `exports_get`, then `exports_raw_download`.
5. Compute: blended margin = sum(profit)/sum(sales). Flag leaks: `profit < 0`, or
   SKU margin < 0.5x blended margin, or `ad_spend > profit`.
6. Render the card.

## Output format

```
Net Profit - {marketplace} - {from}..{to}
Sales {cur}{sales}   Profit {cur}{profit}   Margin {m}%   Units {u}

Top profit SKUs
#  SKU / product              Sales     Profit    Margin   Ad spend
1  {sku}                      {cur}..   {cur}..   {m}%     {cur}..
...

Profit leaks (fix first)
- {sku}: {why - negative profit / ad spend > margin / thin margin}
  -> {action: raise price / cut bid / check COGS / discontinue}
```

Lead with the three headline numbers. Money in the marketplace currency.

## Worked example (illustrative)

A hero SKU might show, say, ~€17k sales / ~€11.9k profit (~68% margin) over the
month - healthy. Contrast a bundle SKU showing ~99% margin: that is almost always a
sign COGS was not uploaded for it, not a real 99% - the skill flags it to check COGS
completeness rather than celebrating a fake margin. Surfacing that kind of
data-quality leak, alongside genuinely thin/negative-profit SKUs, is the point.

## Quality self-check

- Did I rank by profit, not sales?
- Did I recompute margin/ACoS from summed columns (never sum a ratio)?
- Did I sanity-check suspiciously high margins for missing COGS?
- Is money in the right currency?

## Common mistakes

- Summing `acos`/`tacos`/`roi` columns - they are per-row ratios, meaningless summed.
- Reporting sales as "profit". Use the `profit` column.
- Treating a 99% margin as real - usually COGS not uploaded for that SKU.
- Ignoring ad spend - a SKU can be "profitable" pre-ads and a loss after.

## Notes

- Read-only. Never writes to the account.
- `amazon_profit_by_sku_and_date` already blends settlements + COGS + ads, so it is
  the canonical profit source - do not rebuild P&L from raw orders/settlements.
- A DataDoe skill, built on the DataDoe Profit by SKU source.
