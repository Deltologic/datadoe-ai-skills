#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function usage() {
  console.error('Usage: node scripts/render-asin-report.js --data ASIN_DIR/report-data.json --out ASIN_DIR/report.html');
  process.exit(1);
}

const dataPath = readArg('--data');
const outPath = readArg('--out');
if (!dataPath || !outPath) usage();

const skillRoot = path.resolve(__dirname, '..');
const templatePath = path.join(skillRoot, 'references', 'asin-report-template.html');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const template = fs.readFileSync(templatePath, 'utf8');
if (!template.includes('__DATA__')) {
  throw new Error(`ASIN report template is missing the __DATA__ placeholder: ${templatePath}`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, template.replace('__DATA__', JSON.stringify(data)));
console.log(`Wrote ${outPath}`);
