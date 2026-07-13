---
name: ppc-wasted-spend-watchdog
description: >-
  Find the exact Amazon Sponsored Products search terms wasting your ad budget -
  dead spend (clicks but no orders) and bleeders (converting but ACoS above your
  break-even) - quantify the money to reclaim, and route them to the negative-keyword
  and bid-optimizer skills. Live from DataDoe. Use for "wasted ad spend", "high
  ACoS", "which keywords lose money", "PPC audit", "where is my ad budget going", or
  "negative keyword candidates".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  access: read
  category: PPC & Ads
  interface: mcp
  output: report
---

# PPC Wasted-Spend Watchdog

Finds the exact search terms and keywords burning your ad budget - spend with no
(or too few) orders, and high-ACoS terms dragging profit - and quantifies the
euros you'd save. Live from DataDoe Search Term Performance. The read half of the
negative-keyword workflow.

## When to use this

- Weekly PPC clean-up, or whenever ACoS is creeping up.
- After a launch, when broad/auto campaigns catch irrelevant traffic.
- Before you touch bids - see where the waste is first.
- Trigger phrases: "wasted ad spend", "high ACoS", "which keywords lose money",
  "PPC audit", "where is my ad budget going", "negative keyword candidates".

## The framework. Two waste buckets

1. **Dead spend** - term has clicks + spend but `orders = 0` over the window. Pure
   waste. Usually **long-tail**: many small terms (individually a few euros each) that
   add up - so you must scan wide, not just the top spenders.
2. **Bleeders** - term converts but ACoS is above your break-even (spend/sales far
   above target). Losing money on every sale.
Sort each by spend so the biggest euros come first. (For account-level TACoS trend,
use the Weekly Business Review skill - this one is term-level.)

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources:
  - `Search Term Performance (Ads)` (`amazon_ads_search_terms_by_campaign_by_date`) - the customer search term that
    triggered the ad. Primary source.
  - `Keyword Targeting Performance` (`amazon_ads_targeting_by_campaign_by_date`) - your bid keywords, for the
    keyword-level view + current bids.
- Currency/marketplace: read `marketplace_country_code`; localise (e.g. a German marketplace = EUR).
- Set the break-even ACoS from the user (default 30% if unknown).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` (query "search term") -> confirm `amazon_ads_search_terms_by_campaign_by_date` is `enabled`.
3. `exports_create` for `amazon_ads_search_terms_by_campaign_by_date`, last 30-60 days:
   - `groupBy`: `["ad_search_term"]` (add `ad_campaign_name`, `ad_group_id` when you
     need the target for negatives)
   - `aggregations` sum: `ad_spend`, `ad_clicks`, `ad_orders`, `ad_sales`
   - filter `ad_campaign_type = SPONSORED_PRODUCTS`.
   - **Pull wide** to catch dead spend: bleeders sit at the top by spend, but dead
     terms hide in the tail - so either `orderByColumn` the orders alias `ASC` (0-order
     terms first) or pull a large limit (up to 3500 / paginate with `skip`) and bucket
     client-side. Don't judge from top-by-spend alone.
4. Poll, download. Compute per term: ACoS = spend / sales (guard sales=0),
   orders. Bucket: dead (orders=0, clicks >= ~10), bleeder (ACoS > break-even),
   ok. Sum wasted = dead spend + overspend on bleeders.
5. (Optional) pull `amazon_ads_targeting_by_campaign_by_date` for the keyword-level
   view (which bid keyword each wasteful term maps to). Current bids for a cut come
   from the bid-optimizer skill via `AMAZON_ADS_TARGETS_FIND`, not this table.
6. Render, biggest euros first. Hand the dead terms to `ppc-negative-keyword-applier`
   and the bleeders to `ppc-bid-optimizer-apply`.

## Output format

```
Wasted Ad Spend - {marketplace} - last {N} days
Total wasted: {cur}{wasted}  ({dead} dead + {bleed} over break-even)  ACoS target {t}%

Dead spend (no orders)
term                      spend    clicks
{term}                    {cur}..  {n}

Bleeders (ACoS > {t}%)
term                      spend    sales    ACoS
{term}                    {cur}..  {cur}..  {a}%

Next: negate the dead terms · cut bids on the bleeders.
```

## Worked example (illustrative)

A search term might show ~€114 spend, ~128 clicks, 8 orders, ~€63 sales -> ACoS
~181%. A textbook bleeder: it converts, but every sale loses money. Action: cut the
bid hard or move it to exact with a low bid; if it stays >100% ACoS, negate it. By
contrast a term at ~€537 spend / ~€2,900 sales (~18% ACoS) is a keeper. Same report,
opposite decisions - the skill separates the two.

## Quality self-check

- Did I separate dead (0 orders) from bleeders (convert but unprofitable)?
- Did I use enough clicks before calling a term "dead" (>= ~10)?
- Is ACoS computed per term from summed spend/sales, not a summed ratio?
- Did I rank by euros wasted, not count?

## Common mistakes

- Killing a term after 2-3 clicks - too little data.
- Treating a high-ACoS launch term as waste if it drives new-to-brand / rank (call
  it out, don't auto-cut).
- Confusing search term (shopper query) with keyword (your bid).
- Summing the ACoS column - recompute it.

## Notes

- Read-only (analysis). The write follow-ups are separate skills
  (`ppc-negative-keyword-applier`, `ppc-bid-optimizer-apply`), each dryRun-gated.
- A DataDoe skill, built on the DataDoe Search Term Performance source.
