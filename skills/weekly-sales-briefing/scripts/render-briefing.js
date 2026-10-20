#!/usr/bin/env node
'use strict';

// Fills references/briefing-template.html with the report data from compute-briefing.js.
// Pass the 1–2 insights with --insight (each replaces the data's "insights" array), or
// write them into that array before rendering.
//
//   node scripts/render-briefing.js --data report-data.json --out briefing.html \
//     [--insight "First insight." --insight "Second insight."]

const fs = require('fs');
const path = require('path');

const PLACEHOLDER = '__BRIEFING_DATA__';
const MAX_INSIGHTS = 2;
const TEMPLATE_PATH = path.join(__dirname, '..', 'references', 'briefing-template.html');

function fail(message) {
  process.stderr.write(`render-briefing: ${message}\n`);
  process.exit(1);
}

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) fail(`--${name} is required (usage: render-briefing.js --data report-data.json --out briefing.html)`);
  return value;
}

function readInsights() {
  const insights = [];
  process.argv.forEach((arg, index) => {
    if (arg !== '--insight') return;
    const value = process.argv[index + 1];
    if (!value || value.startsWith('--')) fail('--insight needs a sentence');
    insights.push(value);
  });
  return insights;
}

function validate(data) {
  for (const key of ['header', 'currency', 'kpis', 'topSkus', 'drops', 'insights', 'footer']) {
    if (data[key] === undefined) fail(`report data has no "${key}"; build it with compute-briefing.js report`);
  }
  if (!Array.isArray(data.insights) || data.insights.length === 0) {
    fail('no insights; pass 1–2 one-sentence insights with --insight, or write them into "insights"');
  }
  if (data.insights.length > MAX_INSIGHTS) fail(`"insights" has ${data.insights.length} entries; keep at most ${MAX_INSIGHTS}`);
}

function main() {
  const dataPath = readArg('data');
  const outPath = readArg('out');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${dataPath}: ${error.message}`);
  }
  const insights = readInsights();
  if (insights.length > 0) data.insights = insights;
  validate(data);
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  if (!template.includes(PLACEHOLDER)) fail(`${TEMPLATE_PATH} has no ${PLACEHOLDER} placeholder`);
  // Escape "<" so product names can't close the <script> data block.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  fs.writeFileSync(outPath, template.replace(PLACEHOLDER, () => json));
}

main();
