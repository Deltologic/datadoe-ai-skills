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
  title: PPC Wasted Spend Watchdog
  access: read
  category: PPC & Ads
  interface: mcp
  output: report
---

# PPC Wasted-Spend Watchdog

Finds the exact search terms and keywords burning your ad budget - spend with no
(or too few) orders, and high-ACoS terms dragging profit - and quantifies the
money you'd save. Live from DataDoe Search Term Performance. The read half of the
negative-keyword workflow.

## When to use this

- Weekly PPC clean-up, or whenever ACoS is creeping up.
- After a launch, when broad/auto campaigns catch irrelevant traffic.
- Before you touch bids - see where the waste is first.
- Trigger phrases: "wasted ad spend", "high ACoS", "which keywords lose money",
  "PPC audit", "where is my ad budget going", "negative keyword candidates".

## The framework. Two waste buckets

1. **Dead spend** - term has clicks + spend but `orders = 0` over the window, counted
   across every keyword and target that matched it in that ad group. Pure
   waste. Usually **long-tail**: many small terms (individually small amounts each) that
   add up - so you must scan wide (paginate the full set), not just the top spenders.
   **Exclude ASIN-target terms first** - many top "dead" terms are ASIN strings (e.g.
   `b0ch3jb9h1`, a 10-char `B0...` alphanumeric) = deliberate competitor-ASIN targeting,
   not junk queries; flag them separately, don't recommend negating them.
2. **Bleeders** - term converts but ACoS is above your break-even. Split them:
   - **Barely over** (e.g. ~32-33% ACoS vs a 30% break-even) that convert in volume ->
     **bid trim**, not negation - they're close to profitable.
   - **Hard bleeders** (e.g. 100%+ ACoS) -> negate (or exact-match at a low bid).
3. **Own keyword - never a negative.** A dead or hard-bleeder term whose normalised text
   equals the ad group's own bid keyword (`lower(trim(ad_search_term)) ==
   lower(trim(ad_keyword))` with `ad_match_type` EXACT / PHRASE / BROAD; auto campaigns carry
   targeting expressions in `ad_keyword`, so they never match) is the keyword you are
   paying for. Negating it silently blocks that keyword with no trace of why. Keep it in
   its own row group, "Own keyword", and route it to `ppc-bid-optimizer-apply` (pause or
   lower the bid on `ad_keyword_id`) - never to the negative applier. Observed: `trainer
   cleaning kit` topped the dead list of a UK account; it was the exact keyword of its own
   ad group. If `ad_keyword_status` is already PAUSED, the spend is historical: report it,
   recommend nothing.
4. **Paused campaigns and ad groups.** Spend from a campaign or ad group that is now
   PAUSED or ARCHIVED is money already lost, not money to act on: a negative there
   validates and changes nothing. Mark those rows `(paused)`, report their subtotal, and
   keep them out of both hand-off lists. Observed: GBP 93 of a GBP 261 dead bucket and about
   GBP 34 of hard overspend sat in four paused campaigns.
Sort each by spend so the biggest amounts come first. (For account-level TACoS trend,
use the Weekly Business Review skill - this one is term-level.)

Do not recommend a base-bid cut from the blended search-term ACoS alone. A campaign
ACoS mixes placements and audiences. Check modifiers first, for every campaign you
would negate or cut:

1. **Placement performance** — `amazon_ads_placement_by_campaign_by_date`, grouped by
   `ad_campaign_id` and `ad_placement_classification`. Sum `ad_spend`, `ad_clicks`,
   `ad_orders`, `ad_sales`. Recompute ACoS per placement.
2. **Placement bid adjustments** — `amazon_ads_campaigns_raw`.
   `ad_campaign_optimization_placement_bid_adjustments` is JSON of
   `{percentage, placement}` (`TOP_OF_SEARCH`, `REST_OF_SEARCH`, `PRODUCT_PAGE`).
   `ad_campaign_optimization_bid_strategy` changes how that percentage is applied.
3. **Shopper cohort and segment adjustments** — same raw campaign row:
   `ad_campaign_optimization_shopper_segment_bid_adjustment` and
   `ad_campaign_optimization_shopper_cohort_bid_adjustment`. These stack with the
   placement modifier. Effective ceiling is base bid × (1 + placement%) × (1 + audience%).
4. **Audience-segment performance** — `amazon_ads_audiences_by_date` (Sponsored
   Products and Sponsored Brands). Group by `ad_campaign_id` and
   `ad_audience_segment_name`. Sum `ad_spend`, `ad_clicks`, `ad_orders`, `ad_sales`.
   Do not add these rows to campaign or search-term totals (they double-count).
   Segments can overlap, so a segment versus the campaign total is directional.

If one placement or one audience carries the orders, leave that modifier alone and
cut only the weak placement, or the terms that are not in that segment. Say which
modifier you checked in the recommendation.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources:
  - `Search Term Performance (Ads)` (`amazon_ads_search_terms_by_campaign_by_date`) - the customer search term that triggered the ad. Primary source:
    `ad_search_term`, `ad_spend`, `ad_clicks`, `ad_orders`, `ad_sales`, `ad_campaign_type`,
    plus `ad_campaign_id` / `ad_group_id` (needed so the apply skills can target),
    `ad_keyword_bid` (the bid on the keyword that matched - this table does carry it), and
    for the two guards only: `ad_keyword`, `ad_keyword_id`, `ad_match_type`,
    `ad_keyword_status` and `ad_campaign_status` (state as of each row's date). The guard
    columns live in a separate keyword-detail export (step 3c), never in the export that
    decides which terms are dead (grain rule below).
  - **Campaign and ad-group state**, three sources by purpose: `ad_campaign_status` in the
    keyword-detail export (step 3c; cheapest - take the value on the row with the newest
    `max(date)` per campaign);
    `amazon_ads_campaigns_raw.ad_campaign_state` and `amazon_ads_ad_groups_raw.ad_group_state`
    (current snapshot, **refreshed every 72 hours** - good enough for this read-only report;
    one extra export filtered `ad_group_id in (...)` for the ad groups in the dead and hard
    buckets); `AMAZON_ADS_CAMPAIGNS_FIND` / `AMAZON_ADS_AD_GROUPS_FIND` (live - the applier's
    job before any write, not needed here).
  - `Keyword Targeting Performance` (`amazon_ads_targeting_by_campaign_by_date`) - your bid keywords, for the
    keyword-level view. It carries **no bid column** - current bids come from
    `AMAZON_ADS_TARGETS_FIND` (see the bid-optimizer skill).
- **Grain rule: decide "dead" per campaign, ad group and search term.** A negative keyword
  is added at ad-group level and blocks the term for every keyword and target in that ad
  group, so zero orders must hold for the term across all of them. Group the money exports
  by `[ad_search_term, ad_campaign_id, ad_group_id]` only. Adding keyword, target or status
  columns to that `groupBy` splits one shopper term into one row per matched keyword or
  target (Amazon close variants, category and ASIN targets), and `having orders_sum = 0`
  then judges each piece alone. Observed on a UK account over 60 days: `gutermann sewing
  thread` had 24 clicks and 0 orders through an ASIN target but 122 clicks and 22 orders
  through a category target in the same ad group - the split export listed it as dead,
  and an ad-group negative would have blocked those 22 orders. The same split hid `shoe
  polish` (5 + 8 clicks through two targets, 0 orders) below the 10-click bar and
  under-counted `trainer cleaning kit` (GBP 19 of its GBP 33 dead spend). Keep
  `ad_campaign_name` / `ad_group_name` out of that `groupBy` too - a rename mid-window
  splits the term the same way; take names from step 3c or the raw tables.
- **`having` is supported** (post-aggregation, on `groupBy` fields and aggregation aliases;
  `filters` stay pre-aggregation). Use it to pull the dead bucket in one call:
  `having clicks_sum >= 10 AND orders_sum = 0`. Bleeders need ACoS, which is a ratio -
  compute that client-side from the summed columns.
- **Row caps and pagination:** 1,000 rows per JSON export, 5,000 per CSV. A spend-sorted
  pull keeps the big terms; the `having` export keeps the dead ones (in testing all 35 dead
  terms were on page 1 by spend anyway). Paginate with `skip` in `limit` steps only when a
  page returns exactly `limit` rows and you need the remainder.
- Currency/marketplace: read `marketplace_country_code`; localise (e.g. a German marketplace = EUR).
- Set the break-even ACoS from the user (default 30% if unknown) - margins differ by
  product, so make it adjustable (optionally per product group).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. `exports_sources_get` (query "search term") -> confirm `amazon_ads_search_terms_by_campaign_by_date` is `enabled`.
3. `exports_create` for `amazon_ads_search_terms_by_campaign_by_date`, last 30-60 days,
   filter `ad_campaign_type = SPONSORED_PRODUCTS`, `aggregations` sum `ad_spend`,
   `ad_clicks`, `ad_orders`, `ad_sales` with distinct aliases (`spend_sum`, `clicks_sum`,
   `orders_sum`, `sales_sum`). Three exports:
   - **(a) Money, term grain:** `groupBy ["ad_search_term", "ad_campaign_id",
     "ad_group_id"]` (keep the ids - the apply skills need them to target), sorted by the
     spend alias `DESC`, `limit` 5,000 CSV, for the top spenders and bleeders. If it returns
     exactly `limit` rows and you need the tail, page with `skip`.
   - **(b) Dead bucket, term grain:** the same `groupBy` with `having clicks_sum >= 10 AND
     orders_sum = 0` - the complete dead bucket. Never add keyword, target, status or name
     columns to (a) or (b) (grain rule in Configuration).
   - **(c) Keyword detail, for the guards only** (once step 4 has the dead and hard-bleeder
     candidates): `groupBy ["ad_search_term", "ad_campaign_id", "ad_group_id",
     "ad_keyword", "ad_keyword_id", "ad_match_type", "ad_keyword_status",
     "ad_campaign_status"]` (+ `ad_campaign_name` / `ad_group_name` if wanted), the same
     sums plus `max(date) as last_seen`, filter `ad_group_id in (...)` for the candidates'
     ad groups, CSV, page with `skip` if a page fills. Join it to the candidates on
     `(ad_campaign_id, ad_group_id, ad_search_term)`. One term often comes back as several
     rows here (Amazon close variants: `trainer cleaning kit` matched both `trainer
     cleaning kit` and `trainers cleaning kit`); that is expected - these rows feed only
     the own-keyword and paused checks, never the dead test or the money.
   Ads exports can queue slowly, so budget for polling.
4. Poll, download, and bucket at term grain - one row per `(ad_campaign_id, ad_group_id,
   ad_search_term)`. Export (b) is the dead bucket; for the rest of (a) compute per row:
   ACoS = spend / sales (guard sales=0), orders. First set aside ASIN-target terms
   (`b0...` strings) as competitor targeting, not waste. Then bucket: dead (orders=0,
   clicks >= ~10), bleeder (ACoS > break-even; split barely-over -> trim vs hard -> negate),
   ok. Sum wasted = dead spend + overspend on bleeders. Then pull (c) and run the two guards
   on the dead and hard buckets: **own keyword** - a candidate moves to the "Own keyword"
   group when any of its (c) rows has a positive match type and a normalised `ad_keyword`
   equal to the term (recommend pause / lower bid via the bid optimizer, with that
   `ad_keyword_id`; if that keyword's latest status - its (c) row with the newest
   `last_seen` - is PAUSED, the spend is historical: recommend nothing); **paused** - mark
   a candidate `(paused)` when its campaign's latest `ad_campaign_status` (the (c) row
   with the newest `last_seen` for that campaign) is not ENABLED; ad-group state follows
   in step 6b.
5. (Optional) pull `amazon_ads_targeting_by_campaign_by_date` for the keyword-level
   view (which bid keyword each wasteful term maps to). Current bids for a cut come
   from the bid-optimizer skill via `AMAZON_ADS_TARGETS_FIND`, not this table.
6. For each campaign you would cut or negate, pull placement performance, the raw
   campaign bid adjustments, and `amazon_ads_audiences_by_date` as in the modifier
   checks above. Name the placement or audience that should be left alone.
6b. **Resolve ad-group state** for every ad group in the dead and hard buckets:
   `exports_create` on `amazon_ads_ad_groups_raw` (`ad_group_id`, `ad_group_state`,
   `ad_campaign_id`), filter `ad_group_id in (...)` (and `amazon_ads_campaigns_raw` for
   `ad_campaign_state` if `ad_campaign_status` was not pulled). Both are 72-hour
   snapshots - say so. Mark rows `(paused)` when the campaign or the ad group is not
   ENABLED, add the line "of which in paused campaigns or ad groups: {cur}{x} (not
   actionable)", and drop them from the hand-off lists. The headline total stays as
   measured; the actionable figure is the live subset.
7. Render, biggest spend first. Hand the dead terms - **live campaigns and ad groups only,
   own keywords removed** - to `ppc-negative-keyword-applier`, and the bleeders plus the
   own-keyword rows to `ppc-bid-optimizer-apply`, with the modifier note attached.

## Output format

```
Wasted Ad Spend - {marketplace} - last {N} days   (full set paginated)
Total wasted: {cur}{wasted}  ({dead} dead + {bleed} over break-even)  ACoS target {t}%

Dead spend (no orders)
term                      spend    clicks   campaign / ad group              state
{term}                    {cur}..  {n}      {campaign} / {group}             live
{term}                    {cur}..  {n}      {campaign} / {group}             (paused)

Bleeders (ACoS > {t}%)
term                      spend    sales    ACoS   action
{term}                    {cur}..  {cur}..  {a}%   trim bid / negate (>100%)

Own keyword (the ad group's own bid keyword - pause or lower the bid, never negate)
term = keyword            spend    clicks   campaign / ad group              keyword id
{term}                    {cur}..  {n}      {campaign} / {group}             {ad_keyword_id}{, already paused}

Of which in paused campaigns or ad groups: {cur}{x} (not actionable)
Excluded (ASIN-target terms, not junk): {count}
Hand-off: {n} dead terms (live, not own keywords) -> ppc-negative-keyword-applier ·
{m} bleeders + {k} own keywords -> ppc-bid-optimizer-apply.
```

## Worked example (illustrative)

A search term might show ~{cur}114 spend, ~128 clicks, 8 orders, ~{cur}63 sales -> ACoS
~181%. A textbook bleeder: it converts, but every sale loses money. Action: cut the
bid hard or move it to exact with a low bid; if it stays >100% ACoS, negate it. By
contrast a term at ~{cur}537 spend / ~{cur}2,900 sales (~18% ACoS) is a keeper. Same report,
opposite decisions - the skill separates the two.

## Quality self-check

- Did I separate dead (0 orders) from bleeders (convert but unprofitable)?
- Did I use enough clicks before calling a term "dead" (>= ~10)?
- Is ACoS computed per term from summed spend/sales, not a summed ratio?
- Did I rank by spend wasted (in the account currency), not count?
- Before a bid cut, did I check placement ACoS, placement and audience modifiers,
  and `amazon_ads_audiences_by_date` (it is empty for some marketplaces - 0 rows for UK
  while DE had rows - so skip that check and say so when the export returns nothing)?
- Did I pull the dead bucket with `having` (or paginate) so it is complete, not truncated?
- Did I decide dead terms per campaign, ad group and term (export b), with keyword and
  status columns only in the guard export (c), so a term that converts through another
  keyword or target in the same ad group is never called dead?
- Did I set aside ASIN-target (`b0...`) terms as competitor targeting, not waste?
- Did I split bleeders into bid-trim (barely over) vs negate (hard, 100%+)?
- Did I compute ACoS and the bleeder split client-side (ratios are never summed)?
- Did I separate own-keyword terms (term == `ad_keyword`, positive match type) from the
  negatives and route them to the bid optimizer?
- Did I exclude paused campaigns and ad groups from the negatives hand-off, report their
  subtotal, and say the raw state tables are 72-hour snapshots?

## Common mistakes

- Killing a term after 2-3 clicks - too little data.
- Grouping the dead-bucket export by keyword, target or status - one shopper term splits
  into one row per matched keyword or target, and `having orders_sum = 0` judges each
  piece alone. A term with 22 orders through a category target was listed as dead through
  an ASIN target in the same ad group; an ad-group negative would have blocked those
  orders.
- Treating a high-ACoS launch term as waste if it drives new-to-brand / rank (call
  it out, don't auto-cut).
- Confusing search term (shopper query) with keyword (your bid).
- Summing the ACoS column - recompute it.
- Judging from a single truncated pull - caps are 1,000 rows JSON / 5,000 CSV; use the
  `having` export for the dead bucket and `skip` pagination if a page fills to `limit`.
- Treating a 0-row `amazon_ads_audiences_by_date` export as "no audience modifiers" - the
  table is empty for some marketplaces; say the check was skipped.
- Negating ASIN-target (`b0...`) terms - that's competitor targeting, not junk.
- Negating a barely-over bleeder that converts in volume - trim its bid instead.
- Negating a term that is the ad group's own bid keyword - that silences the keyword
  without anyone seeing why. Pause or lower it instead (bid optimizer, `ad_keyword_id`).
- Recommending a negative inside a paused campaign or ad group - it validates and does
  nothing. Check state first; the applier confirms it live before writing.

## Notes

- Read-only (analysis). The write follow-ups are separate skills: dead terms ->
  `ppc-negative-keyword-applier`, bleeders -> `ppc-bid-optimizer-apply` (each dryRun-gated).
  Pass `ad_campaign_id` / `ad_group_id` through - both apply skills need them to target -
  and pass `ad_keyword_id` for own-keyword rows so the bid optimizer can act on them.
- A DataDoe skill, built on the DataDoe Search Term Performance source
  (`amazon_ads_search_terms_by_campaign_by_date`).
