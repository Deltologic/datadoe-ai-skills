#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function usage() {
  console.error('Usage: node scripts/render-dashboard.js --data RUN_DIR/report-data.json --out RUN_DIR/report.html [--seller "Seller Name"] [--marketplace "DE"] [--run-folder runs/RUN_DIR]');
  process.exit(1);
}

const dataPath = readArg('--data');
const outPath = readArg('--out');
if (!dataPath || !outPath) usage();

const skillRoot = path.resolve(__dirname, '..');
const templatePath = path.join(skillRoot, 'references', 'dashboard-template.html');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

data.meta = {
  ...(data.meta || {}),
  sellerName: readArg('--seller', data.meta?.sellerName || data.summary?.sellerName || 'Amazon seller'),
  marketplace: readArg('--marketplace', data.meta?.marketplace || data.summary?.marketplace || 'marketplace'),
  runFolder: readArg('--run-folder', data.meta?.runFolder || path.dirname(dataPath)),
};

const template = fs.readFileSync(templatePath, 'utf8');
if (!template.includes('__DATA__')) {
  throw new Error(`Dashboard template is missing the __DATA__ placeholder: ${templatePath}`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, template.replace('__DATA__', JSON.stringify(data)));
console.log(`Wrote ${outPath}`);
