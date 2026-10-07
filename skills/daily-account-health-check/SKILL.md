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
  title: Daily Account Health Check
  access: read
  category: Account Health
  interface: mcp
  output: report
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
2. **Customer experience** - Order Defect Rate (**both** FBA `seller_order_defect_rate_fba_60d_*`
   and seller-fulfilled FBM `seller_order_defect_rate_fbm_60d_*`; render the FBM row n/a
   when `seller_order_defect_rate_fbm_60d_order_count` is 0), Late Shipment Rate,
   Pre-fulfilment Cancellation Rate. Compare each `*_value` to its own `*_target_less_than`
   column and read `*_status` - do NOT hardcode the threshold (Amazon's targets vary by
   account/marketplace; e.g. a real cancellation target of 3.0%, not 2.5%).
3. **Delivery quality** - Valid Tracking Rate, On-Time Delivery Rate. Compare `*_value`
   to `*_target_greater_than` and read `*_status`. These are seller-fulfilled metrics -
   for an FBA-only seller they come back `value = 0` / `status = GOOD` (they don't apply);
   render them **n/a**, not a red zero (see the FBA-only guard in the workflow). Amazon
   does not enforce On-Time Delivery in every marketplace, so `status` can read GOOD while
   the value sits far below target (observed: 70-79% vs > 97% on every snapshot) - see the
   "below target, not enforced" rule in step 5. Also pull the newer unit-based OTDR,
   `seller_unit_on_time_delivery_rate_14d_*` (value / target_greater_than / status), and
   show it next to the 30-day shipment-based one.
4. **Policy compliance** - **every** `*_6m_status` policy / complaint category the schema
   carries, not a named subset: listing policy violations, suspected and received IP
   complaints, product authenticity / condition / safety complaints, food & product safety
   issues, customer product reviews policy violations, restricted product violations,
   documents requests, other policy violations. Each category's target comes from its own
   `*_6m_target_equals` column (0 today, but read it - never hardcode 0).
5. **Open warnings** - the count of active policy warnings that need action.

A single red gate outranks five green ones. Report the worst gate first.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data source: `Seller Account Health Metrics` (`amazon_seller_performance` -
  resolve the source id via `exports_sources_get`). Fetch cadence `RECURRING_DAILY`, but
  a row exists only for days on which a snapshot was fetched (observed: ~12 rows a month,
  gaps of up to 4 days); the latest `date` is the current state. Each metric carries a
  triad: `*_value`, a target (`*_target_less_than` / `*_target_greater_than` /
  `*_target_equals` for the policy counts), and a `*_status` - the `*_status` is the
  authoritative gate colour. **Status mapping:** metric statuses GOOD -> green, FAIR ->
  amber, BAD / POOR -> red; AHR statuses GREAT / GOOD -> green, AT_RISK -> amber,
  CRITICAL -> red; any unknown status -> amber, and fall back to value-vs-target for the
  note. FAIR is real (observed on the cancellation rate at 10% vs a 3% target).
- **Rates are fractions.** Every `*_value` and `*_target_*` rate column is 0-1 (`0.01` =
  1%, `0.97` = 97%). Multiply by 100 for display and keep value and target on the same
  scale. `seller_account_health_rating_6m_score` is a 0-1000 score, not a rate.
- **A `from`/`to` range is mandatory** - omitting it errors (`FILTER_VALIDATION`). A
  single-day range is accepted but usually returns 0 rows because snapshots are not daily.
  Pass the **last 14-30 days**, `orderByColumn: date DESC`, and take the first row. If
  `rowCount = 0`, widen to 60 days before reporting - never read 0 rows as "healthy".
  Always print the snapshot date and its age in days; flag it amber when older than 3 days.
- Currency/marketplace: read `marketplace_country_code`; localise language and
  currency to it.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller. Keep its `id` as
   `sellerOrVendorId`.
2. `exports_sources_get` with a query like "seller account health" to confirm
   source `amazon_seller_performance` is `enabled` for this org. If disabled, tell the user to
   enable it in Settings > Data and stop.
3. `exports_create` for source `amazon_seller_performance`, this seller, with an explicit
   **`from`/`to` range of the last 14-30 days** (omitting the range errors; a single day
   is accepted but usually returns 0 rows), `orderByColumn: date DESC`. Ask for these columns:
   - `date`, `marketplace_country_code`
   - `seller_account_health_rating_6m_score`, `seller_account_health_rating_6m_status`
   - `seller_order_defect_rate_fba_60d_value`, `seller_order_defect_rate_fba_60d_target_less_than`, `seller_order_defect_rate_fba_60d_status`
   - `seller_order_defect_rate_fbm_60d_value`, `seller_order_defect_rate_fbm_60d_target_less_than`, `seller_order_defect_rate_fbm_60d_status`, `seller_order_defect_rate_fbm_60d_order_count` (render n/a when the order count is 0)
   - `seller_late_shipping_rate_30d_value`, `seller_late_shipping_rate_30d_target_less_than`, `seller_late_shipping_rate_30d_status`
   - `seller_pre_fulfillment_cancellation_rate_7d_value`, `seller_pre_fulfillment_cancellation_rate_7d_target_less_than`, `seller_pre_fulfillment_cancellation_rate_7d_status`
   - `seller_valid_tracking_rate_30d_value`, `seller_valid_tracking_rate_30d_target_greater_than`, `seller_valid_tracking_rate_30d_status`
   - `seller_on_time_delivery_rate_30d_value`, `seller_on_time_delivery_rate_30d_target_greater_than`, `seller_on_time_delivery_rate_30d_status`
   - `seller_unit_on_time_delivery_rate_14d_value`, `seller_unit_on_time_delivery_rate_14d_target_greater_than`, `seller_unit_on_time_delivery_rate_14d_status` (the newer unit-based OTDR)
   - the policy-violation columns - `*_6m_count`, `*_6m_target_equals` **and** `*_6m_status`
     for **every** category: `seller_listing_policy_violations_6m_*`,
     `seller_suspected_intellectual_property_policy_violations_6m_*`,
     `seller_received_intellectual_property_complaints_6m_*`,
     `seller_product_authenticity_customer_complaints_6m_*`,
     `seller_product_condition_customer_complaints_6m_*`,
     `seller_product_safety_customer_complaints_6m_*`,
     `seller_food_and_product_safety_issues_6m_*`,
     `seller_customer_product_reviews_policy_violations_6m_*`,
     `seller_restricted_product_policy_violations_6m_*`,
     `seller_documents_requests_6m_*`, `seller_other_policy_violations_6m_*`. The
     `*_status` is the authoritative GOOD/BAD signal, the count is the detail, the
     `*_target_equals` is the target to print (do not hardcode 0).
   - `seller_policy_violations_6m_warning_count`
4. Poll until the export is ready, then `exports_raw_download` (or `exports_raw_url_get`)
   and take the row with `MAX(date)` from the returned range - that is the current
   snapshot. Record its age in days (today minus `date`); if the export returned 0 rows,
   widen the range to 60 days and retry before concluding anything.
5. Score each gate using the `*_status` field where present (authoritative), mapped as
   GOOD -> green, FAIR -> amber, BAD / POOR -> red (AHR: GREAT / GOOD -> green, AT_RISK ->
   amber, CRITICAL -> red; unknown -> amber plus the value-vs-target comparison);
   otherwise compare `*_value` to its `*_target_less_than` / `*_target_greater_than` /
   `*_target_equals` column - never a hardcoded threshold. **Below target, not enforced:**
   when `*_status` is GOOD but `*_value` fails its own target (observed: On-Time Delivery
   0.70-0.79 vs > 0.97 on every snapshot), keep the gate green (status reflects what Amazon
   enforces) but add the note "below target, not enforced" to the row and list it under
   Fix first, after any red gates - the seller still wants to know. **FBA-only guard:**
   for a seller-fulfilled metric (valid tracking, on-time delivery, FBM order defect rate)
   that returns `value = 0` with `status = GOOD`, or whose `*_order_count` /
   `*_shipment_count` is 0 (or when the account is FBA-only), render it **n/a** - it
   doesn't apply, so don't score it red.
6. Roll up to one overall verdict (worst gate wins) and render the output card.

## Output format

```
Account Health - {marketplace} - snapshot {date} ({age} days old{, STALE if > 3})
Overall: {GREEN | AMBER | RED}   AHR {score}

Gate            Metric                     Value     Target          Status
Master          Account Health Rating      {score}   {target/>=200}  {G/A/R}
Customer        Order Defect Rate (FBA)    {v}%      {target}        {G/A/R}
Customer        Order Defect Rate (FBM)    {v}%      {target}        {G/A/R or n/a if 0 orders}
Customer        Late Shipment Rate         {v}%      {target}        {G/A/R}
Customer        Cancellation Rate          {v}%      {target}        {G/A/R}
Delivery        Valid Tracking Rate        {v}%      {target}        {G/A/R or n/a}
Delivery        On-Time Delivery Rate      {v}%      {target}        {G/A/R or n/a}{ - below target, not enforced}
Delivery        Unit On-Time Delivery 14d  {v}%      {target}        {G/A/R or n/a}
Policy          {category} (6m)            {n}       {target_equals} {G/A/R from *_status}   (one row per category with count > 0 or status != GOOD; roll the GOOD/0 ones into one line)
Policy          Active warnings            {n}       0               {G/A/R}

(Values and targets are 0-1 fractions in the data - multiply both by 100 for the %
display. Target shows the account's own `*_target_*` value from the data, not a fixed number.
Seller-fulfilled metrics show n/a for FBA-only sellers. Status colours: GOOD green, FAIR
amber, BAD/POOR red; a GOOD status with a failing value is green with a note.)

Fix first:
1. {worst gate, plain-English action}
2. {next}
{n}. {any green-but-below-target metric: "X is {v}% against Amazon's {target} - not enforced here, but ..."}
Nothing urgent today. -> only if every gate is green and no value fails its target.
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
- Did I pull a 14-30 day `from`/`to` range, take `MAX(date)`, and print the snapshot's
  age (widening the range when 0 rows came back)?
- Did I scale the 0-1 rate values and targets to % before rendering?
- Did I render seller-fulfilled metrics as n/a when value=0 / status=GOOD (FBA-only),
  not as a red zero?
- Did I use the policy-violation `*_status` fields for GOOD/BAD, not just the counts, for
  every category (incl. food & product safety, product reviews policy, documents
  requests), with the target from `*_6m_target_equals`?
- Did I map FAIR to amber (and unknown statuses to amber + value-vs-target), not to green?
- Did I include the FBM order defect rate (n/a when its order count is 0) and flag any
  GOOD-status metric whose value fails its target as "below target, not enforced" under
  Fix first?
- Is the currency/units correct for this marketplace?
- Did I lead with the worst gate and give a concrete next step, not a data dump?

## Common mistakes

- Averaging metrics across days. Account health is a snapshot - use MAX(date).
- Treating a green AHR as "all fine" while a policy violation is open.
- Reporting raw numbers with no target context (2% ODR means nothing without the
  < 1% target).
- Hard-coding targets. Amazon can change them; the `*_target_*` columns are canon.
- Calling the export without a range (errors) or for a single day (usually 0 rows, which
  is not "healthy") - pass a 14-30 day range and take MAX(date).
- Rendering `0.01` as "0.01%" - the rate columns are fractions; multiply by 100.
- Rendering an FBA-only seller's valid-tracking / on-time-delivery (value=0, status=GOOD)
  as a red failure - it's n/a, not a problem.
- Treating a GOOD status as "nothing to say" when the value is far below target (OTDR 79%
  vs > 97%) - keep it green, but say "below target, not enforced" and list it.
- Checking only FBA order defects or a named subset of policy categories - a seller with
  FBM orders or a BAD food-safety flag gets a clean card it hasn't earned.

## Notes

- Read-only. This skill never writes to the account.
- A DataDoe skill, built on the DataDoe `amazon_seller_performance` source.
