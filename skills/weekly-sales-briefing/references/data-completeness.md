# Data completeness: anchor day, windows, effective days

`scripts/compute-briefing.js` implements these rules. Apply them by hand when you can't run
code, and keep the numbers below exactly as written so both paths give the same card.

## Why anchor on the last complete day

Calendar windows counted back from "today" include partial days and fake a collapse:

- **Sales** on the profit tables are shipped-order sales and run **~1 day behind**. They refresh
  intraday (10am / 1pm / 4pm), so the newest day is still filling.
- **Traffic** (`total_sessions`, `total_page_views`, `avg_buybox_percentage`) comes from Amazon's
  Sales and Traffic report. Amazon says up to 3 days behind; a UK account measured 11–13 days
  with holes. It can be revised for up to 30 days.
- Mid-window gaps still happen.

## Calibration pull

One export on `amazon_profit_by_date` (see SKILL.md step 1 for the request) over the last
~50 days. That is the lag plus 35 days, so it also covers the window 4 weeks back, which a
30-day pull misses. Rows are per date **and currency**.

- Use one currency: the marketplace currency (table below). If it is missing, use the currency
  with the most sales. Ignore rows whose `currency` is empty (they carry no sales). If a seller
  has sales in several currencies, say so and keep one currency per card.
- Medians are taken over the days that have a row in that currency.

## Sales-present day

A day is **sales-present** (complete) when all three hold:

1. `sales` ≥ 60% of the median daily `sales` over the span (relative per account, never a fixed
   amount);
2. `units` ≥ 60% of the median daily `units`;
3. `unshipped` ÷ (`sales` + `unshipped`) ≤ 10%. A day above 10% is still filling even when it
   passes the 60% tests (observed: a day at 74% of median sales with 18.5% unshipped flipped the
   week-over-week sign).

A date with no row is not present. Expect the newest day, sometimes two, to fail: that is the
normal ~1-day lag, not an outage. A failing day inside the span is a gap.

## Traffic-present day

Judged **separately**: `sessions` ≥ 60% of the median of the non-zero daily `sessions`. The
traffic-complete day is the last traffic-present day on or before the sales anchor. This briefing
is sales-only; if you show any traffic or rate figure, compute it from traffic-present days only
and say so on the card.

## Last complete day (the anchor)

1. Split the sales-present days into runs of consecutive dates.
2. Walk the runs from newest to oldest. Take the **end of the first run whose 7-day window
   (the run's end and the 6 days before it) has at least 6 sales-present days**. Count every
   sales-present day in that window, including days from the run before a one-day gap, not
   just the run's own days.
3. If no run qualifies, anchor on the latest sales-present day and mark **every** window
   provisional.

This skips an isolated day after a hole (present 08-30..09-20, hole 09-21..09-24, isolated
09-25: the 7 days ending 09-25 have only 3 present days, so the anchor is 09-20, not 09-25;
anchoring on 09-25 would print a 3/7 week and a fake −58%). One missing day inside a week does
not move the anchor; it lowers that window's effective days instead.

## Windows

| Window | Dates |
| --- | --- |
| This week | the 7 days ending on the anchor |
| Last week | the 7 days before that |
| Last month (same window) | the same 7 days, 4 weeks (28 days) before this week |

All three must sit inside the calibration span; if one doesn't, widen the calibration pull.

## Effective days and provisional windows

- A window's **effective days** = its sales-present days (out of 7). Never assume all 7 are there.
- A window with fewer than 7 is **provisional**. Check all three windows: an under-counted last
  week fakes a boom just as a partial this week fakes a collapse.
- A comparison involving a provisional window uses a **per-present-day basis scaled to 7 days**:
  (revenue ÷ effective days) × 7 on both sides. Label it provisional and never present a
  partial-week delta as a real move.
- A window with 0 effective days can't be compared: show "n/a".

## Export checks

- **Truncation**: if a window export returns as many rows as its `limit`, the catalog is larger
  than the cap. Say so and don't treat the totals as complete.
- **Reconciliation**: a window's export total should match the calibration's `sales` summed over
  the same dates and currency. A gap above 2% means an export was truncated or filtered; report it.

## Change direction

A change of +1% or more is up (green), −1% or less is down (red), anything between is flat
(neutral). When the previous value is 0 the % change is "n/a" and the direction follows the sign
of the amount.

## Currency by marketplace

`sellers_and_vendors_list` returns `UK` where table rows say `GB`; map both.

| Marketplace | Currency | Symbol |
| --- | --- | --- |
| UK / GB | GBP | £ |
| DE, FR, IT, ES, NL, BE, IE | EUR | € |
| US | USD | $ |
| CA | CAD | CA$ |
| MX | MXN | MX$ |
| BR | BRL | R$ |
| SE | SEK | kr |
| PL | PLN | zł |
| TR | TRY | ₺ |
| AE | AED | AED |
| SA | SAR | SAR |
| EG | EGP | E£ |
| ZA | ZAR | R |
| IN | INR | ₹ |
| JP | JPY | ¥ |
| AU | AUD | A$ |
| SG | SGD | S$ |
