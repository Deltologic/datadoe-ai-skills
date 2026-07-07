---
name: daily-account-health-check
description: >-
  Run a daily Amazon account-health check: Account Health Rating (AHR), order-defect
  rate, late-shipment rate, valid-tracking rate, cancellation rate and policy
  violations - each scored against Amazon's own target and rolled up to a single
  red / amber / green verdict with the exact issues to fix first. Live from DataDoe,
  in chat, no dashboard. Use when the user asks about "account health", "is my
  account ok", "AHR", "account health rating", "am I at risk of suspension", "order
  defect rate", "late shipment rate", "policy violations", or a "daily account check".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  youtube-video-embed-url: https://www.youtube.com/embed/2-zIMOAQj84?si=VZ4csDGoIqKUBMKN
---

# Daily Amazon Account Health Check

A daily smoke alarm for your Amazon account. It reads your live account-health
metrics from DataDoe, compares each one to Amazon's own target, and gives you a
single red / amber / green verdict plus the exact issues to fix first. Runs
entirely in chat through the DataDoe MCP - no dashboard to build, no report to
download.

## When to use this

- Every morning, as the first thing you check ("how is my account today").
- Right after Amazon emails you about a policy or performance issue.
- Before you launch a big promotion or send inventory in, to be sure the account
  is in good standing.
- Trigger phrases: "account health", "is my account ok", "AHR", "account health
  rating", "am I at risk of suspension", "order defect rate", "late shipment
  rate", "policy violations".

## The framework. The Five Health Gates

Amazon can restrict selling for different reasons, so check them in order of how
fast they can hurt you:

1. **Account Health Rating (AHR)** - the master score (Amazon's AHR runs 0-1000;
   >= 200 is healthy). Prefer the `_status` field (e.g. GREAT / GOOD / AT_RISK /
   CRITICAL) - green if healthy, amber if at-risk, red if critical - and fall back
   to the score vs 200 only if status is missing.
2. **Customer experience** - Order Defect Rate (target < 1%), Late Shipment Rate
   (target < 4%), Pre-fulfilment Cancellation Rate (target < 2.5%).
3. **Delivery quality** - Valid Tracking Rate (target > 95%), On-Time Delivery
   Rate (target > 90%).
4. **Policy compliance** - listing policy violations, suspected/received IP
   complaints, product authenticity/condition/safety complaints, restricted
   product violations (target for each is 0).
5. **Open warnings** - the count of active policy warnings that need action.

A single red gate outranks five green ones. Report the worst gate first.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data source: `Seller Account Health Metrics` (table `amazon_seller_performance`). One row per marketplace per day; the latest
  `date` is the current state.
- Currency/marketplace: read `marketplace_country_code`; localise language and
  currency to it.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller. Keep its `id` as
   `sellerOrVendorId`.
2. `exports_sources_get` with a query like "seller account health" to confirm
   source `amazon_seller_performance` is `enabled` for this org. If disabled, tell the user to
   enable it in Settings > Data and stop.
3. `exports_create` for source `amazon_seller_performance`, this seller, most recent day. Ask
   for these columns:
   - `date`, `marketplace_country_code`
   - `seller_account_health_rating_6m_score`, `seller_account_health_rating_6m_status`
   - `seller_order_defect_rate_fba_60d_value`, `seller_order_defect_rate_fba_60d_target_less_than`, `seller_order_defect_rate_fba_60d_status`
   - `seller_late_shipping_rate_30d_value`, `seller_late_shipping_rate_30d_target_less_than`, `seller_late_shipping_rate_30d_status`
   - `seller_pre_fulfillment_cancellation_rate_7d_value`, `seller_pre_fulfillment_cancellation_rate_7d_target_less_than`, `seller_pre_fulfillment_cancellation_rate_7d_status`
   - `seller_valid_tracking_rate_30d_value`, `seller_valid_tracking_rate_30d_target_greater_than`, `seller_valid_tracking_rate_30d_status`
   - `seller_on_time_delivery_rate_30d_value`, `seller_on_time_delivery_rate_30d_target_greater_than`, `seller_on_time_delivery_rate_30d_status`
   - the `*_6m_count` policy-violation columns (listing policy, suspected IP, received IP, product authenticity/condition/safety, restricted product, other)
   - `seller_policy_violations_6m_warning_count`
4. Poll until the export is ready, then `exports_raw_download` (or
   `exports_raw_url_get`) and read the single latest row.
5. Score each gate against its target using the `*_status` field where present,
   otherwise compare `*_value` to `*_target_less_than` / `*_target_greater_than`.
6. Roll up to one overall verdict (worst gate wins) and render the output card.

## Output format

```
Account Health - {marketplace} - {date}
Overall: {GREEN | AMBER | RED}   AHR {score}

Gate            Metric                     Value     Target      Status
Master          Account Health Rating      {score}   >= 200      {G/A/R}
Customer        Order Defect Rate          {v}%      < 1%        {G/A/R}
Customer        Late Shipment Rate         {v}%      < 4%        {G/A/R}
Customer        Cancellation Rate          {v}%      < 2.5%      {G/A/R}
Delivery        Valid Tracking Rate        {v}%      > 95%       {G/A/R}
Delivery        On-Time Delivery Rate      {v}%      > 90%       {G/A/R}
Policy          Open violations (6m)       {n}       0           {G/A/R}
Policy          Active warnings            {n}       0           {G/A/R}

Fix first:
1. {worst gate, plain-English action}
2. {next}
Nothing urgent today. -> only if every gate is green.
```

Keep it scannable. Lead with the overall verdict, then the single most important
action. Do not paste every column.

## Worked example

AHR 245 (green). Order Defect Rate 0.4% vs < 1% (green). Late Shipment Rate 6.1%
vs < 4% (red). Valid Tracking 97% (green). 1 listing-policy violation (red).

Overall: RED (a red gate outranks the greens).
Fix first: (1) Late Shipment Rate is 6.1%, above Amazon's 4% ceiling - check
carriers and handling time on recent orders. (2) Resolve the 1 open listing
policy violation in Account Health before it compounds.

## Quality self-check

- Did I use the latest `date` row only (not sum multiple days)?
- Did I compare each metric to its own target column, not a hard-coded number?
- Is the currency/units correct for this marketplace?
- Did I lead with the worst gate and give a concrete next step, not a data dump?

## Common mistakes

- Averaging metrics across days. Account health is a snapshot - use MAX(date).
- Treating a green AHR as "all fine" while a policy violation is open.
- Reporting raw numbers with no target context (2% ODR means nothing without the
  < 1% target).
- Hard-coding targets. Amazon can change them; the `*_target_*` columns are canon.

## Notes

- Read-only. This skill never writes to the account.
- A DataDoe skill, built on the DataDoe `amazon_seller_performance` source.
