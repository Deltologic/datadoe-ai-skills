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

1. **Return rate** per SKU = returned units / units sold over the window. Compare each
   SKU to the catalog median - flag the outliers, not everything. **Return-lag guard:**
   returns lag the sale, so a return this window can belong to a sale from a prior
   window - if a SKU's returns exceed its in-window units sold (rate > 100%) the rate is
   a lag artifact, not a real >100% return rate. Do NOT report it as a percentage; mark
   it "lag-inflated" and rank it by cost / return count instead.
2. **Return cost** per SKU = refunded sales + return handling/label cost + the COGS of
   units that come back unsellable. **Rank by cost, not rate** - that is where the
   money actually is.
3. **Reason - bucket it, don't read raw enums.** `amazon_return_reason` has ~15 values,
   many of them noise. Group each SKU's returns into these buckets and act on the
   actionable share (report the **% of returns that are actionable** vs noise):
   - **Product / quality** (`DEFECTIVE`, `QUALITY_UNACCEPTABLE`, `DAMAGED_BY_*`,
     `MISSING_PARTS`) -> supplier / QC / packaging fix.
   - **Listing accuracy** (`NOT_AS_DESCRIBED`, `NOT_COMPATIBLE`, `ORDERED_WRONG_ITEM`,
     `SWITCHEROO`) -> the page misleads or variations are unclear. Fix images, bullets,
     dimensions, and especially colour/size/variation clarity. (For multi-variation
     SKUs like colours/shades, `NOT_COMPATIBLE` + `ORDERED_WRONG_ITEM` usually means the
     buyer picked the wrong variant - clarify the variation picker + images.)
   - **Sizing / fit** (`APPAREL_TOO_SMALL`, `APPAREL_TOO_LARGE`, `APPAREL_STYLE`) ->
     add/repair the size chart and set fit expectations in bullets + images.
   - **Delivery / fulfilment** (`UNDELIVERABLE_*`, `UNDELIVERABLE_REFUSED`) -> carrier /
     address / logistics, not a listing or product problem (flag for ops).
   - **Low actionability** (`UNWANTED_ITEM`, `NO_REASON_GIVEN`, `MISORDERED`,
     `NO_LONGER_NEEDED`, `FOUND_CHEAPER`) -> do NOT over-invest; count as noise.
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
  - `amazon_sales_and_traffic_with_cogs` - `total_units` / `units_shipped`,
    `units_refunded`, `refund_rate`, and COGS (`cogs_total_value` / `cogs_currency`)
    per child ASIN/day - for return rate and the margin cost of a returned unit.
  - `amazon_settlements_with_cogs` (optional, for exact money) - actual refund amounts
    and returned-item fees settled in the window; use it to firm up the cost estimate
    and to confirm whether a returned unit was reimbursed/resellable.
- Currency/marketplace: read `marketplace_country_code`; refund amounts are in each
  marketplace's currency - group and report per currency, never sum across currencies.
- Window: use a full trailing window (>= 30-60 days). Returns lag the sale by days to
  weeks, so a too-short window understates the true rate.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` -> confirm `amazon_returns` + `amazon_sales_and_traffic_with_cogs`
   are `enabled` (settlements optional).
3. **Returns by SKU + reason:** `exports_create` on `amazon_returns` for the window,
   `groupBy [child_asin, sku, amazon_return_reason, amazon_fulfillment_channel]`,
   `count` returns (+ `sum amazon_return_refunded_amount`, `sum amazon_return_label_cost`
   for FBM). Aggregate to per-SKU totals and a per-SKU reason histogram.
4. **Sales + rate:** `exports_create` on `amazon_sales_and_traffic_with_cogs` for the
   same window, `groupBy child_asin`, `sum total_units`, and pull `units_refunded` /
   `refund_rate` + COGS. Compute return rate per SKU and the catalog median.
5. **Cost estimate** per SKU: refunded sales + return handling/label cost + unsellable
   COGS (state the assumptions; use settlements if pulled for exactness).
6. **Rank by cost**, attach the dominant reason + channel + trend, and map each to its
   fix lever (product / listing / sizing / fulfilment / low-actionability).

## Output format

```
Return & Refund Analyzer - {marketplace} - last {N} days   (returns lag sales; trailing window)

SKU / ASIN         units  ret%    returns  est. cost   top bucket (share)      -> fix
{sku}              {u}    {r}%    {n}      {cur}{c}    Listing accuracy (61%)  clarify variation + images
{sku}              {u}    lag*    {n}      {cur}{c}    Product/quality (55%)   supplier / QC
{sku}              {u}    {r}%    {n}      {cur}{c}    Sizing (44%)            add size chart

*lag = returns exceed in-window units sold (return-lag artifact); ranked by cost, not rate.

Catalog return rate: {median}%   ·   Total refund cost in window: {cur}{sum}
Actionable vs noise: {a}% actionable (product/listing/sizing) · {n}% noise (unwanted/no-reason/undeliverable)
Biggest lever: {sku} - {bucket} ~{cur}{c}/window -> {fix}
Rising: {sku} return rate {was}% -> {now}%
```

## Worked example (illustrative)

A hero SKU sells 2,000 units at a 6% return rate; a novelty SKU sells 40 units at 45%.
Ranked by rate the novelty looks worst - but ranked by **cost** the hero (120 returns
x price + COGS) dwarfs it, so it leads. Its reason histogram is 55% "defective" ->
that's a product/QC fix, and worth a supplier conversation, not a copy tweak. A second
SKU returns mostly "not as described" -> the listing over-promises; fix the images and
bullets. A third is "no longer needed" -> low actionability, leave it. The output is a
short, money-ranked list where each line already says what to do.

## Quality self-check

- Did I rank by return COST, not return rate?
- Did I compare each SKU's rate to the catalog median (flag outliers, not everything)?
- Did I read the actual `amazon_return_reason` histogram and route the correct fix per
  dominant reason (product vs listing vs sizing vs fulfilment)?
- Did I use a trailing window long enough that return lag doesn't understate the rate?
- Did I keep each marketplace in its own currency?
- Did I separate low-actionability reasons (no longer needed, accidental) from fixable
  ones instead of inflating the "problem"?

## Common mistakes

- Ranking by return rate and chasing a tiny SKU while a hero SKU quietly loses more.
- Reporting a rate with no reason - the reason is the whole point (it picks the fix).
- Reporting a return rate above 100% as if real - that is the return-lag artifact
  (returns from earlier sales vs in-window units); flag it and rank by cost instead.
- Reading raw reason enums instead of bucketing - the actionable share (product /
  listing / sizing) is what matters; unwanted / no-reason / undeliverable is noise.
- Blaming the product when the bucket is listing-accuracy (`NOT_COMPATIBLE` /
  `ORDERED_WRONG_ITEM` = clarify variations/images, not a QC fix).
- Treating delivery reasons (`UNDELIVERABLE_*`) as a listing/product problem - that's ops.
- Too short a window - returns lag the sale, so recent-only data understates the rate.
- Summing refund amounts across marketplaces/currencies into one number.

## Notes

- Read-only (analysis). Any listing edit that follows (fixing images/size chart) is a
  separate write skill via `AMAZON_LISTINGS_UPDATE` (dryRun-gated).
- Exact refund money is most precise from settlements; the sales/returns tables give a
  solid estimate when settlements aren't pulled - state which you used.
- A DataDoe skill, built on DataDoe returns, sales/traffic, COGS and settlement data.
