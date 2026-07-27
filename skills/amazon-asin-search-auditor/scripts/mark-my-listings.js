// mark-my-listings.js
//
// Usage:
// node mark-my-listings.js ./asins.csv ./json-dir
//
// Behavior:
// - Reads ASINs from CSV column: child_asin
// - Scans all JSON files in directory
// - If ASIN exists in CSV:
//     organicRanks[].my_listing.active = true
//     ppcRanks[].my_listing.active = true
// - Ignores all other ASINs
// - Overwrites original JSON files

const fs = require("fs");
const path = require("path");

const csvPath = process.argv[2];
const jsonDir = process.argv[3];

if (!csvPath || !jsonDir) {
  console.log(
    "Usage: node mark-my-listings.js <asins.csv> <json-directory>"
  );
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.log("CSV file not found.");
  process.exit(1);
}

if (!fs.existsSync(jsonDir) || !fs.statSync(jsonDir).isDirectory()) {
  console.log("JSON directory not found.");
  process.exit(1);
}

// -----------------------------------
// Load ASINs from CSV
// -----------------------------------

const csvContent = fs.readFileSync(csvPath, "utf8");

// DataDoe always prepends utility columns (seller_id, seller_name,
// amazon_selling_partner_id, ... , marketplace_name) before child_asin, so the ASIN is
// never the only/first column. Parse by HEADER: find the child_asin column index and
// extract just that column. Quote-aware so embedded commas/quoting can't shift columns.
function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields.map(f => f.trim());
}

const rows = csvContent.split(/\r?\n/).filter(line => line.trim() !== "");

if (rows.length === 0) {
  console.log("CSV file is empty.");
  process.exit(1);
}

const header = parseCsvLine(rows[0]);
const asinIndex = header.indexOf("child_asin");

if (asinIndex === -1) {
  console.log('CSV has no "child_asin" column. Columns found: ' + header.join(", "));
  process.exit(1);
}

const asinSet = new Set(
  rows
    .slice(1)
    .map(line => parseCsvLine(line)[asinIndex])
    .filter(Boolean)
);

// -----------------------------------
// Process JSON files
// -----------------------------------

const jsonFiles = fs
  .readdirSync(jsonDir)
  .filter(file => file.toLowerCase().endsWith(".json"));

let updatedFiles = 0;
let updatedListings = 0;

for (const file of jsonFiles) {
  const filePath = path.join(jsonDir, file);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const markListings = (items = []) => {
      for (const item of items) {
        if (asinSet.has(item.asin)) {
          item.my_listing = {
            ...(item.my_listing || {}),
            active: true
          };

          updatedListings++;
        }
      }
    };

    markListings(data.organicRanks);
    markListings(data.ppcRanks);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    updatedFiles++;
  } catch (err) {
    console.log(`Skipping invalid JSON file: ${file}`);
  }
}

console.log(
  `Updated ${updatedListings} listings across ${updatedFiles} JSON files.`
);