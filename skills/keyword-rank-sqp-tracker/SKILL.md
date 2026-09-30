---
name: keyword-rank-sqp-tracker
description: >-
  Track your money keywords week over week using your share of each query
  (impressions, clicks, purchases), and flag the terms slipping,
  lost, rising or emerging before the sales drop shows up. Watches only the keywords
  you convert on, so the alert list is short. Degrades to a baseline on young accounts
  with little history. Live from DataDoe weekly Search Query Performance, read-only.
  Use for "keyword rank", "am I ranking", "search visibility", "rank tracker", "did my
  rank drop", "SQP", "search query performance", "losing rank", or "keyword trends".
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

Tracks how your important search queries move week over week using your **share of
the query** (impressions, clicks, purchases), and flags
the money keywords that are slipping before the sales drop shows up in your revenue. It
watches the terms you actually convert on, not every query, so the alert list is short
and worth acting on. Live from DataDoe's weekly Search Query Performance, read-only.

## When to use this

- Weekly SEO/visibility check: "am I losing ground on the keywords that matter?"
- Sales dipped on an ASIN and you want to check search-share changes; SQP does not
  measure organic search position.
- After a listing edit, launch, or ad change, to watch the keywords respond.
- To spot a growing, relevant query where your share is low.
- Trigger phrases: "keyword rank", "am I ranking", "search visibility", "rank
  tracker", "did my rank drop", "SQP", "search query performance", "losing rank",
  "keyword trends".

## The framework. Watch the money keywords, flag the slips

Use **share of the query** - the slice of a query's impressions/clicks/purchases you
capture - to track visibility and funnel performance. Amazon's **Search Query Score**
ranks queries relative to other queries for the same ASIN based on overall query
performance; 1 is highest. It does not measure the ASIN's organic search position.
Keep the score as per-period context; do not use its movement to trigger share alerts.

**Check history depth first (a tracker needs periods to compare).** SQP data lags the
present and only accumulates from the day the account connected, so a young or
recently-connected account may have very few periods:
- **>= 4 weekly periods** -> full trend mode (below).
- **< 4 weekly periods** -> pull the monthly SQP source as a longer-cadence fallback.
- **< 2 comparable periods either way** -> **baseline mode**: don't invent a trend.
  Report the current share and query score per money keyword as a baseline and state
  plainly: "trend needs >= 4 periods; only N available - re-run weekly as history builds."
Never fabricate a trend from a single period.

When you do have the periods, track shares weekly:

1. **Pick the money keywords** - don't track everything. A query matters when it has
   real volume AND the ASIN actually converts on it (purchases over the window, or a
   meaningful click/purchase share). Rank the watch-list by volume x your purchase share.
2. **Build the weekly series** per money keyword: Search Query Score for each ASIN
   and period, impression share
   (`child_asin_impression_count` / `search_query_total_impression_count`), click share,
   and purchase share, one point per week.
3. **Classify the movement** over the recent weeks (compare the latest 2-3 weeks to the
   prior 2-3, not week-to-week noise):
   - **Slipping** - impression share trending down on a money keyword; investigate
     the loss of share on a term that converts.
   - **Lost** - impression share collapsed to near zero with sufficient query volume.
     Check suppression, stock-out, buy-box and ads before assigning a cause; a missing
     query row or null score alone does not establish lost visibility.
   - **Rising** - share improving. Protect and scale (ads + keep the copy).
   - **Stable** - within normal wobble; ignore.
   - **Emerging** - a query whose total volume is growing where your share is low ->
     keyword coverage/ads opportunity to investigate.
4. **Tie each flag to a lever**: slipping/lost money keyword -> check the listing
   (is the term still in title/backend?), ads support, stock and buy-box; rising
   -> scale; emerging -> check keyword coverage + test ads.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data source (resolve by table name with `exports_sources_get`):
  - `amazon_child_product_organic_search_ranks_per_week` (weekly SQP) - per query per
    week: `date` (week start; use several weeks for a trend), `search_query`,
    `search_query_volume`, `search_query_total_impression_count`,
    `child_asin_impression_count`, `child_asin_click_count`, `child_asin_purchase_count`,
    `child_asin_search_query_score` (Amazon Search Query Score; 1 = highest query
    performance), and the
    `search_query_total_click_count` / `_purchase_count` for share math.
- Inputs: the target ASIN(s) (+ marketplace if multi). Optionally a specific
  watch-list of keywords; otherwise the skill derives the money-keyword list itself.
- Use `child_asin_search_query_score`. `child_asin_organic_search_rank` is a deprecated
  compatibility name for the same data and should not be used in new exports.
- Table names and this skill's identifier remain unchanged for compatibility. Neither
  the weekly nor monthly SQP source provides organic search position or separates
  organic and sponsored visibility.
- Keep scores per ASIN, marketplace and period. Do not take a minimum, sum or average
  across weeks or ASINs, or infer indexing or organic position from them.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller; get the target ASIN(s).
2. `exports_sources_get` -> confirm the weekly SQP source is `enabled`. **Then check
   history depth**: count the distinct `date` (week) values available for the ASIN. If
   fewer than 4 weeks, also pull the monthly SQP source
   (`amazon_child_product_organic_search_ranks_per_month`) for a longer view; if still
   under 2 comparable periods, run **baseline mode** (report current share and query
   score + the "not enough history yet" notice) and stop there.
3. **Pull the weekly series:** `exports_create` on the weekly SQP source filtered to the
   ASIN over a multi-week window (>= 8 weeks so a trend is visible), columns
   `date, search_query, search_query_volume, search_query_total_impression_count,
   child_asin_impression_count, child_asin_click_count, child_asin_purchase_count,
   search_query_total_click_count, search_query_total_purchase_count,
   child_asin_search_query_score`. (Do not aggregate away `date` - you need the
   weekly points.)
4. **Build the money-keyword watch-list:** aggregate counts to per-query totals within
   each ASIN and marketplace, keep queries with real volume and non-trivial purchase share, rank by volume x purchase share.
5. **Per money keyword, compute the weekly series** (query score context, impression
   share, click share, purchase share) and the recent-vs-prior trend. Calculate shares
   from summed counts for each comparison window; report a zero denominator as unavailable.
6. **Classify** each as slipping / lost / rising / stable / emerging using the trend,
   and attach the lever; **report** the slips first (money at stake), then losses,
   risers and emerging - a short, ranked alert list, not a data dump.

## Output format

Always state: "Search Query Score ranks queries for the same ASIN; it is not organic
search position. SQP shares do not isolate organic visibility."

```
Search Query Performance & Share Tracker - {ASIN} - {marketplace} - last {N} weeks

SLIPPING (money keywords losing ground - act first)
  query              vol    impr-share (wk-3 -> now)   query score (context)   your CVR   lever
  {kw}               {v}    12% -> 6%                   1 -> 1                 {cv}%      term still in title? add ads
  {kw}               {v}    9%  -> 5%                    5 -> 5                 {cv}%      check stock / buy-box

LOST (visibility collapsed - urgent)
  {kw}   impr-share ~0 with sufficient query volume  -> check suppression, stock-out, competitor

RISING (protect + scale)
  {kw}   4% -> 9% impr-share

EMERGING (growing query, low share - check relevance and coverage)
  {kw}   query volume +{x}%, your share {s}% -> add to backend/title, test ads

Stable: {count} money keywords holding.
```

Baseline mode (young account - not enough history for a trend):

```
Search Query Performance & Share Tracker - {ASIN} - {marketplace} - BASELINE ({N} period(s) only)

Not enough SQP history for a trend yet ({N} period(s); need >= 4 weeks). Current baseline:
  query              vol    impr-share   your CVR   query score
  {kw}               {v}    {s}%         {cv}%      {score}
  ...
Re-run weekly - the tracker turns on trend/slip detection once >= 4 weeks accumulate.
```

## Worked example (illustrative)

Tracking eight weeks for an ASIN, most money keywords hold, but one high-volume term
the ASIN converts well on drops from ~12% impression share to ~6% -> flagged
**slipping**, top of the list, with the lever "confirm the term is still in the title/backend and add ad support." A second term
falls to near-zero share -> **lost**, urgent, routed to check suppression/stock. A third
climbs -> **rising**, protect and scale. A newly growing query where the ASIN barely
shows -> **emerging**, check relevance and keyword coverage. The output is a five-line
alert list, ordered by what costs money, not a spreadsheet of every keyword.

## Quality self-check

- Did I keep scores and share series separate for each ASIN and marketplace?
- Did I track only money keywords (volume x purchase share), not every query?
- Did I use shares for alerts and label Search Query Score as relative query performance?
- Did I compare recent weeks to prior weeks (trend), not react to one week of wobble?
- Did I pull enough weeks (>= 8) for a real trend?
- Did I route each slip/loss to a concrete lever (title/backend, ads, stock/buy-box)?
- Did I keep it per marketplace (a term can slip in one and hold in another)?

## Common mistakes

- Tracking every keyword - the alert list must be short (money keywords only).
- Reacting to single-week noise instead of a multi-week trend.
- Treating Search Query Score as organic position, indexing proof, or an alert trigger.
- Combining scores across ASINs or periods into a "best rank".
- Treating a missing query row as zero share without checking export completeness.
- Flagging a "slip" that is really a stock-out or lost buy-box (traffic falls too) -
  check those before blaming SEO.
- Too short a window - you can't see a trend in two weeks of weekly data.
- Chasing an emerging query the ASIN has no real relevance to.
- Inventing a trend from one or two periods on a young account - run baseline mode and
  say so; the trend turns on as weeks accumulate.

## Notes

- Read-only (analysis). Fixing a slip (adding a term to the listing) is a separate
  write skill via `AMAZON_LISTINGS_UPDATE` (dryRun-gated); adding ad support is the
  bid/keyword write skills.
- Pairs with the listing optimizer (one-time funnel audit) - this is the ongoing
  week-over-week watch on the same SQP data.
- A DataDoe skill, built on DataDoe weekly Search Query Performance data.
