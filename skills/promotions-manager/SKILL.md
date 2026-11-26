---
name: promotions-manager
description: >-
  Manage your Amazon promotions from your own live data - Best Deals, Lightning Deals,
  Price Discounts (incl. Prime Exclusive), standard / Subscribe & Save / Reorder coupons -
  in one place: what is running and coming, what each event cost in Amazon's deal and
  coupon fees (Amazon's fee preview, marked as an estimate until the fee shows in your
  settlements) against the sales and profit it added, which deals did not earn back
  their own fee, and a rules pre-check for the next one (30-day lowest price, minimum discount,
  overlap, budget, stock, margin) using Amazon's own eligibility verdicts. Read-only, live
  from DataDoe; promotions are created in Seller Central. Use for "promotions", "deals",
  "Lightning Deal", "Best Deal", "coupons", "Prime Day deals", "price discount", "promo
  calendar", "did the deal pay off", "coupon ROI", "deal fees", "can I run a deal on this
  ASIN", or "lowest price in 30 days".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Promotions Manager
  access: read
  category: Profit & Finance
  interface: mcp
  output: report
---

# Promotions Manager

One view of every promotion on the account - Best Deals, Lightning Deals, Deal of the
Day, Price Discounts (incl. Prime Exclusive Discounts), standard, Subscribe & Save and
Reorder coupons - with three answers a seller needs and Seller Central spreads over five
pages: **what is live and coming**, **what each event cost against what it produced**
(Amazon's fees, the deals that did not earn back their own fee, the lift and the profit
it added), and **whether the next one will pass** Amazon's rules before you build it.
Fees are Amazon's previews until they post to settlements: the report says for every
amount whether it is an estimate or a settled charge, and keeps a verdict conditional
while it rests on an estimate.
Live from DataDoe, read-only. The skill never creates or edits a promotion: Amazon's
Promotions API is read-only and DataDoe has no promotion Action, so every change happens
in Seller Central - this skill tells you what to set.

## When to use this

- Before an event (Prime Day, Prime Big Deal Days, Black Friday): which ASINs to submit, at
  what price, and what it will cost.
- After an event or a deal: did it pay off - fees, lift, profit, and the dip afterwards.
- Weekly promo hygiene: deals that sell nothing, coupons about to run out of budget,
  products Amazon flags inside a running deal.
- Planning a single promotion on one ASIN: "can I run a 20% Best Deal on B0... next week?"
- Trigger phrases: "promotions", "deals", "Lightning Deal", "Best Deal", "coupons",
  "Prime Day deals", "price discount", "promo calendar", "did the deal pay off", "coupon
  ROI", "deal fees", "can I run a deal on this ASIN", "lowest price in 30 days".

## The framework. Calendar, cost against lift, rules pre-check

### 1. Calendar

Every promotion with its state, from `amazon_promotions` (the Amazon Promotions API
mirror): `status` PROCESSING / UPCOMING / RUNNING / EXPIRED / FAILED / CANCELLING /
CANCELLED, `promotion_type` DEAL / COUPON / PRICE_DISCOUNT / BASKET_BUILDING, `coupon_type`
STANDARD / SUBSCRIBE_AND_SAVE / REORDER_REWARDS, `event_id` such as `Prime Big Deal
Days/2026/UK`. The deal **sub-type** (BEST_DEAL / LIGHTNING_DEAL / DEAL_OF_THE_DAY /
PRICE_DISCOUNT) is on `amazon_promotion_performance`, not on the configuration row. Per
ASIN, `amazon_promotion_items` carries Amazon's own eligibility `issues`.

### 2. Waves, not rows

An account can run hundreds of one-product deals in a single event. A **wave** is the
group of promotions that start and end together (the same `start_date_time` and
`end_date_time` on the performance table); an event can hold a few waves with different
start days. Review the wave, list its deals, and go down to one deal only when the user
asks (the deal view, step 10). The server adds the rows up: no step reads one row per
ASIN or one row per promotion from a raw table.

### 3. Cost: fees first

- **Fee per promotion** = `upfront_fee_amount` x charged periods + min(`variable_fee_pct`
  x its revenue, `variable_fee_cap_amount`), from the fee preview on its own promotion
  row. Charged periods follow `upfront_fee_frequency`: `ONE_TIME` = 1; a per-day
  frequency = the days of the promotion (a 7-day deal at 70 a day has a fixed part of
  490, not 70).
- **Fee of a wave** = the sum over its promotions: number of deals x the fixed part +
  `variable_fee_pct` x the wave's deal revenue - what the capped deals would pay over
  their cap (`variable_fee_pct` x revenue - cap, for each promotion whose own revenue is
  above cap / `variable_fee_pct`). A cap belongs to one promotion: never set it against
  the revenue of several.
- **Which preview belongs to which promotion** is settled by the promotion's identity
  (`promotions_api_mapping_id` on the performance table = `promotion_id` on
  `amazon_promotions`), not by dates alone (step 4).
- **A deal below its own fee.** A deal whose revenue at the deal price is lower than its
  whole fee (the fixed part for all charged periods plus the variable part) cannot pay
  off, whatever the lift. Count these deals and the deals with no unit sold: this is the
  first result to show, and it needs no baseline.
- **A preview is not a charge.** The fee on the promotion row is Amazon's preview for
  that promotion. Whether it was charged shows only in settlements (step 9), and per
  component: the participation fee (the fixed part) and the performance fee (the
  variable part) post separately and not on the same day. Print each component as
  "settled" or "preview", never replace a whole preview by a part that has posted, and
  keep every result that rests on a preview conditional (framework 4). Empty settlement
  columns do not prove that nothing was charged - on some accounts they stay empty for
  a year: say "settlements show no deal fee" and send the user to one event invoice,
  not "not charged yet".
- **Coupons** report their own cost: `budget_spent` = `total_discount` + fees.
- **Deals report no discount.** Do not print a "discount given" for a deal. Print the
  average price paid per unit before and during the wave (sales / units from the profit
  table) as context, and say that it includes tax and that the product mix moves it.

### 4. Lift against a baseline and against the products outside the deals

Work on daily series (step 8): one per reviewed wave, for that wave's products, and one
for the **other products** - the products that were in none of the reviewed waves.

- **Why none of them.** Waves overlap in time and share products. A comparison group
  that still holds another wave's products rises with that wave and hides the lift of
  the one being judged: leave out the products of every reviewed wave, not only its own.

- **Windows:** the promo days; the baseline (28 clean days before); the 14 days after
  (Configuration, Windows).
- **Lift** = promo units per day / baseline units per day, printed as "x1.8".
- **Pace of the other products** = their units per day in the promo days / in the
  baseline (`c_promo`), and the same for the days after (`c_after`). An event lifts the
  whole store and a season moves everything: print it next to the lift ("deal products
  x1.8, other products x1.1"). Use it only when the other products shipped at least 100
  units in the baseline; otherwise set both to 1 and say "no comparison group". When a
  wave that is not reviewed ran in the same days, name it next to the pace.
- **Expected units** without the deal = baseline units per day x `c_promo` x promo days.
  **Incremental units** = promo units - expected units. Below zero, say "the deal
  products grew less than the other products - no sign that the deal added sales".
- **Profit effect of the promo days** = promo `profit` - baseline `profit` per day x
  `c_promo` x promo days.
- **Pull-forward** (the dip after a deal). Only a fall in **units** counts: dip = (baseline
  units per day x `c_after` - units per day after), floored at 0, x the clean days after, and
  never more than the incremental units (0 when those are negative). Its cost = dip x
  baseline profit per unit (0 when that is negative). When units after the deal are at
  or above the expected pace there is no pull-forward. A lower profit per unit after the
  deal, with units holding, is a price, ads or cost change: print it as a note, never as
  a cost of the deal.
- **Units above the expected pace after the deal** are not credited either. Print them
  as a note ("after the deal the products still sold {n} units above the expected pace -
  a possible lasting gain, not counted") only when all 14 days after are clean and the
  units are at least 10% above the pace expected with `c_after`; a few days after a deal
  are its tail, not a gain.
- **Incremental profit** = profit effect - pull-forward cost - fees. With no fee
  available and a positive result before fees, print the fee at which the wave breaks
  even ("pays off as long as its fees were under {amount}").
- **Fees that have not posted.** Work the class out twice: with the whole fee, and
  without the part that is still a preview. The same class: the verdict stands; say how
  much of the result is a fee preview that settlements do not show. Different classes:
  the verdict is conditional - "{class} if Amazon charges the fee preview, {class} if
  it does not".
- **Short waves.** A few days of sales carry little signal. For a wave of fewer than 7
  promo days, a profit effect after pull-forward within 15% of the deal revenue is "too
  small to call". Apply this first, to the result against the other products' pace and
  to the one against its own baseline: where it holds, set the class as if that effect
  were zero, and then apply the fee rule above. Fees are arithmetic, not signal: they
  still count in full. The table keeps the measured amounts, with "(too small to call)"
  next to the profit effect, and the verdict reads "{class} if Amazon charges the fee
  preview; too small to call if it does not".
- **Waves that share products on the same days.** When two reviewed waves overlap in
  days and hold some of the same products, those products' sales sit in both series and
  cannot be split between the waves. Neither gets a profit verdict of its own: print
  their fees and counts, and "shares {n} products with {wave} on the same days - no
  separate verdict" (step 8). Two overlapping waves with no product in common are
  reviewed separately.
- **Check against the own baseline.** The other products are a yardstick, not a fact:
  when they are on a strong trend of their own, their pace bends the result. Work the
  incremental profit out a second time with `c_promo` and `c_after` set to 1 (the wave
  against its own baseline only). When both results fall in the same class (paid off /
  break-even / lost money), the verdict stands. When they do not, the verdict is
  **uncertain**: print both ("lost money against the pace of the other products,
  break-even against its own baseline") and count the wave neither as a win nor as a
  loss.
- **No sales at the deal price.** A deal or a wave with 0 units at the deal price gets no
  lift and no profit verdict: it produced nothing. Its fee preview is a cost only if
  Amazon charged it: print the preview and what has posted, side by side.
- **Mixed causes, printed as notes:** ad spend per day on the wave's products, before and
  during, when it moved by 50% or more and the amount is at least a fifth of the profit
  effect (both as absolute amounts, against the other products' pace) - with the amount
  above the expected level
  (promo ad spend - baseline ad spend per day x `c_promo` x promo days): "ad spend on
  these products was {amount} above the expected level - that part of the result is an
  ads decision" (profit already includes ad spend); and the other products' profit per
  unit, before and during, when it moved by 30% or more or changed sign ("the whole
  account earned less per unit in these days - part of the fall is not the deal's").
- **Product cost.** Profit is true profit only where product cost is uploaded
  (`cogs_present`). When more than 2% of the account's units in the span have none, every
  verdict is "provisional - {x}% of units have no product cost".
- **Recent days.** Fees and costs post late: a wave that ended fewer than 7 days ago has
  provisional profit. Say so.

### 5. Rules pre-check

For a planned promotion: the price floor (your own lowest paid unit price in the last 30
days), the minimum discount for the type, overlap with a RUNNING / UPCOMING promotion on
the ASIN, budget against expected redemptions, stock cover at the expected lift, and the
margin at the promo price after fees. Every verdict carries its number and its source,
and Amazon's `issues` codes override the skill's own rule table wherever a draft already
exists (`PRICE_THRESHOLD_NOT_MET` prints Amazon's exact maximum price - use it).

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources. Resolve each with `exports_sources_get`, passing the table name as
  `query` and `pageSize: 1`. The columns needed are named here: do not page through the
  schemas.
  - `Promotions` (`amazon_promotions`) - one row per promotion, near-live
    (`last_synced_at` about hourly; print it). `promotion_id`, `promotion_title`,
    `promotion_type`, `coupon_type`, `status`, `start_date`, `end_date`, `event_id`,
    `budget_value`, `budget_currency`, `selection_type` (CATALOG / ITEMS),
    `benefit_discount_type`, `benefit_percent_off` (percent points, 20 = 20%),
    `benefit_amount_off`, `benefit_stacking`, and the **fee preview**
    `upfront_fee_amount` / `upfront_fee_currency` / `upfront_fee_frequency` (ONE_TIME) /
    `variable_fee_pct` (0.01 = 1%) / `variable_fee_cap_amount`. `requiresDatePeriod:
    false` - filter on `start_date` / `end_date` / `status`. Deal rows carry no
    `benefit_*`. `issues` here is an empty list on healthy rows, not null.
    **Coverage:** the mirror holds what the Promotions API returns. Older deals can exist
    only on the performance table: they have no fee preview. Coupons created before
    Amazon's fee preview existed have empty fee columns.
  - `Promotion Items` (`amazon_promotion_items`) - one row per promotion and ASIN for
    ITEMS selections: `promotion_id`, `asin`, `sku` (`__EMPTY__` on ASIN-level deals -
    treat as empty), `benefit_fixed_price` (the deal price of the ASIN),
    `benefit_percent_off` / `benefit_amount_off`, `budget_value`, `last_synced_at`, and
    JSON `issues` = Amazon's eligibility verdicts, each with `code`, `message` and
    `severity`. Codes seen: `PRODUCT_NOT_AVAILABLE`, `PRICE_THRESHOLD_NOT_MET` ("Price
    11.33 above maximum of 7.12"), `UNDISCOUNTED_PRICE_THRESHOLD_NOT_MET`,
    `HAS_OVERLAPPING_PROMOTIONS`, `NO_ASIN_SALES_HISTORY`, `BUDGET_THRESHOLD_NOT_MET`,
    `NO_REFERENCE_PRICE`, `SELLER_ALLOWED_PRICE_THRESHOLD_NOT_MET`, `OTHER`. `issues` is
    null on healthy items. A JSON column takes only the `null` / `notNull` filters:
    it cannot be searched with `contains`, so codes are counted from the rows read. The
    table has no status or date column and keeps the items of ended and cancelled
    promotions.
  - `Promotion Performance` (`amazon_promotion_performance`) - one row per promotion and
    ASIN for deals and price discounts, 714 days of history, refreshed daily:
    `promotion_id` (the id of the performance report), `promotions_api_mapping_id` (the
    promotion's `promotion_id` on `amazon_promotions` and `amazon_promotion_items`; empty
    for deals older than the mirror), `promotion_name`, `promotion_type` (BEST_DEAL / LIGHTNING_DEAL /
    DEAL_OF_THE_DAY / PRICE_DISCOUNT / SALES_DISCOUNT / COUPON / PROMO_CODE),
    `promotion_status` (APPROVED / PENDING_APPROVAL / NEEDS_YOUR_ATTENTION / CANCELED),
    `start_date_time` / `end_date_time` (UTC; the table has no `date` column, so send no
    `from` / `to`), and the per-ASIN `product_units_sold` (units at the promo price),
    `product_revenue`, `product_glance_views`, `product_revenue_currency`. The
    promotion-level `units_sold` / `revenue` / `glance_views` repeat on every ASIN row:
    **sum only the `product_` columns**; use the promotion-level ones only as row
    filters, to count deals (step 5). CANCELED rows carry 0 units: leave them out. A
    promotion in the mirror with no row here (some price discounts) cannot be reviewed:
    say "Amazon reports no performance rows for it".
  - `Coupon Performance` (`amazon_coupon_performance`) - one row per coupon and ASIN, 714
    days: `coupon_id`, `coupon_name`, `start_date_time` / `end_date_time`,
    `customer_segment`, and the coupon-level `clips` / `redemptions` (incl. returned and
    cancelled orders) / `budget` / `total_discount` / `budget_spent` (discount + fees) /
    `budget_remaining` / `budget_percentage_used` (0-100) / `sales` - all **repeated on
    every ASIN row**: group by them, never sum them - plus per-ASIN `discount_type`
    (PERCENT_OFF_LIST_PRICE / AMOUNT_OFF_LIST_PRICE), `discount_amount`, `currency_code`.
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`) [premium] - the lift and
    margin side: `date` (the day of the order, marketplace-local), `child_asin`, `total_sales`,
    `total_units_sold` (shipped units), `profit`, `ad_spend`, `sales_tax`,
    `total_selling_fees`, `cogs_present`. `requiresDatePeriod: true`. Sales are about a
    day behind, and fees and costs keep posting for days. A premium export costs 5 AI
    Tokens instead of 2 and can stay pending for a minute: poll `exports_get`.
    **Aliases must differ from column names** (`sum(profit)` as `profit_sum`).
  - `Settlements & P&L Components` (`amazon_settlements_with_cogs`) - the money that
    posted: `date`, `settlement_type`, `amazon_order_id`, `child_asin`, `quantity`,
    `item_price`, `promotion_item_price`, and the promotion **fee** columns
    `deal_participation_fee`, `deal_performance_fee`, `coupon_participation_fee`,
    `coupon_performance_fee`, `coupon_redemption_fee` (expenses negative).
    `requiresDatePeriod: true`. Fee rows are account-level: no ASIN, and
    `amazon_order_id` holds the promotion id. **These columns can read 0 for a whole year
    on an account that ran hundreds of deals**, so the fee preview is the primary cost
    source and settled rows are a cross-check.
  - For the plan check only: `Listings` (`amazon_listings_with_cogs`) [premium] -
    `sku`, `child_asin`, `listing_price_value`, `listing_status`,
    `listing_fulfillment_channel`, `fba_quantity_available`, `fba_quantity_inbound`,
    `cogs_total_value`, `cogs_present`; and `Order Line Items`
    (`amazon_order_items_with_cogs`) - `date`, `child_asin`, `quantity`, `sales_channel`,
    `item_price_value` (line total before coupon discounts), `item_status`. Use
    marketplace lines only: a line is off-Amazon when `sales_channel` is non-empty and,
    after trim and lowercasing, is not an Amazon marketplace domain (`amazon.co.uk`,
    `amazon.de`, `amazon.com` and so on). A blank channel stays.
  - Subscribe & Save, when the user asks about S&S coupons: `amazon_replenishment_offers`
    and `amazon_replenishment_metrics_by_sku_and_date`.
  The promotion tables are **not** in the default dataset: if `exports_sources_get` shows
  `enabled: false`, tell the user to enable Promotions, Promotion Items, Promotion
  Performance and Coupon Performance at `https://app.datadoe.com/settings?tab=data` and
  stop. A 0-row export on an enabled table means no promotions in that window - say so,
  never print zeros.
- Call details: `outputType: "CSV"`; a `null` / `notNull` rule takes an empty `value`;
  an `in` / `notIn` value is a comma-separated list; a `between` value is `a,b`; a date
  value is `YYYY-MM-DD`. Create one or two exports or source lookups at a time and retry
  once when the server answers that it is rate-limiting; a premium export can stay
  pending for a minute.
  The column names below were checked against the schemas: call `exports_source_get`
  only when an export is rejected for a column.
- **Every export is grouped and small.** Raw promotion rows carry long JSON and account
  columns; a list of a few hundred promotions does not fit a chat. Every step below groups
  on the server and returns at most a few hundred short rows. An export with aggregations
  and no `groupBy` returns one row. When an export comes back at exactly its `limit`,
  rows are missing: say so, and narrow the filter rather than read a cut list as whole
  (the two top lists - the 40 largest deals and the 60 newest flags - are cut on
  purpose). Where a step names no `limit`, use 100. `max(last_synced_at)` can come back
  wrapped as `{"value": "..."}`: read the value.
- **ASIN lists.** The lift needs each wave's products as a `child_asin` `in` filter (a
  comma-separated list) and, for the other products, the same lists as `notIn` rules.
  Copy the ASINs exactly from the export that returned them, and count them with a code
  tool when the client has one. A list above 700 ASINs:
  for `in`, split it over two exports and add the days up; for `notIn`, split it over
  two rules of the same export. Check the result: units in the promo days from the
  profit table must be at least the units at the deal price; if they are not, the list
  is wrong.
- Windows (defaults; say which you used):
  - **Calendar and review:** everything RUNNING / UPCOMING / PROCESSING, plus what
    **ended** in the last 90 days (the user may widen it, up to 714 days).
  - **Lift review:** the 3 waves with the most deal revenue among those that ended in the
    window. Smaller waves get their revenue, fees and deal counts only. A running wave
    gets no profit verdict: print its units, revenue, fees and deals below their fee "so
    far".
  - **Local days.** `start_date_time` is UTC; the profit table uses marketplace-local
    dates. A start at 23:00 UTC in a UTC+1 marketplace is the next local day. Use the
    marketplace's offset on that date: daylight saving moves it (the UK is UTC+1 in
    October and UTC+0 in November).
  - **Baseline:** the 28 days whose last day is 2 days before the wave's first local day
    (the day in between is left out), minus the
    days on which another wave was running whose whole deal revenue is at least 10% of
    this wave's (smaller ones are named, not dropped). Fewer than 14 clean days: go back
    to 56 days. Still fewer: "no clean baseline - lift not measured", fees only. Divide
    by the clean days, never by 28.
  - **After:** the 14 calendar days after the wave's last local day, minus the days of
    another such wave; the window is not extended to make up for them. Fewer than 7
    clean days, or the days have not passed yet: "pull-forward not measurable yet".
  - **30-day price floor:** the 30 calendar days ending yesterday.
- Thresholds (use these words in the output):
  - **Paid off** = incremental profit above 5% of the wave's deal revenue; **break-even**
    = within 5% of the deal revenue either side of zero; **lost money** = below that. A
    wave whose fee is unavailable gets its verdict "before deal fees", never "paid off".
  - **Amplified an existing per-unit loss** = baseline profit per unit is negative, on at
    least 20 baseline units, and units sold at the deal price. Say "fix price or cost
    first", not merely "lost money".
  - Coupon **budget alarm:** `budget_percentage_used` >= 80 on a RUNNING coupon;
    **exhausted** at >= 100 (the coupon stops showing).
  - Coupon **redemption rate** = `redemptions` / `clips`; below 10% = "clipped, not
    bought" (a price or page problem, not a coupon problem).
  - **Margin floor** for a plan: profit per unit at the promo price after fees must stay
    >= 0 unless the user names a different floor (a loss-leader is their call).
  - **Stock cover** for a plan: `fba_quantity_available` / (baseline daily units x expected
    lift x promo days) >= 1.0; below 1.0 = "will stock out mid-deal". Use lift 2.0 when
    the account has no comparable wave, else the lift of its last wave of that type.
  - **COGS plausibility** (plan check): `cogs_total_value` / `listing_price_value` >= 0.85
    on a SKU = "check the COGS upload" - print the verdict with that flag instead of
    trusting the margin.
- Amazon's rules (verified October 2026 - rules and fees change several times a year and
  differ by marketplace; **always say the date and treat Amazon's `issues` as the
  authority**; verify in Seller Central before a submission):

  | Type | Length | Price rule | Other requirements |
  | --- | --- | --- | --- |
  | Best Deal (7-Day Deal) | up to 7 days (events longer) | >= 15% off the reference price (some categories 20%) **and** <= the lowest price in the trailing 30 days (the lowest customer-paid price, all sellers, incl. promos) | Professional plan, >= 3.5 seller feedback with regular ratings, product >= 3 stars with sales history, Prime-eligible, no overlapping promotion on the ASIN |
  | Lightning Deal | 4-12 hours, quantity-capped | same as Best Deal | same; needs stock for the committed quantity |
  | Price Discount | 1-30 consecutive days | >= 5% off the 30-day lowest **non-promotional** paid price, >= 5% off the current price, and >= 5% off the validated reference price (no strike-through without one) | Professional plan, >= 3.5 feedback, >= 3-star product, New condition |
  | Prime Exclusive Discount | event or standing | <= lowest price in 60 days **and** >= 5% off the 30-day lowest | FBA / Prime offers only |
  | Standard coupon | set by Amazon (check the current maximum) | 5-50% off, or an amount; budget must cover discount + fees | shows only while budget remains |
  | Subscribe & Save coupon | up to 365 days | 5-50% | ASIN enrolled in S&S; may run next to a Reorder coupon on the same ASIN |
  | Reorder coupon | up to 180 days | 5-50% | repeat customers of the brand only |

  Reference-price tightening (US, April 23 and May 18, 2026): List Price / Typical Price
  must be supported by real sales; an ASIN that sold below its non-promotional median on
  50%+ of the last 90 days loses the strike-through, and any deal shows no savings badge.
- Fees - three sources, in this order, and the output names which one it used:
  1. **Fee preview** on the promotion row (`amazon_promotions`): fee = `upfront_fee_amount` x
     charged periods + min(`variable_fee_pct` x promo revenue, `variable_fee_cap_amount`).
     Charged periods follow `upfront_fee_frequency`: `ONE_TIME` = 1; a per-day frequency =
     the chargeable days of the promotion (end - start, in local days). Observed: UK deal
     GBP 12 `ONE_TIME` + 1% cap GBP 600 (Prime Big Deal Days 2026), DE deal EUR 16 + 1% cap
     EUR 1,000, coupons GBP 2 / EUR 4 / CAD 2 `ONE_TIME` + 1%. It is what Amazon previewed
     **for that promotion** - never carry it over to an older or a different event.
  2. **Settled** fee rows in `amazon_settlements_with_cogs` (step 9) when they can be
     matched to the promotion.
  3. **Published schedule** for the **same marketplace, promotion type, event and
     effective date** - only for a promotion without a fee preview and without settled rows,
     or for a plan before a draft exists. The skill ships one verified schedule, the US
     one below; for any other marketplace with no fee preview, the fee is **"unavailable
     pending confirmation"** and the verdict is reported before fees. Never apply the US
     amounts to GBP / EUR / CAD promotions, with or without conversion - the UK and DE
     previews above differ materially from the US schedule.

  | Type (Amazon US store, verified October 2026) | Upfront | Variable | Cap |
  | --- | --- | --- | --- |
  | Best Deal / Lightning Deal, non-peak days (since 2 Jun 2025) | **$70 per day** of the deal (a 7-day Best Deal = $490; Best Deals run 1-14 days) | 1.0% of deal sales | $2,000 per deal on the variable part |
  | Prime Day 2025: Prime Exclusive Best Deal / Lightning Deal / Price Discount | flat $1,000 / $500 / $100 per campaign (no per-day, no variable fee) | - | - |
  | Prime Big Deal Days and Black Friday week 2026: Best / Lightning Deal, Prime Exclusive Discount | $100 per promotion (minus $50 early submission) | 1.5% of promotional sales | $5,000 |
  | Coupon (since 1 Jun 2025) | $5 per coupon | 2.5% of coupon-attributed sales | $2,000 on the variable part (coupons created from 5 Nov 2025) |

  Sources: Amazon's 2025 fee announcement in Seller Central (per-day wording for the
  non-peak deal fee, Prime Day 2025 flat rates, coupon fee) and the 2026 peak-event
  announcements. Print the date of the schedule next to every estimated fee.
- Currency/marketplace: localise from `revenue_currency` / `currency_code` /
  `upfront_fee_currency` (a German marketplace = EUR). The seller list can name the UK
  marketplace `UK` while table columns use `GB` - accept either.

## Step-by-step workflow (MCP-native)

About 22 small exports for the calendar and a review of three waves. Steps 3 to 9 answer
"what is running" and "did it pay off"; step 10 is one deal on request; step 11 is the
plan check.

1. `sellers_and_vendors_list` -> pick the seller (vendors: the same tables carry vendor
   rows with `vendor_code` and vendor funding in `amount_spent`; the seller profit logic
   of step 8 does not apply to them).
2. `exports_sources_get` for `amazon_promotions`, `amazon_promotion_items`,
   `amazon_promotion_performance`, `amazon_coupon_performance` (all must be `enabled`),
   `amazon_profit_by_sku_and_date` and `amazon_settlements_with_cogs`.
3. **Calendar** - one grouped export on `amazon_promotions`. Filter with combinator `or`:
   `status` `in` `PROCESSING,UPCOMING,RUNNING`; `end_date >=` the start of the review
   window. `groupBy: ["promotion_type", "coupon_type", "status", "event_id",
   "start_date", "end_date", "selection_type", "upfront_fee_amount",
   "upfront_fee_currency", "upfront_fee_frequency", "variable_fee_pct",
   "variable_fee_cap_amount"]`, `countDistinct(promotion_id)` as `promos`,
   `max(last_synced_at)` as `synced`; ordered by `start_date` descending, `limit: 100`.
   One row per group of promotions with the same dates and the same fee preview: an event
   of 200 deals is a few rows, not 200. The fee preview of a group applies to each of its
   promotions; which wave those promotions belong to is settled in step 4. A `CATALOG`
   selection covers every ASIN of the account: say so.
4. **Waves** - one grouped export on `amazon_promotion_performance`. Filters:
   `end_date_time >=` the start of the review window minus 90 days,
   `promotion_status != CANCELED`. `groupBy: ["promotion_type", "start_date_time",
   "end_date_time", "product_revenue_currency"]`, `countDistinct(promotion_id)` as
   `deals`, `countDistinct(promotions_api_mapping_id)` as `mapped`, `count(asin)` as
   `asin_rows`, `sum(product_units_sold)` as `deal_units`, `sum(product_revenue)` as
   `deal_revenue`, `sum(product_glance_views)` as `deal_views`; ordered by
   `start_date_time` descending, `limit: 100`.
   - **State of a wave.** Compare both ends with the time of the report. Started and not
     ended: **running**. Start still ahead: **upcoming** - it goes under "Upcoming" with
     its number of deals, has no sales to judge and stays out of the counts of step 5.
     Ended: **ended**. Waves that ended before the review window are not reviewed: they
     are there so that their days can be taken out of the baselines.
   - A promotion of the calendar with no wave here cannot be reviewed: name it by type
     and dates. When its days fall in the baseline or the promo days of a reviewed
     wave, say that it could not be taken out of them.
   - **Fee preview, by identity.** `mapped` is the number of the wave's promotions that
     exist in `amazon_promotions`. `mapped` = 0: no fee preview (the deals are older than
     the mirror) - "fee unavailable" unless step 9 finds settled rows or the skill holds
     a verified schedule for that marketplace and event. Otherwise take the calendar
     groups (step 3) that start and end on the wave's days. One fee preview among them
     and `promos` = `mapped` = `deals`: the two sets are the same promotions, and that
     preview belongs to each of them. Anything else - two different fee previews on
     those days, or counts that differ - is resolved by id, never by guessing:
     - the wave's promotions: `amazon_promotion_performance`, the filters of step 8a for
       that wave; `groupBy: ["promotion_id", "promotions_api_mapping_id"]`,
       `sum(product_revenue)` as `deal_revenue`; `limit: 500`;
     - their previews: `amazon_promotions`, `promotion_id` `in` those mapping ids;
       `groupBy: ["promotion_id", "upfront_fee_amount", "upfront_fee_currency",
       "upfront_fee_frequency", "variable_fee_pct", "variable_fee_cap_amount",
       "start_date", "end_date"]`; `limit: 500`.
     Work each promotion's fee out from its own preview and revenue, count the deals
     below their fee from these rows, and add the fees up. A promotion with no preview
     row has no preview: say how many. More than 500 promotions in such a wave: "fee
     preview not assigned", fee unavailable. Keep the two ids of a wave's promotions
     whenever step 9 returns settled rows: they are what the rows are matched on.
5. **Deals with no sale, deals below their fee, largest deals** - three exports on
   `amazon_promotion_performance`, all with the filters `end_date_time >=` the start of
   the review window, `start_date_time <` tomorrow's date (upcoming waves stay out) and
   `promotion_status != CANCELED`:
   - **no sale:** plus `units_sold` `=` `0`; `groupBy: ["promotion_type",
     "start_date_time", "end_date_time"]`, `countDistinct(promotion_id)` as
     `deals_no_sale`;
   - **below their fee:** plus `revenue` `<` the break-even revenue of the fee preview =
     upfront fee x charged periods / (1 - `variable_fee_pct`), rounded up to the cent (a
     one-time fee of 12 + 1% gives 12.13; 70 a day over 7 days + 1% gives 494.95); the
     same `groupBy`, `countDistinct(promotion_id)` as `deals_below_fee`. It includes the
     deals with no sale. The threshold belongs to one fee preview and one deal length.
     When every wave with a preview has the same threshold, one export does it; when
     they differ, run it once per threshold with that wave's day filters of step 8a
     added. Not for a wave without a preview;
   - **largest deals:** `groupBy: ["promotion_type", "start_date_time",
     "end_date_time", "promotion_id", "promotion_name"]`, `sum(product_units_sold)` as
     `deal_units`, `sum(product_revenue)` as `deal_revenue`; ordered by `deal_revenue`
     descending, `limit: 40`. One row is one promotion, also when two share a name. Per
     wave: its largest deals and their share of the wave's revenue. For a wave with a
     fee preview, every row above cap / `variable_fee_pct` is a capped deal: take its
     excess out of the wave's fee (framework 3). When all 40 rows are above that line,
     read the next page. A wave with no row among the 40: "no deal above {revenue of the
     last row}".
   - **the names, on request:** the largest-deals export with `units_sold` `=` `0` added
     and the filters of step 8a for one wave, ordered by `promotion_name`, `limit: 300`
     - the deals of that wave that sold nothing. Run it when the user asks which deals
     to leave out.
   A wave with no row in a count export has no such deal. Ignore the below-fee rows of a
   wave without a fee preview.
6. **Amazon's flags on items** - a flag belongs to one promotion. Follow it by the
   promotion's id, not by the ASIN: the same product can sit in a deal that is over and
   in one that runs, and the warning of the first says nothing about the second.
   - **the count:** `amazon_promotion_items`, filter `issues` `notNull`; `count(asin)`
     as `flagged_rows`, `countDistinct(asin)` as `flagged_asins`,
     `countDistinct(promotion_id)` as `flagged_promos`, no `groupBy`;
   - **the newest rows:** the same filter; `groupBy: ["promotion_id", "asin", "issues",
     "last_synced_at"]`, `max(benefit_fixed_price)` as `deal_price`, ordered by
     `last_synced_at` descending, `limit: 60`.
   One item can carry several codes. The rows read are a sample of the newest: every
   count below is "among the {n} read", never a total. Sort the items read into three
   groups:
   - **not available** - `PRODUCT_NOT_AVAILABLE`: out of stock, or the offer is
     inactive. Check the listing and the stock; a shipment helps only if it can be on
     sale before the deal ends, otherwise the product sits out the deal. An item that
     also carries a price flag is listed here only, with that flag mentioned: stock
     comes first;
   - **deal price above Amazon's maximum** - `PRICE_THRESHOLD_NOT_MET` or
     `SELLER_ALLOWED_PRICE_THRESHOLD_NOT_MET` where `deal_price` is above the lowest
     maximum quoted in the messages: print the deal price and that maximum;
   - **no fix in the message** - everything else, including `OTHER`,
     `NO_REFERENCE_PRICE` and a price message whose price is already at or below its
     "maximum": one line with the count, pointing to the deal's page in Seller Central
     (the state of their promotions is not looked up).
   For the items of the first two groups (skip when there are none), two lookups by the
   flagged promotion's id:
   - **its state:** `amazon_promotions`, filter `promotion_id` `in` the ids of those
     rows; `groupBy: ["promotion_id", "status", "start_date", "end_date"]`; `limit:
     100`. RUNNING: advice applies now. UPCOMING or PROCESSING: a coming deal - fix it
     before it starts. EXPIRED, CANCELLED, FAILED or no row: the promotion is over -
     name the item under "flag on a promotion that is over", without advice;
   - **its sales so far** (running ones only): `amazon_promotion_performance`, filters
     `promotions_api_mapping_id` `in` those ids and `asin` `in` their ASINs; `groupBy:
     ["promotions_api_mapping_id", "asin"]`, `sum(product_units_sold)` as `deal_units`;
     `limit: 200`. Read the units of the flagged promotion and product only. A product
     with a price flag that has sold units in that same promotion is not blocked by it:
     print "flagged, but selling" and do not tell the seller to change the price.
   Say "{n} of {N} flagged items read". A lower deal price also lowers the margin: next
   to a maximum, say that the plan check (step 11) shows the profit at that price.
7. **Coupons** - one grouped export on `amazon_coupon_performance`. Filter
   `end_date_time >=` the start of the review window. `groupBy: ["coupon_id",
   "coupon_name", "start_date_time", "end_date_time", "customer_segment", "clips",
   "redemptions", "budget", "total_discount", "budget_spent", "budget_percentage_used",
   "sales", "currency_code"]`, `countDistinct(asin)` as `asins`; ordered by
   `budget_spent` descending, `limit: 50`. Per coupon: redemption rate, cost per
   redemption = `budget_spent` / `redemptions`, fees = `budget_spent` - `total_discount`,
   budget alarm. No rows: "No coupons in the window".
8. **Lift and profit** for up to 3 waves (Configuration, Windows):
   - **(a) The wave's products** - `amazon_promotion_performance`, filtered by the whole
     key of the wave, the same that step 4 groups by: `promotion_type` `=` its type,
     `start_date_time` `>=` the UTC date of its start as step 4 printed it and `<` the
     day after (not the local day), `end_date_time` `>=` the UTC date of its end and
     `<` the day after, `promotion_status != CANCELED`. A Best Deal and a Price Discount
     on the same days are two waves with two lists. Two exports: the check - no
     `groupBy`, `countDistinct(promotion_id)` as `deals`, `count(asin)` as `asin_rows`,
     `sum(product_units_sold)` as `deal_units` - must return the wave's numbers from
     step 4; then the list - `groupBy: ["asin"]`, `sum(product_units_sold)` as
     `deal_units`; ordered by `asin`, `limit: 1000`. When the check returns more than
     step 4, a second wave of the same type starts and ends on the same days at another
     hour: they cannot be told apart by day, so review the two as one wave. When it
     returns nothing, the dates are wrong. Count the ASINs you send in (b) and (c): the
     count must equal the rows of the list.
   - **Shared products.** For two reviewed waves that overlap in days, compare their
     lists (with a code tool, or with one export: the filters of the first wave plus
     `asin` `in` the list of the second, `countDistinct(asin)` as `shared`). Any shared
     product: no separate profit verdict for either (framework 4). On request, review
     them as one wave - the products of both in one list, each once, and the days from
     the first start to the last end.
   - **(b) The wave's daily series** - `amazon_profit_by_sku_and_date`, `from` = the
     first baseline day, `to` = the last day after (or yesterday), filter `child_asin`
     `in` the list from (a); `groupBy: ["date"]`, `sum(total_units_sold)` as
     `units_sum`, `sum(total_sales)` as `sales_sum`, `sum(profit)` as `profit_sum`,
     `sum(ad_spend)` as `ads_sum`; ordered by `date`, `limit: 200`. One row per day.
   - **(c) The other products' daily series** - the same export, once, from the earliest
     baseline day of the reviewed waves to the latest day after, with one filter rule
     per reviewed wave: `child_asin` `notIn` that wave's list from (a), combinator
     `and`. The lists may share products; `notIn` rules need no merging. Rows with no
     `child_asin` drop out, which is right: they are not products.
   - **(d) Product cost coverage** - the same source and span, no ASIN filter,
     `groupBy: ["cogs_present"]`, `sum(total_units_sold)` as `units_sum`. Share without
     product cost = units where `cogs_present` is false / all units.
   Then add up the days of each window and work out framework 4. Show the lift next to
   the pace of the other products, the profit effect, the pull-forward, the fees and
   the incremental profit, with the notes that apply.
9. **Settled fees** - one export on `amazon_settlements_with_cogs` from the earliest
   baseline day (or the start of the review window, when no wave is reviewed) to today,
   filter with combinator `or`: `deal_participation_fee != 0`, `deal_performance_fee !=
   0`, `coupon_participation_fee != 0`, `coupon_performance_fee != 0`,
   `coupon_redemption_fee != 0`; `groupBy: ["date", "amazon_order_id"]`, `sum` of the
   five fee columns (aliases that differ from the column names); `limit: 300`. The
   columns are cash flow, so a fee is negative: use the absolute amounts. No rows:
   "settlements show no deal or coupon fee - where a fee is shown, it is Amazon's
   preview".
   With rows:
   - match them to promotions by `amazon_order_id` = the promotion's id; a wave's ids
     come from the id export of step 4 (`promotion_id` and `promotions_api_mapping_id` -
     try both);
   - compare **per promotion and per component**: the participation fee with the fixed
     part of the preview, the performance fee with its variable part (for coupons also
     the redemption fee). A component that has posted replaces its part of the preview;
     a component that has not posted stays a preview. A posting of 12 against a preview
     of 12 + 100 gives 12 settled + 100 preview, not a fee of 12;
   - print the fee as "{a} settled + {b} preview" and keep the verdict conditional while
     any part is a preview (framework 4). A settled component that differs from its
     preview: print both and use the settled one.
10. **Deal view** (only when the user names a promotion). Find it first:
    `amazon_promotion_performance`, filter `promotion_name` `=` that name; `groupBy:
    ["promotion_id", "promotions_api_mapping_id", "promotion_type", "start_date_time",
    "end_date_time"]`, sums as in step 4. Several rows are several promotions with one
    name: ask which, by its dates. Then its products (step 8a with `promotion_id` `=`
    its id in place of the wave key) and steps 8b to 8d with that ASIN list and those
    dates. The name is a filter of the promotion lookup only: the profit table has no
    promotion column. Its fee is its own fee preview, found by its mapping id.
11. **Rules pre-check for a planned promotion** (only when the user names an ASIN or a
    list, a type and a price or % off; otherwise skip to the output):
    - **Promotions on the planned ASINs (pull first).** `amazon_promotion_items`, filter
      `asin` `in` the planned ASINs: `groupBy: ["promotion_id", "asin", "issues"]`,
      `max(benefit_fixed_price)` as `deal_price`. Then `amazon_promotions`, filter
      `promotion_id` `in` those ids: type, status, dates, benefit. Add the deal and coupon
      performance rows of those ASINs that ended in the last 60 days (`asin` `in`, grouped
      by promotion and ASIN with its dates and, for coupons, `discount_type` and
      `discount_amount`). This is the list of promotions and promo days used below. A
      `CATALOG` promotion from the calendar covers every ASIN.
    - **Price floor (primary):** `amazon_order_items_with_cogs`, `from`/`to` = the 30 days
      ending yesterday, filter `child_asin in (...)` (the planned ASINs, a short list),
      `quantity > 0` and `item_status != Canceled`, `groupBy [date, child_asin, quantity,
      sales_channel, item_price_value, item_promotion_discount_value]`,
      `count(amazon_order_item_id) as n_lines`, ordered by `item_price_value` ascending,
      `limit: 1000`. Drop off-Amazon `sales_channel` rows. One row is one price and one
      discount that were really paid on that day. Paid unit price of a row =
      (`item_price_value` - the absolute `item_promotion_discount_value`, 0 when empty) /
      `quantity` (a two-unit line of GBP 6.98 is a GBP 3.49 unit price). The discount on
      the order line is the evidence that a coupon was redeemed. **Do not convert a
      price only because a coupon was active on that day:** a 20% coupon that nobody
      redeemed leaves a GBP 30 sale at GBP 30, and a planned GBP 25 passes. Two floors
      come out:
      - **paid floor** = the minimum paid unit price over all rows - the Best /
        Lightning Deal and Prime Exclusive Discount basis;
      - **non-promotional floor** = the minimum over rows with no discount on the line,
        on days with **no** promotion on the ASIN (the list pulled first) - the Price
        Discount basis.
      When the discount is empty on every line (it is filled some hours after the
      order) although a coupon with redemptions ran on the ASIN in the window, the
      observed floor can miss a redemption. Then print the coupon-adjusted price as a
      **possible floor** - unit x (1 - `discount_amount` / 100) for
      `PERCENT_OFF_LIST_PRICE`, unit - `discount_amount` for `AMOUNT_OFF_LIST_PRICE`,
      never a percent figure subtracted as money - and give the price rule CHECK
      ("uncertain: a coupon may have set a lower paid price"), not FAIL, when the plan
      passes the observed floor and fails only the possible one.
      Then check which SKU set the floor (`amazon_listings_with_cogs` for the ASIN): on one
      account the floor of a GBP 4.99 FBA ASIN was GBP 3.49, the seller's own
      merchant-fulfilled SKU on the same ASIN; a deal price above your own cheaper offer
      fails Amazon's check. No rows in 30 days = "insufficient own price history", not a
      pass.
    - **Price floor (cross-check, optional):** `amazon_settlements_with_cogs`, same
      window, filter `child_asin in (...)` and `settlement_type != REFUND`, `groupBy
      [child_asin, settlement_type, amazon_order_id]`, `sum(item_price) as ip_sum`,
      `sum(promotion_item_price) as pip_sum`, `sum(quantity) as qty_sum` -> paid unit
      price = (`ip_sum` + `pip_sum`) / `qty_sum`, the settlement view of the coupon-adjusted
      paid price. Discard unit prices below 50% of the current listing price (split
      postings: four busy ASINs produced floors of a quarter of the price) and expect the
      5,000-row cap on busy ASINs (page with `skip`). **Both floors are your own sales
      only.** Amazon's rule uses the lowest customer-paid price across all sellers and its
      own reference-price model - a pass here is necessary, not sufficient; the
      authoritative answer is the `issues` row once the promotion is drafted in Seller
      Central.
    - **Discount rule:** compare the planned price with the floors and the current
      `listing_price_value`: Best / Lightning Deal needs planned <= **paid floor** and >=
      15% off the reference (use the current price as the proxy and say so); Prime
      Exclusive Discount the same on a 60-day paid floor (widen the export); Price
      Discount needs >= 5% off the **non-promotional floor** and >= 5% off the current
      price; coupons 5-50%.
    - **Overlap:** any RUNNING / UPCOMING / PROCESSING promotion that holds the ASIN (the
      list pulled first; CATALOG = every ASIN) and whose dates touch the planned window
      (deals and coupons both count; Amazon's code is `HAS_OVERLAPPING_PROMOTIONS`). A
      healthy multi-ASIN deal has null `issues` on its items - it is found through its
      item rows, not through the flagged list.
    - **Budget (coupons):** expected redemptions = baseline daily units x expected lift x
      days x the account's median redemption rate; needed budget = redemptions x (discount
      per unit + per-redemption fee) + upfront fee.
    - **Stock:** `amazon_listings_with_cogs`, filter `child_asin in (...)`, columns `sku`,
      `listing_price_value`, `fba_quantity_available`, `fba_quantity_inbound`,
      `listing_status`, `listing_fulfillment_channel`, `cogs_total_value`, `cogs_present` ->
      cover ratio (Configuration). A Lightning Deal with cover < 1 on the committed quantity
      is a "will sell out" note, not a failure.
    - **Margin - one cost decomposition, COGS counted once:** one export on
      `amazon_profit_by_sku_and_date` for the 28 clean days before today, filter
      `child_asin` `in` the planned ASINs, `groupBy: ["child_asin"]`,
      `sum(total_units_sold)` as `units_sum`, `sum(total_sales)` as `sales_sum`,
      `sum(profit)` as `profit_sum`, `sum(sales_tax)` as `tax_sum`,
      `sum(total_selling_fees)` as `referral_sum`. From it: baseline unit
      price `p_b` = `sales_sum` / `units_sum`; tax share `t` = `tax_sum` / `sales_sum` (0 in
      US / CA, ~1/6 in the UK where prices include VAT); referral rate `r` = `referral_sum`
      / `sales_sum`; unit profit `u_b` = `profit_sum` / `units_sum`; **other unit cost**
      `c` = `p_b` x (1 - `t` - `r`) - `u_b` - this already holds COGS, FBA, ads, refunds and
      fixed fees, so `cogs_total_value` is **not** subtracted again (it serves only the
      plausibility flag). Expected units `n` = baseline daily units x expected lift x days.
      At the planned price `P`:
      unit profit = `P` x (1 - `t` - `r` - `variable_fee_pct`) - `c` - upfront fee x
      periods / `n`; break-even `P*` = (`c` + upfront x periods / `n`) / (1 - `t` - `r` -
      `variable_fee_pct`). The variable fee is a rate on revenue and enters only
      multiplied by `P`; the upfront fee enters once, spread over `n`. Say which fee
      source the rates come from (preview / schedule / unavailable - then show the margin
      before fees). With no baseline units (new ASIN): `c` = `cogs_total_value` +
      `listing_estimated_per_item_referral_fee` from the listing, flagged "cost from
      listing, no baseline", and `r` = 0 because the referral fee is already in `c`.
      Below the margin floor = "lost money at this price"; print `P*`. Run the COGS
      plausibility check first: a FAIL on margin with implausible COGS is "check COGS", not
      "do not run the deal". Where `u_b` is already negative at full price, say so - the
      deal is not the problem.
    - Verdict per ASIN: PASS / CHECK (passes your data, Amazon's verdict pending) / FAIL
      (which rule, by how much), and the fix (price to set, promotion to end first, units to
      send in, budget to set).
12. Render. Everything in the marketplace currency; name the windows, the sync time of
    `amazon_promotions` and the last profit day; no promotion is created or edited.

## Scheduled or short runs

For a daily or weekly check ("what is running, what needs attention") run steps 1 to 7
and step 9: the calendar, the running and upcoming waves with their deals with no sale
and below their fee so far, Amazon's flags, the coupons and the fees that have posted.
That is about 12 small exports, none of them premium. Review a wave for lift and profit
(step 8) once, in the first run after its 14 days after have passed, or when the user
asks. A short message holds: the running
event in one line (deals, revenue so far, fee preview, deals with no sale yet), the
products to restock or reprice inside running deals, coupons with a budget alarm, and
the verdict of a wave reviewed in this run. Nothing to report: say so in one line.

## Output format

```
Promotions - {seller} ({marketplace}) - calendar synced {last_synced_at} · review: promotions ended {from}..{to} · lift measured on profit data to {last day of the series}
Nothing was created or changed: promotions are managed in Seller Central.

RUNNING NOW
  {event or type}: {n} deals, {start}..{end} · {units} units and {cur}{revenue} at the deal price so far · fee preview {cur}{fees} ({n} x {cur}{upfront}{ x {periods}} + {pct}% of revenue) - an estimate; settlements show {no deal fee | {cur}{amount}}
  {n} of the {N} deals have sold nothing yet; {m} are below their own fee so far (the {n} included).
  {when the event started on several days, one row per start day: deals, units, revenue, fee preview, sold nothing yet, below their fee}
  Largest: {deal} {cur}.. ({share}% of the event), {deal} {cur}.., ...
  Coupons: {n} running ({n} above 80% of budget) · Upcoming: {n} deals starting {date} · Processing: {n}

AMAZON'S FLAGS ({N} flagged items in {P} promotions in the mirror; the {n} newest read - the counts below are among those {n})
  Not available, in a running deal: {k} - {asin} ({units} units so far in that deal{, also above Amazon's maximum}), ... -> check the listing and the stock; a shipment helps only if it is on sale before {deal end}
  Deal price above Amazon's maximum, in a running deal, no unit sold: {k} - {asin} {deal price} -> at most {maximum}, ... (the plan check shows the profit at that price)
  Flagged for price, but selling: {k} - {asin} ({units} units so far in that deal), ...
  In a coming deal: {k} - {asin} {flag}, starts {date} -> fix before it starts
  Flag on a promotion that is over: {k} - {asin}, ...
  No fix in Amazon's message: {k} items ({codes}) -> open the deal in Seller Central

DID THEY PAY OFF? Waves that ended in the window ({k} of {n} paid off{, {u} uncertain or conditional})
  Wave                  Deals  Units at deal price  Deal revenue  Fees ({a} settled + {b} preview | unavailable)  Deals with no sale  Deals below their fee
  {event}, {dates}      120    340                  {cur}..       {cur}0 settled + {cur}.. preview ({pct}% of the revenue)  55    80
  ...
  Largest deals: {wave} - {deal} {cur}.. ({share}% of the wave), ... · {wave} - no deal above {cur}..
  Lift and profit (the {k} largest waves):
  Wave        Lift (other products)  Avg price before -> during  Profit effect, promo days  Pull-forward  Fees     Incremental profit   Against its own baseline   Verdict
  {wave}      x1.6 (x1.2)            {cur}9.40 -> {cur}8.10       -{cur}..{ (too small to call)}  {none | none counted - the deals added no units | -{cur}.. | not measurable yet}  {cur}..  -{cur}..  -{cur}..  {paid off | break-even | lost money | uncertain: {class} against the other products' pace, {class} against its own baseline | {class} if Amazon charges the fee preview, {class | too small to call} if it does not | no separate verdict - shares {n} products with {wave}}{ before deal fees}{ · {cur}{b} of it is a fee preview that settlements do not show}{ · amplified an existing per-unit loss}{ · provisional - {x}% of units have no product cost}
  Notes: {ad spend per day {a} -> {b}, {amount} above the expected level | other products earned {x} -> {y} per unit in the same days | baseline cut to {n} clean days because {wave} ran | no comparison group}

COUPONS in the window
  Coupon     Type      ASINs  Clips  Redeemed (rate)  Discount  Fees   Cost/redemption  Coupon sales  Budget used  Verdict
  {name}     STANDARD  1      412    198 (48%)        {cur}..   {cur}..  {cur}..        {cur}..       64%          {ok | budget alarm | clipped, not bought}
  [or: "No coupons in the window."]

WHAT TO DO
  {one line per finding a seller can act on: leave out next time the deals that sold nothing (offer the list of names); check listing and stock of the products that are not available; set the price Amazon quotes where nothing sold; top up or let lapse a coupon}

Plan check - {type} on {n} ASINs at {price | pct off}, {start}..{end}:
ASIN        Current   30d floor (own; paid / non-promo; SKU that set it)   Planned  Rule                       Overlap            Stock cover   Unit profit after fees (break-even)  Verdict
{asin}      {cur}..   {cur}.. ({sku})                     {cur}..  >= 15% off & <= floor: ok  none               1.8x          +{cur}..                PASS (Amazon verdict pending)
{asin}      {cur}..   {cur}.. (own FBM {sku})             {cur}..  planned > floor by {cur}.. "{other promo}" running  0.6x  -{cur}..          FAIL - price; end {promo} first; break-even {cur}..
Next step: create it in Seller Central > Advertising > Deals / Coupons / Prime Exclusive Discounts; re-run this skill once the draft exists to read Amazon's eligibility verdicts.
```

Leave out a section that has nothing in it with one line ("No coupons in the window").
Print the plan check only when a plan was named. No token-cost lines.

- **Order of the waves:** those that paid off first, largest gain first; then the losses,
  largest loss first; then the uncertain and the conditional ones. When none paid off,
  say so in one line.
- **What to do.** Advice about deals that sold nothing is for the next event: do not
  advise cancelling a running deal - nothing in the data shows that a fee comes back.
  Name the products to restock, and for a price above Amazon's maximum give the price
  and the warning that it lowers the margin.
- **Dashboard.** When the user asks for a dashboard, render the same report as one page:
  four tiles on top (running deals and their revenue so far; their fee preview so far;
  running deals with no sale yet; reviewed waves that paid off, "{k} of {n}", with the
  uncertain and conditional ones named next to it), then the
  sections of the report as tables, in the same order and with the same words. No chart
  unless the user asks for one.

## Worked example (illustrative)

A UK store, two months after its autumn event and in the middle of a longer one.

- **Running:** 180 one-product Best Deals in one event, started on three days. So far
  5,200 units and GBP 41,000 at the deal price; fee preview GBP 12 + 1% each, GBP 2,570
  together. 60 deals have sold nothing yet and 85 are below their own GBP 12 fee so far.
  No profit verdict while the event runs.
- **Flags:** 150 flagged items; in the 60 newest read, most carry a message with no fix
  in it, 9 are "Product not available" (out of stock inside a running deal) and 5 quote
  a maximum price below the deal price.
- **The autumn event (2 days, 120 deals):** 340 units and GBP 2,900 at the deal price
  against GBP 1,469 of fee previews (120 x 12 + 1% of 2,900) - 51% of the revenue. 55
  deals sold nothing and 80 earned less than their own fee. The deal products sold 150
  units a day before and 240 a day in the event: lift x1.6, while the other products
  sold x1.2. Expected without the deals: 150 x 1.2 x 2 = 360 units, so 120 incremental.
  Profit was GBP 200 a day before, so GBP 480 was expected and GBP 310 came in: profit
  effect GBP -170. Units after the event stayed at the expected pace: no pull-forward.
  Incremental profit -170 - 1,469 = GBP -1,639, and almost all of it is fees on deals
  that did not sell. The event ran two days, and GBP -170 is within 15% of the deal
  revenue: too small to call (against its own baseline alone it is GBP -90, the same).
  So the verdict rests on the fee: **lost money if Amazon charges the fee preview; too
  small to call if it does not**. Settlements show no deal fee: one event invoice has to
  settle it.
- **A summer wave (14 days, 10 brand deals):** GBP 52,000 at the deal price, one deal
  carries 88% of it. No fee preview (the deals are older than the mirror): the verdict is
  "before deal fees". Lift x1.7 against x1.2 for the other products - a group without
  the products of any reviewed wave, 90 of which were in two of them. The products earn
  less than
  GBP 1 a unit normally and the deal price took most of it, also on the units that would
  have sold anyway: profit effect GBP -4,800, and GBP -4,100 against its own baseline:
  **lost money before deal fees** both ways. Note printed: ad spend on these products
  doubled during the wave, GBP 2,000 above the expected level.
- **A small late-summer wave (8 days, 4 deals):** GBP 8,000 at the deal price. Lift x1.2
  while the other products sold x1.5: against that pace the deals added no units and
  the result is GBP -700 (lost money); against its own baseline it is GBP -100
  (break-even). The two disagree: **uncertain before deal fees**, counted neither as a
  win nor as a loss.
- **What to do:** next event, submit the products that sold in this one and leave out
  the 55 that did not; restock or drop the 9 unavailable products; check one event
  invoice to confirm the per-deal fee.

## Quality self-check

- Is every export grouped, and did I avoid reading one row per promotion or per ASIN from
  a raw table?
- Did I sum only the `product_` columns of the performance table, and group (not sum) the
  coupon totals?
- Did I leave out CANCELED performance rows?
- Did I assign each fee preview by the promotion's identity (`mapped`, or the id lookup
  when the dates do not single out one preview), with the fixed part for every charged
  period and the cap per promotion?
- Did I keep running and upcoming waves apart?
- Did I call the fee a preview, show settled and preview amounts per component, and
  keep a verdict that depends on a preview conditional?
- For a wave of fewer than 7 promo days: did I treat a profit effect within 15% of the
  deal revenue as too small to call?
- Did I follow every flag by its promotion id, and give advice only for a promotion
  that runs or is coming?
- Did I select each wave's products by its whole key (type, start, end) and check them
  against the wave's numbers?
- Do two reviewed waves share products on the same days? Then no separate verdict.
- Did I count the deals with no sale and the deals below their own fee on the server
  (step 5), for every wave that has a fee preview?
- Did I refuse to apply the US schedule to a GBP / EUR / CAD promotion, or a preview to
  an older or different event?
- Did I copy the ASIN lists exactly, count them against the rows of step 8a, and check
  promo units against units at the deal price?
- Did I compute the baseline on clean days, use local days, and print the lift next to
  the pace of the other products?
- Does the comparison group leave out the products of every reviewed wave, not only of
  the wave being judged?
- Did I count pull-forward from units only, cap it at the incremental units, and skip it
  when it is not measurable yet?
- Did I work every verdict out a second time against the wave's own baseline, and call
  it uncertain when the two disagree?
- Did I give no lift or profit verdict to a deal or wave with 0 units at the deal price?
- Did I print the notes on ad spend, on the other products' profit per unit and on
  product cost coverage where they apply?
- Did I mark waves that ended fewer than 7 days ago, and running waves, as not final?
- Did I quote Amazon's `issues` messages verbatim, say how many I read, and give a fix
  only where the message holds one?
- For a plan: did I take the paid floor from prices and discounts on the order lines
  (not from a coupon merely being active), keep the non-promotional floor separate,
  count COGS once, and say "own sales only" and "Amazon verdict pending"?
- Did I write that nothing was created or edited, and where to do it?

## Common mistakes

- Summing `revenue` / `units_sold` / `clips` / `budget_spent` across ASIN rows - they are
  promotion-level values repeated per ASIN.
- Pulling raw promotion, item or performance rows into a chat. Group on the server.
- Treating `promotion_type` on `amazon_promotions` (DEAL) as the sub-type - BEST_DEAL vs
  LIGHTNING_DEAL is only on the performance table.
- Looking for the fee preview only among promotions of the last 30 days while reviewing
  90: the older event then reads "fee unavailable".
- Reading settlement deal fee columns as the truth - they can be 0 for a year on an
  account with hundreds of deals; and reading the preview as a charge.
- Replacing a whole fee preview by the first settlement row: the participation fee can
  post weeks before the performance fee.
- Charging one upfront fee for a deal billed per day, or one cap for two promotions.
- Matching a fee preview or a flag to a deal by its dates or its ASIN instead of the
  promotion's id.
- Listing a wave that starts next week under "running", as deals with no sales.
- Giving two overlapping waves on the same products a verdict each from the same sales.
- Hardcoding US fees - a UK deal preview said GBP 12 + 1% capped at GBP 600, not $70 +
  1%.
- Ranking a deal that sold nothing at the deal price as a win or a loss from the sales
  of its products in the same days.
- Charging a deal for a fall in profit after it ended while its units held: that is a
  price, ads or cost change.
- Counting only the negative swings after many small deals as "hangover": add the wave
  up first.
- Crediting the whole lift to the deal when the other products sold more in the same
  days too - or calling a deal a loss only because the other products were on a strong
  trend of their own.
- Comparing a wave with "the rest of the account" while another wave runs in the same
  days: the rest then holds deal products and the lift looks smaller than it was.
- Printing a "discount given" for a deal from an average price: the product mix moves it.
- Measuring lift against days that hold another large wave.
- Reporting the pull-forward on a wave that ended four days ago.
- Printing Amazon's "maximum" as a fix when the deal price is already below it.
- Counting deals with no sale by reading a list of hundreds of rows: filter and count on
  the server.
- Telling the seller to restock or reprice a flagged product without checking that the
  promotion that raised the flag still runs.
- Advising to cancel a running deal because it has not sold yet.
- Comparing the planned deal price only with the current price - the rule is the lowest
  paid price in 30 days, and a coupon redemption last week can be that floor.
- Lowering the paid floor for every sale on a day a coupon was active: only a line that
  carries a discount was paid less.
- Calling a FAIL from your own data when Amazon's `issues` row says otherwise, or a PASS
  final - Amazon's model sees all sellers' prices; yours sees your own.
- Counting coupon `redemptions` as net sales - they include returned and cancelled orders.
- Subtracting `discount_amount` from a price when `discount_type` is
  `PERCENT_OFF_LIST_PRICE` - it is percent points, not money.
- Subtracting `cogs_total_value` on top of a unit cost inferred from baseline profit -
  COGS is then counted twice.
- Using `sum(profit)` as `profit` - alias collisions are rejected; `min` / `max` work on
  numbers and dates only.
- Adding a token-cost line to the output.

## Notes

- Read-only. Amazon's Promotions API (v2025-12-01: `searchPromotions`, `getPromotion`,
  `getSelection`) is read-only and DataDoe has no promotion Action, so no skill can create,
  edit or cancel a deal or coupon today; this one tells you what to set in Seller Central
  and reads Amazon's verdict back once the draft exists.
- The review is by wave. Per-deal lift is the deal view (step 10), one deal at a time.
- Products that were in an earlier wave can still sell above their normal level when the
  baseline of the next wave starts; the lift of that next wave is then understated.
- The deal price of an ASIN is `benefit_fixed_price` on `amazon_promotion_items` for
  promotions in the mirror; for older deals it is `product_revenue` /
  `product_units_sold`.
- Vendor accounts: `amount_spent` / `product_amount_spent` is vendor funding, `revenue` is
  Amazon's revenue, and the baseline must come from the vendor sales table; step 8 does
  not apply.
- Rules and fees in Configuration were verified in October 2026 from Amazon Seller Central
  help and seller-facing announcements; they change by marketplace and by event - print
  the date, prefer the preview, and send the user to Seller Central for the final word.
- The thresholds (3 waves, 5% of deal revenue, 100 units for the comparison group, 10%
  for another wave, 60 flagged rows, 40 largest deals) are defaults from tests on one UK
  account in November 2026. Say which you used when asked.
- A DataDoe skill, built on DataDoe promotion, coupon, profit, settlement and listing
  tables.
