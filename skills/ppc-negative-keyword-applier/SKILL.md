---
name: ppc-negative-keyword-applier
description: >-
  Find the exact Sponsored Products search terms burning budget with no sales, then
  add them as negative keywords through DataDoe Actions - always a dryRun preview
  first, and a real change only on your explicit approval. The write follow-through
  to the wasted-spend watchdog. Live from DataDoe, runs in chat. Use for "wasted ad
  spend", "add negative keywords", "negate search terms", "search terms with no
  sales", "stop paying for these clicks", or "clean up my PPC".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  access: write
  category: PPC & Ads
  interface: mcp
  output: action
---

# PPC Negative-Keyword Applier

Finds the exact Sponsored Products search terms that are burning budget with no
sales, then adds them as negative keywords through DataDoe Actions. It always
runs a `dryRun` first and shows you every change before anything reaches Amazon,
so it is safe to demo and safe to run. MCP-native end to end.

## When to use this

- Your ACoS is creeping up and you suspect junk search terms.
- Weekly PPC cleanup: stop paying for clicks that never convert.
- Right after a launch, when broad/auto campaigns catch a lot of irrelevant traffic.
- Trigger phrases: "wasted ad spend", "negative keywords", "add negatives",
  "search terms with no sales", "stop paying for these clicks", "clean up my PPC".

## The framework. Find, confirm, apply

1. **Find** the wasteful terms from performance data (read).
2. **Confirm** the list and the exact match type with the user (nothing is
   automatic).
3. **Apply** as negatives via a `dryRun` Action, review the validated payload,
   then run for real only on explicit approval.

## What counts as "wasteful" (defaults, tune per user)

A search term is a negative candidate when, over the last 30-60 days:
- `ad_spend` >= 2x your target CPA (or >= the item price if you do not know CPA), AND
- `ad_orders` = 0 (no attributed orders), AND
- `ad_clicks` >= 10 (enough clicks to trust the zero).

Borderline (spend above target CPA but a few orders) -> list separately as "review",
do not auto-negate.

**Exclude ASIN-target terms first.** Many "dead" search terms are ASIN strings (e.g.
`b0ch3jb9h1` - a 10-char `B0...` alphanumeric) = deliberate competitor-ASIN targeting,
not junk queries. Filter these out (or list them separately as "ASIN target - review")
before negating, so you don't kill legitimate competitor targeting - they often dominate
the top spenders.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Read source: `Search Term Performance (Ads)` - `amazon_ads_search_terms_by_campaign_by_date`
  (source id `e94e967198`): `ad_search_term`, `ad_campaign_id`, `ad_group_id`,
  `ad_spend`, `ad_clicks`, `ad_orders`, `ad_campaign_type` (+ names / keyword / match type).
- Write action: `AMAZON_ADS_TARGETS_ADD` (negative keyword), gated behind a `dryRun`
  step. A negative keyword is `negative: true` + `targetType: "KEYWORD"` +
  `targetDetails: { keyword, matchType }`, scoped to a `campaignId` + `adGroupId`; max
  **250** targets per action.
- **Match type is `EXACT` / `PHRASE` / `BROAD`** - never `NEGATIVE_EXACT` /
  `NEGATIVE_PHRASE`. The negativity is carried by the separate `negative: true` flag, not
  by the match-type value; the live backend rejects `NEGATIVE_*` match types.
- Currency/marketplace: read `marketplace_country_code` for display/currency in the
  output only. Do NOT put marketplace in the ADD payload - `AMAZON_ADS_TARGETS_ADD` on
  Sponsored Products rejects `marketplaceScope` / `marketplaces`; the `campaignId` /
  `adGroupId` already scope the negative to the right marketplace.
- **Prerequisites for a live apply:** the seller connection must be **Read and write**
  (Accounts page), and the `AMAZON_ADS_TARGETS_ADD` action type must be **enabled**
  (Settings > Actions). `dryRun` works regardless - find + preview always run.

## Step-by-step workflow (MCP-native)

### Phase 1 - Find (read)
1. `sellers_and_vendors_list` -> pick the seller, keep `sellerOrVendorId`.
2. `exports_sources_get` (query "search term") -> confirm `amazon_ads_search_terms_by_campaign_by_date` is
   `enabled`.
3. `exports_create` for `amazon_ads_search_terms_by_campaign_by_date`, last 30-60 days, columns:
   `ad_search_term`, `ad_keyword`, `ad_match_type`, `ad_campaign_id`,
   `ad_campaign_name`, `ad_campaign_type`, `ad_group_id`, `ad_group_name`,
   `ad_spend`, `ad_sales`, `ad_orders`, `ad_clicks`. Filter to
   `ad_campaign_type = SPONSORED_PRODUCTS`.
4. Poll, download, aggregate by `ad_search_term` (+ campaign/ad group). Apply the
   wasteful rule above. Produce the candidate list with spend, clicks, orders,
   and the target campaign/ad group ids.

### Phase 2 - Confirm
5. Show the ranked candidate list (most wasted spend first, ASIN-target terms excluded /
   flagged) and the total spend it would stop. Ask the user which to negate and at what
   match type - `EXACT` is safest (negates only that exact term); `PHRASE` is broader.
   The term is negated by `negative: true`; the match type is just `EXACT` / `PHRASE` /
   `BROAD`. Do not proceed without a selection.

### Phase 3 - Apply (dryRun, then real)
6. `actions_details_schema_get` for `AMAZON_ADS_TARGETS_ADD` and read the exact
   `targetDetails` shape before building the payload.
7. Build one `targets[]` entry per approved term:
   ```json
   {
     "campaignId": "<ad_campaign_id>",
     "adGroupId": "<ad_group_id>",
     "adProduct": "SPONSORED_PRODUCTS",
     "state": "ENABLED",
     "negative": true,
     "targetType": "KEYWORD",
     "targetDetails": { "keyword": "<ad_search_term>", "matchType": "EXACT" }
   }
   ```
   `matchType` must be `EXACT` / `PHRASE` / `BROAD` (never `NEGATIVE_*`); the negativity
   is the `negative: true` flag. Max 250 targets per action. Do NOT add `marketplaceScope`
   / `marketplaces` - `AMAZON_ADS_TARGETS_ADD` on Sponsored Products rejects them
   ("does not support marketplaceScope/marketplaces for SPONSORED_PRODUCTS"); the
   `campaignId` / `adGroupId` already scope the negative to the right marketplace.
8. `actions_start type="AMAZON_ADS_TARGETS_ADD"` with **`dryRun: true`**. This validates
   the whole batch without touching Amazon (works even if the Action type is disabled) -
   confirm `status: VALIDATED, valid: true, actionId: null`.
9. Show the validated result and the before/after list. Only if the user explicitly
   approves, call `actions_start` again with `dryRun: false`, poll `actions_get` until it
   completes, and report per-term acceptance. Otherwise stop - nothing changed.

## Output format

```
Negative-keyword candidates - {marketplace} - last {N} days
Total wasted spend if applied: {currency}{sum}

#  Search term            Spend    Clicks  Orders  Campaign / Ad group      Match
1  {term}                 {cur}{v} {n}     0       {campaign} / {group}     EXACT (neg)
...

Dry run: {k} targets validated, 0 errors.
Reply "apply" to add these negatives for real, or edit the list first.
```

## Worked example (illustrative)

A term with ~€42 spend, ~61 clicks, 0 orders in an auto/discovery campaign: above
2x CPA, zero orders, plenty of clicks -> negative candidate. Proposed as a negative
(`negative: true`) with `matchType: "EXACT"`. Dry run returns `VALIDATED` / `actionId:
null`. On "apply", the negative is added and future spend on that term stops.

## Quality self-check

- Did I only include terms with enough clicks to trust the zero-order signal?
- Did I exclude / flag ASIN-target terms (`b0...`) so I don't kill competitor targeting?
- Did I use `matchType: EXACT` / `PHRASE` / `BROAD` + `negative: true` (never `NEGATIVE_*`)?
- Did I keep each negative in its own campaign/ad group (ids from the data)?
- Did I run `dryRun`, confirm `VALIDATED` / `actionId: null`, and show it before any real write?
- Did I get explicit approval before `dryRun: false`?
- Is the marketplace / currency right for the output display (it is NOT passed in the
  ADD payload)?

## Common mistakes

- Negating a term after 2-3 clicks - too little data, you may kill a converter.
- Adding a negative account-wide instead of to the campaign/ad group that spent.
- Skipping the dry run. Always validate first; you are responsible for writes.
- Confusing search term (what the shopper typed) with keyword (what you bid on) -
  you negate the search term.
- Using `NEGATIVE_EXACT` / `NEGATIVE_PHRASE` as the match type - the live backend only
  accepts `EXACT` / `PHRASE` / `BROAD`; negativity is the separate `negative: true` flag.
- Negating ASIN-target terms (`b0...` strings) - that's deliberate competitor targeting,
  not a junk query.
- Trusting the JSON schema alone - always dryRun against the live backend; the schema
  accepted `NEGATIVE_*` match types and `marketplaceScope` / `marketplaces` that the
  backend rejects for `AMAZON_ADS_TARGETS_ADD` on Sponsored Products.

## Notes

- Write skill. It uses DataDoe Actions and only writes on explicit approval;
  `dryRun` covers demos and testing with no live changes.
- A DataDoe skill, built on the DataDoe Search Term Performance source +
  `AMAZON_ADS_TARGETS_ADD`.
