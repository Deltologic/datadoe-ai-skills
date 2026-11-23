---
name: amazon-listing-optimizer
description: >-
  Optimize an Amazon listing from your own live data, tuned for 2026 Amazon (the
  75-character title cap, the COSMO intent layer and the Rufus / Alexa for Shopping
  assistant). It first checks whether the listing is the cause at all (Buy Box, stock
  and price, a swap with another of your products, fewer searches), then benchmarks
  your search funnel against the market to find whether you leak at impressions,
  clicks, cart-adds or purchases, separates an exposure problem from a copy problem,
  finds the converting themes your title forgot to say,
  audits intent coverage and listing health, and returns a rewritten, policy-safe,
  upload-ready title, bullets, backend terms and attribute fills. Live from DataDoe.
  Use for "optimize my listing", "listing optimization", "fix my title", "improve my
  bullets", "keyword gaps", "why isn't my listing ranking", "why isn't it
  converting", "backend keywords", "listing audit", or "is my listing Rufus ready".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  title: Amazon Listing Optimizer
  access: read
  category: Listings & Content
  interface: mcp
  output: report
---

# Amazon Listing Optimizer

Optimizes an Amazon listing from your own live data, tuned for how Amazon actually
ranks and recommends in 2026 (the 75-character title cap, the COSMO intent layer, and
the Rufus / "Alexa for Shopping" AI assistant). It **diagnoses where the listing leaks
against the market** (are you seen, clicked, added to cart, bought?), separates an
**exposure** problem from a **copy** problem, finds the converting themes your title
forgot to say, audits **intent coverage** the way COSMO reads a listing, and returns a
rewritten, policy-compliant, upload-ready title, bullets, backend terms and attribute
fills with a prioritized, measurable fix list. All from DataDoe - no manual exports,
no screenshots, no third-party tools.

## When to use this

- A listing under-converts or isn't ranking for the terms it should.
- Before a push/relaunch, or after a title/bullet edit, to check coverage + funnel.
- New variation or ASIN that needs its copy dialed in.
- To bring an old, long, keyword-stuffed title into 2026 policy before Amazon
  auto-rewrites it for you.
- Trigger phrases: "optimize my listing", "listing optimization", "fix my title",
  "improve my bullets", "keyword gaps", "why isn't my listing ranking", "why isn't
  it converting", "backend keywords", "listing audit", "is my listing Rufus ready".

## What changed in 2026 (design this skill around it)

- **Title cap is 75 characters** (including spaces) for all categories except media,
  enforced from 27 July 2026. Over-length or non-compliant titles are **auto-rewritten
  by Amazon's own AI without seller approval** - so a tight, compliant title is not
  optional. The title can no longer hold every keyword; it holds the brand + the one
  best-converting theme + the audience/use-case. Keywords now live in bullets, backend
  and structured attributes.
- **COSMO** is Amazon's intent/semantic layer on top of A9. A9 still uses keyword
  match, sales velocity, CTR and CVR; COSMO adds "does this listing actually match what
  the shopper means". It **rewards breadth of intent coverage** (who it's for, what it
  does, where/when it's used, what it is, what it pairs with) and **penalizes keyword
  repetition, generic descriptors and empty attribute fields**. Breadth of intent beats
  depth of keyword repetition.
- **Rufus / "Alexa for Shopping"** now mediates a large share of shopping queries and
  can surface an "AI research" summary above listings. It favours listings that plainly
  answer who the product is for, what problem it solves, what it is made of, how it
  compares, and that pre-empt objections - in natural language, backed by complete data
  and ratings.

## The framework. Diagnose the funnel vs the market, then fix the right thing

For every important query the ASIN touches, the search funnel is
**impressions -> clicks -> cart-adds -> purchases**. Read each stage **against the
market average for that same query**, not against an absolute number - a 2% click rate
can be excellent on one query and terrible on another.

Per query, compute:
- **Impression share** = `child_asin_impression_count` / `search_query_total_impression_count`.
- **Impressions per search** = `child_asin_impression_count` / `search_query_volume`:
  how often the product is shown. About 1 means once in every search. Impression share
  is small by nature - a search shows 20 to 30 products, so a product shown once in
  every search holds about 3% to 5% of the impressions. Never call a share low from its
  size; use impressions per search to judge exposure.
- **Your CTR** = `child_asin_click_count` / `child_asin_impression_count`, and the
  **market CTR** = `search_query_total_click_count` / `search_query_total_impression_count`.
- **Cart rate** = `child_asin_add_to_cart_count` / `child_asin_click_count`.
- **Your CVR** = `child_asin_purchase_count` / `child_asin_click_count`, and the
  **market CVR** = `search_query_total_purchase_count` / `search_query_total_click_count`.
- **Search Query Score** = `child_asin_search_query_score`, kept per ASIN, marketplace
  and period as context. Amazon ranks queries relative to other queries for the same
  ASIN based on overall query performance; 1 is highest. This is not the ASIN's organic
  search position. Do not take a minimum or aggregate scores across periods or ASINs.

Then classify each high-value query:

1. **Exposure problem** - you win on CTR/CVR (at or above market) but the product is
   shown in fewer than about half of the searches (impressions per search under 0.5).
   **Investigate: ads, offer, stock and relevant keyword coverage** before rewriting
   copy; stronger exposure may be the highest-upside opportunity. A product already
   shown about once per search has no exposure problem on that query, whatever its
   impression share.
2. **Keyword coverage gap** - on a relevant, high-volume query the product is rarely
   shown (impressions per search under 0.5) and the query's terms are absent from the
   listing. **Fix: consider a bullet / backend / attribute** (not necessarily the
   75-char title). Low exposure or a Search Query Score does not prove that the term
   is not indexed; verify indexing separately.
3. **Click-rate (below-market CTR)** - impressions but CTR below the market CTR for
   that query -> main image / title / price / badge. (If CTR is low in absolute terms
   but at market, there is nothing to fix - don't chase it.)
4. **Conversion (below-market CVR, or cart-adds that don't convert)** -> bullets / A+ /
   images / price / Prime / reviews.
5. **Relevance guard** - rarely shown AND below-market CTR AND below-market CVR is
   usually not your product. **Do not chase it into the title.**

### First: is the listing the cause?

Run this before any rewrite, and always when the user wants to win back a query or
explain a drop. If one of these fits, say it in the first lines of the answer:

- **The offer.** In the weeks of the drop a week has no units shipped and a Buy Box
  under 90%, or the Buy Box of a week is under 90% and at least 5 points under the
  weeks before (both weighted by page views, step 4c), or the average price paid rose
  by 5% or more while units fell -> stock, Buy Box or price. Copy will not fix it. A
  week with no units shipped and no page views, after weeks with page views, means
  nobody reached the listing (out of stock, suppressed or inactive) -> the offer too.
  A week with no units shipped while the Buy Box held, or with no Buy Box data, is a
  note ("check stock"), not the cause: units count shipped orders only.
- **Another of your own products took the place.** On the query that fell, another
  of your tracked products gained at least half of the share points this product lost
  at the stage that fell, and your products together fell by less than 10%, or rose
  -> a swap between your products, often two pack sizes or colours under one parent.
  Decide which should lead; nothing was lost. A small move of the total alone is not
  a swap: a product that falls from 2% to 1% next to one of yours that holds 50% moves
  the total from 52% to 51%. No measured gainer, no swap.
- **The words are already there.** The query's terms are in the title, item highlight,
  bullets or backend terms -> no keyword explains the loss. Look at clicks (main image,
  price, rating) and at the product page.
- **The listing changed during or after the data.** `summaries.lastUpdatedDate` of the
  SKU that carries the content falls in the last SQP week or later -> most of the
  funnel was earned by the earlier version, which DataDoe no longer holds. The date
  moves on any update (price and stock too; on a SKU with automated pricing it moves
  almost every day), so say "updated on {date}, what changed is unknown", ask the user
  whether the copy changed, and compare the same queries again after two new SQP
  weeks. It is a caveat, not a cause.
- **Fewer searches.** The query's searches fell by 15% or more and the product's
  shares held -> demand or season.
- **Shoppers moved to another kind of product.** Searches held (fell by less than
  15%), the product is shown as often (impressions per search fell by less than 20%),
  and its click rate fell by 20% or more while the market's click rate did not. Compare the
  top clicked products for that query before and after (Brand Analytics, step 4c): a
  different type of product taking the clicks (a winter version, a multipack) is a
  season or assortment effect, not copy. To find your own product of that other kind,
  use the step 4c export for that query: the product of yours whose share rose there
  (name it from `amazon_products_by_child_asin`). If none rose, say that you sell none
  on that query; supporting your own product of that kind may win back more than a
  rewrite. Before you recommend ads for it, check its offer in the step 4c export:
  only with units shipped and a Buy Box of 90% or more in its latest week. Otherwise
  the first fix is its stock or Buy Box ("restock {product}, then put it in front of
  that query").
- **Ads.** If the product's Sponsored Products and Display clicks fell in the same
  weeks, say so as context: SQP mixes sponsored and organic results. The ASIN-level
  ads data has no Sponsored Brands clicks (empty, not 0) and no Sponsored TV or DSP, so
  a shift between ad formats can look like a fall. Do not call ads the cause without
  campaign or search-term data that shows it.

The rewrite still follows, sized to what the data supports. When the listing already
covers its top queries, the honest output is a short list of small changes and the
sentence "copy is not the cause of this drop" - not a full rewrite presented as the
fix.

### The single highest-leverage move: does your title say what converts?

Before rewriting anything, run this once - the most common, highest-ROI miss:
1. **Cluster** the queries into themes: one theme per word shoppers add to the product
   noun (audience, material, size, use, problem, season). Size numbers form one theme;
   competitor brands form their own group, which is never a theme to add.
2. Per theme, sum volume and take the **CVR** and **CTR-vs-market**.
3. Find the theme with the **best conversion and real volume** - what buyers actually
   want from this product. The title carries the theme with the most clicks; a smaller
   theme that converts better belongs in a bullet.
4. **Check whether that theme's words are in the title.** A word counts as there as a
   word, a word form, or part of a compound (in German, "Sohlen" is in
   "Einlegesohlen"); do not change a compliant title only to spell such a word on its
   own, and put it in the backend terms if it is not already covered. If your
   best-converting theme is missing, that is the #1 fix - and since the title now holds
   only 75 characters, it must earn its place with the single best-converting theme,
   not a keyword pile.

### Intent-coverage audit (how COSMO reads the listing)

Across the title + bullets + description + attributes, check that the listing
explicitly answers each dimension at least once (most listings cover only 2-3; aim
for the lot):
- **WHO** it's for (audience / use case).
- **WHAT it does** (function + what its materials/features *enable*, not just specs).
- **WHERE / WHEN** it's used (location, occasion, frequency).
- **WHAT it is** (product type / category).
- **WHAT it pairs with / compares to**.
Each real keyword appears **once**, in the field where it fits best - repetition is
wasted space and a COSMO/title-policy penalty.

### Rufus-readiness check

Would the listing let an AI assistant answer: who is this for, what problem does it
solve, what is it made of, how does it compare, and what do buyers complain about
(objections)? If any answer is missing, add it in a bullet or A+ in plain language.
3-4 star reviews hold the real audience language and objections, but DataDoe has no
review text: ask the user to paste a few, or skip this and say so.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (resolve each by table name with `exports_sources_get`):
  - `amazon_child_product_organic_search_ranks_per_week` (SQP) - the funnel engine and
    the one required source. Per query: `search_query_volume`,
    `child_asin_impression_count` + `search_query_total_impression_count`,
    `child_asin_click_count` + `search_query_total_click_count`,
    `child_asin_add_to_cart_count`, `child_asin_purchase_count` +
    `search_query_total_purchase_count`, `child_asin_search_query_score`,
    `child_asin_median_click_price_value`/`_currency`. Coverage is per configured ASIN
    and often sparse (weeks can be missing and the latest week stale), and each week
    carries at most ~100 queries (the report cap, not the full query set) - probe
    coverage first (workflow step 4a). Fallback when weekly coverage is thin:
    `amazon_child_product_organic_search_ranks_per_month` (same funnel columns, one row
    per month).
  - `amazon_products_by_child_asin` (fallback / supplement for content) - `product_name`
    (the displayed title), `product_bullet_point_1..5`, `product_description`, `product_brand`,
    category, BSR, `product_image_url`, `marketplace_country_code`. It returns a row for
    **every marketplace the seller is in** (e.g. CA / DE / GB for one UK seller) - always
    filter `marketplace_country_code` to the target marketplace (rows use `GB`;
    `sellers_and_vendors_list` reports `UK` for the same seller). Prefer
    `amazon_listings_raw` for submitted title/bullets/description/brand; use this for
    category / BSR or when `attributes` is sparse.
  - `amazon_listings_raw` - the listing as submitted, the backend keywords and the
    attributes, and the place to see **which attribute fields are empty** (the "death
    of null" gap COSMO penalises). One row per SKU/marketplace, a current snapshot (use
    `last_seen_at` for freshness; it is not a time series and there is no listing
    history).
    **Read the flat text columns first:** `item_name` (the listing title; when the
    seller submitted none it falls back to the summary title and then the catalog, so
    it is not proof of what was submitted),
    `title_differentiation` (the item highlight Amazon shows next to the title in
    search results), `bullet_point_1` to `bullet_point_5`, `product_description`,
    `generic_keyword` (backend search terms), `product_type`, `parent_asin`, `sku`.
    They fit a chat as CSV. Count the item highlight as covered text in every keyword
    audit, and leave it unchanged unless the user asks or the click rate is the problem
    (step 10).
    JSON columns: `summaries` (small: status, displayed title, last update), `issues`,
    `attributes` (large), `offers`. Pull `attributes` only for the SKU that carries the
    content (the submitted title in step 3 and the attribute audit). Inside `attributes`:
    - **Backend search terms** = `attributes.generic_keyword[].value` - an array of
      `{language_tag, marketplace_id, value}`; `value` is Amazon's real "Search Terms"
      blob (space-separated). Pick the entry matching the target `marketplace_id`. **No
      `generic_keyword` key = the SKU has no backend terms at all** (a concrete miss).
    - **Listing content** (richer than the catalog source): `item_name`, `bullet_point[]`,
      `product_description` (HTML), `brand`, `color`, `size`, image locators
      (`main_product_image_locator`, `other_product_image_locator_1..5`), `list_price`.
    - **Two titles, not one.** `attributes.item_name` is the title you *submitted*;
      `summaries.itemName` is the title Amazon *displays* (it usually equals
      `amazon_products_by_child_asin.product_name`; when those two differ, report both
      and do not guess which one shoppers see). They can differ wildly - 66 vs 149
      chars observed on the same SKU. **Measure the 75-char rule on `summaries.itemName`**
      and flag the divergence when the two differ: Amazon is not showing your
      contribution, so a compliant submitted title does not make the listing compliant.
      The same holds for images: when `summaries.mainImage` and
      `attributes.main_product_image_locator` name different images, report both and
      send the main image to the manual checks.
    - **Empty-attribute gaps**: compare the `attributes` keys against what's expected for
      the SKU's `summaries.productType` (types differ - `SHARP_PIN` carries far fewer
      fields than `SHOE_INSERT`); an expected field absent or an empty array is a gap.
    - **Health**: `issues[]` (`code`, `severity`, `categories`, `enforcements.actions`) -
      flag suppressions so you don't "just add keywords" to a blocked listing.
    - **Multiple SKUs per ASIN**: a `child_asin` + `marketplace_id` can have more than one
      row - different seller SKUs for the same ASIN (new vs used, FBA vs FBM, a superseded
      listing). Don't treat the first or richest row as canonical: check `summaries.status`
      on each and audit the `BUYABLE` one(s) - that is what's actually live. If a
      non-buyable sibling SKU carries better content (populated `generic_keyword`, fuller
      `bullet_point` / `product_description`) than the buyable SKU(s), flag it explicitly:
      the good copy exists but isn't on the listing that sells. Use
      `summaries.lastUpdatedDate` to tell which is the newer edit.
      An **offer-only SKU** (a second fulfilment channel or a virtual SKU of the same
      ASIN) often has no title, bullets or backend terms of its own. That is not a gap
      when another buyable SKU of the ASIN carries the content: audit the SKU that
      carries it, and do not report the empty ones as missing keywords.
    The JSON columns are large. In a chat, read the flat columns as CSV and pull
    `attributes` for one SKU only (three SKUs came to about 17,000 characters of JSON).
    With a file system, download and parse instead.
  - `amazon_ads_search_terms_by_campaign_by_date` - converting ad search terms (keyword
    harvest the SQP set may miss). It has no ASIN column: filter to the campaigns that
    advertise the product, or to the product's theme words, and say that the harvest
    is per campaign, not per product.
  - `amazon_ads_performance_by_child_asin_and_date` - `ad_impressions`, `ad_clicks`
    and `ad_orders` per product, `ad_campaign_type` and day: whether ads still run on
    this product. It covers Sponsored Products, Display and Brands; Brands rows have
    empty clicks and impressions, and Sponsored TV and DSP are not in it.
  - `amazon_profit_by_sku_and_date` (**premium**) - the offer check by week:
    `total_units_sold` (shipped units only), `total_sales`, `avg_buybox_percentage` and
    `total_page_views` per `child_asin`. The Buy Box and page views repeat on every SKU
    row of the ASIN and day: never average them over rows (step 4c). The Buy Box can
    lag by more than a week: an empty Buy Box next to units sold means "not published
    yet"; 0 with no page views means no traffic.
  - `amazon_fba_inventory_health` (optional, **premium**) - `your_price`, `featuredoffer_price`,
    `lowest_price_new_plus_shipping`, `available` for a price/stock read (a CVR leak is
    often price or an out-of-stock, not copy). Premium note: a premium export costs 5 AI Tokens instead of 2 - nothing else differs, and the table is part of the always-on default dataset, so it is never disabled. A 0-row export means no data in the window or an initial load still in progress - say which, and use `amazon_listings_with_cogs.listing_price_value` / `fba_quantity_available` instead; never render zeros.
  - `amazon_brand_analytics_search_terms_weekly` (Brand Registry only, optional) - top
    terms with #1-3 click/conversion share. It is **org/marketplace-scoped, not account-scoped**
    (no `seller_or_vendor_id` column) - filter by marketplace and treat the clicked ASINs as
    market-wide (often competitors). It lists only the top three clicked products per
    term, and its latest week can be older than the latest SQP week. If absent, **skip
    and say so** - never block.
- Use `child_asin_search_query_score`. `child_asin_organic_search_rank` is a deprecated
  compatibility name for the same data and should not be used in new exports.
- The SQP table name stays unchanged for compatibility; the source does not provide
  organic search position or separate organic and sponsored visibility.
- Inputs: the target ASIN/SKU (+ marketplace if multi).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller; get the target ASIN.
2. `exports_sources_get` -> confirm sources, passing the table name as `query` and
   `pageSize: 1` (the default page prints several long descriptions); SQP is required,
   the rest degrade gracefully.
3. **Current listing,** in two small exports on `amazon_listings_raw` (CSV), filtered
   with `child_asin` and `marketplace_country_code`:
   - every SKU of the ASIN: `sku`, `parent_asin`, `product_type`, `item_name`,
     `title_differentiation`, `generic_keyword`, `summaries`, `issues`, `last_seen_at`.
     From `summaries` read `status`, `itemName` and `lastUpdatedDate`. Pick the buyable
     SKU that carries the content (Configuration: multiple SKUs).
   - that one SKU (add a `sku` filter): `bullet_point_1` to `bullet_point_5` and
     `product_description`. Several SKUs of one ASIN repeat the same bullets, so do
     not pull them for all.

   Record both titles with their lengths: **displayed** = `summaries.itemName` (this is
   the one the 75-char compliance verdict uses) and **submitted** = `attributes.item_name`
   of the SKU that carries the content. Pull `attributes` for that one SKU in a third
   export (step 9 needs it too). The flat `item_name` is for the keyword audit only:
   it falls back to the displayed title when nothing was submitted. If `attributes`
   has no `item_name`, say "no submitted title found" instead of comparing. If the two
   titles differ, say so in the header - Amazon is displaying a different title than
   the one on file, and the submitted title's length proves nothing.
   Fall back to `amazon_products_by_child_asin` for title / bullets / category / BSR
   if the listing columns are empty - filtered to the target
   `marketplace_country_code`, since it returns one row per marketplace of the seller.
4. **SQP coverage probe, then the funnel per query (the core):**
   - **4a. Coverage probe first.** `exports_create` on the SQP weekly source for the ASIN
     over the intended window (>= 8 weeks), `groupBy: ["date"]` with
     `countDistinct(search_query)` and `sum(child_asin_impression_count)`. Report which
     weeks exist and the age of the latest one (weeks can be missing and the latest
     can be stale; a week holds at most 100 queries per ASIN - the report cap, not
     the full query set - and often 30 to 70). An SQP week runs Sunday to Saturday and
     `date` is the Sunday. If fewer than ~4 weeks are present in the window, either
     fall back to `amazon_child_product_organic_search_ranks_per_month` (same funnel
     columns, monthly rows) or run in **"snapshot" mode** on the weeks that exist - and
     say so in the header: which periods the analysis rests on and how stale they are.
     Never present a one-week sample as an 8-week trend.
   - **4b. Funnel pull.** `exports_create` on the SQP source for the ASIN over the window
     (or the periods found in 4a), grouped by `search_query`, pulling BOTH the
     `child_asin_*` and the `search_query_total_*` columns so you can benchmark against
     the market. Compute impression share, your-vs-market CTR, cart rate, your-vs-market
     CVR. Sum funnel counts over the window before dividing; if showing Search Query
     Score, pull `date` separately and show per-period values without aggregation.
     Also take `sum(search_query_volume)` and `count(search_query)` (the weeks the
     query has a row): searches per week = volume / weeks. Order by the product's
     summed impressions, descending, with `limit: 60`: a product can touch more than
     200 queries, and the top 40 to 60 carry nearly all of its impressions. These are
     the "high-value queries" below. Keep the export grouped - raw SQP rows carry
     account columns and do not fit a chat.
     The window total can hide a slide. For the queries with at least 30 clicks (at
     most three),
     add one export `groupBy: ["date", "search_query"]` with the same sums and
     `max(child_asin_search_query_score)`, and show the click rate against the market
     week by week when it moved.
   - **4c. Cause check** (framework: "First: is the listing the cause?"). Compare two
     windows of equal length that touch, as the Search Query Performance & Share
     Tracker does: 4 weeks against 4 with 8 or more weeks in a row, 3 against 3 with 6
     or 7, 2 against 2 with 4 or 5.
     - **Offer.** One export on `amazon_profit_by_sku_and_date` for the ASIN (and, when
       you will name another product of yours below, that ASIN too) over the SQP
       weeks, `groupBy: ["date", "child_asin"]` with `dateInterval: "WEEK"` (weeks
       start on Sunday, like SQP), `sum(total_units_sold)`, `sum(total_sales)` and
       `min(avg_buybox_percentage)` as `lowest_buybox_day`; average price paid = sales
       / units. The Buy Box repeats on every SKU row of the ASIN and day, so an average
       over rows counts a day once per SKU; a week whose lowest day is 90% or more
       cannot be under 90%. If a week's lowest day is under 90%, or a week has no
       units, add one daily export (`groupBy: ["date", "child_asin"]`, no
       `dateInterval`, `max(avg_buybox_percentage)`, `max(total_page_views)`): a
       window's Buy Box = sum of Buy Box x page views / sum of page views, leaving out
       days with an empty Buy Box. Compare `lastUpdatedDate` from step 3 with the last
       SQP week.
     - **Your other products.** Take the query that fell: the one the user names; if
       none is named, the query with the most clicks lost between the two windows among
       those in the week-by-week pull (4b), or the product's top query by clicks when
       none fell. One SQP export filtered to that query, `groupBy: ["date",
       "child_asin"]`, summing each product's impressions, clicks and purchases and
       taking `max` of the three query totals. A swap needs another of your products
       whose share at the stage that fell rose by at least half of the points this
       product lost, with your products together down by less than 10%, or up. Count a
       product's share only from a row in at least 2 weeks of each window; with fewer,
       say "share from the weeks present" and do not call it a swap on that alone.
     - **Ads.** One export on `amazon_ads_performance_by_child_asin_and_date` for the
       ASIN, by week, `groupBy: ["date", "ad_campaign_type"]`, `sum(ad_clicks)` as
       `clicks_from_ads` (an alias must differ from the column name). Report Sponsored
       Products and Display clicks; Sponsored Brands clicks are empty in this table
       (missing, not 0).
     - **Reuse.** If the Search Query Performance & Share Tracker already ran in this
       chat on this ASIN, reuse its offer and own-products results for the same query
       and windows instead of exporting them again; anything it did not cover, export.
     - Put the result in the first lines of the answer, and print every check you
       could not run as "not checked", never as "none" or "steady".
     - When the click rate fell while searches held, add one export on
       `amazon_brand_analytics_search_terms_weekly` (if enabled): filter
       `marketplace_country_code` and `search_term` = the main query, over the SQP
       weeks, columns `date`, `department_name`, `clicked_asin`, `clicked_item_name`,
       `click_share_rank`, `click_share`, `conversion_share`. Ranks and shares are per
       department: compare one department across weeks - the marketplace-wide one (for
       example "Amazon.de") when it is there, else the one with rows in the most weeks -
       and never mix departments in one list. It lists only the top three clicked
       products per term, department and week, `clicked_item_name` can be empty, and
       its latest week can be a week older than SQP.
5. **Theme check (first):** cluster into themes, find the best-converting theme with
   real volume, check whether its words are in the title. Judge a theme only when it
   holds at least 20 of the product's clicks; print clicks and purchases next to every
   rate, and call a theme under that line a hint.
6. **Classify each high-value query** as exposure / keyword coverage / CTR / CVR /
   relevance using the market benchmarks. Split "you win but aren't seen"
   (investigate ads/offer/coverage) from "you're seen but lose" (copy).
7. **Intent-coverage + Rufus audit:** score the listing on the COSMO dimensions and the
   Rufus questions above; note which are missing.
8. **Harvest + competitive gap:** pull converting ad terms from
   `amazon_ads_search_terms_by_campaign_by_date`: `groupBy: ["ad_search_term"]`, `sum`
   of `ad_clicks`, `ad_orders` and `ad_impressions` as `clicks`, `orders` and
   `impressions`, `having` `orders >= 2`, the product noun of the main query in a
   `contains` filter on `ad_search_term`, `limit: 40`. The
   table has no ASIN column, so say that the harvest covers every product the theme
   word matches. For the competitive gap reuse the Brand Analytics export from step 4c
   (or pull it now for the main queries): your product is in the gap when it is not in
   the top three clicked products; take its own click share from SQP.
9. **Coverage + backend-keyword + attribute audit:**
   - Tokenise title + item highlight (`title_differentiation`) + bullets + backend
     terms (`generic_keyword`). Flag the high-value SQP queries (from step 4) whose
     words appear in none of them - a concrete "add to your Search Terms" fix. A term
     that sits in the item highlight is covered. If no buyable SKU of the ASIN has any
     `generic_keyword`, flag that as a clear miss; an empty offer-only SKU next to a
     filled one is not a miss.
   - **Empty-attribute gaps:** for the SKU's `product_type`, list expected fields that
     are missing or empty (at minimum `bullet_point`, `product_description`,
     `generic_keyword`, `main_product_image_locator`) - "death of null". No export
     holds the full field list of a product type: beyond that minimum, label the gaps
     "likely empty, not confirmed" unless the user has loaded the product type
     definition. Also flag values that contradict the product (a unit of grams on a
     liquid, a pack weight that matches one unit of a multipack).
   - Match everything by marketplace (`marketplace_id`) so a multi-marketplace ASIN's
     keywords/attributes don't bleed across markets.
   - Check price vs `featuredoffer_price` and `available` if pulled; flag listing
     `issues[]` / suppressions (don't just add keywords to a blocked listing).
10. **Rewrite (2026-compliant, upload-ready):**
    - **Size it to the finding.** If the cause check says the listing is not the
      cause, or the listing already covers its high-value queries, give only the
      changes the data supports and say that copy is not the fix. Do not produce a
      full rewrite for its own sake.
    - **Language.** Write the copy in the marketplace language. If the user writes in
      another language, add a translation under each line.
    - **Claims.** Never add a regulated claim (disinfects, antibacterial, medical,
      safety) that the current listing does not already make. Carry existing ones over
      unchanged and tell the user to check them against the label.
    - **Facts.** Never invent a product fact the listing does not state (a size, a
      material, a quantity). Write a clearly marked placeholder and ask the user.
    - **Title that is already compliant.** Do not change it only to move the brand
      first, and do not change it when the user confirms the copy changed during or
      after the data. Offer the brand-first version as an option to test later.
    - **Item highlight** (`title_differentiation`): it is shown next to the title in
      search results. When the click rate is the problem, propose a new one as an
      option to test, built from the themes that convert, at most 125 characters
      (Amazon's published limit, July 2026). Say that whether the field is open depends
      on the marketplace and product type, which DataDoe cannot confirm. Otherwise
      leave it unchanged unless the user asks.
    - **Title <= 75 chars**: brand first, then the single best-converting theme, then
      audience/use-case. One keyword each, no repetition, no promo/subjective words, no
      banned symbols. This is a precision line, not a keyword dump.
    - **5 bullets**: each answers a customer question / covers a distinct COSMO
      dimension; benefit first, then the feature that proves it and the context it's
      used in; keep any legally required text; distinct keywords across the five.
    - **Backend search terms**: fill the byte cap (commonly just under 250 bytes;
      DataDoe cannot confirm the cap, so tell the user to check it before upload) with
      the relevant terms that did NOT fit the title/bullets - this is
      now where most keyword coverage lives; no title repeats, no brand/competitor
      names, include synonyms, misspellings, other-language terms.
    - **Attributes**: list the empty structured fields to fill (audience, intended use,
      occasion, material, etc.) - "death of null".
11. **Set a measurement plan:** ship the single highest-impact change first (usually
    the title), then wait - semantic/indexing changes take days to a few weeks to
    reflect. Re-run this skill and compare the same queries. Don't change everything at
    once.

## Copy rules (Amazon 2026 policy + best practice, marketplace-safe)

- **Title (<= 75 chars, non-media):** brand first; primary converting keyword early;
  readable human phrase, not a list; each word appears at most twice (prepositions,
  articles, conjunctions exempt) and real keywords ideally once; no promotional words
  ("best", "sale", "#1", "free shipping"), no subjective claims, no ALL-CAPS blocks;
  banned symbols `! $ ? _ { } ^ ¬ ¦` unless part of the brand, and `~ # < > *` only for
  a style identifier or a measurement; capitalise the first letter of each major word
  in English, and follow the marketplace language's own spelling rules elsewhere.
  If the current title is over 75 chars, treat compliance as an urgent fix (Amazon will
  otherwise auto-rewrite it).
- **Bullets:** 5, benefit first then the proof feature and the use context; one COSMO
  dimension / customer question each; distinct keywords across the five; keep required
  regulatory/safety text; no keyword-stuffing.
- **Backend search terms:** read them from the `generic_keyword` column of `amazon_listings_raw` (the same text sits inside `attributes`). They are not a column on `amazon_products_by_child_asin`. Fill the marketplace byte cap; NO words
  already in the title/bullets; no brand or competitor names; synonyms, misspellings,
  other-language terms; space-separated, no commas needed.
- **Attributes:** fill every relevant structured field (audience, use, occasion,
  material, scent, etc.) - empty fields are COSMO knowledge gaps.
- **Localize:** marketplace language + currency; never reuse another marketplace's copy.

## What the data can't see - flag these to check manually

- **Organic search position and indexing** - SQP cannot establish either. Search Query
  Score is relative query performance for one ASIN, and SQP shares do not isolate
  organic visibility. Verify positions or indexing separately if needed.

- **Main image + image count** - a below-market CTR is very often the main image; aim
  for a clean main image plus 6-7+ images with use-case/infographic content (COSMO now
  reads use-case imagery, not decorative icons).
- **A+ Content / Brand Story / video** - major CVR + intent-coverage levers; use A+
  comparison charts to answer "how does it compare".
- **Star rating + review count/velocity** - a below-market CVR with good copy is often a
  reviews problem.
- **Price / coupon / deal / badges** - pull `featuredoffer_price` if available, else
  verify price and whether a coupon/Best-Seller badge would lift CTR/CVR.
- **Compliance** - never invent claims (medical, "cures", etc.); keep required
  regulatory text; restricted-claim categories (supplements, biocides, medical devices)
  need extra care.

## Output format

```
Listing Optimizer - {ASIN} - {marketplace}   (displayed title {chars}/75 chars {FLAG if >75})
{if submitted != displayed: "Submitted item_name is {chars}/75 but Amazon displays a different {chars}-char title - contribution not shown."}
SQP coverage: {n} weeks present ({first}..{last}), latest {age} weeks old{; "snapshot mode" / "monthly fallback" if < ~4 weeks}
CAUSE CHECK
  offer: {Buy Box {x}%, units steady | Buy Box {x}% in week of {date} | no units shipped and Buy Box {x}% in week of {date} | note: no units shipped in week of {date}, Buy Box held - check stock}
  your other products on "{query}": {{asin} gained {p} of the {q} points | none of yours gained | not checked}
  searches: {b} -> {a} a week · shoppers now click: {same kinds of product | {other kind}, from Brand Analytics, department {d} | not checked}
  ads (Sponsored Products and Display): clicks {b} -> {a} a week {| not checked} · query words in the listing: {yes/no}
  listing last updated {date}{, during or after the last SQP week: what changed is unknown}
{if the listing is not the cause: "Copy is not the cause of this drop: {reason}. The changes below are small."}

THEME CHECK (what actually converts)
  theme            searches/wk   your CVR   CTR vs mkt   in title?   -> action
  {best theme}     {v}           {cv}%      {x}x         NO          add to title (headline)
  ...

FUNNEL DIAGNOSIS (top queries, vs market)
  query   searches/wk   shown per search   impr-share   yourCTR/mkt   cart%   yourCVR/mkt   verdict
  ...
WEEK BY WEEK (main query, when it moved): {week}: yourCTR/mkt {x}% / {y}%, query score {n} (context) ...

EXPOSURE UPSIDE (you win but aren't seen)
  {kw}: shown {n} times per 100 searches, CTR {x}x market, CVR at/above market -> investigate ads / offer / stock / keyword coverage

INTENT COVERAGE (COSMO): WHO {y/n} · WHAT-does {y/n} · WHERE/WHEN {y/n} · WHAT-is {y/n} · PAIRS/COMPARE {y/n}
RUFUS-READY: for-whom {y/n} · problem {y/n} · made-of {y/n} · compare {y/n} · objections {y/n}

COMPETITIVE GAP (only if Brand Analytics available)
  {term}: top clicked {product} {y}% of clicks; you {x}% (from SQP), {in / not in} the top three   [or: "Brand Analytics not enabled - skipped."]

KEYWORD COVERAGE: {covered}/20 top queries (by impressions, without competitor brands) in the listing; word forms count as covered
  Missing (relevant): {kw (vol, impression share)} -> {title/bullet/backend}
EMPTY ATTRIBUTES to fill: {field, field, ...}
CHECK MANUALLY (data can't see): main image / images / A+ / rating / price-coupon

--- UPLOAD-READY (paste into listing / flat file) ---
item_name (Amazon listing attribute for catalog `product_name`, {chars}/75):
  {new title, <=75 chars, compliant}
bullet_point1..5:
  1) {benefit + proof + context, one COSMO dimension}
  ...5
generic_keyword (backend search terms, {bytes}/{cap}; today {n} of its words repeat the title, item highlight or bullets - exact words, not counting articles and prepositions):
  {relevant terms not in title/bullets}
attributes_to_fill:
  {audience=..., intended_use=..., occasion=..., material=...}

FIX FIRST (by impact, measurable)
  0) {only when shoppers moved to another kind of product that you sell: put {your product} in front of that query (ads) - this comes before any copy change; if that product has no stock or Buy Box in its latest week: "restock {your product} first"}
  1) {title: add best-converting theme / bring under 75 chars (headline)}
  2) {below-market CTR on "Y" -> new main image + title hook}
  3) {exposure: you win "Z" but see {s}% -> investigate ads / offer / stock / keyword coverage}
  Measure: ship #1 now, allow days-to-weeks for re-index, re-run and compare.
```

## Worked example (illustrative)

An odor spray out-clicks the market ~3x on the "against odor" theme and converts well,
but "odor" is absent from the title -> **headline fix**: since the title now holds only
75 chars, spend them on brand + "against odor" + the product type, and push the rest of
the keywords into bullets and backend. On two of its best terms it is shown in only
about a third of the searches while beating market CTR and CVR -> **exposure upside**:
investigate ads, offer, stock and keyword coverage before rewriting copy. (On its main
term it holds 5% of impressions, which is about once in every search: no exposure
problem there.) A "disinfectant" theme clicks at market rate but converts below
market -> a **page/trust** fix (and a defensible claim only if the product qualifies).
The intent audit shows the listing never says WHERE it's used or WHAT it pairs with ->
add those to bullets for COSMO. Output: a compliant title, question-led bullets, a full
backend line, a list of empty attributes to fill, and a "do this first, measure in
days-to-weeks" plan - a diagnosis and the rewrite, not a keyword list.

## Quality self-check

- Is the rewritten title <= 75 characters, brand-first, one keyword each, no
  promo/subjective words, no banned symbols? Did I flag the current title if it's over -
  measured on the **displayed** `summaries.itemName`, not only the submitted
  `attributes.item_name`, and did I flag it when the two differ?
- Did I run the cause check first (offer, own-product swap, words already in the
  listing, listing edited after the data, fewer searches) and say so in the first lines
  when the listing is not the cause?
- Did I size the rewrite to the finding instead of rewriting everything?
- Does a swap name the product of mine that gained, and did I print every check I
  could not run as "not checked"?
- Did I weight the Buy Box by page views per ASIN and day, compare the same Brand
  Analytics department across weeks, and keep the ads line to the formats it covers?
- Did I judge exposure by impressions per search, not by the size of the impression
  share?
- Did I probe SQP coverage (`groupBy date`) before the funnel and state which weeks the
  analysis rests on, how stale they are, and whether I fell back to monthly / snapshot mode?
- Did I filter `amazon_products_by_child_asin` to the target marketplace?
- Did I benchmark each funnel stage against the market (not absolute numbers) and
  separate exposure (ads/offer/coverage) from copy (image/page) problems?
- Did I run the theme check first and put the best-converting theme in the title?
- Did I audit COSMO intent coverage (who/what-does/where-when/what-is/pairs) and the
  Rufus questions, and route missing keywords to bullets/backend/attributes?
- Did I use the cart-add stage to catch last-mile (price/Prime/stock) leaks?
- Did I apply the relevance guard before putting any term in the title?
- Do the 5 bullets each answer a question / cover a distinct dimension? Backend filled,
  no title repeats, no brand/competitor, within the byte cap? Empty attributes listed?
- Did I read the actual backend terms from `generic_keyword` (for the right
  marketplace), count the item highlight as covered text, and flag high-value SQP terms
  missing from all of them - without reporting an empty offer-only SKU as a gap?
- Did I keep every export grouped or limited so it fits a chat?
- Did I judge empty attributes against the SKU's `productType`, not a universal schema?
- Did I flag the blind spots (image, A+, rating, price) and keep compliance text?
- Did I give a measurement plan (one change first, days-to-weeks re-index, re-run)?

## Common mistakes

- Rewriting the copy of a product whose drop is the Buy Box, stock, price, a swap
  with another of your own products, or fewer searches.
- Presenting a full rewrite as the fix when the listing already covers its queries.
- Calling a 4% impression share "rarely shown". It is about once in every search.
- Reading the funnel as the current copy when the listing was edited after the last
  SQP week.
- Reporting a term as missing when it sits in the item highlight
  (`title_differentiation`).
- Reporting an offer-only SKU with no backend terms as a gap when another SKU of the
  ASIN carries them.
- Adding a regulated claim the listing did not already make.
- Writing a long, keyword-stuffed title - it now breaks the 75-char policy and COSMO
  flags it; Amazon may auto-rewrite it against you.
- Measuring title compliance on `attributes.item_name` alone - a 66-char submitted title
  can sit behind a 149-char displayed `summaries.itemName`; the displayed one is what
  Amazon enforces.
- Running the funnel on whatever SQP rows come back without checking coverage - one stale
  week dressed up as an 8-week trend, or 100 capped queries read as the whole market.
- Reading `amazon_products_by_child_asin` unfiltered and mixing another marketplace's
  title / bullets into the audit.
- Reading CTR/CVR as absolute numbers instead of against the market for that query.
- Treating Search Query Score as organic position or proof that a term is not indexed.
- Aggregating query scores into a "best organic rank" across periods or ASINs.
- Treating an exposure problem (you win but aren't seen) as a copy problem.
- Repeating a keyword across title/bullets/backend instead of covering a new intent
  dimension (breadth beats repetition).
- Leaving structured attribute fields empty ("death of null").
- Blaming copy for a below-market CVR that is really reviews or price.
- Ignoring listing issues/suppressions that block the listing regardless of copy.
- Assuming a fixed attribute schema across product types - expected fields differ by
  `productType`; judge gaps per type, and read backend terms from
  `attributes.generic_keyword[].value` (per marketplace), not a guessed field.
- Auditing whichever `amazon_listings_raw` row comes back first when an ASIN has multiple
  seller SKUs - always check `summaries.status` and audit the `BUYABLE` one(s); a rich but
  non-buyable sibling SKU is a real, easy-to-miss gap (good backend keywords sitting on a
  listing nobody can buy).
- Fluent AI-written copy with no structured intent signals - reads well, ranks poorly.
- Changing everything at once, then judging before the days-to-weeks re-index.
- Inventing medical/other restricted claims to win a keyword.

## Notes

- Read-only (analysis + copy). Applying the changes is a separate write skill via
  `AMAZON_LISTINGS_UPDATE` (dryRun-gated).
- Tuned for 2026 Amazon: 75-char title cap, COSMO intent ranking, Rufus / Alexa for
  Shopping. Built on DataDoe SQP (with market benchmarks), listing attributes + backend
  keywords (`amazon_listings_raw.attributes.generic_keyword`), catalog, search-term,
  inventory and (when available) Brand Analytics data.
