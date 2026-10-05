---
name: ppc-bid-optimizer-apply
description: >-
  Recompute Sponsored Products keyword bids toward a target ACoS and apply them
  through DataDoe Actions - always a dryRun preview first, and a real change only on
  your explicit approval. The write follow-through to the wasted-spend watchdog. Live
  from DataDoe, runs in chat. Use for "optimize bids", "fix ACoS", "lower my bids",
  "raise bids on winners", "adjust keyword bids", or "bid optimization".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: PPC Bid Optimizer
  access: write
  category: PPC & Ads
  interface: mcp
  output: action
---

# PPC Bid Optimizer (with apply)

Recomputes Sponsored Products keyword bids toward a target ACoS and applies them
through DataDoe Actions - always `dryRun` first, real change only on your approval.
The write follow-through to the Wasted-Spend Watchdog. MCP-native end to end.

## When to use this

- After the Wasted-Spend Watchdog flags bleeders, to actually fix the bids.
- Weekly bid tuning toward a target ACoS.
- Trigger phrases: "optimize bids", "lower my bids", "fix ACoS", "adjust keyword
  bids", "bid optimization", "reduce ad spend on losing keywords".

## The framework. Target-ACoS bidding

For each keyword: new bid = current bid x (target ACoS / actual ACoS), clamped by the
guardrails below.
- **ACoS too high** (bleeder) -> cut bid toward target.
- **ACoS well below target + converting** -> raise bid modestly to win volume.
- **Zero conversions / not enough clicks** -> leave alone (insufficient data).

**Bid guardrails (apply on every run):**
- **Min clicks to act:** skip any keyword with < 5 clicks in the window - too little
  signal to move a bid on.
- **Max change per run:** cap the step at +/-30% of the current bid (default; user may
  raise to at most +/-50%) so one pass can't wildly swing a bid. One step per run - PPC
  needs time to settle; revisit next week.
- **Min bid floor 0.02:** never set a bid below Amazon's practical minimum of 0.02 (the
  schema allows any value > 0, but < 0.02 is not actionable). Honour the user's own
  min/max if tighter.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Read (performance), preferred when the org has it: `amazon_ads_profit_by_target_and_date`
  [premium] - per target/day: `action_target_id` (the Ads `targetId`, ready for the UPDATE
  payload), `ad_campaign_type` (the table also holds Sponsored Brands, Display and
  Television targets - filter to `SPONSORED_PRODUCTS`), `ad_campaign_id` / `ad_group_id`
  (the UPDATE scope - keep them when grouping), `target_entity_type` (`KEYWORD` /
  `PRODUCT_OR_AUTO_TARGET`), `ad_target_bid` (latest fetched bid, keyword or target),
  `ad_keyword_bid` (bid recorded in the report, can be stale), `estimated_break_even_acos` (compare actual ACoS against it
  instead of a flat target when available), `is_attribution_mature` (skip rows where it is
  false instead of guessing a 7-day cut-off). Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and fall back to the source below; never render zeros.
  Note: `estimated_break_even_acos` is null when the account has no COGS uploaded - then
  use the user's target ACoS.
- Read (performance), fallback: `amazon_ads_search_terms_by_campaign_by_date` - per keyword/day: `ad_keyword_id`, `ad_keyword`, `ad_keyword_bid`
  (current bid), `ad_campaign_id`, `ad_group_id`, `ad_spend`, `ad_sales`, `ad_clicks`,
  `ad_orders`, `ad_match_type`, `ad_campaign_type`. Aggregate by keyword for ACoS.
  NOTE: `ad_sales` / `ad_orders` are **7-day attributed** - exclude ~the last 7 days
  (see the workflow) so recent under-attribution doesn't trigger over-aggressive cuts.
- Resolve targetId + live bid: the `AMAZON_ADS_TARGETS_FIND` action returns the `targetId`
  and the live `bid`. Filter with `adProductFilter.include: ["SPONSORED_PRODUCTS"]` (FIND
  requires **exactly one** ad product) plus `campaignIdFilter` / `keywordFilter` /
  `targetIdFilter`. **FIND is an Action and needs the connection on Read and write** even
  though it only reads - a Read-only account answers "Actions are not enabled for this
  seller or vendor account. Set access level to Read and write". Fallback without it:
  `amazon_ads_profit_by_target_and_date.action_target_id` is the Ads `targetId` (for
  Sponsored Products it equals `ad_keyword_id` on keyword rows and `ad_target_id` on
  auto/product rows), with `ad_target_bid` as the bid (else `ad_keyword_bid`) and
  `ad_campaign_id` / `ad_group_id` from the same grouped export (step 2) as the scope -
  flag those bids as table-sourced (up to a day stale). The real risk is a stale bid or
  the wrong campaign/ad group, not a different id.
- Write: `AMAZON_ADS_TARGETS_UPDATE` action, gated behind a `dryRun` step. Confirmed
  payload shape (max **25** targets per action - schema `maxItems: 25`; split longer lists):
  ```
  actions_start(type="AMAZON_ADS_TARGETS_UPDATE", sellerOrVendorId="...", dryRun=true,
    details={"targets":[{"targetId":"<id>","campaignId":"<id>","adGroupId":"<id>",
      "adProduct":"SPONSORED_PRODUCTS","bid":0.21}]})
  ```
  `bid` must be a number with `exclusiveMinimum: 0` and `maximum: 999999999.99` (floor
  at 0.02 in practice). A `dryRun: true` call returns `status: VALIDATED, valid: true,
  actionId: null` - nothing is queued or sent to Amazon. `marketplaceScope` /
  `marketplaces` are **accepted** by `TARGETS_UPDATE` on Sponsored Products (dryRun
  2026-10-03: VALIDATED with and without them) but are not needed - the `targetId` already
  scopes the change. Only `AMAZON_ADS_TARGETS_ADD` rejects them.
- **Live state, not snapshots:** `amazon_ads_targets_raw` / `amazon_ads_campaigns_raw` /
  `amazon_ads_ad_groups_raw` are **72-hour snapshots**. Never take the "current" bid from
  them before a write - read it live with `AMAZON_ADS_TARGETS_FIND` (step 3).
- Inputs from user: target ACoS (e.g. 30%), min/max bid, max step (default +/-30%).
- **Prerequisites:** the seller connection must be **Read and write** (Accounts page) for
  the live apply **and for the `AMAZON_ADS_TARGETS_FIND` read**, and the
  `AMAZON_ADS_TARGETS_UPDATE` action type must be **enabled** (Settings > Actions).
  `dryRun` works regardless - the analysis + preview always run (with table-sourced bids
  when FIND is unavailable).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. **Performance:** prefer `amazon_ads_profit_by_target_and_date` (premium export, 5 AI Tokens) when it has rows:
   filter `is_attribution_mature = true` **and `ad_campaign_type = SPONSORED_PRODUCTS`**
   (one UK month held 235 Sponsored Brands and 3 Display targets beside the Sponsored
   Products ones, and the FIND / UPDATE below are Sponsored Products only); `groupBy
   ["action_target_id", "target_entity_type", "ad_campaign_id", "ad_group_id",
   "ad_keyword", "ad_match_type"]` (the campaign and ad-group ids are required in the
   UPDATE payload and by the table-sourced fallback); sum spend/sales/clicks/orders with
   distinct aliases; `max(ad_target_bid)` and `max(ad_keyword_bid)` - use the first as the
   table bid and fall back to the second when it is null. Otherwise `exports_create` on
   `amazon_ads_search_terms_by_campaign_by_date`, trailing 30-60d but **ending ~7 days
   ago** (exclude the last 7 days - SP sales/orders are 7-day attributed, so a fresh window
   under-counts conversions). `groupBy` `[ad_keyword_id, ad_keyword, ad_match_type,
   ad_campaign_id, ad_group_id]`, sum `ad_spend/ad_sales/ad_clicks/ad_orders`, take the
   bid as `max(ad_keyword_bid)` (a non-grouped column cannot be carried through a grouped
   export), filter `ad_campaign_type = SPONSORED_PRODUCTS`. Compute ACoS per keyword.
   Many actionable rows are SP **auto targets**, not keywords - treat them as targets.
3. **Resolve targetId + live bid:** `actions_start` `AMAZON_ADS_TARGETS_FIND` with
   `adProductFilter.include: ["SPONSORED_PRODUCTS"]` (exactly one) + `campaignIdFilter` /
   `keywordFilter` / `targetIdFilter`; poll `actions_get` -> `targetId` + live `bid` (+
   `campaignId`, `adGroupId`) per target. If FIND is refused for access level, use
   `action_target_id` / the table bid as in Configuration and label the bids table-sourced.
4. **Compute new bid** per the framework + guardrails (>= 5 clicks, +/-30% step cap,
   0.02 floor, user min/max). Build the change list, biggest ACoS offenders first;
   max 25 targets per action - batch longer lists into several actions.
5. **dryRun:** `actions_start` `AMAZON_ADS_TARGETS_UPDATE` with `dryRun: true` and the
   payload shape above. Confirm `status: VALIDATED, valid: true, actionId: null`, then
   show the full before/after bid table.
6. On explicit approval only: `actions_start` again with `dryRun: false`, poll
   `actions_get`, report per-target acceptance. Otherwise stop - nothing changed.

## Output format

```
Bid Optimizer (dry run) - {marketplace} - target ACoS {t}%

keyword              match   ACoS   cur bid   -> new bid   why
{kw}                 PHRASE  156%   {cur}0.55    {cur}0.35  cut to target
{kw}                 EXACT   14%    {cur}0.40    {cur}0.48  raise (headroom)

Dry run: {n} bids validated, 0 issues.
Reply "apply" to push these bids, or edit targets/target-ACoS first.
```

## Worked example (illustrative)

A phrase keyword might show ~€182 spend / ~€117 sales / 176 clicks / 14 orders ->
ACoS ~156%. At a 30% target, new bid = current x (30/156) ~= a large cut, but clamped
to the +/-30% step cap + 0.02 floor, so likely one capped cut this run, revisit next
week. Contrast a keyword at ~18% ACoS - leave it or nudge up. The
`AMAZON_ADS_TARGETS_UPDATE` dryRun validates cleanly (`status: VALIDATED, valid: true,
actionId: null`) even when Actions are disabled - so the preview is always safe to show.

## Quality self-check

- Did I take `targetId` + bid from FIND, or - when FIND was refused for access level - from
  `action_target_id` with the bids flagged as table-sourced?
- Did I filter the target-profit export to Sponsored Products and keep `ad_campaign_id` /
  `ad_group_id` in its `groupBy`, so every proposed update has a valid SP scope?
- Did I exclude ~the last 7 days so 7-day attribution didn't trigger over-aggressive cuts?
- Did I skip keywords with < 5 clicks, cap the step at +/-30%, and floor at 0.02?
- Did I split the batch so no action carries more than 25 targets?
- Did I dryRun and confirm `VALIDATED` / `actionId: null` + show before/after before any
  real write?
- Explicit approval before `dryRun: false`?
- Right marketplace + currency for the account?

## Common mistakes

- Slashing a bid to zero on one bad week (over-correction).
- Reading `amazon_ads_profit_by_target_and_date` without an `ad_campaign_type` filter, or
  grouping it by `action_target_id` alone - Brands and Display targets get proposed as
  Sponsored Products updates, and the table-sourced fallback has no campaign / ad group to
  build the payload from.
- Raising bids on high-ACoS "converting" keywords (they're still unprofitable).
- Sending the bid to `ad_keyword_id` instead of the FIND-resolved `targetId` - it lands
  on the wrong target (or nothing).
- Cutting bids on a fresh window - SP sales are 7-day attributed; exclude the last ~7 days.
- Acting on < 5 clicks (noise), or moving a bid more than +/-30% in one run.
- Taking the "current" bid from `amazon_ads_targets_raw` - a 72-hour snapshot; use the
  live bid from `AMAZON_ADS_TARGETS_FIND`.
- Sending more than 25 targets in one `AMAZON_ADS_TARGETS_UPDATE` action.
- Running the real update without the Action enabled / a Read-and-write connection - and
  forgetting that `TARGETS_FIND` needs Read and write too.

## Notes

- Write skill. Real writes need the Action enabled + read+write connection; `dryRun`
  always works for demo/testing.
- Pairs with `ppc-wasted-spend-watchdog` (find) and `ppc-negative-keyword-applier`
  (negate the truly dead terms).
- A DataDoe skill, built on DataDoe `amazon_ads_search_terms_by_campaign_by_date` +
  the `AMAZON_ADS_TARGETS_FIND` / `AMAZON_ADS_TARGETS_UPDATE` actions.
