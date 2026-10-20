#!/usr/bin/env node
'use strict';

// Weekly Sales Briefing calculations. Rules: references/data-completeness.md.
// Output format: references/report-data-format.md.
//
//   node scripts/compute-briefing.js calibrate --calibration FILE [--marketplace UK]
//   node scripts/compute-briefing.js report --calibration FILE --this-week FILE \
//     --last-week FILE --last-month FILE --seller NAME --marketplace UK \
//     [--generated YYYY-MM-DD] [--limit 5000] [--out FILE]
//
// Input files are DataDoe exports (CSV or JSON). Columns are read by header name.

const fs = require('fs');
const path = require('path');

const PRESENT_SHARE_OF_MEDIAN = 0.6;
const MAX_UNSHIPPED_SHARE = 0.1;
const WINDOW_DAYS = 7;
const MIN_PRESENT_DAYS_FOR_ANCHOR = 6;
const LAST_MONTH_OFFSET_DAYS = 28;
const RECONCILIATION_TOLERANCE_PCT = 2;
const FLAT_CHANGE_PCT = 1;
const NAME_MAX_CHARS = 40;
const TOP_SKUS = 5;
const TOP_DROPS = 3;
const TOP_RISERS = 3;
const DEFAULT_EXPORT_LIMIT = 5000;

const CURRENCY_BY_MARKETPLACE = Object.freeze({
  UK: ['GBP', '£'], GB: ['GBP', '£'],
  DE: ['EUR', '€'], FR: ['EUR', '€'], IT: ['EUR', '€'], ES: ['EUR', '€'], NL: ['EUR', '€'],
  BE: ['EUR', '€'], IE: ['EUR', '€'],
  US: ['USD', '$'], CA: ['CAD', 'CA$'], MX: ['MXN', 'MX$'], BR: ['BRL', 'R$'],
  SE: ['SEK', 'kr '], PL: ['PLN', 'zł '], TR: ['TRY', '₺'],
  AE: ['AED', 'AED '], SA: ['SAR', 'SAR '], EG: ['EGP', 'E£'], ZA: ['ZAR', 'R'],
  IN: ['INR', '₹'], JP: ['JPY', '¥'], AU: ['AUD', 'A$'], SG: ['SGD', 'S$'],
});

const COLUMN_ALIASES = Object.freeze({
  date: ['date'],
  currency: ['currency'],
  sales: ['sales', 'total_sales', 'sum_total_sales', 'total_sales_sum'],
  units: ['units', 'total_units_sold', 'sum_total_units_sold', 'total_units_sold_sum'],
  orders: ['orders', 'total_orders', 'sum_total_orders', 'total_orders_sum'],
  sessions: ['sessions', 'total_sessions', 'max_total_sessions', 'total_sessions_max'],
  unshipped: ['unshipped', 'unshipped_sales', 'sum_unshipped_sales', 'unshipped_sales_sum'],
  asin: ['child_asin', 'asin'],
  name: ['product_name', 'name'],
});

const MONTHS = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);

function fail(message) {
  process.stderr.write(`compute-briefing: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith('--')) fail(`unexpected argument "${key}"`);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) fail(`missing value for ${key}`);
    flags[key.slice(2)] = value;
    index += 1;
  }
  return { mode, flags };
}

function requireFlag(flags, name) {
  if (!flags[name]) fail(`--${name} is required`);
  return flags[name];
}

// ---------- input ----------

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const nonEmpty = records.filter((cells) => cells.some((cell) => cell !== ''));
  if (nonEmpty.length === 0) return { columns: [], rows: [] };
  const columns = nonEmpty[0].map((cell, index) => (index === 0 ? cell.replace(/^\uFEFF/, '') : cell));
  const rows = nonEmpty.slice(1).map((cells) =>
    Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ''])),
  );
  return { columns, rows };
}

function readTable(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`cannot read ${file}: ${error.message}`);
  }
  const trimmed = text.trim();
  if (path.extname(file).toLowerCase() === '.json' || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let parsed;
    try {
      parsed = trimmed === '' ? [] : JSON.parse(trimmed);
    } catch (error) {
      fail(`${file} is not valid JSON: ${error.message}`);
    }
    const rows = Array.isArray(parsed) ? parsed : parsed.rows ?? parsed.data;
    if (!Array.isArray(rows)) fail(`${file}: expected a JSON array of rows`);
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return { columns, rows };
  }
  return parseCsv(text);
}

function resolveColumn(table, key, file, required = true) {
  const found = COLUMN_ALIASES[key].find((alias) => table.columns.includes(alias));
  if (!found && required && table.rows.length > 0) {
    fail(`${file}: no "${key}" column (looked for ${COLUMN_ALIASES[key].join(', ')})`);
  }
  return found ?? null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// ---------- dates and numbers ----------

function parseDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail(`invalid date "${day}"`);
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}

function formatDay(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function addDays(day, days) {
  return formatDay(parseDay(day) + days * 86_400_000);
}

function daysBetween(fromDay, toDay) {
  return Math.round((parseDay(toDay) - parseDay(fromDay)) / 86_400_000);
}

function listDays(fromDay, toDay) {
  const days = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) days.push(day);
  return days;
}

function humanDay(day) {
  const [year, month, date] = day.split('-').map(Number);
  return `${date} ${MONTHS[month - 1]} ${year}`;
}

function humanRange(fromDay, toDay) {
  const [fromYear, fromMonth, fromDate] = fromDay.split('-').map(Number);
  const [toYear, toMonth, toDate] = toDay.split('-').map(Number);
  if (fromYear !== toYear) return `${humanDay(fromDay)} – ${humanDay(toDay)}`;
  if (fromMonth !== toMonth) return `${fromDate} ${MONTHS[fromMonth - 1]} – ${toDate} ${MONTHS[toMonth - 1]} ${toYear}`;
  return `${fromDate}–${toDate} ${MONTHS[toMonth - 1]} ${toYear}`;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function truncateName(name) {
  const chars = [...name];
  return chars.length <= NAME_MAX_CHARS ? name : `${chars.slice(0, NAME_MAX_CHARS - 1).join('').trimEnd()}…`;
}

// ---------- calibration ----------

function resolveCurrency(marketplace, currencyCodes) {
  const mapped = marketplace ? CURRENCY_BY_MARKETPLACE[marketplace.toUpperCase()] : undefined;
  if (mapped) return { code: mapped[0], symbol: mapped[1] };
  const code = currencyCodes[0];
  const known = Object.values(CURRENCY_BY_MARKETPLACE).find(([candidate]) => candidate === code);
  return { code: code ?? 'UNKNOWN', symbol: known ? known[1] : `${code ?? ''} ` };
}

function calibrate(file, marketplace) {
  const table = readTable(file);
  const columns = {
    date: resolveColumn(table, 'date', file),
    currency: resolveColumn(table, 'currency', file, false),
    sales: resolveColumn(table, 'sales', file),
    units: resolveColumn(table, 'units', file),
    sessions: resolveColumn(table, 'sessions', file, false),
    unshipped: resolveColumn(table, 'unshipped', file, false),
  };
  const warnings = [];
  if (!columns.unshipped) warnings.push('Calibration has no unshipped_sales column, so still-filling days are not detected.');

  const salesByCurrency = new Map();
  for (const row of table.rows) {
    const code = columns.currency ? row[columns.currency] : 'ALL';
    if (code === null || code === undefined || code === '') continue;
    salesByCurrency.set(code, (salesByCurrency.get(code) ?? 0) + toNumber(row[columns.sales]));
  }
  if (salesByCurrency.size === 0) fail(`${file}: no calibration rows with a currency`);
  const codesBySales = [...salesByCurrency.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
  const currency = resolveCurrency(marketplace, codesBySales);
  const rowCurrency = salesByCurrency.has(currency.code) ? currency.code : codesBySales[0];
  if (salesByCurrency.size > 1) {
    warnings.push(`Calibration has several currencies (${codesBySales.join(', ')}); the briefing uses ${rowCurrency} only.`);
  }

  const byDay = new Map();
  for (const row of table.rows) {
    const code = columns.currency ? row[columns.currency] : 'ALL';
    if (code !== rowCurrency) continue;
    const day = String(row[columns.date]).slice(0, 10);
    const entry = byDay.get(day) ?? { sales: 0, units: 0, sessions: 0, unshipped: 0 };
    entry.sales += toNumber(row[columns.sales]);
    entry.units += toNumber(row[columns.units]);
    entry.sessions = Math.max(entry.sessions, columns.sessions ? toNumber(row[columns.sessions]) : 0);
    entry.unshipped += columns.unshipped ? toNumber(row[columns.unshipped]) : 0;
    byDay.set(day, entry);
  }
  const rowDays = [...byDay.keys()].sort();
  const spanFrom = rowDays[0];
  const spanTo = rowDays[rowDays.length - 1];
  const entries = rowDays.map((day) => byDay.get(day));
  const medianSales = median(entries.map((entry) => entry.sales));
  const medianUnits = median(entries.map((entry) => entry.units));
  const medianSessions = median(entries.map((entry) => entry.sessions).filter((value) => value > 0));

  const days = listDays(spanFrom, spanTo).map((day) => {
    const entry = byDay.get(day);
    if (!entry) return { date: day, salesPresent: false, trafficPresent: false, reason: 'no row' };
    const unshippedShare = entry.sales + entry.unshipped > 0 ? entry.unshipped / (entry.sales + entry.unshipped) : 0;
    let reason = null;
    if (entry.sales < PRESENT_SHARE_OF_MEDIAN * medianSales) reason = 'sales below 60% of median';
    else if (entry.units < PRESENT_SHARE_OF_MEDIAN * medianUnits) reason = 'units below 60% of median';
    else if (unshippedShare > MAX_UNSHIPPED_SHARE) reason = `unshipped ${round(unshippedShare * 100, 1)}% of sales (still filling)`;
    return {
      date: day,
      sales: round(entry.sales, 2),
      units: entry.units,
      unshippedSharePct: round(unshippedShare * 100, 1),
      salesPresent: reason === null,
      trafficPresent: medianSessions > 0 && entry.sessions >= PRESENT_SHARE_OF_MEDIAN * medianSessions,
      reason,
    };
  });
  const present = new Set(days.filter((day) => day.salesPresent).map((day) => day.date));
  if (present.size === 0) fail(`${file}: no day passes the completeness test`);

  // Runs of consecutive present days, newest first. Anchor on the newest run end whose
  // 7-day window has at least MIN_PRESENT_DAYS_FOR_ANCHOR present days.
  const runEnds = [...present].sort().filter((day) => !present.has(addDays(day, 1))).reverse();
  const countPresent = (fromDay, toDay) => listDays(fromDay, toDay).filter((day) => present.has(day)).length;
  const anchorDay = runEnds.find((end) => countPresent(addDays(end, -(WINDOW_DAYS - 1)), end) >= MIN_PRESENT_DAYS_FOR_ANCHOR);
  const fallback = anchorDay === undefined;
  const lastCompleteDay = fallback ? [...present].sort().pop() : anchorDay;
  if (fallback) {
    warnings.push('No 7-day window with at least 6 complete days; anchored on the latest complete day and marked every window provisional.');
  }

  const buildWindow = (endDay) => {
    const fromDay = addDays(endDay, -(WINDOW_DAYS - 1));
    const windowDays = listDays(fromDay, endDay);
    const presentDays = windowDays.filter((day) => present.has(day)).length;
    const outsideCalibration = windowDays.filter((day) => day < spanFrom || day > spanTo);
    return {
      from: fromDay,
      to: endDay,
      presentDays,
      missingDates: windowDays.filter((day) => !present.has(day)),
      outsideCalibration,
      provisional: fallback || presentDays < WINDOW_DAYS,
    };
  };
  const windows = {
    thisWeek: buildWindow(lastCompleteDay),
    lastWeek: buildWindow(addDays(lastCompleteDay, -WINDOW_DAYS)),
    lastMonth: buildWindow(addDays(lastCompleteDay, -LAST_MONTH_OFFSET_DAYS)),
  };
  for (const [name, window] of Object.entries(windows)) {
    if (window.outsideCalibration.length > 0) {
      warnings.push(`${name} has ${window.outsideCalibration.length} day(s) outside the calibration span; widen the calibration pull.`);
    }
  }

  const trafficDays = days.filter((day) => day.trafficPresent && day.date <= lastCompleteDay).map((day) => day.date);
  const trafficCompleteThrough = trafficDays.length > 0 ? trafficDays[trafficDays.length - 1] : null;

  return {
    currency,
    rowCurrency,
    currencies: codesBySales,
    calibration: {
      from: spanFrom,
      to: spanTo,
      medianSales: round(medianSales, 2),
      medianUnits: round(medianUnits, 2),
      medianSessions: round(medianSessions, 2),
    },
    lastCompleteDay,
    anchorFallback: fallback,
    trafficCompleteThrough,
    trafficLagDays: trafficCompleteThrough ? daysBetween(trafficCompleteThrough, lastCompleteDay) : null,
    windows,
    notComplete: days.filter((day) => !day.salesPresent).map((day) => ({ date: day.date, reason: day.reason })),
    calibrationSalesByDay: Object.fromEntries(days.filter((day) => day.sales !== undefined).map((day) => [day.date, day.sales])),
    warnings,
  };
}

// ---------- report ----------

function readWindow(file, limit, currencyCode) {
  const table = readTable(file);
  const columns = {
    currency: resolveColumn(table, 'currency', file, false),
    asin: resolveColumn(table, 'asin', file),
    name: resolveColumn(table, 'name', file, false),
    sales: resolveColumn(table, 'sales', file),
    units: resolveColumn(table, 'units', file),
    orders: resolveColumn(table, 'orders', file, false),
  };
  const byAsin = new Map();
  let revenue = 0;
  let units = 0;
  let orders = 0;
  for (const row of table.rows) {
    // Keep one currency per card when the export carries a currency column.
    if (columns.currency && row[columns.currency] && row[columns.currency] !== currencyCode) continue;
    const asin = String(row[columns.asin] ?? '').trim();
    const sales = toNumber(row[columns.sales]);
    const rowUnits = toNumber(row[columns.units]);
    const rowOrders = columns.orders ? toNumber(row[columns.orders]) : 0;
    revenue += sales;
    units += rowUnits;
    orders += rowOrders;
    if (asin === '') continue;
    const name = columns.name ? String(row[columns.name] ?? '').trim() : '';
    const entry = byAsin.get(asin) ?? { asin, name: '', sales: 0, units: 0 };
    if (entry.name === '' && name !== '') entry.name = name;
    entry.sales += sales;
    entry.units += rowUnits;
    byAsin.set(asin, entry);
  }
  return {
    byAsin,
    revenue,
    units,
    orders,
    rowCount: table.rows.length,
    truncated: table.rows.length >= limit,
  };
}

function compare(current, previous, currentDays, previousDays, perDay) {
  if (currentDays === 0 || previousDays === 0) {
    return { basis: perDay ? 'per-present-day' : 'total', change: null, changePct: null, direction: 'flat', comparable: false, previous: null };
  }
  const a = perDay ? (current / currentDays) * WINDOW_DAYS : current;
  const b = perDay ? (previous / previousDays) * WINDOW_DAYS : previous;
  const change = a - b;
  const changePct = b === 0 ? null : (change / b) * 100;
  let direction = 'flat';
  if (changePct === null) direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  else if (changePct >= FLAT_CHANGE_PCT) direction = 'up';
  else if (changePct <= -FLAT_CHANGE_PCT) direction = 'down';
  return {
    basis: perDay ? 'per-present-day' : 'total',
    change: round(change, 2),
    changePct: changePct === null ? null : round(changePct, 1),
    direction,
    comparable: true,
    previous: round(b, 2),
  };
}

function report(flags) {
  const limit = flags.limit ? Number(flags.limit) : DEFAULT_EXPORT_LIMIT;
  const marketplace = requireFlag(flags, 'marketplace');
  const seller = requireFlag(flags, 'seller');
  const generated = flags.generated ?? formatDay(Date.now());
  parseDay(generated);
  const cal = calibrate(requireFlag(flags, 'calibration'), marketplace);
  const warnings = [...cal.warnings];
  const data = {
    thisWeek: readWindow(requireFlag(flags, 'this-week'), limit, cal.rowCurrency),
    lastWeek: readWindow(requireFlag(flags, 'last-week'), limit, cal.rowCurrency),
    lastMonth: readWindow(requireFlag(flags, 'last-month'), limit, cal.rowCurrency),
  };

  const windowLabels = { thisWeek: 'This week', lastWeek: 'Last week', lastMonth: 'Last month' };
  const cardNotes = [];
  if (cal.currencies.length > 1) {
    cardNotes.push(`Only ${cal.rowCurrency} sales are shown; the account also sells in ${cal.currencies.filter((code) => code !== cal.rowCurrency).join(', ')}.`);
  }
  const windows = {};
  for (const [name, window] of Object.entries(cal.windows)) {
    const exported = data[name];
    const calibrationSales = listDays(window.from, window.to).reduce(
      (sum, day) => sum + (cal.calibrationSalesByDay[day] ?? 0),
      0,
    );
    const gapPct = calibrationSales === 0 ? null : ((exported.revenue - calibrationSales) / calibrationSales) * 100;
    const reconciled = gapPct === null ? exported.revenue === 0 : Math.abs(gapPct) <= RECONCILIATION_TOLERANCE_PCT;
    if (exported.truncated) {
      warnings.push(`${name} export returned ${exported.rowCount} rows (the limit), so its totals are incomplete.`);
      cardNotes.push(`${windowLabels[name]}'s export hit the ${exported.rowCount}-row limit, so its totals are incomplete.`);
    }
    if (!reconciled) {
      const gapText = gapPct === null ? 'n/a' : `${round(gapPct, 1)}%`;
      warnings.push(`${name} export total differs from the calibration by ${gapText}; an export may be truncated or filtered.`);
      cardNotes.push(`${windowLabels[name]}'s SKU total differs from the account total by ${gapText}.`);
    }
    windows[name] = {
      ...window,
      revenue: round(exported.revenue, 2),
      units: exported.units,
      orders: exported.orders,
      asinCount: exported.byAsin.size,
      rowCount: exported.rowCount,
      truncated: exported.truncated,
      reconciliation: {
        calibrationSales: round(calibrationSales, 2),
        gapPct: gapPct === null ? null : round(gapPct, 1),
        ok: reconciled,
      },
    };
  }

  const thisDays = windows.thisWeek.presentDays;
  const wowProvisional = windows.thisWeek.provisional || windows.lastWeek.provisional;
  const momProvisional = windows.thisWeek.provisional || windows.lastMonth.provisional;
  const kpis = {
    thisWeek: { value: windows.thisWeek.revenue, presentDays: thisDays, provisional: windows.thisWeek.provisional },
    vsLastWeek: {
      ...compare(data.thisWeek.revenue, data.lastWeek.revenue, thisDays, windows.lastWeek.presentDays, wowProvisional),
      provisional: wowProvisional,
    },
    vsLastMonth: {
      ...compare(data.thisWeek.revenue, data.lastMonth.revenue, thisDays, windows.lastMonth.presentDays, momProvisional),
      provisional: momProvisional,
    },
  };

  const label = (entry) => (entry.name === '' ? entry.asin : entry.name);
  const byRevenue = (a, b) => b.sales - a.sales || a.asin.localeCompare(b.asin);
  const topSkus = [...data.thisWeek.byAsin.values()]
    .filter((entry) => entry.sales > 0)
    .sort(byRevenue)
    .slice(0, TOP_SKUS)
    .map((entry, index) => ({
      rank: index + 1,
      asin: entry.asin,
      name: truncateName(label(entry)),
      revenue: round(entry.sales, 2),
      units: entry.units,
    }));

  const lastWeekDays = windows.lastWeek.presentDays;
  const scaled = (sales, days) => (wowProvisional ? (days === 0 ? 0 : (sales / days) * WINDOW_DAYS) : sales);
  const movers = [...data.thisWeek.byAsin.values()]
    .map((entry) => {
      const previous = data.lastWeek.byAsin.get(entry.asin);
      return { entry, previousSales: previous ? previous.sales : 0 };
    })
    .filter(({ entry, previousSales }) => entry.sales > 0 && previousSales > 0)
    .map(({ entry, previousSales }) => {
      const delta = scaled(entry.sales, thisDays) - scaled(previousSales, lastWeekDays);
      return {
        asin: entry.asin,
        name: truncateName(label(entry)),
        thisWeek: round(entry.sales, 2),
        lastWeek: round(previousSales, 2),
        delta: round(delta, 2),
        deltaPct: round((delta / scaled(previousSales, lastWeekDays)) * 100, 1),
      };
    });
  const byDelta = (a, b) => a.delta - b.delta || a.asin.localeCompare(b.asin);
  const drops = movers.filter((mover) => mover.delta < 0).sort(byDelta).slice(0, TOP_DROPS);
  const risers = movers
    .filter((mover) => mover.delta > 0)
    .sort((a, b) => byDelta(b, a))
    .slice(0, TOP_RISERS);

  const top5Revenue = topSkus.reduce((sum, sku) => sum + sku.revenue, 0);
  const completeness = wowProvisional
    ? `this week ${thisDays}/7 days present, last week ${lastWeekDays}/7 — provisional`
    : `this week ${thisDays}/7 days present`;
  const footerNotes = [
    ...Object.entries(windows)
      .filter(([, window]) => window.provisional)
      .map(([name, window]) => `${windowLabels[name]} reflects ${window.presentDays} of 7 days.`),
    ...cardNotes,
  ];

  return {
    header: {
      title: `${seller} — Weekly Sales Briefing`,
      seller,
      marketplace: marketplace.toUpperCase(),
      subtitle: `${humanRange(windows.thisWeek.from, windows.thisWeek.to)} · ${completeness}`,
    },
    currency: cal.currency,
    lastCompleteDay: cal.lastCompleteDay,
    trafficCompleteThrough: cal.trafficCompleteThrough,
    windows,
    kpis,
    topSkus,
    drops: { provisional: wowProvisional, basis: wowProvisional ? 'per-present-day' : 'total', items: drops },
    insightFacts: {
      risers,
      top5SharePct: windows.thisWeek.revenue === 0 ? null : round((top5Revenue / windows.thisWeek.revenue) * 100, 1),
      asinsSoldThisWeek: [...data.thisWeek.byAsin.values()].filter((entry) => entry.sales > 0).length,
    },
    insights: [],
    footer: {
      text: `Data via DataDoe · Generated ${humanDay(generated)} · sales complete through ${humanDay(cal.lastCompleteDay)}`,
      notes: footerNotes,
    },
    warnings,
  };
}

function main() {
  const { mode, flags } = parseArgs(process.argv.slice(2));
  let result;
  if (mode === 'calibrate') {
    const cal = calibrate(requireFlag(flags, 'calibration'), flags.marketplace);
    const { calibrationSalesByDay, ...rest } = cal;
    result = rest;
  } else if (mode === 'report') {
    result = report(flags);
  } else {
    fail('usage: compute-briefing.js calibrate|report --calibration FILE ... (see the header of this file)');
  }
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (flags.out) fs.writeFileSync(flags.out, json);
  else process.stdout.write(json);
}

main();
