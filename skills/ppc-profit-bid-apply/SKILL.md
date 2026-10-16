---
name: ppc-profit-bid-apply
description: >-
  Set Sponsored Products keyword bids from each product's profit and the
  keyword's conversion, then apply them through DataDoe Actions - always a
  dryRun preview first, and a real change only on your explicit approval. The
  bid is sales per click times a target ACoS. Live from DataDoe, runs in chat.
  Use for "profit bids", "bid from margin", "sales per click bid", "break-even
  ACoS bids", or "calculate keyword bids".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Profit-based PPC Bids
  access: write
  category: PPC & Ads
  interface: mcp
  output: action
---

# Profit-based PPC Bids (with apply)

Sets a new Sponsored Products bid for every eligible keyword in one pass, from
the product's real Amazon fees and product cost and from how well the keyword
converts. It shows the current bid and the new bid, validates the change with
a `dryRun`, and writes to Amazon only after you reply `apply`. MCP-native end
to end.

This is not `ppc-bid-optimizer-apply`. That skill uses one target ACoS for the
account and moves the current bid by target ÷ actual ACoS. This skill picks a
target per keyword and sets bid = sales per click × target ACoS.

## When to use this

- You want bids that start from profit per product, not from one account ACoS.
- You want every Sponsored Products keyword priced in one table, then updated
  together after you approve.
- Trigger phrases: "profit bids", "bid from my margin", "sales per click bid",
  "break-even ACoS bids", "calculate keyword bids".

## Language

Reply in Vietnamese by default. If the user writes in another language, reply
in that language. Keep keyword text, ASINs, currency codes, and the approval
word `apply` unchanged. Say in the reply language that only the exact word
`apply` runs the live update.

## The framework

Do this for each Sponsored Products keyword or product/auto target. Treat
product and automatic targets with the same formula. The user may limit the
run to keywords.

1. **Break-even ACoS** = (attributed sales − product cost − Amazon fees) ÷
   attributed sales. On the profit table this is the sum of
   `estimated_contribution_before_ads` divided by the sum of `ad_sales`, not
   the average of daily ratios. The ratio is 0–1 in the data; show it as a
   percent. It already uses the products people bought after the click.
2. **Conversion** = orders ÷ clicks (`ad_orders` ÷ `ad_clicks`).
   - 5% or lower → target ACoS **20%**
   - 15% or higher → target ACoS **40%** (above break-even on purpose, to grow)
   - anything in between → target ACoS = **break-even ACoS**
   20% and 40% are ACoS targets, not 20% or 40% of break-even.
3. **Bid** = same-SKU sales per click × target ACoS. Same-SKU sales per click
   = sum of `ad_sales_same_sku` ÷ clicks. Also show the calculator bid (total
   `ad_sales` ÷ clicks × target ACoS) and do not propose it unless the user
   asks. Total ad sales include other products bought after the click, so that
   bid can be too high.

Show target ACoS minus break-even ACoS in percentage points. A positive gap
means the bid aims above profit. That is expected on the 40% band. Do not
silently cap 40% or 20% at break-even.

**Do not invent a margin.** If break-even is null, the 20% and 40% rows go in
a separate "no product cost" group and stay out of the default apply list.
The middle band has no target without break-even: skip it and ask for product
cost. If break-even is 0 or negative, the product loses money before ads:
skip it, and do not use 20% or 40%.

**Other-product sales.** If same-SKU sales are 0 and total sales are above 0,
skip the target. Those sales are other products, so a sales-per-click bid
would be too high. Say so. If the user explicitly asks for the total-sales
bid, use that bid, label it, and keep the same guardrails.

**Sample size (defaults, the user may change them before the dry run):**

- Under **20 clicks**: not enough data. Do not assign 20%, 40%, or break-even.
  Widen the window once to 60 days, then once to 90 days, still using only
  mature days. If it is still under 20 clicks, skip it and leave the bid.
- A raw conversion of 15% or more gets the **40%** target only when the
  keyword also has at least **30 clicks** and at least **5 orders**. Otherwise
  use break-even, and say the growth target was blocked. Three clicks and one
  order must never get 40%: that row fails the 20-click rule, and even a
  lowered click floor cannot unlock 40% without 30 clicks and 5 orders.

**Bid guardrails (after the formula, on every proposed bid):**

1. Take the raw bid, then cap it at the maximum bid (default **10** in the
   account currency) and floor it at **0.02**.
2. Then limit the move to **±30%** of the live bid (the user may raise this
   to at most ±50%). One step per run.
3. Round to 2 decimal places. If that equals the live bid, show the row and
   do not send it.

Walk toward the cap. A live bid of 12 with a maximum of 10 and a 30% step
becomes 8.40 this run, not 10.

Organic rank is out of scope. This skill does not read or estimate it.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Defaults the user can edit before the dry run: low conversion 5% → 20%
  ACoS; high conversion 15% → 40% ACoS; otherwise break-even. Minimum 20
  clicks. Growth target needs 30 clicks and 5 orders. Maximum step ±30%.
  Minimum bid 0.02. Maximum bid 10 in the account currency. Window: a period
  the user chooses, or the last 30 mature days.
- Read, preferred: `amazon_ads_profit_by_target_and_date` [premium]. A premium
  export costs 5 AI Tokens instead of 2. The table is enabled by default. A
  0-row export means no rows in the window or an initial load still in
  progress — say which, and use the fallback below. Never render zeros as if
  they were bids.
  Filter `ad_campaign_type = SPONSORED_PRODUCTS` and
  `is_attribution_mature = true`. Keep `action_target_id`,
  `target_entity_type`, `ad_campaign_id`, and `ad_group_id` when grouping.
  Sum `ad_clicks`, `ad_orders`, `ad_sales`, `ad_sales_same_sku`,
  `ad_sales_other_sku`, `estimated_contribution_before_ads`, `estimated_cogs`,
  `estimated_variable_fees`, `ad_spend`, `costed_sales`, and
  `missing_cost_sales`. Use `max(ad_target_bid)` and fall back to
  `max(ad_keyword_bid)` only as a table bid. `estimated_break_even_acos` is a
  ratio and is null when cost is missing. `ad_sales` includes other products;
  `ad_sales_same_sku` is the advertised product. Cost is kept only when the
  cost currency matches the ad currency. Do not convert currencies.
- Read, fallback when that export has 0 rows, or for a target whose
  break-even is null:
  - Performance: `amazon_ads_targeting_by_campaign_by_date`, Sponsored
    Products only, ending about 7 days ago (this table has no maturity flag).
    Group by `ad_keyword_id`, `ad_keyword`, `ad_match_type`, `ad_campaign_id`,
    `ad_group_id`. Sum `ad_clicks`, `ad_orders`, `ad_orders_same_sku`,
    `ad_sales`, `ad_spend`. Table bid: `max(ad_keyword_bid)`.
  - Advertised product: `amazon_ads_performance_by_child_asin_and_date`,
    Sponsored Products, same window, group by `ad_group_id` and `child_asin`.
    Sum `ad_sales_same_sku` and `ad_clicks`. The primary ASIN is the one with
    the most same-SKU sales in the ad group. If it is under 70% of that
    group's same-SKU sales, mark the margin blended and list the ASINs.
  - Margin: `amazon_profit_by_sku_and_date` [premium], from today − 104 days
    to today − 15 days. Group by `child_asin`, `product_name`, `cogs_present`.
    Sum `total_sales`, `sales_tax`, `cogs_total`, `total_fees`. Use
    `cogs_present = true` rows for sales, tax, COGS, and fees. Leave
    `cogs_present = false` sales out and report their share. Keep
    `cogs_present` null fee-only rows, scaled by the covered sales share.
    Net sales = `total_sales` − `sales_tax` (`sales_tax` is already 0 in the
    US and Canada). Break-even ACoS = (net sales − COGS − kept fees) ÷ net
    sales. Under about 80% COGS coverage, ask for a unit cost instead of
    guessing. This table's fees can include VAT on Amazon fees.
  - Same-SKU sales per click is not on the targeting table. Use the ad
    group's same-SKU sales per click from the ASIN performance export, and
    label it as an ad-group estimate. Keyword total sales per click stays the
    calculator column only.
- Optional market comparison, only after the bid table or when the user asks.
  It does not change a bid. `amazon_child_product_organic_search_ranks_per_week`,
  latest week (`max(date)`), for the primary ASIN. Match `ad_keyword` to
  `search_query` with trim and case-folding, exact text only. Your rate =
  `child_asin_purchase_count` ÷ `child_asin_click_count`. Market rate =
  `search_query_total_purchase_count` ÷ `search_query_total_click_count`.
  These are Search Query Performance rates, not ad conversion, and they are
  not organic rank. If the export is empty, say Search Query Performance is
  not on this account and continue.
- Resolve the live bid: `AMAZON_ADS_TARGETS_FIND`. Filter
  `adProductFilter.include: ["SPONSORED_PRODUCTS"]` (exactly one ad product)
  plus `campaignIdFilter`, `keywordFilter`, or `targetIdFilter`. FIND is a
  read Action. It runs on Read only and Read and write accounts. Use the
  table bid only when FIND is refused because that Action type is disabled,
  and label those bids table-sourced. Never take the current bid from
  `amazon_ads_targets_raw` or the other 72-hour snapshots.
- Enabled scope: keep targets whose FIND state is ENABLED. Confirm the
  campaign and ad group with `AMAZON_ADS_CAMPAIGNS_FIND` and
  `AMAZON_ADS_AD_GROUPS_FIND` (`stateFilter.include: ["ENABLED"]`). Leave
  paused and archived entities out of the write. Their spend is history.
- Write: `AMAZON_ADS_TARGETS_UPDATE`, max **25** targets per action. Split
  longer lists. Confirmed payload:
  ```
  actions_start(type="AMAZON_ADS_TARGETS_UPDATE", sellerOrVendorId="...", dryRun=true,
    details={"targets":[{"targetId":"<id>","campaignId":"<id>","adGroupId":"<id>",
      "adProduct":"SPONSORED_PRODUCTS","bid":2.10}]})
  ```
  `bid` is a number, greater than 0, at most 999999999.99. Floor at 0.02 in
  practice. `dryRun: true` returns `status: VALIDATED`, `valid: true`,
  `actionId: null`. Nothing is queued. Do not send `marketplaceScope` or
  `marketplaces`; the target id already scopes the change.
- Call `actions_details_schema_get` for `AMAZON_ADS_TARGETS_UPDATE` before the
  first dry run and use its `access` field. A live apply needs **Read and
  write** (Accounts) and the Action type **enabled** (Settings > Actions).
  A dry run still validates on a Read only account and does not queue.
- Before apply, say that an external rule or another tool can overwrite these
  bids. Ask who owns bids on the account. Do not block the preview on the
  answer. Do not apply if the user says another tool should keep ownership.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` → pick the seller. Use the marketplace the user
   names. If they do not name one and the account has a single Ads profile,
   use that profile. If several, ask. One marketplace per run. Read currency
   from the export.
2. State the editable defaults in the reply. If the user already set different
   bands or caps, use those. Otherwise continue with the defaults and show
   them in the table header.
3. Performance, preferred: `exports_create` on
   `amazon_ads_profit_by_target_and_date` for the chosen window, with the
   filters and groupBy in Configuration. Compute break-even, conversion,
   same-SKU sales per click, and the calculator sales per click per target.
   If the export has 0 rows, say why and switch the whole run to the fallback
   sources. If some targets have null break-even or
   `profit_status = MISSING_PRODUCT_COST_OR_FEE`, fill those margins from the
   fallback and label them.
4. `actions_start` `AMAZON_ADS_TARGETS_FIND` for the candidate target ids.
   Poll `actions_get` for `targetId`, live `bid`, state, `campaignId`, and
   `adGroupId`. Drop anything that is not ENABLED. If FIND is refused because
   the Action type is disabled, keep the table bid and label it.
5. Compute the new bid with the framework and the guardrails. Build one
   before/after table for every target that has enough data, biggest absolute
   bid change first. Put skipped rows under the table: too few clicks, growth
   target blocked, no product cost, loses money before ads, other-product
   sales only, paused. The "no product cost" group is not in the default
   payload.
6. `actions_details_schema_get` for `AMAZON_ADS_TARGETS_UPDATE`, then
   `actions_start` with `dryRun: true`, in batches of 25. Confirm
   `VALIDATED`, `valid: true`, `actionId: null`. Show the full table. Offer
   the Search Query Performance comparison; run it only if the user wants it.
7. Stop. The live update runs only after a later message that is exactly
   `apply` and refers to this preview. Then `actions_start` with
   `dryRun: false` for the validated batches only, poll `actions_get`, and
   report each target Amazon accepted. Any other reply edits the list or
   stops. Nothing has changed until that live call succeeds.

## Output format

Translate the labels and the why-phrases. Do not translate keyword text.

```
Profit bids (dry run) — {marketplace} — {currency}
Window: {from} to {to}. Bands: ≤5% → 20%, ≥15% → 40%, else break-even.
Caps: step ±30%, bid 0.02 to {max}. Same-SKU sales per click. {n} skipped.

keyword            match   CVR    BE     target   now    new    why
{kw}               EXACT   15.7%  30.0%  40%      1.80   2.10   grow; +10 pp vs break-even
{kw}               PHRASE  8.0%   30.0%  30%      0.90   0.84   break-even
{kw}               BROAD   3.0%   30.0%  20%      0.50   0.65   low conversion; step capped

Dry run: {n} bids validated, 0 issues. No product cost: {k} (not in this apply).
Reply "apply" to push these bids.
```

## Worked example (illustrative)

Advertised price 29.99, Amazon fees 9.50, product cost 11.50. Left over =
8.99. Break-even ACoS = 8.99 ÷ 29.99 = 29.98% (about 30%). A keyword with
1,500 clicks, 236 orders, and 7,893 of sales converts at 15.7%, so the target
is 40%, which is about 10 percentage points above break-even. Sales per click
= 7,893 ÷ 1,500 = 5.262. The calculator bid is 5.262 × 40% = 2.10.

If 1,500 of those sales were other products, same-SKU sales are 6,393 and
same-SKU sales per click are 4.262. The proposed bid is 4.262 × 40% = 1.70.
The 2.10 figure stays in the calculator column.

A live bid of 1.80 becomes 2.10 (inside ±30%). A live bid of 0.50 becomes
0.65, because 2.10 is more than a 30% step. A keyword with 3 clicks and 1
order converts at 33% on paper and must not get 40%. It has fewer than 20
clicks, so it is skipped or the window is widened. It still cannot get 40%
without 30 clicks and 5 orders.

The dry run returns `VALIDATED`, `valid: true`, `actionId: null`. The live
bid does not change until the user replies `apply`.

## Quality self-check

- Did break-even use summed contribution ÷ summed sales, and did I show it as
  a percent?
- Did the proposed bid use same-SKU sales per click, with the total-sales bid
  only as a column?
- Did 3 clicks and 1 order stay off the 40% target?
- Did I skip a null break-even on the middle band, and keep 20% and 40% rows
  with no product cost out of the default payload?
- Did I skip break-even at or below 0, paused entities, and other-product-only
  sales?
- Did I clamp to the maximum bid and then to ±30% of the live FIND bid, and
  floor at 0.02?
- Did I filter Sponsored Products, keep campaign and ad group ids, and drop
  immature profit rows?
- Did each action carry at most 25 targets, and did dry run return
  `actionId: null` before any `apply`?
- Did I avoid organic rank, and avoid letting Search Query Performance change
  a bid?
- Right marketplace and currency?

## Common mistakes

- Using one account target ACoS, or current bid × (target ÷ actual). That is
  the other skill.
- Treating 20% and 40% as fractions of break-even.
- Bidding from total sales per click and ignoring other-product sales.
- Giving 40% to a keyword with a handful of clicks because one order made
  conversion look high.
- Averaging daily break-even ratios instead of summing contribution and sales.
- Applying 20% or 40% when the product loses money before ads.
- Filling a missing product cost with a guessed margin.
- Reading a stale bid from a snapshot table instead of `AMAZON_ADS_TARGETS_FIND`.
- Sending more than 25 targets, or writing before `apply`.
- Changing the bid because Search Query Performance, or because of organic
  rank. Rank is out of scope.
- Summing Sponsored Brands or Display into this Sponsored Products update.

## Notes

- Write skill. FIND runs on Read only access. The live update needs the
  Action enabled and Read and write access. A dry run does not send the bid.
- Another bid rule can overwrite a manual bid. Say that in the preview.
- Pairs with `ppc-bid-optimizer-apply` (one account target ACoS) and
  `ppc-wasted-spend-watchdog` (which terms to look at first).
- A DataDoe skill, built on `amazon_ads_profit_by_target_and_date`, with
  `amazon_ads_targeting_by_campaign_by_date`,
  `amazon_ads_performance_by_child_asin_and_date`, and
  `amazon_profit_by_sku_and_date` when product cost is missing there, plus
  `AMAZON_ADS_TARGETS_FIND` and `AMAZON_ADS_TARGETS_UPDATE`.
