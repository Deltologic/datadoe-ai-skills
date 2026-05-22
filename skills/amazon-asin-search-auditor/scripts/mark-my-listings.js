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

const asinSet = new Set(
  csvContent
    .split(/\r?\n/)
    .slice(1) // skip header
    .map(line => line.trim())
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