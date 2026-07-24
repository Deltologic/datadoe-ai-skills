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
1. **COGS gate (check first)** - if `cogs_total` is 0 for all / nearly all SKUs, COGS
   isn't configured; every profit/margin below is overstated (really just
   sales - fees - ad spend). Lead with a prominent warning (see workflow) before any
   number is trusted.
2. **Headline** - total sales, total profit, blended margin %, units.
3. **Winners** - top SKUs by profit (not sales) - where the money really is.
4. **Leaks** - SKUs with negative profit, margin below an absolute floor (~15% net) or
   far below the account average, or ad spend eating the whole margin - excluding
   settlement-lag artifacts (recent unsettled fees, see workflow).
5. **One action per leak** - raise price, cut ad spend, fix COGS, or discontinue.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data source: `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`, id `57a0cb319c`).
  Premium table, `CONTINUOUS` fetch (intraday refresh); already pre-joins settlements +
  COGS + ads, so you do NOT recompute profit yourself - trust the `profit` column. Fields
  include `profit`, `total_sales`, `total_units_sold`, `cogs_total` (+ `cogs_item` /
  `cogs_shipping`), `total_fees` (+ `total_selling_fees` / `fba_fees`), `ad_spend`,
  `ad_sales`, `acos`, `tacos`, `roi`, `product_name`, `currency`.
- Account roll-up (optional): `Profit by Date` (`amazon_profit_by_date`, id `b24cd69c06`)
  for the account-level headline / a quick `sum(cogs_total)` COGS-config check.
- **Query quirks (build the export right the first time):**
  - **Alias collision:** an aggregation `alias` must NOT equal an existing column name -
    `sum(profit) as profit` errors with `ALIAS_COLLISION`. Use a distinct alias
    (`profit_sum`, `t_profit`).
  - **Slow queue:** profit exports can sit `PENDING` for minutes - poll patiently, don't
    assume a fast return or give up early.
- Currency/marketplace: read `currency` / `marketplace_country_code` and localise
  (e.g. a German marketplace = EUR). Keep `currency` in the `groupBy` and report per
  currency - EU/pan-EU accounts can span currencies; never sum across them.
- **Window: use a full month or longer.** Amazon fees settle in batches (by
  settlement date, not sale date), so a few days or a single week can badly misstate
  profit/margin - a fee batch can land in one period and make it look terrible, or an
  un-settled period look great. A whole month smooths this. For recent windows, exclude
  the most-recent unsettled days or flag per-SKU lag artifacts (see workflow).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller, keep `sellerOrVendorId`.
2. `exports_sources_get` (query "profit") -> confirm source `amazon_profit_by_sku_and_date` is `enabled`.
3. `exports_create` for `amazon_profit_by_sku_and_date`, the requested date window, aggregated per SKU:
   - `groupBy`: `["sku","product_name","currency"]`
   - `aggregations` (sum): `total_sales`, `profit`, `cogs_total`, `ad_spend`,
     `total_fees`, `total_units_sold` - give each a **distinct alias** (e.g.
     `sum(profit) as profit_sum`, never `as profit`, which errors `ALIAS_COLLISION`).
   - `orderByColumn` the profit-sum alias (`profit_sum`), `DESC`; `limit` ~200.
   Do NOT sum `acos`/`tacos`/`roi` (they are ratios) - recompute them from the
   summed columns if needed (e.g. margin% = profit / sales).
4. Poll `exports_get` (patiently - profit exports can stay PENDING for minutes), then
   `exports_raw_download`.
5. **COGS-config gate (before trusting any margin):** if `cogs_total` is 0 for all /
   nearly all SKUs (e.g. `sum(cogs_total) = 0`), COGS isn't loaded for this account - set
   a prominent top-of-output warning ("COGS not configured; margins are overstated / not
   true net profit") and label margins accordingly. Profit ranking still works; the
   margin figures do not.
6. **Settlement-lag guard (recent windows):** fees post on settlement cycles, so a fresh
   SKU can show fees > sales (or fees with ~no sales) - a timing artifact, not a real
   loss. Either exclude the most-recent unsettled days, or flag any SKU whose fee/sales
   ratio is implausible (e.g. fees > sales in a short window) as "settlement lag - recheck
   after settlement" rather than a real leak.
7. Compute: blended margin = sum(profit)/sum(sales). Flag leaks: `profit < 0`,
   `ad_spend > profit`, or **net margin below an absolute floor (~15%)**. Use the absolute
   floor instead of "< 0.5x blended" whenever the blended margin is <= 0 or degenerate
   (COGS=0 inflates it, or a loss-making window) - a multiple of a negative baseline is
   meaningless. When blended is healthy, apply both.
8. Render the card.

## Output format

```
Net Profit - {marketplace} - {from}..{to}
[!] COGS NOT CONFIGURED - margins below are overstated, NOT true net profit   (only when cogs_total = 0 account-wide)
Sales {cur}{sales}   Profit {cur}{profit}   Margin {m}%   Units {u}

Top profit SKUs
#  SKU / product              Sales     Profit    Margin   Ad spend
1  {sku}                      {cur}..   {cur}..   {m}%     {cur}..
...

Profit leaks (fix first)
- {sku}: {why - negative profit / ad spend > margin / net margin < 15%}
  -> {action: raise price / cut bid / check COGS / discontinue}
Settlement-lag (recheck, not real losses): {sku(s) with fees > sales in an unsettled window}
```

Lead with the three headline numbers. Money in the marketplace currency.

## Worked example (illustrative)

A hero SKU might show, say, ~€17k sales / ~€11.9k profit (~68% margin) over the
month - healthy. Contrast a bundle SKU showing ~99% margin: that is almost always a
sign COGS was not uploaded for it, not a real 99% - the skill flags it to check COGS
completeness rather than celebrating a fake margin. And if *every* SKU shows no COGS
(`cogs_total = 0` account-wide), the skill leads with a prominent "COGS not configured"
warning - the whole P&L is overstated until COGS is loaded. Surfacing that data-quality
leak, alongside genuinely thin/negative-profit SKUs (and separating true losses from
settlement-lag timing artifacts), is the point.

## Quality self-check

- Did I rank by profit, not sales?
- Did I recompute margin/ACoS from summed columns (never sum a ratio)?
- Did I sanity-check suspiciously high margins for missing COGS?
- Did I check account-level COGS (`cogs_total`=0 across SKUs) and lead with a prominent
  warning when it's absent - not just a per-SKU footnote?
- Did I flag settlement-lag SKUs (fees > sales in a recent window) as timing artifacts,
  not real losses?
- Did I apply an absolute margin floor (~15%) so the leak flag still works when blended
  margin is negative/degenerate?
- Did I give aggregations distinct aliases (no `as profit`) to avoid ALIAS_COLLISION?
- Is money in the right currency?

## Common mistakes

- Summing `acos`/`tacos`/`roi` columns - they are per-row ratios, meaningless summed.
- Reporting sales as "profit". Use the `profit` column.
- Treating a 99% margin as real - usually COGS not uploaded for that SKU.
- Ignoring ad spend - a SKU can be "profitable" pre-ads and a loss after.
- Burying account-wide COGS=0 in a footnote - if COGS isn't loaded the whole P&L is
  overstated; lead with it.
- Reporting a fresh SKU with fees > sales as a real loss - usually settlement lag; flag
  it to recheck after settlement.
- Using "< 0.5x blended margin" when blended is negative - add an absolute ~15% floor.
- Aliasing `sum(profit) as profit` - ALIAS_COLLISION; use a distinct alias.

## Notes

- Read-only. Never writes to the account.
- `amazon_profit_by_sku_and_date` already blends settlements + COGS + ads, so it is
  the canonical profit source - do not rebuild P&L from raw orders/settlements.
- A DataDoe skill, built on the DataDoe Profit by SKU source.
