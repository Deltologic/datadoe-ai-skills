---
name: keyword-rank-sqp-tracker
description: >-
  Track your money keywords week over week - organic rank and, more importantly, your
  share of the query (impressions, clicks, purchases) - and flag the terms slipping,
  lost, rising or emerging before the sales drop shows up. Watches only the keywords
  you convert on, so the alert list is short. Degrades to a baseline on young accounts
  with little history. Live from DataDoe weekly Search Query Performance, read-only.
  Use for "keyword rank", "am I ranking", "search visibility", "rank tracker", "did my
  rank drop", "SQP", "search query performance", "losing rank", or "keyword trends".
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
  access: read
  category: Search & SEO
  interface: mcp
  output: report
---

# Keyword Rank & Share Tracker

Tracks how your important search queries move week over week - organic rank and, more
importantly, your **share of the query** (impressions, clicks, purchases) - and flags
the money keywords that are slipping before the sales drop shows up in your revenue. It
watches the terms you actually convert on, not every query, so the alert list is short
and worth acting on. Live from DataDoe's weekly Search Query Performance, read-only.

## When to use this

- Weekly SEO/visibility check: "am I losing ground on the keywords that matter?"
- Sales dipped on an ASIN and you want to see if it's a visibility/rank problem.
- After a listing edit, launch, or ad change, to watch the keywords respond.
- To spot an emerging query you're under-indexed on before competitors lock it.
- Trigger phrases: "keyword rank", "am I ranking", "search visibility", "rank
  tracker", "did my rank drop", "SQP", "search query performance", "losing rank",
  "keyword trends".

## The framework. Watch the money keywords, flag the slips

Rank alone can mislead (position can wobble while sales hold); the ground-truth signal
is **share of the query** - the slice of a query's impressions/clicks/purchases you
capture. Track both, weekly.

**Check history depth first (a tracker needs periods to compare).** SQP data lags the
present and only accumulates from the day the account connected, so a young or
recently-connected account may have very few periods:
- **>= 4 weekly periods** -> full trend mode (below).
- **< 4 weekly periods** -> pull the monthly SQP source as a longer-cadence fallback.
- **< 2 comparable periods either way** -> **baseline mode**: don't invent a trend.
  Report the current share/rank per money keyword as a baseline and state plainly
  "trend needs >= 4 periods; only N available - re-run weekly as history builds."
Never fabricate a trend from a single period.

When you do have the periods, track both, weekly:

1. **Pick the money keywords** - don't track everything. A query matters when it has
   real volume AND the ASIN actually converts on it (purchases over the window, or a
   meaningful click/purchase share). Rank the watch-list by volume x your purchase share.
2. **Build the weekly series** per money keyword: best organic rank, impression share
   (`child_asin_impression_count` / `search_query_total_impression_count`), click share,
   and purchase share, one point per week.
3. **Classify the movement** over the recent weeks (compare the latest 2-3 weeks to the
   prior 2-3, not week-to-week noise):
   - **Slipping** - impression share trending down and/or rank worsening on a money
     keyword. The alert that matters most: you're losing a term you monetise.
   - **Lost** - impression share collapsed to near zero or rank fell off (toward 100).
     Urgent: check suppression, stock-out, or a competitor takeover.
   - **Rising** - share/rank improving. Protect and scale (ads + keep the copy).
   - **Stable** - within normal wobble; ignore.
   - **Emerging** - a query whose total volume is growing where your share is low ->
     indexing/ads opportunity before it's locked up.
4. **Tie each flag to a lever**: slipping/lost money keyword -> check the listing
   (is the term still in title/backend?), rank/ads support, stock and buy-box; rising
   -> scale; emerging -> index it + test ads.

## Configuration

- MCP base: `https://mcp.datadoe.com/mcp/v1`
- Data source (resolve by table name with `exports_sources_get`):
  - `amazon_child_product_organic_search_ranks_per_week` (weekly SQP) - per query per
    week: `date` (week start; use several weeks for a trend), `search_query`,
    `search_query_volume`, `search_query_total_impression_count`,
    `child_asin_impression_count`, `child_asin_click_count`, `child_asin_purchase_count`,
    `child_asin_organic_search_rank` (1 = best, up to 100), and the
    `search_query_total_click_count` / `_purchase_count` for share math.
- Inputs: the target ASIN(s) (+ marketplace if multi). Optionally a specific
  watch-list of keywords; otherwise the skill derives the money-keyword list itself.
- Note on rank: the SQP organic rank is a per-query position signal for the ASIN and
  can tie across ASINs; treat **share of the query** as the primary truth and rank as a
  supporting signal, not the other way round.

## Step-by-step workflow (MCP-native)

1. `sellers_and_vendors_list` -> pick the seller; get the target ASIN(s).
2. `exports_sources_get` -> confirm the weekly SQP source is `enabled`. **Then check
   history depth**: count the distinct `date` (week) values available for the ASIN. If
   fewer than 4 weeks, also pull the monthly SQP source
   (`amazon_child_product_organic_search_ranks_per_month`) for a longer view; if still
   under 2 comparable periods, run **baseline mode** (report current share/rank + the
   "not enough history yet" notice) and stop there.
3. **Pull the weekly series:** `exports_create` on the weekly SQP source filtered to the
   ASIN over a multi-week window (>= 8 weeks so a trend is visible), columns
   `date, search_query, search_query_volume, search_query_total_impression_count,
   child_asin_impression_count, child_asin_click_count, child_asin_purchase_count,
   search_query_total_purchase_count, child_asin_organic_search_rank`. (Do not aggregate
   away `date` - you need the weekly points.)
4. **Build the money-keyword watch-list:** aggregate to per-query totals, keep queries
   with real volume and non-trivial purchase share, rank by volume x purchase share.
5. **Per money keyword, compute the weekly series** (rank, impression share, click
   share, purchase share) and the recent-vs-prior trend.
6. **Classify** each as slipping / lost / rising / stable / emerging using the trend,
   and attach the lever; **report** the slips first (money at stake), then losses,
   risers and emerging - a short, ranked alert list, not a data dump.

## Output format

```
Keyword Rank & Share Tracker - {ASIN} - {marketplace} - last {N} weeks

SLIPPING (money keywords losing ground - act first)
  query              vol    impr-share (wk-3 -> now)   rank (wk-3 -> now)   your CVR   lever
  {kw}               {v}    12% -> 6%                   8 -> 19              {cv}%      term still in title? add ads
  {kw}               {v}    9%  -> 5%                    5 -> 11              {cv}%      check stock / buy-box

LOST (visibility collapsed - urgent)
  {kw}   impr-share ~0 / rank ~100  -> check suppression, stock-out, competitor

RISING (protect + scale)
  {kw}   4% -> 9% impr-share, rank 22 -> 9

EMERGING (growing query, low share - index it)
  {kw}   query volume +{x}%, your share {s}% -> add to backend/title, test ads

Stable: {count} money keywords holding.
```

Baseline mode (young account - not enough history for a trend):

```
Keyword Rank & Share Tracker - {ASIN} - {marketplace} - BASELINE ({N} period(s) only)

Not enough SQP history for a trend yet ({N} period(s); need >= 4 weeks). Current baseline:
  query              vol    impr-share   your CVR   best rank
  {kw}               {v}    {s}%         {cv}%      {r}
  ...
Re-run weekly - the tracker turns on trend/slip detection once >= 4 weeks accumulate.
```

## Worked example (illustrative)

Tracking eight weeks for an ASIN, most money keywords hold, but one high-volume term
the ASIN converts well on drops from ~12% impression share to ~6% while its rank slides
from single digits into the teens -> flagged **slipping**, top of the list, with the
lever "confirm the term is still in the title/backend and add ad support." A second term
falls to near-zero share -> **lost**, urgent, routed to check suppression/stock. A third
climbs -> **rising**, protect and scale. A newly growing query where the ASIN barely
shows -> **emerging**, index it. The output is a five-line alert list, ordered by what
costs money, not a spreadsheet of every keyword.

## Quality self-check

- Did I track only money keywords (volume x purchase share), not every query?
- Did I lead with share of the query and use rank as support (not the reverse)?
- Did I compare recent weeks to prior weeks (trend), not react to one week of wobble?
- Did I pull enough weeks (>= 8) for a real trend?
- Did I route each slip/loss to a concrete lever (title/backend, ads, stock/buy-box)?
- Did I keep it per marketplace (a term can slip in one and hold in another)?

## Common mistakes

- Tracking every keyword - the alert list must be short (money keywords only).
- Reacting to single-week noise instead of a multi-week trend.
- Trusting rank over share - share of the query is the outcome that pays.
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
