---
name: amazon-listing-optimizer
description: >-
  Optimize an Amazon listing from your own live data, tuned for 2026 Amazon (the
  75-character title cap, the COSMO intent layer and the Rufus / Alexa for Shopping
  assistant). It benchmarks your search funnel against the market to find whether
  you leak at impressions, clicks, cart-adds or purchases, separates an exposure
  problem from a copy problem, finds the converting themes your title forgot to say,
  audits intent coverage and listing health, and returns a rewritten, policy-safe,
  upload-ready title, bullets, backend terms and attribute fills. Live from DataDoe.
  Use for "optimize my listing", "listing optimization", "fix my title", "improve my
  bullets", "keyword gaps", "why isn't my listing ranking", "why isn't it
  converting", "backend keywords", "listing audit", or "is my listing Rufus ready".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
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
- **Your CTR** = `child_asin_click_count` / `child_asin_impression_count`, and the
  **market CTR** = `search_query_total_click_count` / `search_query_total_impression_count`.
- **Cart rate** = `child_asin_add_to_cart_count` / `child_asin_click_count`.
- **Your CVR** = `child_asin_purchase_count` / `child_asin_click_count`, and the
  **market CVR** = `search_query_total_purchase_count` / `search_query_total_click_count`.
- **Best organic rank** = `min(child_asin_organic_search_rank)`.

Then classify each high-value query:

1. **Exposure problem** - you win on CTR/CVR (at or above market) but impression share
   is low. The listing is good; it just isn't seen. **Fix: rank + ads**, not copy. The
   most-missed, highest-upside case.
2. **Discoverability / indexing** - low impression share AND weak rank on a relevant,
   high-volume query -> the term isn't indexed. **Fix: put it in a bullet / backend /
   attribute** (not necessarily the 75-char title), then rank.
3. **Click-rate (below-market CTR)** - impressions but CTR below the market CTR for
   that query -> main image / title / price / badge. (If CTR is low in absolute terms
   but at market, there is nothing to fix - don't chase it.)
4. **Conversion (below-market CVR, or cart-adds that don't convert)** -> bullets / A+ /
   images / price / Prime / reviews.
5. **Relevance guard** - low impression share AND below-market CTR AND below-market CVR
   is usually not your product. **Do not chase it into the title.**

### The single highest-leverage move: does your title say what converts?

Before rewriting anything, run this once - the most common, highest-ROI miss:
1. **Cluster** the queries into themes.
2. Per theme, sum volume and take the **CVR** and **CTR-vs-market**.
3. Find the theme with the **best conversion and real volume** - what buyers actually
   want from this product.
4. **Check whether that theme's words are in the title.** If your best-converting theme
   is missing, that is the #1 fix - and since the title now holds only 75 characters,
   it must earn its place with the single best-converting theme, not a keyword pile.

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
Mine 3-4 star reviews for the real audience language and objections.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources (resolve each by table name with `exports_sources_get`):
  - `amazon_child_product_organic_search_ranks_per_week` (SQP) - the funnel engine and
    the one required source. Per query: `search_query_volume`,
    `child_asin_impression_count` + `search_query_total_impression_count`,
    `child_asin_click_count` + `search_query_total_click_count`,
    `child_asin_add_to_cart_count`, `child_asin_purchase_count` +
    `search_query_total_purchase_count`, `child_asin_organic_search_rank`,
    `child_asin_median_click_price_value`/`_currency`.
  - `amazon_products_by_child_asin` - current `product_name` (title),
    `product_bullet_point_1..5`, `product_description`, `product_brand`, category,
    BSR, `product_image_url`, `marketplace_country_code`.
  - `amazon_listings_raw` - listing attributes, backend keywords, listing issues /
    suppressions, and **which attribute fields are empty** (the "death of null" gap
    COSMO penalises).
  - `amazon_ads_search_terms_by_campaign_by_date` - converting ad search terms (keyword
    harvest the organic SQP set may miss).
  - `amazon_fba_inventory_health` (optional) - `your_price`, `featuredoffer_price`,
    `lowest_price_new_plus_shipping`, `available` for a price/stock read (a CVR leak is
    often price or an out-of-stock, not copy).
  - `amazon_brand_analytics_search_terms_weekly` (Brand Registry only, optional) - top
    terms with #1-3 click/conversion share. If absent, **skip and say so** - never block.
- Inputs: the target ASIN/SKU (+ marketplace if multi).

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller; get the target ASIN.
2. `exports_sources_get` -> confirm sources; SQP is required, the rest degrade
   gracefully.
3. **Current listing:** `exports_create` on `amazon_products_by_child_asin` (+
   `amazon_listings_raw`) filtered to the ASIN -> title, bullets, description,
   attributes, backend keywords, issues, `marketplace_country_code`. Read the
   marketplace's caps now (Copy rules below).
4. **Funnel per query (the core):** `exports_create` on the SQP source for the ASIN
   over a full recent window (>= 8 weeks), grouped by `search_query`, pulling BOTH the
   `child_asin_*` and the `search_query_total_*` columns so you can benchmark against
   the market. Compute impression share, your-vs-market CTR, cart rate, your-vs-market
   CVR, best rank per query.
5. **Theme check (first):** cluster into themes, find the best-converting theme with
   real volume, check whether its words are in the title.
6. **Classify each high-value query** as exposure / discoverability / CTR / CVR /
   relevance using the market benchmarks. Split "you win but aren't seen" (rank+ads)
   from "you're seen but lose" (copy).
7. **Intent-coverage + Rufus audit:** score the listing on the COSMO dimensions and the
   Rufus questions above; note which are missing.
8. **Harvest + competitive gap:** pull converting ad terms; if Brand Analytics is
   available, find terms where a competitor takes the #1-3 share you should own; else
   skip and note it.
9. **Coverage + offer + health:** tokenise title + bullets + backend; flag high-value,
   relevant terms not covered and empty attribute fields; check price vs
   `featuredoffer_price` and `available` if pulled; flag listing issues/suppressions.
10. **Rewrite (2026-compliant, upload-ready):**
    - **Title <= 75 chars**: brand first, then the single best-converting theme, then
      audience/use-case. One keyword each, no repetition, no promo/subjective words, no
      banned symbols. This is a precision line, not a keyword dump.
    - **5 bullets**: each answers a customer question / covers a distinct COSMO
      dimension; benefit first, then the feature that proves it and the context it's
      used in; keep any legally required text; distinct keywords across the five.
    - **Backend search terms**: fill the byte cap (commonly ~250 bytes; verify per
      marketplace) with the relevant terms that did NOT fit the title/bullets - this is
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
  a style identifier or a measurement; capitalise the first letter of each major word.
  If the current title is over 75 chars, treat compliance as an urgent fix (Amazon will
  otherwise auto-rewrite it).
- **Bullets:** 5, benefit first then the proof feature and the use context; one COSMO
  dimension / customer question each; distinct keywords across the five; keep required
  regulatory/safety text; no keyword-stuffing.
- **Backend search terms (`generic_keyword`):** fill the marketplace byte cap; NO words
  already in the title/bullets; no brand or competitor names; synonyms, misspellings,
  other-language terms; space-separated, no commas needed.
- **Attributes:** fill every relevant structured field (audience, use, occasion,
  material, scent, etc.) - empty fields are COSMO knowledge gaps.
- **Localize:** marketplace language + currency; never reuse another marketplace's copy.

## What the data can't see - flag these to check manually

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
Listing Optimizer - {ASIN} - {marketplace}   (current title {chars}/75 chars {FLAG if >75})

THEME CHECK (what actually converts)
  theme            vol/mo   your CVR   CTR vs mkt   in title?   -> action
  {best theme}     {v}      {cv}%      {x}x         NO          add to title (headline)
  ...

FUNNEL DIAGNOSIS (top queries, vs market)
  query   vol   impr-share   yourCTR/mkt   cart%   yourCVR/mkt   rank   verdict
  ...

EXPOSURE UPSIDE (you win but aren't seen)
  {kw}: impr-share {s}%, CTR {x}x market, CVR at/above market -> push rank/ads first

INTENT COVERAGE (COSMO): WHO {y/n} · WHAT-does {y/n} · WHERE/WHEN {y/n} · WHAT-is {y/n} · PAIRS/COMPARE {y/n}
RUFUS-READY: for-whom {y/n} · problem {y/n} · made-of {y/n} · compare {y/n} · objections {y/n}

COMPETITIVE GAP (only if Brand Analytics available)
  {term}: your share {x}% (top competitor {y}%)   [or: "Brand Analytics not enabled - skipped."]

KEYWORD COVERAGE: {covered}/{topN} high-value terms in the listing
  Missing (relevant): {kw (vol, rank)} -> {title/bullet/backend}
EMPTY ATTRIBUTES to fill: {field, field, ...}
CHECK MANUALLY (data can't see): main image / images / A+ / rating / price-coupon

--- UPLOAD-READY (paste into listing / flat file) ---
item_name (title, {chars}/75):
  {new title, <=75 chars, compliant}
bullet_point1..5:
  1) {benefit + proof + context, one COSMO dimension}
  ...5
generic_keyword (backend, {bytes}/{cap}):
  {relevant terms not in title/bullets}
attributes_to_fill:
  {audience=..., intended_use=..., occasion=..., material=...}

FIX FIRST (by impact, measurable)
  1) {title: add best-converting theme / bring under 75 chars (headline)}
  2) {below-market CTR on "Y" -> new main image + title hook}
  3) {exposure: you win "Z" but see {s}% -> push rank/ads}
  Measure: ship #1 now, allow days-to-weeks for re-index, re-run and compare.
```

## Worked example (illustrative)

An odor spray out-clicks the market ~3x on the "against odor" theme and converts well,
but "odor" is absent from the title -> **headline fix**: since the title now holds only
75 chars, spend them on brand + "against odor" + the product type, and push the rest of
the keywords into bullets and backend. On its best terms it shows for only ~4% of
impressions while beating market CTR and CVR -> **exposure upside**: push rank/ads,
don't touch copy. A "disinfectant" theme clicks at market rate but converts below
market -> a **page/trust** fix (and a defensible claim only if the product qualifies).
The intent audit shows the listing never says WHERE it's used or WHAT it pairs with ->
add those to bullets for COSMO. Output: a compliant title, question-led bullets, a full
backend line, a list of empty attributes to fill, and a "do this first, measure in
days-to-weeks" plan - a diagnosis and the rewrite, not a keyword list.

## Quality self-check

- Is the rewritten title <= 75 characters, brand-first, one keyword each, no
  promo/subjective words, no banned symbols? Did I flag the current title if it's over?
- Did I benchmark each funnel stage against the market (not absolute numbers) and
  separate exposure (rank/ads) from copy (image/page) problems?
- Did I run the theme check first and put the best-converting theme in the title?
- Did I audit COSMO intent coverage (who/what-does/where-when/what-is/pairs) and the
  Rufus questions, and route missing keywords to bullets/backend/attributes?
- Did I use the cart-add stage to catch last-mile (price/Prime/stock) leaks?
- Did I apply the relevance guard before putting any term in the title?
- Do the 5 bullets each answer a question / cover a distinct dimension? Backend filled,
  no title repeats, no brand/competitor, within the byte cap? Empty attributes listed?
- Did I flag the blind spots (image, A+, rating, price) and keep compliance text?
- Did I give a measurement plan (one change first, days-to-weeks re-index, re-run)?

## Common mistakes

- Writing a long, keyword-stuffed title - it now breaks the 75-char policy and COSMO
  flags it; Amazon may auto-rewrite it against you.
- Reading CTR/CVR as absolute numbers instead of against the market for that query.
- Treating an exposure problem (you win but aren't seen) as a copy problem.
- Repeating a keyword across title/bullets/backend instead of covering a new intent
  dimension (breadth beats repetition).
- Leaving structured attribute fields empty ("death of null").
- Blaming copy for a below-market CVR that is really reviews or price.
- Ignoring listing issues/suppressions that block the listing regardless of copy.
- Fluent AI-written copy with no structured intent signals - reads well, ranks poorly.
- Changing everything at once, then judging before the days-to-weeks re-index.
- Inventing medical/other restricted claims to win a keyword.

## Notes

- Read-only (analysis + copy). Applying the changes is a separate write skill via
  `AMAZON_LISTINGS_UPDATE` (dryRun-gated).
- Tuned for 2026 Amazon: 75-char title cap, COSMO intent ranking, Rufus / Alexa for
  Shopping. Built on DataDoe catalog, listing, SQP (with market benchmarks),
  search-term, inventory and (when available) Brand Analytics data.
