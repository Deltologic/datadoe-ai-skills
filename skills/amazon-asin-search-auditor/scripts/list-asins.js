// extract-asins.js
// Usage: node extract-asins.js ./json-input-dir
// Output: asins.json

import { existsSync, statSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const inputDir = process.argv[2];
const outputPath = "asins.json";

if (!inputDir) {
  console.log("Missing required input directory path with search results JSON files.");
  process.exit(1);
}

if (!existsSync(inputDir) || !statSync(inputDir).isDirectory()) {
  console.log("Input path must be an existing directory.");
  process.exit(1);
}

const organicRanked = new Set();
const ppcRanked = new Set();

const jsonFiles = readdirSync(inputDir)
  .filter(file => file.toLowerCase().endsWith(".json"));

for (const file of jsonFiles) {
  const filePath = join(inputDir, file);

  try {
    const data = JSON.parse(readFileSync(filePath, "utf8"));

    for (const item of data.organicRanks || []) {
      if (item.asin) organicRanked.add(item.asin);
    }

    for (const item of data.ppcRanks || []) {
      if (item.asin) ppcRanked.add(item.asin);
    }
  } catch {
    console.log(`Skipping invalid JSON file: ${file}`);
  }
}

const result = {
  organicRanked: [...organicRanked],
  ppcRanked: [...ppcRanked]
};

writeFileSync(outputPath, JSON.stringify(result, null, 2));

console.log(`Saved ASINs from ${jsonFiles.length} files to ${outputPath}`);
