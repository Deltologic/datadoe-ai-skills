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
  title: Net Profit P&L Analyzer
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
- Account P&L: `Profit by Date` (`amazon_profit_by_date`). This is the account number.
  It includes every campaign type in `ad_spend`, and unallocated fees (storage, inbound,
  subscription, and similar posted-date fees) land here. Trust `profit`. Do not rebuild
  it from `amazon_settlements_with_cogs`.
- SKU P&L: `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`). Use it only for
  the per-SKU ranking. Its `ad_spend` is Sponsored Products and Sponsored Display,
  same-SKU attribution only. **Do not sum this table's `profit` and call it account
  profit.** That sum will not equal `amazon_profit_by_date.profit`.
- Both tables are premium. Premium guard: check `exports_source_get` first - if
  `enabled: false`, or the export returns 0 rows, tell the user "this table is not
  available in your plan" and stop; never render a P&L of zeros. Filter on `date` (marketplace-local profit date). Do not
  filter `order_date`: posted-date fees have no order date and a filter on it drops them.
  `groupBy` must not be empty. `groupBy: []` returns zero rows.
- `total_fees`, `fba_fees`, `total_selling_fees`, `cogs_total`, and `ad_spend` are
  positive costs. `profit` is already `total_sales - total_fees - cogs_total - ad_spend
  + refund_cost`. Do not add `total_selling_fees` or `fba_fees` on top of `total_fees`.
  <!-- TODO(Riegel, Q3): confirm the sign of `refund_cost` - the column description does
  not state it; the `+ refund_cost` term above is kept as-is until confirmed. -->
  `total_sales` is shipped item price plus shipping, minus shipping promotions. It does
  not include item tax.
- Currency: keep `currency` in every `groupBy` and report per currency. Never sum
  across currencies. COGS is the amount the seller entered on `amazon_cogs`
  (`cost_item_value`, `cost_item_shipping_value`, `cost_currency`). It is not converted.
  If `cost_currency` is not the marketplace currency, convert `cogs_total` before you
  compare it with sales, and state the rate. A margin near 100% usually means COGS
  was not uploaded.
- **Window: use a full month or longer.** Fees post on settlement date, so a few days
  or one week can misstate margin. Flag a SKU whose margin looks extreme and check
  it is not a settlement-timing artifact.
- **Query quirks:** an aggregation `alias` must NOT equal an existing column name -
  `sum(profit) as profit` errors with `ALIAS_COLLISION`; use a distinct alias (`profit_sum`).
  Profit exports can sit `PENDING` for minutes - poll patiently, do not give up early.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller, keep `sellerOrVendorId`.
2. `exports_sources_get` (query "profit") -> confirm `amazon_profit_by_date` and
   `amazon_profit_by_sku_and_date` are `enabled`.
3. **Account headline:** `exports_create` on `amazon_profit_by_date` for the window:
   - `groupBy`: `["currency"]`
   - `aggregations` (sum): `total_sales`, `profit`, `total_cost`, `ad_spend`,
     `total_fees`, `cogs_total`, `total_units_sold`
   Do NOT sum `acos` / `tacos` / `roi`. Recompute margin as profit / sales.
4. **SKU ranking:** `exports_create` on `amazon_profit_by_sku_and_date` for the same
   window:
   - `groupBy`: `["sku","product_name","currency"]`
   - `aggregations` (sum): `total_sales`, `profit`, `total_cost`, `ad_spend`,
     `total_fees`, `cogs_total`, `total_units_sold` - give each a **distinct alias**
     (e.g. `sum(profit) as profit_sum`, never `as profit`, which errors `ALIAS_COLLISION`).
   - `orderByColumn` the profit-sum alias (`profit_sum`), `DESC`; `limit` ~200.
   Do NOT sum `acos` / `tacos` / `roi` (they are ratios) - recompute them from the summed
   columns if needed (e.g. margin % = profit / sales).
5. If COGS looks wrong, `exports_create` on `amazon_cogs` and read `cost_currency`,
   `cost_item_value`, and `cost_item_shipping_value` for the SKUs in question.
6. Poll `exports_get` (patiently - profit exports can stay `PENDING` for minutes), then
   `exports_raw_download`.
7. **COGS-config gate (before trusting any margin):** read the `cogs_present` column. If it
   is false for all / nearly all SKUs, COGS is not loaded for this account - put a prominent
   warning at the top of the output ("COGS not configured; margins are overstated / not true
   net profit") and label margins accordingly. Profit ranking still works; the margin figures
   do not. Use `cogs_present`, not `sum(cogs_total) = 0`, for this gate.
8. **Settlement-lag guard (recent windows):** fees post on settlement cycles, so a fresh SKU
   can show fees > sales (or fees with ~no sales) - a timing artifact, not a real loss. Flag
   any SKU whose fee/sales ratio is implausible in a short window as "settlement lag -
   recheck after settlement" rather than a real leak.
9. Headline numbers come from step 3 only. Flag SKU leaks from step 4: `profit < 0`,
   `ad_spend` above profit, or SKU margin < 0.5x the account margin. When the account margin
   is <= 0 or degenerate (COGS missing, loss-making window), use an **absolute ~15% margin
   floor** instead of the 0.5x multiple - a multiple of a negative baseline is meaningless.
   Say that SKU ad spend omits Sponsored Brands and other campaign types that are in the
   account `ad_spend`.
10. Render the card.

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

- Did the headline come from `amazon_profit_by_date`, not a sum of SKU profit?
- Did I rank SKUs by profit, not sales?
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

- Summing `amazon_profit_by_sku_and_date.profit` and presenting it as account profit.
- Summing `acos`/`tacos`/`roi` columns - they are per-row ratios, meaningless summed.
- Adding `total_selling_fees` or `fba_fees` on top of `total_fees`.
- Filtering posted fees away with `order_date`, or sending `groupBy: []`.
- Reporting sales as "profit". Use the `profit` column from `amazon_profit_by_date`.
- Treating a 99% margin as real - usually COGS was not uploaded, or `cost_currency`
  is not the marketplace currency.
- Ignoring ad spend - a SKU can be profitable before ads and a loss after. SKU
  `ad_spend` still misses Sponsored Brands; the account figure does not.
- Burying account-wide missing COGS in a footnote - if `cogs_present` is false the whole
  P&L is overstated; lead with it.
- Reporting a fresh SKU with fees > sales as a real loss - usually settlement lag; flag it
  to recheck after settlement.
- Using "< 0.5x account margin" when the account margin is negative - use the absolute
  ~15% floor instead.
- Aliasing `sum(profit) as profit` - `ALIAS_COLLISION`; use a distinct alias.

## Notes

- Read-only. Never writes to the account.
- Account profit is `amazon_profit_by_date`. SKU profit is
  `amazon_profit_by_sku_and_date`. Do not rebuild the P&L from settlements.
- A DataDoe skill, built on the DataDoe profit tables.
