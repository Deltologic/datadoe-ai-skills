import fs from 'node:fs';
import path from 'node:path';

/**
 * Scheme-aware check: every backticked `amazon_*` identifier used in the skills must exist
 * in DataDoe's public data scheme, either as a table name or as a column name. Catches
 * typos and references to removed tables/columns. Runs against the live spec; when the
 * spec cannot be fetched (offline CI) it logs a warning and passes, unless
 * REQUIRE_SCHEME_CHECK=1 is set.
 */

const SCHEME_URL = 'https://api.datadoe.com/api/v1/spec/data-scheme';
const repoRoot = path.resolve(__dirname, '..');
const skillsDir = path.join(repoRoot, 'skills');

type Source = { tableName: string; columns: { name: string }[] };

function listMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function collectIdentifiers(file: string): Map<string, number[]> {
  const found = new Map<string, number[]>();
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/`(amazon_[a-z0-9_]+)(?:\.[a-z0-9_]+)?`/g)) {
      const id = match[1];
      if (!found.has(id)) found.set(id, []);
      found.get(id)!.push(index + 1);
    }
  });
  return found;
}

async function fetchScheme(): Promise<Source[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(SCHEME_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const json = (await response.json()) as { sources?: Source[] };
    return Array.isArray(json.sources) ? json.sources : null;
  } catch {
    return null;
  }
}

describe('skills reference only tables and columns that exist in the DataDoe data scheme', () => {
  let known: Set<string> | null = null;

  beforeAll(async () => {
    const sources = await fetchScheme();
    if (!sources) {
      if (process.env.REQUIRE_SCHEME_CHECK === '1') {
        throw new Error(`Could not fetch ${SCHEME_URL}`);
      }
      console.warn(`validate-scheme: could not fetch ${SCHEME_URL}; skipping scheme check.`);
      return;
    }
    known = new Set<string>();
    for (const source of sources) {
      known.add(source.tableName);
      for (const column of source.columns ?? []) known.add(column.name);
    }
  });

  const files = listMarkdownFiles(skillsDir).map((file) => path.relative(repoRoot, file));

  test.each(files)('%s', (relativeFile) => {
    if (!known) return;
    const identifiers = collectIdentifiers(path.join(repoRoot, relativeFile));
    const unknown: string[] = [];
    for (const [id, lineNumbers] of identifiers) {
      if (!known.has(id)) unknown.push(`${id} (lines ${lineNumbers.join(', ')})`);
    }
    expect(unknown).toEqual([]);
  });
});
