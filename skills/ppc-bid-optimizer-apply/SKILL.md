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

For each keyword: new bid = current bid x (target ACoS / actual ACoS), clamped.
- **ACoS too high** (bleeder) -> cut bid toward target (floor at a min bid).
- **ACoS well below target + converting** -> raise bid modestly to win volume (cap
  the step, e.g. +/-30% per run, and a hard max bid).
- **Not enough clicks** -> leave alone (insufficient data).
Never move a bid more than one step per run - PPC needs time to settle.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Read: `Keyword Targeting Performance` (`amazon_ads_targeting_by_campaign_by_date`) - spend/sales/clicks/orders per keyword.
- Current bid + target id: `AMAZON_ADS_TARGETS_FIND` action (returns `targetId` +
  live `bid`). The performance export does NOT carry a reliable bid/targetId, so
  FIND is the source of truth for both.
- Write: `AMAZON_ADS_TARGETS_UPDATE` action (`targets[]` with `targetId`, `bid`,
  `adProduct: SPONSORED_PRODUCTS`, `targetType: KEYWORD`, `marketplaceScope`,
  `marketplaces`).
- Inputs from user: target ACoS (e.g. 30%), min/max bid, max step (default 30%).
- **Enablement:** `AMAZON_ADS_TARGETS_FIND` and the real `UPDATE` require the org to
  enable these Actions (Settings > Actions) with the connection set to read+write.
  `dryRun` works even when disabled - so the analysis + preview always run.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller.
2. **Performance:** `exports_create` on `amazon_ads_targeting_by_campaign_by_date`, last 30-60d, `groupBy`
   `[ad_keyword, ad_match_type, ad_campaign_id, ad_group_id]`, sum
   `ad_spend/ad_sales/ad_clicks/ad_orders`, filter `ad_campaign_type =
   SPONSORED_PRODUCTS`. Compute ACoS per keyword.
3. **Current bids:** `actions_start` `AMAZON_ADS_TARGETS_FIND` (targetQuery,
   adProductFilter SPONSORED_PRODUCTS, targetTypeFilter KEYWORD, stateFilter
   ENABLED), poll `actions_get` -> map `targetId` + current `bid` by keyword.
4. Compute new bid per the framework (clamp to min/max + max step). Build the change
   list, biggest ACoS offenders first.
5. **dryRun:** `actions_start` `AMAZON_ADS_TARGETS_UPDATE` with `dryRun: true`. Show
   the validated result (status VALIDATED) and the full before/after bid table.
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
to the max single-step + min bid, so likely one ~30% cut this run, revisit next week.
Contrast a keyword at ~18% ACoS - leave it or nudge up. The `AMAZON_ADS_TARGETS_UPDATE`
dryRun validates cleanly (status VALIDATED, 0 issues) even when Actions are disabled -
so the preview is always safe to show.

## Quality self-check

- Did I get current bid + targetId from FIND (not guess)?
- Did I clamp to min/max and cap the per-run step?
- Did I dryRun and show before/after before any real write?
- Explicit approval before `dryRun: false`?
- Right marketplace + currency for the account?

## Common mistakes

- Slashing a bid to zero on one bad week (over-correction).
- Raising bids on high-ACoS "converting" keywords (they're still unprofitable).
- Using the export's bid/targetId (unreliable) instead of FIND.
- Running the real update without enabling the Action / read+write connection.

## Notes

- Write skill. Real writes need the Action enabled + read+write connection; `dryRun`
  always works for demo/testing.
- Pairs with `ppc-wasted-spend-watchdog` (find) and `ppc-negative-keyword-applier`
  (negate the truly dead terms).
- A DataDoe skill, built on DataDoe targeting data + `AMAZON_ADS_TARGETS_UPDATE`.
