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
   add up - so you must scan wide (paginate the full set), not just the top spenders.
   **Exclude ASIN-target terms first** - many top "dead" terms are ASIN strings (e.g.
   `b0ch3jb9h1`, a 10-char `B0...` alphanumeric) = deliberate competitor-ASIN targeting,
   not junk queries; flag them separately, don't recommend negating them.
2. **Bleeders** - term converts but ACoS is above your break-even. Split them:
   - **Barely over** (e.g. ~32-33% ACoS vs a 30% break-even) that convert in volume ->
     **bid trim**, not negation - they're close to profitable.
   - **Hard bleeders** (e.g. 100%+ ACoS) -> negate (or exact-match at a low bid).
Sort each by spend so the biggest euros come first. (For account-level TACoS trend,
use the Weekly Business Review skill - this one is term-level.)

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources:
  - `Search Term Performance (Ads)` (`amazon_ads_search_terms_by_campaign_by_date`,
    id `e94e967198`) - the customer search term that triggered the ad. Primary source:
    `ad_search_term`, `ad_spend`, `ad_clicks`, `ad_orders`, `ad_sales`, `ad_campaign_type`,
    plus `ad_campaign_id` / `ad_group_id` (needed so the apply skills can target).
  - `Keyword Targeting Performance` (`amazon_ads_targeting_by_campaign_by_date`) - your bid keywords, for the
    keyword-level view + current bids.
- **`having` is not supported** (confirmed rejected: `Unrecognized key: "having"`), and
  filters are pre-aggregation only - you can't filter on summed `orders`. So pull the
  (paginated) rows and bucket dead / bleeder **client-side**; don't waste a call trying to
  filter `orders = 0` server-side.
- **Pagination:** the export API accepts `skip`, so a high-volume account can be paged to
  completion (`skip = 0, 3500, 7000, ...`) rather than truncated at the 3,500-row cap.
- Currency/marketplace: read `marketplace_country_code`; localise (e.g. a German marketplace = EUR).
- Set the break-even ACoS from the user (default 30% if unknown) - margins differ by
  product, so make it adjustable (optionally per product group).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` (query "search term") -> confirm `amazon_ads_search_terms_by_campaign_by_date` is `enabled`.
3. `exports_create` for `amazon_ads_search_terms_by_campaign_by_date`, last 30-60 days:
   - `groupBy`: `["ad_search_term", "ad_campaign_id", "ad_group_id"]` (keep the
     campaign/ad-group ids - the apply skills need them to target; add `ad_campaign_name`
     for readability)
   - `aggregations` sum: `ad_spend`, `ad_clicks`, `ad_orders`, `ad_sales`
   - filter `ad_campaign_type = SPONSORED_PRODUCTS`.
   - **Paginate the full set** to catch dead spend: bleeders sit at the top by spend, but
     dead terms hide in the long tail, and a single spend-sorted pull truncates exactly
     that tail at the 3,500-row cap. Loop `skip` in 3,500 increments (`skip = 0, 3500,
     7000, ...`) until a page returns < 3,500 rows. (Sorting by the orders alias `ASC`
     also surfaces 0-order terms first so they survive a partial pull - but pagination is
     the proper fix.) Ads exports can queue slowly, so budget for polling each page.
4. Poll, download, and bucket **client-side** (no server-side `having`). Compute per term:
   ACoS = spend / sales (guard sales=0), orders. First set aside ASIN-target terms
   (`b0...` strings) as competitor targeting, not waste. Then bucket: dead (orders=0,
   clicks >= ~10), bleeder (ACoS > break-even; split barely-over -> trim vs hard -> negate),
   ok. Sum wasted = dead spend + overspend on bleeders.
5. (Optional) pull `amazon_ads_targeting_by_campaign_by_date` for the keyword-level
   view (which bid keyword each wasteful term maps to). Current bids for a cut come
   from the bid-optimizer skill via `AMAZON_ADS_TARGETS_FIND`, not this table.
6. Render, biggest euros first. Hand the dead terms to `ppc-negative-keyword-applier`
   and the bleeders to `ppc-bid-optimizer-apply`.

## Output format

```
Wasted Ad Spend - {marketplace} - last {N} days   (full set paginated)
Total wasted: {cur}{wasted}  ({dead} dead + {bleed} over break-even)  ACoS target {t}%

Dead spend (no orders)
term                      spend    clicks   campaign / ad group
{term}                    {cur}..  {n}      {campaign} / {group}

Bleeders (ACoS > {t}%)
term                      spend    sales    ACoS   action
{term}                    {cur}..  {cur}..  {a}%   trim bid / negate (>100%)

Excluded (ASIN-target terms, not junk): {count}
Next: dead terms -> ppc-negative-keyword-applier · bleeders -> ppc-bid-optimizer-apply.
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
- Did I paginate the full set (`skip = 0, 3500, ...`) so the long tail isn't truncated?
- Did I set aside ASIN-target (`b0...`) terms as competitor targeting, not waste?
- Did I split bleeders into bid-trim (barely over) vs negate (hard, 100%+)?
- Did I bucket client-side (no server-side `having`)?

## Common mistakes

- Killing a term after 2-3 clicks - too little data.
- Treating a high-ACoS launch term as waste if it drives new-to-brand / rank (call
  it out, don't auto-cut).
- Confusing search term (shopper query) with keyword (your bid).
- Summing the ACoS column - recompute it.
- Judging from a single truncated pull - the 3,500 cap cuts the long tail where dead
  spend hides; paginate with `skip` to completion.
- Trying to filter `orders = 0` with `having` - not supported; bucket client-side.
- Negating ASIN-target (`b0...`) terms - that's competitor targeting, not junk.
- Negating a barely-over bleeder that converts in volume - trim its bid instead.

## Notes

- Read-only (analysis). The write follow-ups are separate skills: dead terms ->
  `ppc-negative-keyword-applier`, bleeders -> `ppc-bid-optimizer-apply` (each dryRun-gated).
  Pass `ad_campaign_id` / `ad_group_id` through - both apply skills need them to target.
- A DataDoe skill, built on the DataDoe Search Term Performance source
  (`amazon_ads_search_terms_by_campaign_by_date`).
