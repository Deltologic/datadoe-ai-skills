# Report data format

The card is `references/briefing-template.html` with one JSON object pasted into its
`<script type="application/json" id="briefing-data">` block, in place of `__BRIEFING_DATA__`.
`scripts/compute-briefing.js report` builds that object and `scripts/render-briefing.js` pastes
it in. Without code, build the same object by hand using the rules in
`references/data-completeness.md`, then paste it into a copy of the template. Inside the
pasted JSON, write every `<` as the six characters `\u003c`, so a product name can't close the
script block.

## Reading the window exports

Merge rows by `child_asin` before anything else: an ASIN can appear twice (for example once
with an empty `product_name` and 0 sales). Sum `sales` and `units`, and keep the first
non-empty `product_name`. Rows with an empty `child_asin` count toward the window total but are
never ranked.

## Fields the card uses

A hand-built object needs only these fields; the template ignores everything else. Money is in
the card currency, rounded to 2 decimals. Percentages are rounded to 1 decimal.

```json
{
  "header": {
    "title": "Delto UK Main Account — Weekly Sales Briefing",
    "subtitle": "12–18 Oct 2026 · this week 7/7 days present"
  },
  "currency": { "code": "GBP", "symbol": "£" },
  "kpis": {
    "thisWeek": { "value": 70808.78, "presentDays": 7, "provisional": false },
    "vsLastWeek": {
      "basis": "total",
      "change": -8870.68,
      "changePct": -11.1,
      "direction": "down",
      "comparable": true,
      "previous": 79679.46,
      "provisional": false
    },
    "vsLastMonth": { "...": "same shape as vsLastWeek" }
  },
  "topSkus": [
    { "rank": 1, "asin": "B06Y3F9DNZ", "name": "KAPS Nano Protector Waterproofing Spray…", "revenue": 7343.41, "units": 734 }
  ],
  "drops": {
    "provisional": false,
    "basis": "total",
    "items": [
      { "asin": "B086KXWTZR", "name": "6 Pair Pack Anti Odour Shoe Insoles Set…", "thisWeek": 1312.56, "lastWeek": 3518.07, "delta": -2205.51, "deltaPct": -62.7 }
    ]
  },
  "insights": ["Revenue fell 11.1% week over week; the 6-pair insole pack alone lost £2,206."],
  "footer": {
    "text": "Data via DataDoe · Generated 20 Oct 2026 · sales complete through 18 Oct 2026",
    "notes": []
  }
}
```

| Field | Rule |
| --- | --- |
| `header.title` | `<seller name from sellers_and_vendors_list> — Weekly Sales Briefing` |
| `header.subtitle` | this week's date range, then `this week N/7 days present`; when this week or last week is provisional: `this week N/7 days present, last week M/7 — provisional`. A provisional last-month window shows only on its KPI tile and in `footer.notes` |
| `kpis.thisWeek` | this week's total `sales`, its effective days, provisional when < 7 |
| `kpis.vsLastWeek`, `kpis.vsLastMonth` | `change` = this week − the other window, `changePct` = change ÷ the other window × 100 (`null` when that is 0), `previous` = the other window's total. `basis` is `per-present-day` when either window is provisional (then both sides are revenue ÷ effective days × 7), else `total`. `direction` is `up`, `down` or `flat` (±1% rule). `comparable` is `false` when either window has 0 effective days (then `change`, `changePct` and `previous` are `null`). `previous` is the other window on the same basis as `change` (scaled to 7 days on a per-present-day basis), so `change` = this week − `previous` on the card |
| `topSkus` | up to 5 ASINs with this week's revenue > 0, sorted by revenue (ties by ASIN). `name` is the ASIN when `product_name` is empty; a name longer than 40 characters becomes its first 39 characters, trailing spaces removed, plus `…` |
| `drops.items` | up to 3 ASINs with revenue in **both** this week and last week whose `delta` = this week − last week is negative, most negative first. On a `per-present-day` basis, each side is revenue ÷ effective days × 7. `deltaPct` = delta ÷ last week (same basis) × 100. `thisWeek` and `lastWeek` stay the raw window revenues |
| `drops.provisional` | `true` when this week or last week is provisional |
| `insights` | 1–2 one-sentence observations you write from the data (see SKILL.md step 6); required |
| `footer.text` | `Data via DataDoe · Generated <today> · sales complete through <anchor day>`, dates as `20 Oct 2026` |
| `footer.notes` | one line per provisional window: `This week reflects 6 of 7 days.` (`Last week …`, `Last month …`); then `<Window>'s export hit the <rows>-row limit, so its totals are incomplete.` for a truncated export (`<rows>` = the export's row count), `<Window>'s SKU total includes incomplete days, so its comparison is overstated.` when the export missed the date filter (rerun it rather than publish), `<Window>'s SKU total differs from the account total by <gap>%.` for any other reconciliation gap above 2% (`<gap>` signed, 1 decimal, e.g. `-3.4%`), and `Only <code> sales are shown; the account also sells in <codes>.` when the calibration has several currencies. Add the traffic line from SKILL.md if the card shows any traffic or rate figure |

## Extra fields from the script

`compute-briefing.js report` also returns fields the card doesn't show. Read them before writing
insights and mention anything material:

- `windows.<name>`: dates, effective days, missing dates, totals, export row count, `truncated`,
  and `reconciliation` (export total vs calibration, `gapPct`, `ok`);
- `insightFacts`: the top 3 risers (same basis as the drops), the top 5's share of this week's
  revenue, and how many ASINs sold this week;
- `warnings`: truncation, reconciliation gaps, an export that missed the date filter (rerun
  it), a currency other than the marketplace's, several currencies, windows outside the
  calibration span (widen the calibration pull and rerun), or a fallback anchor. The ones that
  affect the numbers are already in `footer.notes`.

`compute-briefing.js calibrate` returns the card currency, the anchor (`lastCompleteDay`), the
three windows to export with each one's `exportFilter` (`null` when all 7 days are complete),
the days that failed the completeness test with the reason, and the traffic-complete day.
