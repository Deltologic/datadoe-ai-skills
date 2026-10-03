---
name: return-refund-analyzer
description: >-
  Find the SKUs bleeding the most margin to returns, why they come back (the real
  return reasons, bucketed into product / listing / sizing / delivery), and the fix
  for each - ranked by money lost, not by return rate, and filtered so you chase the
  actionable returns, not the noise. Live from DataDoe, read-only. Use for "returns",
  "refunds", "return rate", "why are people returning", "return reasons", "which
  products get returned", "returns costing me money", or "reduce returns".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Return Refund Analyzer
  access: read
  category: Profit & Finance
  interface: mcp
  output: report
---

# Return & Refund Analyzer

Finds the SKUs bleeding the most margin to returns, tells you **why** they come back
(the actual return reasons, not just the rate), and routes each to the right fix -
product/QC, listing accuracy, sizing, or fulfilment. It ranks by money lost, not by
return rate, so a high-volume hero SKU with a "small" rate outranks a tiny SKU that
returns half the time. Live from DataDoe, read-only. No spreadsheets.

## When to use this

- Margin looks thin despite good sales - returns are a quiet, common cause.
- A SKU's reviews or refunds are creeping up and you want the reason.
- Weekly/monthly quality review, or before scaling ad spend on a SKU (returns kill ROI).
- Sourcing or listing decisions - is this a product defect or a listing-accuracy problem?
- Trigger phrases: "returns", "refunds", "return rate", "why are people returning",
  "return reasons", "which products get returned", "returns costing me money",
  "reduce returns".

## The framework. Rank by cost, diagnose the reason, route the fix

1. **Return rate** per SKU = `return_units` / `total_units_sold` over the window, both
   from `amazon_profit_by_sku_and_date` (the denominator is the units actually sold;
   `return_units` is dated on return receipt/request, the same basis as `amazon_returns`,
   so the two counts should agree). Compare each SKU to the catalog median - flag the
   outliers, not everything. **Return-lag guard:**
   returns lag the sale, so a return this window can belong to a sale from a prior
   window - if a SKU's returns exceed its in-window units sold (rate > 100%) the rate is
   a lag artifact, not a real >100% return rate. Do NOT report it as a percentage; mark
   it "lag-inflated" and rank it by cost / return count instead.
2. **Return cost** per SKU = refunded sales (`refund_cost`) + return handling/label cost
   + the item cost of the units that came back (`return_cogs`, less whatever is resold).
   **Rank by cost, not rate** - that is where the money actually is.
3. **Reason - bucket it, don't read raw enums.** `amazon_return_reason` carries ~30
   values (more than it looks), and FBM prefixes them - so **read the actual reason
   histogram first and route from it**, and normalize before matching:
   - **Strip channel prefixes `CR-` and `AMZ-PG-` before matching.** FBM prefixes the
     enum: `CR-DEFECTIVE` -> `DEFECTIVE`, `CR-ORDERED_WRONG_ITEM` -> listing, etc. The two
     `AMZ-PG-` shorthands map by meaning: `AMZ-PG-BAD-DESC` -> listing,
     `AMZ-PG-APP-TOO-*` -> sizing.
   - **Match by prefix/family, not a fixed exact list** (the enum grows). Buckets:
   - **Product / quality** (`DEFECTIVE`, `QUALITY_UNACCEPTABLE`, `MISSING_PARTS`,
     `EXTRA_ITEM`, `DAMAGED_BY_*` e.g. `DAMAGED_BY_CARRIER` / `DAMAGED_BY_FC`) ->
     supplier / QC / packaging fix. *(actionable)*
   - **Listing accuracy** (`NOT_AS_DESCRIBED`, `NOT_COMPATIBLE`, `ORDERED_WRONG_ITEM`,
     `SWITCHEROO`, `PRODUCT_NOT_*` e.g. `PRODUCT_NOT_ITALIAN` / `PRODUCT_NOT_SPANISH`) ->
     the page misleads or variations are unclear. Fix images, bullets, dimensions, and
     especially colour/size/variation clarity. (For multi-variation SKUs, `NOT_COMPATIBLE`
     + `ORDERED_WRONG_ITEM` usually means the buyer picked the wrong variant - clarify the
     variation picker + images.) *(actionable)*
   - **Sizing / fit** (`APPAREL_TOO_SMALL`, `APPAREL_TOO_LARGE`, `APPAREL_STYLE`,
     `APPAREL_*`) -> add/repair the size chart and set fit expectations in bullets +
     images. *(actionable)*
   - **Delivery / fulfilment** (`UNDELIVERABLE_*` e.g. `UNDELIVERABLE_UNKNOWN` /
     `UNDELIVERABLE_REFUSED`, `MISSED_ESTIMATED_DELIVERY`, `NEVER_ARRIVED`) -> carrier /
     address / logistics, not a listing or product problem (flag for ops).
     *(non-actionable)*
   - **Noise / low actionability** (`NO_REASON_GIVEN`, `UNWANTED_ITEM`, `MISORDERED`,
     `FOUND_BETTER_PRICE`, `UNAUTHORIZED_PURCHASE`) -> do NOT over-invest; count as noise.
     *(non-actionable)*
   - **Unclassified (catch-all)** - any reason matching none of the above (a new/unknown
     enum value). Do NOT drop it silently: report a small "unclassified: N (values...)"
     line so new reasons surface and get bucketed next run.
   The dominant *actionable* bucket is the diagnosis and picks the fix.
4. **Trend + channel**: is the SKU's return rate rising, and is it FBA or FBM
   (`amazon_fulfillment_channel`)? A rising quality/defect bucket is an early product
   signal; an FBM label-cost drain is a shipping/policy signal.
Report the top cost SKUs with their dominant actionable bucket and the one lever that
moves it - and separately note how much of the volume is unfixable noise.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (resolve each by table name with `exports_sources_get`):
  - `amazon_returns` - the reason engine. Per return: `sku`, `child_asin`, `date`
    (return request date), `amazon_return_reason` (the enum), `amazon_fulfillment_channel`
    (FBA/FBM), `amazon_return_request_status`, and for FBM: `amazon_return_refunded_amount`,
    `amazon_return_label_cost`, `amazon_return_label_to_be_paid_by`.
    **Money columns (`amazon_return_refunded_amount`, `amazon_return_label_cost`) are
    FBM-only / nullable - FBA returns carry no money here.** So FBA per-return cost is
    always an *estimate* from sales/COGS (optionally settlements), never actuals from
    this table - and FBA is the bulk of most accounts.
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`) - the rate and money
    engine. Per `sku` / `child_asin` / `date`: `total_units_sold` (the rate
    denominator), `return_units` (returned units on return receipt/request date - the
    same basis as `amazon_returns`), `refund_cost` (signed: refund outflows negative,
    fee reversals positive, on posting date), `return_cogs` (item cost of the returned
    units; not part of `profit`), `cogs_total` / `cogs_item`, `total_sales`, `currency`.
    **Premium export** (5 AI Tokens instead of 2 - nothing else differs); part of the
    always-on default dataset, so it is never disabled. `requiresDatePeriod: true` -
    `exports_create` must send top-level `from` / `to`. Refreshed intraday, sales lag
    ~1 day.
    **Source of truth:** `amazon_returns` for the reasons, channel and per-return detail;
    the profit table for the rate denominator and the money (`refund_cost`,
    `return_cogs` per SKU). Use `return_units` from the profit table as the rate
    numerator so numerator and denominator share one table; if it diverges from the
    `amazon_returns` count by more than a few %, say so rather than mixing them.
  - `amazon_settlements_with_cogs` (optional, for exact money) - actual refund amounts
    and returned-item fees settled in the window; use it to firm up the cost estimate
    and to confirm whether a returned unit was reimbursed/resellable.
- Currency/marketplace: read `marketplace_country_code`; refund amounts are in each
  marketplace's currency - group and report per currency, never sum across currencies.
- Window: use a full trailing window (>= 30-60 days). Returns lag the sale by days to
  weeks, so a too-short window understates the true rate. Pull returns and the profit
  table over the **same** `from` / `to` - a denominator from a different window makes
  the rate meaningless.
- **Completeness check (~1-day lag).** The profit table is intraday but sales lag about
  a day: the newest date is a partial day. Detect the last complete day from the daily
  `total_units_sold` (walk back from the tail until a day is at/above ~60% of the median
  day) and end both windows there; never let a partial day shrink the denominator.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm `amazon_returns` is `enabled` and resolve
   `amazon_profit_by_sku_and_date` (always-on, premium; settlements optional).
3. **Returns by SKU + reason:** `exports_create` on `amazon_returns` for the window,
   `groupBy [child_asin, sku, amazon_return_reason, amazon_fulfillment_channel]`,
   `count` returns (+ `sum amazon_return_refunded_amount`, `sum amazon_return_label_cost`
   for FBM). Aggregate to per-SKU totals and a per-SKU reason histogram.
   Prefer pulling grouped and filtering client-side - you need the full per-SKU reason
   histogram anyway, so one grouped pull is the natural shape. (Server-side `sku` /
   `child_asin` filtering on `amazon_returns` has been unreliable in the past; if you do
   filter server-side, verify it returns rows before relying on it.)
4. **Units sold, rate + money:** `exports_create` on `amazon_profit_by_sku_and_date`
   for the **same** `from` / `to` as step 3 (top-level dates are required),
   `groupBy [child_asin, sku, currency]`, `sum total_units_sold`, `sum return_units`,
   `sum refund_cost`, `sum return_cogs`, `sum total_sales` (distinct aliases). Also
   roll up per `child_asin` for the ASIN view. Return rate per SKU =
   `return_units` / `total_units_sold`; compute the catalog median from it. The
   denominator must come from this table - it is the shipped-units count the profit
   reconciles to; a sales/traffic-style source under-counts units and inflates rates.
5. **Cost** per SKU: `refund_cost` (flip the sign for display - outflows are negative)
   + return handling/label cost (FBM: `amazon_return_label_cost`) + `return_cogs` for
   the units that came back and were not resold (state the resale assumption; use
   settlements if pulled for exactness). For **FBA** returns there is no per-return
   money in `amazon_returns` - the FBA money comes from the profit table's
   `refund_cost` / `return_cogs` (or settlements), never from the returns table.
6. **Rank by cost**, attach the dominant reason + channel + trend, and map each to its
   fix lever (product / listing / sizing / fulfilment / low-actionability).

## Output format

```
Return & Refund Analyzer - {marketplace} - last {N} days   (returns lag sales; trailing window)

SKU / ASIN         units  ret%    returns  cost        top bucket (share)      -> fix
{sku}              {u}    {r}%    {n}      {cur}{c}    Listing accuracy (61%)  clarify variation + images
{sku}              {u}    lag*    {n}      {cur}{c}    Product/quality (55%)   supplier / QC
{sku}              {u}    {r}%    {n}      {cur}{c}    Sizing (44%)            add size chart

*lag = returns exceed in-window units sold (return-lag artifact); ranked by cost, not rate.
units = total_units_sold, ret% = return_units / units, cost = refund_cost + label cost + return_cogs (Profit by SKU & Date)

Catalog return rate: {median}%   ·   Total refund cost in window: {cur}{sum}  (return_cogs: {cur}{c})
Actionable vs non-actionable: {a}% actionable (product/listing/sizing) · {x}% non-actionable (delivery + noise)   [unclassified: {u}]
Biggest lever: {sku} - {bucket} ~{cur}{c}/window -> {fix}
Rising: {sku} return rate {was}% -> {now}%
```

## Worked example (illustrative)

A hero SKU sells 2,000 units at a 6% return rate; a novelty SKU sells 40 units at 45%.
Ranked by rate the novelty looks worst - but ranked by **cost** the hero (120 returns
x price + COGS) dwarfs it, so it leads. Its reason histogram is 55% "defective" ->
that's a product/QC fix, and worth a supplier conversation, not a copy tweak. A second
SKU returns mostly "not as described" -> the listing over-promises; fix the images and
bullets. A third is "unwanted item" -> low actionability, leave it. The output is a
short, money-ranked list where each line already says what to do.

## Quality self-check

- Did I rank by return COST, not return rate?
- Did I compare each SKU's rate to the catalog median (flag outliers, not everything)?
- Did I read the actual `amazon_return_reason` histogram and route the correct fix per
  dominant reason (product vs listing vs sizing vs fulfilment)?
- Did I normalize reasons (strip `CR-` / `AMZ-PG-` prefixes, match by family) so
  unclassified drops to ~0, and surface any leftover unknown values rather than dropping?
- Did I use a trailing window long enough that return lag doesn't understate the rate?
- Is the denominator `total_units_sold` from `amazon_profit_by_sku_and_date`, pulled
  over the same `from` / `to` as the returns, with both windows ending on the last
  complete day (~1-day lag)?
- Did I take the money (`refund_cost`, `return_cogs`) from the profit table and the
  reasons from `amazon_returns` - and say which table each number came from?
- Did I keep each marketplace in its own currency?
- Did I separate low-actionability reasons (unwanted item, misordered) from fixable
  ones instead of inflating the "problem"?

## Common mistakes

- Ranking by return rate and chasing a tiny SKU while a hero SKU quietly loses more.
- Reporting a rate with no reason - the reason is the whole point (it picks the fix).
- Reporting a return rate above 100% as if real - that is the return-lag artifact
  (returns from earlier sales vs in-window units); flag it and rank by cost instead.
- Reading raw reason enums instead of bucketing - the actionable share (product /
  listing / sizing) is what matters; unwanted / no-reason / undeliverable is noise.
- Matching reasons against a fixed exact list - FBM prefixes (`CR-`, `AMZ-PG-`) and new
  enum values then fall through as unclassified; strip prefixes, match by family, and
  surface a catch-all so nothing is silently dropped.
- Blaming the product when the bucket is listing-accuracy (`NOT_COMPATIBLE` /
  `ORDERED_WRONG_ITEM` = clarify variations/images, not a QC fix).
- Treating delivery reasons (`UNDELIVERABLE_*`) as a listing/product problem - that's ops.
- Too short a window - returns lag the sale, so recent-only data understates the rate.
- Building the rate on a units count from a sales/traffic-style source instead of
  `total_units_sold` - on one UK account such a source held 49 of 60 days and ~17% fewer
  units than the profit table, so every return rate came out 15-20% too low.
- Mismatched windows - returns over 60 days against units over 49 - or a denominator
  that includes the newest partial day.
- Reading `refund_cost` as a positive number - it is signed (outflows negative); flip it
  for display and do not net it against `return_cogs`.
- Summing refund amounts across marketplaces/currencies into one number.

## Notes

- Read-only (analysis). Any listing edit that follows (fixing images/size chart) is a
  separate write skill via `AMAZON_LISTINGS_UPDATE` (dryRun-gated).
- Exact refund money is most precise from settlements; `refund_cost` / `return_cogs` on
  `amazon_profit_by_sku_and_date` give a solid per-SKU figure when settlements aren't
  pulled - state which you used.
- `amazon_returns` money columns are FBM-only; FBA per-return money comes from the
  profit table (or settlements), never from the returns table.
- Prefer pulling `amazon_returns` grouped and filtering client-side (you need the full
  per-SKU reason histogram regardless). Server-side `sku` / `child_asin` filtering has
  been unreliable historically; verify it returns rows before depending on it.
- A DataDoe skill, built on DataDoe returns, Profit by SKU & Date (units, refunds, COGS)
  and settlement data.
