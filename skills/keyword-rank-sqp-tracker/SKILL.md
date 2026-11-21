---
name: keyword-rank-sqp-tracker
description: >-
  Find where you are losing search share on the keywords you sell on - for the whole
  store or for one product - week over week, from your share of each query's
  impressions, clicks and purchases. Before it raises an alarm it checks the cause:
  fewer searches, a swap between your own products, stock / Buy Box / price, or a real
  loss at the impression, click or purchase stage. Watches only the keywords you
  convert on, so the list is short. Degrades to a baseline on young accounts with
  little history. Live from DataDoe weekly Search Query Performance, read-only. Use for
  "keyword rank", "am I ranking", "search visibility", "rank tracker", "did my rank
  drop", "SQP", "search query performance", "losing rank", "losing share", or "keyword
  trends".
metadata:
  title: Search Query Performance & Share Tracker
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  access: read
  category: Search & SEO
  interface: mcp
  output: report
---

# Search query performance and share tracker

Tracks your **share of the search queries you sell on**, week over week, for the whole
store or for one product. For every drop it says which stage moved (shown, clicked,
bought) and checks the cause before it calls the drop a loss: many "lost keywords" are
fewer searches, a swap between two of your own products, or a stock or Buy Box problem.
It watches the queries you actually convert on, so the list is short. Live from
DataDoe's weekly Search Query Performance (SQP), read-only.

## When to use this

- Weekly visibility check: "where am I losing ground on the keywords that matter?"
- Sales dipped on a product and you want to know whether search share moved.
- After a listing edit, launch, or ad change, to watch the keywords respond.
- Before a listing rewrite, to check that the listing is the cause.
- Trigger phrases: "keyword rank", "am I ranking", "search visibility", "rank
  tracker", "did my rank drop", "SQP", "search query performance", "losing rank",
  "losing share", "keyword trends".

## The framework. Share by stage, cause before alarm

### 1. What a share is, and how to read it

For one product on one query, a share is the product's count divided by the query's
total count:

- **Impression share** = `child_asin_impression_count` / `search_query_total_impression_count`
- **Click share** = `child_asin_click_count` / `search_query_total_click_count`
- **Purchase share** = `child_asin_purchase_count` / `search_query_total_purchase_count`

Sum the counts over a window first, then divide. Report a zero denominator as
unavailable.

**Impression share is small by nature.** One search shows many products. On one German
account (November 2026) a search produced 23 to 32 product impressions, and a product
shown about once in every search held 3.5% to 6% of them. So never call a share "low"
from its size. Compare the product with itself over time, and to say how often it is
shown use **impressions per search** = `child_asin_impression_count` /
`search_query_volume` (about 1 means once in every search).

Amazon's **Search Query Score** ranks queries against other queries for the same
product; 1 is highest. It is not the product's position in search results. Show it as
context per week; never use it to trigger an alert, and never take a minimum, sum or
average across weeks or products. SQP counts mix organic and sponsored results, and a
purchase is counted only when it follows a search on that query, so SQP purchases are
far below units sold.

### 2. Weeks and windows

- An SQP week runs Sunday to Saturday; `date` is the Sunday. Amazon publishes a week
  after Monday 12:00 UTC, so the newest week in the table is the latest complete week.
- Use the **unbroken run of weeks that ends at the newest week**. A missing week ends
  the run; weeks before the gap are not used. If the user asked for more weeks than the
  run holds, say how many there are in the first line of the answer.
- Compare two windows of equal length that touch each other:

  | Weeks in the run | "After" window | "Before" window |
  |---|---|---|
  | 8 or more | latest 4 weeks | the 4 weeks before them |
  | 6 or 7 | latest 3 weeks | the 3 weeks before them |
  | 4 or 5 | latest 2 weeks | the 2 weeks before them |

  Name the weeks of both windows in the answer. A week of the run that falls outside
  both windows is not used in the store view.
- Fewer than 4 weeks: pull the monthly source and compare the latest month with the one
  before. Fewer than 2 comparable periods either way: **baseline mode** - report the
  current shares and say "a trend needs at least 4 weeks; only N available". Never
  build a trend from one period.

### 3. Products first, then their money keywords

- **Screen products on the server.** Rank products by the purchases they lost between
  the windows, counted over all their tracked queries, and look closer at the 10 with
  the largest loss (at least 5 purchases lost). On a tie at 10th place keep every tied
  product and say so.
- A **money keyword** is a query on which one of those products has at least 5
  purchases in the two windows together. Keep at most the 8 strongest per product (on
  a tie, the one with more searches). Choose keywords on both windows together:
  choosing on the earlier window alone makes every keyword look as if it fell.
- Leave out **head terms**: pairs where the product holds under 0.5% of the query's
  impressions in both windows. A few purchases on a huge generic query say nothing
  about share, and their totals swamp every sum.
- A pair is **comparable** when it has a row in at least 2 weeks of each window.
  Amazon's report holds at most 100 queries per product and week, so a missing row
  means "not in that week's list", not zero. Leave pairs that are not comparable out
  and count them.
- A product with no money keyword sells on many small queries. Do not judge its
  shares; it still gets the offer check, and without an offer cause it gets "no clear
  cause - spread over small queries".

### 4. Three stages, with floors

For every comparable pair, and for every product (its comparable pairs summed), work
out the three shares in each window. Searches per week = `search_query_volume` summed
over the pair's weeks, divided by the weeks it has; for a product, add up its pairs.

A stage is **down** when its share fell by 20% or more of its earlier value and the
earlier window holds at least this much at that stage: 500 impressions, 20 clicks, 10
purchases. Judge a pair on its own counts and a product on its summed counts. **Up**
mirrors it; anything between is **held**. Under the floor the answer is "too few to
call" - a watch item, never a loss.

### 5. Cause before alarm

Give each of the 10 products one cause, judged on the product's summed stages
(framework 4); a single keyword whose stage fell is shown as detail, not as the cause.
Check in this order; the first that fits wins.

| # | Cause | How to tell | What it means |
|---|---|---|---|
| 1 | **Offer** | In an "after" week no units were sold; or the Buy Box average of an "after" week is under 90% and at least 5 points under the "before" average; or the average price paid rose by 5% or more while units fell | Stock, Buy Box or price. Fix the offer; the listing is not the cause |
| 2 | **Swap between your own products** | A stage is down, and at the earliest stage that fell (impressions before clicks before purchases) all your tracked products together fell by less than 10%, or rose, on the same queries | Another of your products took the place. Decide which should lead |
| 3 | **Shown less** | Impression share is down | Check that the query's words are in the title, bullets and backend terms, and whether ads still run on it |
| 4 | **Clicked less** | Impression share held, click share is down | What shoppers see in the results: main image, title, price, rating, badge |
| 5 | **Bought less** | Click share held, purchase share is down | The product page: price, reviews, bullets, images, delivery promise |
| 6 | **Fewer searches** | No stage is down and searches per week are down 15% or more | Demand or season. Nothing to fix |
| 7 | **No clear cause** | None of the above fits, every move sits under the floors, or the product has no money keyword | A small or mixed move. Watch |

Notes that go next to the cause:

- **Buy Box low all along.** Under 90% in both windows without the 10-point drop is a
  standing problem, not the cause of this drop. Say so and go on to the next check.
- **Average price paid** is sales divided by units, so it also moves when the mix of
  SKUs under one ASIN changes. Say "average price paid rose" and ask the user to check
  the price.
- **A swap explains the place, not always the whole drop.** If your products together
  also lost 10% or more at a later stage on those queries, say that too.
- **Partly a swap.** If your products together fell by 10% or more but one other
  product of yours gained at least half of what the flagged product lost at that stage
  on the same query, keep the cause and add: "{product} gained {n} of the {m}".
- When the product that gained has the same `parent_asin`, call it another variation
  of the same listing.
- Prices are in the marketplace currency (`sellers_and_vendors_list`).

Causes 3 to 5 are real losses of share. Causes 4 and 5, and cause 3 when the query's
words are missing from the listing, are the cases to check with the Listing Optimizer:
it decides whether the copy is the cause, or the season, the ads, or a different kind
of product shoppers now click. Causes 1, 2 and 6 are not listing problems: say so
plainly.

### 6. Ranking and the listing case

Show the 10 products ranked by purchases lost, each with its cause. Then name the
biggest real loss of share (causes 3 to 5): the one with the largest count at the
stage that fell. That stage must clear its floor; say how many clicks or purchases the
case rests on, and when it is small, say so. Call it "the case to check with the
Listing Optimizer", not a listing problem: this skill does not read the listing, the
season or the ads. If no product has cause 3 to 5, say that none of the drops is a
listing problem.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data sources. Resolve each with `exports_sources_get`, passing the table name as
  `query` and `pageSize: 1` (the default page prints several long descriptions):
  - `amazon_child_product_organic_search_ranks_per_week` (weekly SQP), one row per
    product, query and week: `date`, `child_asin`, `search_query`,
    `search_query_volume`, `child_asin_impression_count`, `child_asin_click_count`,
    `child_asin_purchase_count`, `child_asin_search_query_score`, and the query totals
    `search_query_total_impression_count`, `search_query_total_click_count`,
    `search_query_total_purchase_count`. The totals and the volume repeat on every
    product row of the same query and week: sum them only inside one product-and-query
    pair across weeks, or take `max` per week.
  - `amazon_child_product_organic_search_ranks_per_month` - the same columns per month,
    for accounts with under 4 weeks.
  - `amazon_profit_by_sku_and_date` - the offer check: `total_units_sold`,
    `total_sales`, `avg_buybox_percentage` by `child_asin` and week. Premium table: an
    export costs 5 AI Tokens instead of 2, nothing else differs. Its Buy Box and
    traffic columns can lag by more than a week: an empty Buy Box next to units sold
    means "not published yet", not a lost Buy Box.
  - `amazon_products_by_child_asin` - `product_name` and `parent_asin`. It has a row
    per marketplace: filter `marketplace_country_code` (rows use `GB` for the United
    Kingdom).
- Inputs: none for the store view; one or more ASINs for the product view; optionally
  the user's own keyword list.
- A DataDoe seller id is one marketplace, so SQP exports need no marketplace filter.
- SQP exists only for the ASINs on the seller's SQP list (up to 252). If the weekly
  probe returns nothing, say that the list is empty or that Amazon has not delivered
  yet.
- **Keep every SQP export grouped and small.** A grouped export returns only the
  columns you ask for; raw SQP rows add about 230 characters of account columns each
  (350 raw rows came to 83,000 characters). With the steps below the product screen
  returns up to 100 short rows and no other export passes about 150 rows. An `in` value is a comma-separated list: leave out a query that
  contains a comma and say so.
- When a keyword export returns exactly `limit` rows, the cut falls inside a tie and
  is arbitrary: drop the rows at the smallest value on the list.
- `child_asin_organic_search_rank` is a deprecated name for the Search Query Score; do
  not use it.

## Step-by-step workflow (MCP-native)

Use the **store view** when the user names no product. It takes about 10 small exports
and never pulls raw rows: the server ranks the products, and the detail is pulled for
10 of them only.

1. `sellers_and_vendors_list` -> pick the seller.
2. **Weeks probe.** Confirm the weekly SQP source is enabled. Then one export on it
   from the Sunday 12 weeks before today to today, `groupBy: ["date"]`, with `countDistinct(child_asin)`,
   `count(search_query)` and `sum(child_asin_purchase_count)`. Find the unbroken run
   that ends at the newest week and set the two windows (framework 2). The weekly
   purchase sums give the store's search purchases before and after.
3. **Product screen.** Two exports, `groupBy: ["child_asin"]`,
   `sum(child_asin_purchase_count)` as `purchases`:
   - the "before" window, ordered by `purchases` descending, `limit: 100`;
   - the "after" window, filtered with `child_asin` `in` those products.

   Loss = before minus after. Take the 10 products with the most purchases lost,
   leaving out any that lost fewer than 5. A product outside the 100 lost at most the
   purchases of the 100th: if that is more than the 10th loss, say the screen may
   have missed a product.
4. **Money keywords.** One export over both windows together, filtered with
   `child_asin` `in` the 10 products, `groupBy: ["child_asin", "search_query"]`,
   `sum(child_asin_purchase_count)` as `purchases`, `having` `purchases >= 5`, ordered
   by `purchases` descending, `limit: 100`. Keep at most the 8 strongest per product.
5. **Before and after.** Two exports, one per window, `groupBy: ["child_asin",
   "search_query"]`, filtered with `child_asin` `in` the 10 products and `search_query`
   `in` the queries kept in step 4. Aggregations: `sum` of
   `child_asin_impression_count`, `search_query_total_impression_count`,
   `child_asin_click_count`, `search_query_total_click_count`,
   `child_asin_purchase_count`, `search_query_total_purchase_count` and
   `search_query_volume`, plus `count(search_query)` as the weeks present. Use only the
   pairs kept in step 4 (the two filters also return other combinations); drop head
   terms and pairs that are not comparable.
6. **Shares and floors.** Per pair and per product, work out the three shares and the
   searches per week for both windows and mark each stage down, up, held or too few
   (framework 4).
7. **Offer check.** One export on `amazon_profit_by_sku_and_date` for the 10 products
   over both windows, `groupBy: ["date", "child_asin"]` with `dateInterval: "WEEK"`
   (weeks start on Sunday, like SQP), `sum(total_units_sold)`, `sum(total_sales)` and
   `avg(avg_buybox_percentage)`. Average price paid = sales / units. Do not read the
   unfinished current week. This export can stay pending for a minute: poll
   `exports_get` until it completes.
8. **Your products together** (the swap check). Only for products with a stage down
   that the offer check did not explain. Take their money keywords where the share at
   that stage fell by 20% or more (floor or not), strongest first, at most 15 queries
   in total.
   - One export over both windows, filtered with `search_query` `in` those queries,
     `groupBy: ["date", "search_query"]`, `sum` of `child_asin_impression_count`,
     `child_asin_click_count` and `child_asin_purchase_count` (all your tracked
     products together) and `max` of the three query totals (the same on every row of
     a query and week). Sum the weeks of each window, then divide. For each flagged
     product, add up its own queries and compare the windows.
   - For each of those products (at most 5), one export filtered to its query with the
     largest fall, over both windows, `groupBy: ["date", "child_asin"]`, `sum` of the
     three counts. Divide each product's counts by that query's window totals from the
     first export: the product that gained is the one whose share at that stage rose
     the most (counts fall for everyone when searches fall). This export also decides
     "partly a swap".
9. **Names.** One export on `amazon_products_by_child_asin` for the 10 products and
   any product that gained in step 8, filtered to the marketplace: `child_asin`,
   `product_name`, `parent_asin`. Shorten long titles to brand, product and size.
   Translate names and queries only when the user asks: put the English next to each
   query and name where it appears.
10. **Assign causes and report** (framework 5 and 6).

**Product view** (the user names one or a few ASINs): skip step 3 and run steps 4 to
10 for those ASINs. Add one export for the week-by-week lines of the queries that
moved: `groupBy: ["date", "search_query"]`, filtered to the ASIN and at most 10
queries, the same sums plus `max(child_asin_search_query_score)`.

**Emerging queries** (growing searches where the product is barely shown) only when
the user asks: in the product view, compare searches per week between the windows for
queries where the product has impressions and at most 1 purchase.

When the user asks for a dashboard, show the same content in the same order: the
header, the product table, then the two short lists.

## Output format

Start with the weeks used. State once: "Search Query Score ranks queries for the same
product; it is not a position in search results. SQP mixes organic and sponsored
results."

```
Search Query Performance & Share Tracker - {store} - {marketplace}
Before = weeks of {dates}, after = weeks of {dates}{; "you asked for M weeks, the data holds N in a row"}.
Store: {b} -> {a} purchases after a search ({+/-x}%). Looked closer at the 10 products that lost the most.

PRODUCTS BY PURCHASES LOST (all their tracked queries)
  product             purchases     on its {n} money keywords: purchases / impr share / click share / purchase share   searches/wk   cause
  {name} ({asin})     {b} -> {a}    {b} -> {a} / {b}% -> {a}% / {b}% -> {a}% / {b}% -> {a}%                             {b} -> {a}    {cause}
  ...

REAL LOSSES OF SHARE (shown less / clicked less / bought less)
  {name}: {stage} on "{query}" {b}% -> {a}% ({count b} -> {count a}); Buy Box {x}%, price steady -> {lever}
  [or: "None. Every drop above is fewer searches, a swap between your products, or the offer."]

NOT A LISTING PROBLEM
  {name}: offer - Buy Box {x}% in the week of {date} / no units since {date}
  {name}: swap - "{query}" went to your {other product}; your products together {b}% -> {a}%
  {name}: fewer searches - "{query}" {b} -> {a} searches a week, shares held

Left out: {count} head terms, {count} pairs not comparable. Notes: {Buy Box low all along, cuts at a limit}.
Next: {one action per real loss; for the case to check: "run the Listing Optimizer on {asin}"}
```

Product view: the same header, then one line per money keyword with the three shares
before and after, searches per week, the cause, and the week-by-week impression share
for the queries that moved.

Baseline mode (not enough history for a trend):

```
Search Query Performance & Share Tracker - {asin or store} - {marketplace} - BASELINE ({N} period(s) only)

A trend needs at least 4 weeks; only {N} available. Current shares:
  query              searches/wk   impr share   click share   purchase share   query score
  {kw}               {v}           {s}%         {s}%          {s}%             {score}
Re-run weekly - the comparison turns on once 4 weeks are in.
```

## Worked example (illustrative)

A store with about 250 tracked products and seven weeks of data, so three weeks
against three. Search purchases for the store rose. The product that lost the most is
the best seller: every share held, but searches for its queries fell by a quarter ->
**fewer searches**, nothing to fix. The product with the sharpest fall in impression
share (2.6% to 0.3% on the main query) turns out to be a **swap**: another pack size
under the same parent took the place, and the seller's products together went from 15%
to 17% of that query's impressions. A third product sold no units in the newest week
-> **offer**, out of stock. A fourth lost clicks in the one week its Buy Box fell to
61% -> **offer**. A fifth lost purchase share with a Buy Box that was low all along:
the purchases went to another of the seller's products -> **swap**, with a note to fix
the Buy Box. One product is left with the Buy Box at 100%, a steady price, the same
impressions and half the clicks -> **clicked less**, the one case to hand to the
Listing Optimizer. Without the cause checks all six would have read as lost keywords.

## Quality self-check

- Did I state the weeks of both windows, and say so when the user asked for more than
  exist?
- Are the two windows the same length, touching, and inside one unbroken run?
- Did I choose the products on both windows together, and drop head terms?
- Did I leave out pairs with fewer than 2 weeks in a window instead of reading a
  missing row as zero?
- Did I apply the floors (500 impressions, 20 clicks, 10 purchases) before calling a
  stage down?
- Did every one of the 10 products get the offer check, and every product with a
  stage down the swap check, before I called it a loss?
- Did I look at click share and purchase share, not only impression share?
- Did I avoid calling an impression share "low" because of its size?
- Is every SQP export grouped and small (the screen about 100 rows, the rest under about 150)?
- Did I say how many clicks or purchases the listing case rests on?
- Did I keep Search Query Score as context only?

## Common mistakes

- Calling a product "lost" when another of your own products took its place.
- Blaming search for a product that was out of stock or lost the Buy Box.
- Calling a Buy Box that was low all along the cause of a new drop.
- Reading a season as a loss: purchases fall with searches while every share holds.
- Alerting on impression share only. A product can be shown as often and clicked half
  as often.
- Reading a 4% impression share as "rarely shown". It is about once in every search.
- Choosing products or keywords on the earlier window only, then finding that they
  all fell.
- Summing a product's shares over a huge generic query where it barely appears.
- Treating a missing row as zero share.
- Pulling raw weekly rows, or every keyword of the store. They do not fit a chat.
- Calling a move on 3 or 4 purchases.
- Treating Search Query Score as a position in search, or averaging it.
- Inventing a trend from one or two periods on a young account.

## Notes

- Read-only (analysis). Changing the listing is a separate write skill via
  `AMAZON_LISTINGS_UPDATE` (dryRun-gated); ad changes are the bid and keyword write
  skills.
- Pairs with the Amazon Listing Optimizer: this skill finds the product where the
  listing is the likely cause, that one audits the listing.
- Ads are not checked here. For a product that is shown less, look at its ad activity
  before changing the listing.
- The store view judges the 10 products that lost the most purchases. A product that
  lost share while its purchases held is not on that list: use the product view for
  it.
- The thresholds (5 purchases, 0.5% head-term line, 20% move, the three floors, 90% Buy
  Box) come from tests on one German account with about 250 tracked products in
  November 2026. Say which thresholds you used when the user asks how a product was
  judged.
- A DataDoe skill, built on DataDoe weekly Search Query Performance data.
