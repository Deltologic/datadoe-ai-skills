---
name: promotions-manager
description: >-
  Manage your Amazon promotions from your own live data - Best Deals, Lightning Deals,
  Price Discounts (incl. Prime Exclusive), standard / Subscribe & Save / Reorder coupons -
  in one place: what is running and coming, what each one really cost (deal and coupon fees
  plus the discount given) against the lift it produced, and a rules pre-check for the next
  one (30-day lowest price, minimum discount, overlap, budget, stock, margin) using Amazon's
  own eligibility verdicts. Read-only, live from DataDoe; promotions are created in Seller
  Central. Use for "promotions", "deals", "Lightning Deal", "Best Deal", "coupons",
  "Prime Day deals", "price discount", "promo calendar", "did the deal pay off",
  "coupon ROI", "deal fees", "can I run a deal on this ASIN", or "lowest price in 30 days".
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

One view of every promotion on the account - Best Deals, Lightning Deals, Deal of the Day,
Price Discounts (incl. Prime Exclusive Discounts), standard, Subscribe & Save and Reorder
coupons - with three answers a seller needs and Seller Central spreads over five pages:
**what is live and coming** (and what Amazon flags on it), **what each promotion really
cost against what it produced** (fees + discount given vs incremental units and profit), and
**whether the next one will pass** Amazon's rules (30-day lowest price, minimum discount,
overlap, budget, stock, margin) before you build it. Live from DataDoe, read-only. The
skill never creates or edits a promotion: Amazon's Promotions API is read-only and DataDoe
has no promotion Action, so every change happens in Seller Central - this skill tells you
exactly what to set.

## When to use this

- Before an event (Prime Day, Prime Big Deal Days, Black Friday): which ASINs to submit, at
  what price, and what it will cost.
- After an event or a deal: did it pay off - incremental units, margin after fees, and the
  post-promo dip.
- Weekly promo hygiene: deals pending approval or "needs attention", coupons about to run
  out of budget, overlapping promotions blocking an ASIN, expired coupons on hero ASINs.
- Planning a single promotion on one ASIN: "can I run a 20% Best Deal on B0... next week?"
- Trigger phrases: "promotions", "deals", "Lightning Deal", "Best Deal", "coupons",
  "Prime Day deals", "price discount", "promo calendar", "did the deal pay off", "coupon
  ROI", "deal fees", "can I run a deal on this ASIN", "lowest price in 30 days".

## The framework. Calendar, true cost vs lift, rules pre-check

1. **Calendar** - every promotion with its state, from `amazon_promotions` (the Amazon
   Promotions API mirror: `status` PROCESSING / UPCOMING / RUNNING / EXPIRED / FAILED /
   CANCELLING / CANCELLED, `promotion_type` DEAL / COUPON / PRICE_DISCOUNT / BASKET_BUILDING,
   `coupon_type` STANDARD / SUBSCRIBE_AND_SAVE / REORDER_REWARDS, `event_id` such as
   `Prime Big Deal Days/2026/UK`). The deal **sub-type** (BEST_DEAL / LIGHTNING_DEAL /
   DEAL_OF_THE_DAY / PRICE_DISCOUNT) lives on `amazon_promotion_performance`, not on the
   configuration row. Per ASIN, `amazon_promotion_items` carries Amazon's own eligibility
   `issues` - read them before you reason about rules yourself.
2. **True cost vs lift** - per promotion: **cost** = Amazon's fees (the fee snapshot on the
   promotion: `upfront_fee_amount` x the charged periods per `upfront_fee_frequency` +
   `variable_fee_pct` x promo revenue, capped at `variable_fee_cap_amount`, applied **once
   per promotion** after the ASIN roll-up; coupons also report `budget_spent`, which
   already includes fees and the discount) + the **discount given** (coupon `total_discount`; for deals the
   price gap x `product_units_sold`). **Lift** = promo-window units and profit on the same
   ASINs from `amazon_profit_by_sku_and_date` against a trailing baseline (28 clean days
   before the deal), and the 14-day **hangover** after it. Rank by incremental profit after
   fees, not by revenue - a deal that sells 3x at a loss is not a win.
3. **Rules pre-check** - for a planned promotion: the price floor (your own lowest paid
   unit price in the last 30 days, from settlements), the minimum discount for the type,
   overlap with a RUNNING / UPCOMING promotion on the ASIN, budget vs expected redemptions,
   stock cover at the expected lift, and the margin at the promo price after fees. Every
   verdict carries its number and its source, and Amazon's `issues` codes override the
   skill's own rule table wherever a draft already exists (`PRICE_THRESHOLD_NOT_MET`
   prints Amazon's exact maximum price - use it).

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources:
  - `Promotions` (`amazon_promotions`) - one row per promotion, near-live
    (`fetchPeriods: CONTINUOUS`, `last_synced_at` about hourly; print it). Columns:
    `promotion_id`, `promotion_title`, `promotion_type`, `coupon_type`, `status`,
    `start_date`, `end_date`, `event_id`, `budget_type`, `budget_value`, `budget_currency`,
    `selection_type` (CATALOG / ITEMS), `benefit_discount_type`, `benefit_percent_off`
    (percent points, 20 = 20%), `benefit_amount_off`, `benefit_stacking` (ALLOWED /
    NOT_ALLOWED), `benefit_per_customer_uses`, the **fee snapshot** `upfront_fee_amount` /
    `upfront_fee_currency` / `upfront_fee_frequency` (ONE_TIME) / `variable_fee_pct`
    (0.01 = 1%) / `variable_fee_cap_amount`, `latest_revision_status`, `created_date`,
    `last_updated_date`, and JSON `issues`, `customer_segments`, `additional_tiers`.
    `requiresDatePeriod: false` - filter on `start_date` / `end_date` / `status`. Deal rows
    carry no `benefit_*` (the deal price sits per ASIN in Seller Central and is not
    exposed); coupons created before Amazon's fee snapshot existed have null fee columns.
    **Coverage:** the mirror holds what the Promotions API returns - on one UK account
    coupons back to 2024 but deals only from the current event (October 2026); the 78
    Best Deals of February-August 2026 exist only on the performance table. A deal with
    no configuration row gets the published fee schedule and the label "fee estimated (no
    snapshot)". A `promotion_title` can be a per-ASIN name (`B01NBLRUQF_PBDD`) or a brand
    name shared by hundreds of ASINs (`Kaps`, 420 ASINs in one Best Deal).
  - `Promotion Items` (`amazon_promotion_items`) - one row per promotion x ASIN for ITEMS
    selections: `promotion_id`, `asin`, `sku` (`__EMPTY__` on ASIN-level deals - treat as
    null), per-ASIN `benefit_percent_off` / `benefit_amount_off` / `benefit_fixed_price`,
    `budget_value`, and JSON `issues` = Amazon's eligibility verdicts: codes seen
    `PRICE_THRESHOLD_NOT_MET` ("Price 11.33 above maximum of 7.12", also "below minimum
    of 5.00"), `UNDISCOUNTED_PRICE_THRESHOLD_NOT_MET`, `HAS_OVERLAPPING_PROMOTIONS`,
    `NO_ASIN_SALES_HISTORY`, `BUDGET_THRESHOLD_NOT_MET`, `PRODUCT_NOT_AVAILABLE`, each with
    `severity`. Filter `issues notNull` to get only the flagged rows.
  - `Promotion Performance` (`amazon_promotion_performance`) - one row per promotion x ASIN
    for deals and price discounts, 714 days of history, refreshed daily
    (`last_updated_date_time` can lag a day): `promotion_id`, `promotion_name`,
    `promotion_type` (BEST_DEAL / LIGHTNING_DEAL / DEAL_OF_THE_DAY / PRICE_DISCOUNT /
    SALES_DISCOUNT / COUPON / PROMO_CODE), `promotion_status` (APPROVED / PENDING_APPROVAL /
    NEEDS_YOUR_ATTENTION / CANCELED), `start_date_time` / `end_date_time` (UTC - filter on
    `start_date_time`, the table has no `date` column), promotion-level `glance_views` /
    `units_sold` / `revenue` **repeated on every ASIN row** (never sum them across rows -
    aggregate by `promotion_id` first), and the per-ASIN `product_glance_views` /
    `product_units_sold` (units at the promo price) / `product_revenue` /
    `product_revenue_currency`. `promotions_api_mapping_id` joins to `amazon_promotions`
    **when present** - on two of three test accounts it was null on every row, so fall back
    to `promotion_name` = `promotion_title`, `start_date_time` within one day of
    `start_date`, and at least one shared ASIN (brand-named deals share the name across
    events - the date decides). CANCELED rows carry 0 units: they belong in the calendar
    count, never in performance. One row per promotion x ASIN: 17 deals that ended in one
    90-day window were 748 rows, 78 deals were 2,024.
  - `Coupon Performance` (`amazon_coupon_performance`) - one row per coupon x ASIN, 714
    days: `coupon_id`, `coupon_name`, `start_date_time` / `end_date_time` (filter on
    `start_date_time`), `customer_segment`, coupon-level `clips` / `redemptions` (incl.
    returned and cancelled orders) / `budget` / `total_discount` / `budget_spent` (discount
    + fees) / `budget_remaining` / `budget_percentage_used` (0-100) / `sales` (coupon
    revenue after the discount) - all **repeated on every ASIN row**, aggregate by
    `coupon_id` first - plus per-ASIN `discount_type` (PERCENT_OFF_LIST_PRICE /
    AMOUNT_OFF_LIST_PRICE) and `discount_amount`, `currency_code`, and
    `promotions_api_mapping_id`. Vendor rows add `campaign_id`, `vendor_code`,
    `is_subscribe_and_save`.
  - `Profit by SKU & Date` (`amazon_profit_by_sku_and_date`) [premium] - the lift and margin
    side: `date`, `child_asin`, `sku`, `total_sales`, `total_units_sold`, `profit`,
    `cogs_total`, `ad_spend`, `refund_cost`, `total_sessions`, `total_page_views`,
    `avg_buybox_percentage`, `unshipped_sales`, `product_name`, `currency`, `cogs_present`.
    `requiresDatePeriod: true`. Traffic columns are per-ASIN values repeated on every SKU
    row (`max()`, never `sum()`); sales ~1 day behind, traffic 2-13 days behind - a deal
    that ended this week has provisional profit. Profit is only true profit where
    `cogs_present` is true - say "before COGS" otherwise. **Pull each window for the whole
    account**, `groupBy [child_asin]`, CSV `limit 5000`, `orderByColumn child_asin` (one
    row per ASIN; 3,000-3,300 rows on a UK account - one page) and join to the deal ASINs
    in code: a `child_asin in (...)` filter with hundreds of ASINs is fragile and a brand
    deal can hold 420 of them. **Aliases must differ from column names** - `sum(profit) as
    profit` is rejected (ALIAS_COLLISION); use `units_sum`, `sales_sum`, `profit_sum`,
    `ads_sum`, `pv_max`. `min`/`max` work on numbers and dates only, never on text - group
    by a text column instead of aggregating it.
  - `Settlements & P&L Components` (`amazon_settlements_with_cogs`) - the money that
    actually posted: `date`, `settlement_type`, `amazon_order_id`, `sku`, `child_asin`,
    `quantity`, `item_price`, `promotion_item_price` (item + coupon discount given to the
    customer, negative), `promotion` (its refund, positive), `shipping_promotion_rebate`,
    and the promotion **fee** columns `deal_participation_fee`, `deal_performance_fee`,
    `coupon_participation_fee`, `coupon_performance_fee`, `coupon_redemption_fee` (expenses
    negative; Lightning and Best Deal fees are not distinguished). `requiresDatePeriod:
    true`. **These fee columns can read 0 for a whole year on an account that ran dozens
    of approved deals** (one UK account, 78 Best Deals Feb-Aug 2026, GBP 110k deal
    revenue, deal fee columns 0 every month) - Amazon invoices some marketplaces' deal fees
    outside the order settlements. So the fee snapshot on `amazon_promotions` is the
    primary cost source; settlement fee columns are a cross-check, reported when non-zero.
    `settlement_type` is ORDER / REFUND / OTHER. Per-order rows are many: four busy ASINs
    filled the 5,000-row cap in 30 days, and summing `item_price` / `quantity` per order
    produced unit prices of a quarter of the listing price (split postings), so this
    table is the **cross-check** for the price floor, not the primary (step 7).
  - `Listings` (`amazon_listings_with_cogs`) [premium] - today's price and stock: `sku`,
    `child_asin`, `listing_price_value`, `listing_price_currency`, `listing_status`,
    `listing_fulfillment_channel`, `fba_quantity_available`, `fba_quantity_inbound`,
    `cogs_total_value`, `cogs_present`.
  - `Order Line Items` (`amazon_order_items_with_cogs`) - the **primary own-price
    history** for the 30-day floor: `date`, `child_asin`, `sku`, `quantity`,
    `item_price_value` (line total, before coupon discounts - at `quantity = 1` it is the
    unit price the buyer saw), `item_status`. `requiresDatePeriod: true`. Grouped by
    `child_asin` it is one row per ASIN whatever the volume (2,292 single-unit lines in 30
    days on one ASIN came back as one row).
  - Subscribe & Save, when the user asks about S&S coupons: `amazon_replenishment_offers`
    (`child_asin`, `sku`, `amazon_replenishment_program_eligibility`, `price`,
    `subscriptions`, `stock_risk`) and `amazon_replenishment_metrics_by_sku_and_date`
    (`total_subscriptions_revenue`, `shipped_subscription_units`, `active_subscriptions`,
    `revenue_penetration`, `share_of_coupon_subscriptions`, `coupons_revenue_penetration`,
    `lost_revenue_due_to_oos`; `requiresDatePeriod: true`).
  Premium note: a premium export costs 5 AI Tokens instead of 2, nothing else differs, and
  the premium tables are part of the always-on default dataset. The promotion tables are
  **not** in the default dataset: if `exports_sources_get` shows `enabled: false`, tell the
  user to enable Promotions, Promotion Items, Promotion Performance and Coupon Performance
  at `https://app.datadoe.com/settings?tab=data` and stop; a 0-row export on an enabled
  table means the account has no promotions in that window - say so, never render zeros.
- Windows (defaults; say which you used):
  - **Calendar:** everything RUNNING / UPCOMING / PROCESSING plus anything that ended in
    the last 30 days.
  - **Performance review:** promotions that **ended** in the last 90 days (user may widen
    to 714 days); events are reviewed as a group (same `event_id`) and individually.
  - **Baseline:** the 28 days ending 2 days before `start_date`, **minus** any day the ASIN
    was in another promotion (from the calendar) - if fewer than 14 clean days remain,
    widen to 56 and say so. Baseline daily units = clean-day mean. "Another promotion"
    is decided from the **ASIN/day promotion coverage map** (step 6a), built from the
    performance tables for the whole baseline-to-hangover span plus the calendar - not
    from the calendar alone, which only holds live promotions and the last 30 days while
    a review reaches back 90-714 days and the mirror lacks older deals. In practice: when
    a second deal wave overlaps the baseline (two waves 11 days apart on one account),
    pull the clean sub-window as its own export (18 clean days) and divide by 18, not 28.
  - **Hangover:** the 14 days after `end_date` (skip if the deal ended less than 14 days
    ago; say "hangover not yet measurable"); drop ASINs that were in another promotion
    during those 14 days - their hangover is contaminated, say how many.
  - **30-day price floor:** the 30 calendar days ending yesterday.
- Thresholds (use these words in the output):
  - **Paid off** = incremental profit after fees > 0; **break-even** = within +-5% of 0;
    **lost money** = < 0. Incremental profit **per promotion** = the sum over its ASINs of
    (promo-window `profit` minus baseline daily profit x promo days minus the hangover
    shortfall: baseline daily profit x 14 minus hangover `profit`, floored at 0 when the
    hangover was better than baseline) **minus the promotion fee once** (step 6d: settled,
    else snapshot, else unavailable). A promotion whose fee is unavailable gets its
    verdict "before deal fees", never "paid off". A promotion with COGS gaps in its
    windows (step 6c) is **provisional** and says "before COGS on {share}% of units".
  - **Lift** = promo-window daily units / baseline daily units; print it as "x2.4". An
    ASIN with 0 baseline units has no lift ("n/a - no baseline sales"); all its promo
    units count as incremental. Report how many deal ASINs had no baseline (one UK event:
    117 of 623).
  - **Baseline unit profit** = baseline `profit` / baseline units, printed per deal. When
    it is already negative, a lift multiplies a loss: label the deal "amplified an
    existing per-unit loss - fix price or cost first", not merely "lost money".
  - **COGS plausibility:** `cogs_total_value` / `listing_price_value` >= 0.85 on a SKU
    (one 6-pair set carried COGS GBP 9.50 against a GBP 9.99 price) = "check the COGS
    upload" - print the verdict with that flag instead of trusting the margin. This is a
    sanity flag on today's cost; it says nothing about **historical coverage**, which
    comes from `cogs_present` in the window exports (step 6c).
  - Coupon **budget alarm:** `budget_percentage_used` >= 80 on a RUNNING coupon;
    **exhausted** at >= 100 (the coupon stops showing).
  - Coupon **redemption rate** = `redemptions` / `clips`; below 10% = "clipped, not
    bought" (price or page problem, not a coupon problem).
  - **Margin floor** for a plan: profit per unit at the promo price after fees must stay
    >= 0 unless the user names a different floor (a loss-leader is their call, not yours).
  - **Stock cover** for a plan: `fba_quantity_available` / (baseline daily units x expected
    lift x promo days) >= 1.0; below 1.0 = "will stock out mid-deal"; use lift 2.0 when
    the account has no comparable deal, else the median lift of its past deals of the type.
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
  1. **Snapshot** on the promotion row (`amazon_promotions`): fee = `upfront_fee_amount` x
     charged periods + min(`variable_fee_pct` x promo revenue, `variable_fee_cap_amount`).
     Charged periods follow `upfront_fee_frequency`: `ONE_TIME` = 1; a per-day frequency =
     the chargeable days of the promotion (end - start, in local days). Observed: UK deal
     GBP 12 `ONE_TIME` + 1% cap GBP 600 (Prime Big Deal Days 2026), DE deal EUR 16 + 1% cap
     EUR 1,000, coupons GBP 2 / EUR 4 / CAD 2 `ONE_TIME` + 1%. The snapshot is what Amazon
     previewed **for that promotion** - never carry it over to an older or a different
     event.
  2. **Settled** fee rows in `amazon_settlements_with_cogs` (step 6d) when they can be
     matched to the promotion.
  3. **Published schedule** for the **same marketplace, promotion type, event and
     effective date** - only for a promotion without a snapshot and without settled rows,
     or for a plan before a draft exists. The skill ships one verified schedule, the US
     one below; for any other marketplace with no snapshot, the fee is **"unavailable
     pending confirmation"** and the verdict is reported before fees. Never apply the US
     amounts to GBP / EUR / CAD promotions, with or without conversion - the UK and DE
     snapshots above differ materially from the US schedule.

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

1. `sellers_and_vendors_list` -> pick the seller (vendors: the same tables carry vendor
   rows with `vendor_code` / `campaign_id` and vendor funding in `amount_spent`; the lift
   side then comes from the vendor sales table, not `amazon_profit_by_sku_and_date`).
2. `exports_sources_get` -> resolve `amazon_promotions`, `amazon_promotion_items`,
   `amazon_promotion_performance`, `amazon_coupon_performance` (all must be `enabled`) and
   `amazon_profit_by_sku_and_date`, `amazon_listings_with_cogs`,
   `amazon_settlements_with_cogs`. Call `exports_source_get` on the promotion tables once
   per session - they have 32-46 columns, page 2 of `amazon_promotions` holds `created_date`,
   `last_updated_date`, `last_synced_at` and the JSON columns.
3. **Calendar** (`amazon_promotions`, JSON `limit 1000`, `orderByColumn start_date`
   DESC; filter `status in (PROCESSING,UPCOMING,RUNNING)` OR `end_date >= today - 30`):
   columns `promotion_id`, `promotion_title`, `promotion_type`, `coupon_type`, `status`,
   `start_date`, `end_date`, `event_id`, `budget_value`, `budget_currency`,
   `benefit_discount_type`, `benefit_percent_off`, `benefit_amount_off`, `benefit_stacking`,
   `upfront_fee_amount`, `upfront_fee_currency`, `variable_fee_pct`,
   `variable_fee_cap_amount`, `latest_revision_status`, `last_synced_at`, `issues`. Count by
   type x status; group event deals under their `event_id` (one UK account: 146 RUNNING
   Prime Big Deal Days deals = one line, not 146). Include `selection_type` in the
   columns. Then **selection membership**: `amazon_promotion_items`, filter `promotion_id
   in (...)` for every calendar promotion with `selection_type = ITEMS` (chunk the list;
   one row per promotion x ASIN, `issues` is **null on healthy items**, so never filter
   on `issues` for membership), columns `promotion_id`, `asin`, `sku`, `benefit_percent_off`,
   `benefit_amount_off`, `benefit_fixed_price`, `issues`. This map feeds the overlap check
   (step 7) and the join fallback (step 4c). A promotion with `selection_type = CATALOG`
   has no item rows: treat it as covering **every** ASIN of the account for overlap and
   say so in the output. **Flagged ASINs** are the subset with `issues` not null (13 rows
   on a 300-promotion account): parse `issues[].code` and `message`; join `promotion_id`
   to the calendar for the title and dates. Every `severity: ERROR` row is a "needs
   attention" line with Amazon's message quoted verbatim - "Price 11.33 above maximum of
   7.12" is the deal-price ceiling Amazon computed, print it as the fix.
4. **Deal performance - the promotion list first, then the ASIN detail:**
   - **(a)** `amazon_promotion_performance`, filter `start_date_time between` (review
     window start - 30 days, today) and `promotion_status != CANCELED`, `groupBy
     [promotion_id, promotions_api_mapping_id, promotion_name, promotion_type,
     promotion_status, start_date_time, end_date_time, revenue_currency]` (text columns
     are grouped, never aggregated), `max(glance_views) as promo_glance_views`,
     `max(units_sold) as promo_units`, `max(revenue) as promo_revenue`,
     `countDistinct(asin) as asins` (`max`, not `sum`: the promotion totals repeat per
     ASIN row; aliases must not equal column names). Keep promotions whose
     `end_date_time` falls in the review window. One row per deal - fits any cap (35 rows
     for four months on a UK account).
   - **(b)** per-ASIN detail for those promotions: columns `promotion_id`,
     `promotions_api_mapping_id`, `asin`, `product_name`, `product_glance_views`,
     `product_units_sold`, `product_revenue`, `product_revenue_currency`, filter
     `promotion_id in (...)` in chunks that stay under
     the cap (one UK account: 78 approved deals = 2,024 ASIN rows; CSV `limit 5000`,
     chunk the `in` list so no chunk exceeds it - rows per promotion are known from (a)).
     Unit price at the deal = `product_revenue` / `product_units_sold` (null when 0 units).
   - **(c)** join to the calendar: `promotions_api_mapping_id` (carried from (a)/(b)) =
     `promotion_id` of `amazon_promotions` when present, else `promotion_name` =
     `promotion_title`, `start_date_time` within one day of `start_date`, and a shared
     ASIN between the (b) rows and the step 3 selection membership. Take the fee snapshot
     from the matched row. Unmatched deals: settled fee rows if step 6d finds them, else
     the published schedule **of that marketplace and event** if the skill has a verified
     one, else "fee unavailable pending confirmation" (verdict before fees).
5. **Coupon performance:** `amazon_coupon_performance`, filter `start_date_time between`
   (window start - 365 days, today) and `end_date_time >= window start`, columns
   `coupon_id`, `coupon_name`, `start_date_time`, `end_date_time`, `customer_segment`,
   `clips`, `redemptions`, `budget`, `total_discount`, `budget_spent`, `budget_remaining`,
   `budget_percentage_used`, `sales`, `asin`, `discount_type`, `discount_amount`,
   `currency_code`, `promotions_api_mapping_id`; CSV `limit 5000`, `orderByColumn coupon_id`
   (one row per coupon on most seller accounts; multi-ASIN coupons repeat the totals -
   dedupe on `coupon_id` before any sum). Per coupon: redemption rate, cost per redemption
   = `budget_spent` / `redemptions`, discount share = `total_discount` / `sales`, budget
   alarm. Coupon fees = `budget_spent` - `total_discount` (Amazon folds clip / redemption /
   performance fees into `budget_spent`); cross-check the monthly settlement coupon fee
   columns when they are non-zero.
6. **Lift, cost coverage, hangover and fees** (`amazon_profit_by_sku_and_date` for the
   ASINs of the reviewed deals and coupons - the per-ASIN list comes from steps 4b / 5 -
   plus the settlement fee rows):
   - **(a) Promotion coverage map, ASIN x day:** for the span from the earliest baseline
     start to the latest hangover end, list every promotion that touched it - the
     performance table (`amazon_promotion_performance` filtered `start_date_time <= span
     end` and `end_date_time >= span start`, grouped as in 4a, then its ASIN rows as in
     4b; `amazon_coupon_performance` the same way on `start_date_time` / `end_date_time`)
     plus the calendar and its selection membership from step 3 (CATALOG selections cover
     every ASIN). Mark each ASIN/day that falls inside any of them. This is the only way
     to know that a baseline day was clean: the calendar alone misses historical deals.
   - **(b) Windows per ASIN:** promo window = `start_date`..`end_date` (local days; a UTC
     `23:00` start is the next local day); baseline = the 28 days ending 2 days before the
     start **minus** the ASIN's marked days; hangover = the 14 days after the end, only
     once they have passed, minus marked days. Group ASINs by identical clean-day set -
     usually two or three patterns (clean, overlapped by the previous wave, overlapped by
     the next). Export shape per pattern window: **no ASIN filter**, `groupBy
     [child_asin]`, `sum(total_units_sold) as units_sum`, `sum(total_sales) as sales_sum`,
     `sum(profit) as profit_sum`, `sum(sales_tax) as tax_sum`, `sum(total_selling_fees) as
     referral_sum`, `sum(ad_spend) as ads_sum`, `max(total_page_views) as pv_max`, CSV
     `limit 5000`, `orderByColumn child_asin` (~3,100-3,300 rows on a UK account, one
     page), joined to the deal ASINs in code. A pattern whose clean days are not one
     contiguous range is pulled as its sub-ranges (one export each) and summed; when that
     would take more than four exports, pull those ASINs by day instead: `groupBy [date,
     child_asin]`, filter `child_asin in (...)` (that smaller set only), CSV `limit 5000`,
     and drop the marked days in code. Divide by the clean-day count, never by 28.
   - **(c) COGS coverage:** run each window export a second time with the filter
     `cogs_present = false` (same shape) -> per ASIN the units, sales and profit that
     carry **no uploaded cost**; rows with `cogs_present` null are fee-only rows with no
     shipped or returned unit (one UK window: 3,097 such ASIN rows, 0 units) and are not
     missing cost. Uncovered share = uncovered units / all units for the promotion's
     ASINs (that window: 188 of 21,783 units, 0.9%, on 93 ASINs). Any uncovered unit in
     a promo, baseline or hangover window makes the promotion's verdict **provisional**,
     printed "before COGS on {share}% of units"; the plausibility flag on today's
     `cogs_total_value` does not replace this check.
   - **(d) Fees, reconciled once per promotion:** pull `amazon_settlements_with_cogs` for
     the span with `from`/`to` and the filter (combinator `or`) `deal_participation_fee !=
     0`, `deal_performance_fee != 0`, `coupon_participation_fee != 0`,
     `coupon_performance_fee != 0`, `coupon_redemption_fee != 0`; columns `date`,
     `transaction_posted_date`, `settlement_type`, `sku`, `child_asin`, `amazon_order_id`
     and the five fee columns (18 rows in a year on one UK account). These rows are
     **account-level**: `sku` is empty, `child_asin` is null and `amazon_order_id` carries
     the **promotion id** (observed: a coupon's `coupon_participation_fee` of GBP -2 and
     its `coupon_performance_fee` posted weekly on Fridays under `amazon_order_id` equal to
     the coupon's `promotion_id`). Because they have no ASIN they are **never inside the
     ASIN profit subtotals** of `amazon_profit_by_sku_and_date` - they sit in
     `amazon_profit_by_date` only. So: match the rows to the promotion by
     `amazon_order_id` = `promotion_id` (or the mapping id); settled fee = their sum
     (sign flipped). Completeness: upfront part = snapshot `upfront_fee_amount` x periods
     and variable part within 10% of `variable_fee_pct` x promo revenue -> "settled"; a
     smaller amount -> "partially posted" (use the larger of settled and snapshot and say
     so); no rows and a snapshot -> "snapshot"; neither -> "unavailable". Subtract the
     fee **once at promotion level** after summing the ASINs (allocate to ASINs only for a
     per-ASIN view, by promo-priced revenue share, and say so). Coupon fees live in
     `budget_spent` (= `total_discount` + fees); reconcile them against the settled
     coupon rows the same way, by `promotion_id`.
   - **(e) Per ASIN:** lift = (promo units / promo days) / (baseline units / clean days);
     incremental units = promo units - baseline daily x promo days; ASIN contribution =
     promo `profit` - baseline daily `profit` x promo days - hangover shortfall. Promo
     units from the profit table are usually **higher** than `product_units_sold`
     (non-Prime buyers, other offers): report both and attribute the lift to the
     promotion only on the promo-priced units.
   - **(f) Roll up per promotion** (sum the ASIN contributions, subtract the fee from (d)
     once) and per event; rank by incremental profit after fees; label Paid off /
     break-even / lost money, with "before deal fees" when the fee is unavailable and
     "before COGS on {share}%" when (c) found gaps.
7. **Rules pre-check for a planned promotion** (only when the user names an ASIN or a
   list, a type and a price or % off; otherwise skip to the output):
   - **Price floor (primary):** `amazon_order_items_with_cogs`, `from`/`to` = the 30 days
     ending yesterday, filter `child_asin in (...)` (the planned ASINs, a short list),
     `quantity > 0` and `item_status != Canceled`, `groupBy [date, child_asin, quantity]`,
     `min(item_price_value) as min_line`, `count(amazon_order_item_id) as n_lines` -> unit
     price per row = `min_line` / `quantity` (a two-unit line of GBP 6.98 is a GBP 3.49
     unit price), one row per day, ASIN and quantity bucket (140 rows for two busy ASINs
     over 30 days). Keep the date: it is what ties a price to a coupon. **Coupon
     conversion:** for every row whose date falls inside a coupon on that ASIN (coverage
     map, step 6a, with the coupon's `discount_type` / `discount_amount` from
     `amazon_coupon_performance` or the calendar), the paid unit price is unit x (1 -
     `discount_amount` / 100) for `PERCENT_OFF_LIST_PRICE` and unit - `discount_amount`
     for `AMOUNT_OFF_LIST_PRICE` - never subtract a percent figure as money (a 20% coupon
     on a GBP 30 item gives a GBP 24 paid price, not GBP 10). Two floors come out:
     - **paid floor** = the minimum over all rows after coupon conversion - the Best /
       Lightning Deal and Prime Exclusive Discount basis;
     - **non-promotional floor** = the minimum over rows on days with **no** promotion on
       the ASIN (coverage map) - the Price Discount basis.
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
   - **Overlap:** any RUNNING / UPCOMING / PROCESSING promotion whose selection membership
     (step 3; CATALOG = every ASIN) contains the ASIN and whose dates touch the planned
     window (deals and coupons both count; Amazon's code is `HAS_OVERLAPPING_PROMOTIONS`).
     A healthy multi-ASIN deal has null `issues` on its items - it is found through the
     membership map, not through the flagged list.
   - **Budget (coupons):** expected redemptions = baseline daily units x expected lift x
     days x the account's median redemption rate; needed budget = redemptions x (discount
     per unit + per-redemption fee) + upfront fee.
   - **Stock:** `amazon_listings_with_cogs`, filter `child_asin in (...)`, columns `sku`,
     `listing_price_value`, `fba_quantity_available`, `fba_quantity_inbound`,
     `listing_status`, `listing_fulfillment_channel`, `cogs_total_value`, `cogs_present` ->
     cover ratio (Configuration). A Lightning Deal with cover < 1 on the committed quantity
     is a "will sell out" note, not a failure.
   - **Margin - one cost decomposition, COGS counted once:** from the ASIN's 28-day
     baseline export (step 6b shape, with `tax_sum` and `referral_sum`): baseline unit
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
     source the rates come from (snapshot / schedule / unavailable - then show the margin
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
8. Render. Everything in the marketplace currency; name the windows, the sync time of
   `amazon_promotions` and the lag of the profit table; no promotion is created or edited.

## Output format

```
Promotions - {seller} ({marketplace}) - calendar as of {last_synced_at} · review window: promotions ended {from}..{to} · profit lag ~{n}d
Live now: {n} deals ({event or "standalone"}) · {n} coupons ({n} S&S, {n} Reorder) · {n} price discounts · Upcoming: {n} · Pending/processing: {n} · Cancelled last 30d: {n}

Needs attention ({n}):
- {ASIN} in "{promotion_title}" ({type}, {start}..{end}): {Amazon message verbatim} -> {fix: set price <= {cur}{max} | end {other promo} first | send in stock | lower budget}
- Coupon "{coupon_name}": budget {pct}% used, {cur}{remaining} left, ends {end} -> {top up / let it lapse}

Deals ended in the window, by incremental profit after fees:
Promotion                  Type       Days  ASINs  Promo units (promo-priced)  Lift   Base unit profit  Discount given  Fees ({settled|snapshot|schedule {date}|unavailable})  Incremental profit  Verdict
{title}                    BEST_DEAL  7     12     1,240 (1,105)               x2.6   +{cur}..          {cur}..        {cur}.. (upfront {cur}.. + {pct}% of {cur}..)  +{cur}..   paid off
{title}                    BEST_DEAL  14    420    10,469 (9,558)              x1.85  -{cur}..          {cur}..        unavailable (no snapshot, no settled rows, no {marketplace} schedule)  -{cur}.. before deal fees   amplified an existing per-unit loss (hangover -{cur}..){ · before COGS on {share}% of units}{ · check COGS on {n} SKUs}
{title}                    LIGHTNING  1     1      80 (80)                     x3.1   +{cur}..          {cur}..        {cur}..                          -{cur}..   lost money (hangover -{cur}..)
Event {event_id} / wave {start}..{end}: {n} deals, {cur}{revenue} promo revenue, {cur}{fees} fees, incremental profit {+/-}{cur}.. - {n} paid off, {n} lost money · {k} of {m} deal ASINs had no baseline sales (lift n/a) · hangover excludes {j} ASINs in a later deal

Coupons ended or running in the window:
Coupon                     Type      ASINs  Clips  Redeemed (rate)  Discount    Fees      Cost/redemption  Coupon sales  Budget used  Verdict
{name}                     STANDARD  1      412    198 (48%)        {cur}..     {cur}..   {cur}..          {cur}..       64%          paid off
{name}                     S&S       3      96     4 (4%)           {cur}..     {cur}..   {cur}..          {cur}..       100% - exhausted  clipped, not bought

Costs this window: fees {cur}.. (deals {cur}.. + coupons {cur}..; settled rows matched by promotion id {cur}.. - {"complete" | "partially posted" | "none posted"}; {n} promotions with fee unavailable) · discounts given {cur}.. · promo revenue {cur}..

Plan check - {type} on {n} ASINs at {price | pct off}, {start}..{end}:
ASIN        Current   30d floor (own; paid / non-promo; SKU that set it)   Planned  Rule                       Overlap            Stock cover   Unit profit after fees (break-even)  Verdict
{asin}      {cur}..   {cur}.. ({sku})                     {cur}..  >= 15% off & <= floor: ok  none               1.8x          +{cur}..                PASS (Amazon verdict pending)
{asin}      {cur}..   {cur}.. (own FBM {sku})             {cur}..  planned > floor by {cur}.. "{other promo}" running  0.6x  -{cur}..          FAIL - price; end {promo} first; break-even {cur}..
{asin}      {cur}..   {cur}..                             {cur}..  ok                         none               5.2x          -{cur}.. (COGS {cur}.. on a {cur}.. price)  CHECK COGS before deciding
Next step: create it in Seller Central > Advertising > Deals / Coupons / Prime Exclusive Discounts; re-run this skill once the draft exists to read Amazon's eligibility verdicts.
```

Omit a section that has nothing in it with one line ("No coupons in the window"). No
token-cost lines.

## Worked example (from a live run, October 2026, UK account)

The calendar shows 146 RUNNING deals that all belong to `Prime Big Deal Days/2026/UK`
(GBP 12 + 1% capped at GBP 600 each, synced 07:00), no coupons since November 2025 and
one expired price discount - so the first line is the event, not 146 rows. Thirteen ASIN
rows carry `issues`: nine new ASINs with `NO_ASIN_SALES_HISTORY` (nothing to fix - they
cannot be in a deal yet), three `PRICE_THRESHOLD_NOT_MET` quoting a maximum of 7.12
against an 11.33 price (the seller sets 7.12 or drops the ASIN), one
`HAS_OVERLAPPING_PROMOTIONS`, one `BUDGET_THRESHOLD_NOT_MET`, one `PRODUCT_NOT_AVAILABLE`.
The review of the 17 Best Deals that ended in the last 90 days (two waves, 16-30 August
and 28 August-4 September; none in `amazon_promotions`, no settled deal-fee rows in the
span, and no verified UK schedule for August - so every fee reads "unavailable" and the
verdicts are **before deal fees**) shows one brand deal of 420 ASINs doing GBP 63.6k of
promo revenue at a x1.85 lift with 9,558 promo-priced units out of 10,469 sold in the
window - and every one of the 17 negative before fees, GBP 16.3k in total, because
baseline unit profit was already negative on the big brands: the deals amplified an
existing per-unit loss. COGS coverage in the promo window was 99.1% of units (188
uncovered units on 93 small ASINs), so the verdicts are provisional only on those. One
hero SKU carried COGS of GBP 9.50 against a GBP 9.99 price, so its line says "check the
COGS upload", not "stop running deals". The plan check for a 20% Best Deal on three
of those ASINs: two pass the price rule against their own 30-day paid floor (GBP 8.32
and 5.41, from single- and multi-unit lines alike), one fails because the seller's own
merchant-fulfilled SKU on the same ASIN sold at GBP 3.49 against a planned 3.99 - end or
reprice that offer first - and all three lose money per unit at the deal price on the
single cost decomposition (VAT share 1/6, referral 17.7% of sales on this account) until
the cost side is fixed. Stock cover is 5x or more on all three, so stock is not the
constraint.

## Quality self-check

- Did I read `amazon_promotions` for state and `amazon_promotion_performance` for the deal
  sub-type and results, and join them by mapping id first, name + ASIN + date second?
- Did I take `max()` of the promotion-level and coupon-level totals (they repeat on every
  ASIN row) and `sum()` only the `product_*` columns?
- Did I exclude CANCELED performance rows from results but count them in the calendar?
- Did I quote Amazon's `issues` messages verbatim and let them override my rule table?
- Did I state the fee source for every promotion (settled / snapshot / schedule with its
  date / unavailable), multiply a per-day upfront fee by the chargeable days, keep the
  variable cap separate, and subtract the fee once per promotion after the ASIN roll-up?
- Did I match settled fee rows by `amazon_order_id` = promotion id and treat them as
  account-level (outside the ASIN subtotals), never as "already in ASIN profit"?
- Did I refuse to apply the US schedule to a GBP / EUR / CAD promotion, or a current
  snapshot to an older event?
- Did I build the ASIN x day coverage map from the performance tables for the whole span
  before calling a baseline day clean?
- Did I run the `cogs_present = false` pass on every window and mark provisional verdicts?
- Did I carry `promotions_api_mapping_id` through 4a/4b, and pull selection membership for
  every calendar promotion (not only flagged items), with CATALOG = every ASIN?
- Did I convert coupon discounts by type and date before taking the paid floor, keep the
  non-promotional floor separate, and include multi-unit lines (unit = line / quantity)?
- Did I count COGS once in the margin (`c` from the baseline), apply the variable fee as a
  rate on `P`, and derive break-even from the same formula?
- Did I compute the baseline on clean days only, and skip the hangover when it is not yet
  measurable?
- Did I say "own sales only" next to the 30-day floor and "Amazon verdict pending" on
  every PASS?
- Did I report promo-priced units and total promo-window units separately?
- Did I keep the review window, the baseline window, the sync time and the profit lag in
  the header?
- Did I rank by incremental profit after fees, not revenue or units?
- Did I print baseline unit profit and the COGS plausibility flag before calling a deal a
  loss, and count the zero-baseline ASINs?
- Did I pull the profit windows for the whole account and join in code, with aliases
  that differ from the column names?
- Did I write that nothing was created or edited, and where to do it?

## Common mistakes

- Summing `revenue` / `units_sold` / `clips` / `budget_spent` across ASIN rows - they are
  promotion-level values repeated per ASIN; one 12-ASIN deal becomes 12x its revenue.
- Treating `promotion_type` on `amazon_promotions` (DEAL) as the sub-type - BEST_DEAL vs
  LIGHTNING_DEAL is only on the performance table.
- Expecting `promotions_api_mapping_id` to join everything - it was null on every row on
  two of three accounts tested; have the name + ASIN + date fallback ready.
- Reading settlement deal fee columns as the truth - they were 0 for a year on an account
  with 78 approved deals; the snapshot on the promotion row is the primary cost.
- Hardcoding US fees - the snapshot on a UK deal said GBP 12 + 1% capped at GBP 600, not
  $70 + 1%; coupons there carried 1%, not 2.5%.
- Measuring lift against the 28 days right before an event - those days often hold the
  pre-event dip or another promotion; drop promo days from the baseline.
- Comparing the planned deal price only with the current price - the rule is the lowest
  paid price in 30 days, and a coupon redemption last week can be that floor.
- Calling a FAIL from your own data when Amazon's `issues` row says otherwise, or a PASS
  final - Amazon's model sees all sellers' prices; yours sees your own.
- Counting coupon `redemptions` as net sales - they include returned and cancelled orders.
- Reporting the hangover on a deal that ended four days ago.
- Pulling the full per-ASIN performance table in one export on an account with 200+
  deals - 2,000+ rows; list the promotions first, then fetch the ASIN rows per chunk.
- Computing the 30-day floor from per-order settlement sums - split postings produce unit
  prices of a quarter of the real price and busy ASINs overflow the cap; use the order
  items table grouped by date, ASIN and quantity first.
- Restricting the floor to `quantity = 1` lines - a two-unit line at GBP 10 is a GBP 5 unit
  price that a single-unit minimum of GBP 8 would hide.
- Subtracting `discount_amount` from a price when `discount_type` is
  `PERCENT_OFF_LIST_PRICE` - it is percent points, not money.
- Charging the US non-peak deal fee once - it is $70 **per day**; a 7-day Best Deal is
  $490 before the variable part.
- Estimating a UK or DE deal's fee from the US schedule, or from a snapshot taken for a
  later event - report "unavailable" and the verdict before fees instead.
- Reading a non-zero settlement fee column anywhere in the window as "the fee is already
  in ASIN profit" - fee rows are account-level and carry the promotion id in
  `amazon_order_id`; they are never in the ASIN subtotals.
- Repeating the full upfront or capped fee in every ASIN's calculation - it is one fee per
  promotion.
- Subtracting `cogs_total_value` on top of a unit cost inferred from baseline profit - COGS
  is then counted twice and a profitable plan reads as a loss.
- Judging baseline cleanliness from the calendar - it holds live promotions and the last
  30 days only; the historical waves live in the performance tables.
- Fetching Promotion Items only with `issues notNull` - healthy items have null `issues`,
  so the overlap check and the join fallback lose every healthy multi-ASIN deal.
- Calling a deal "paid off" with units that have no uploaded COGS in the window - profit
  is inflated by zero cost there; mark it provisional.
- Missing that your own cheaper SKU on the same ASIN (an FBM or a Grade and Resell offer)
  is the floor Amazon will hold you to.
- Calling a deal "lost money" when the ASIN loses money at full price too - say that the
  deal amplified it, and check the COGS upload when COGS is near the price.
- Using `sum(profit) as profit` or `max(revenue) as revenue` - alias collisions are
  rejected; `max()` on a text column is rejected too.
- Adding a token-cost line to the output.

## Notes

- Read-only. Amazon's Promotions API (v2025-12-01: `searchPromotions`, `getPromotion`,
  `getSelection`) is read-only and DataDoe has no promotion Action, so no skill can create,
  edit or cancel a deal or coupon today; this one tells you exactly what to set in Seller
  Central and reads Amazon's verdict back once the draft exists.
- Deal prices per ASIN are not exposed by the API; the unit price at the deal is derived
  from `product_revenue` / `product_units_sold` after the fact.
- Vendor accounts: `amount_spent` / `product_amount_spent` is vendor funding, `revenue` is
  Amazon's revenue, and the baseline must come from the vendor sales table; the seller
  profit logic in step 6 does not apply.
- Rules and fees in Configuration were verified in October 2026 from Amazon Seller Central
  help and seller-facing announcements; they change by marketplace and by event - print
  the date, prefer the snapshot, and send the user to Seller Central for the final word.
- A DataDoe skill, built on DataDoe promotion, coupon, profit, settlement and listing
  tables.
