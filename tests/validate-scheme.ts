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

type Source = {
  tableName: string;
  description?: string;
  issues?: { title?: string; description?: string }[];
  columns: { name: string; description?: string }[];
};

type Deprecations = {
  tables: Map<string, string>; // tableName -> reason
  columns: Map<string, { owners: Set<string>; reason: string }>; // column -> deprecated on these tables
  columnOwners: Map<string, Set<string>>; // column -> every table that carries it
};

const isDeprecatedText = (text: string | undefined): boolean =>
  /deprecat/i.test(text ?? '');

/** Lines that merely warn against a deprecated name are not usages. */
const isWarningLine = (line: string): boolean =>
  /deprecat|do not use|don't use|never use|not use|should not be used|instead of|removed on|replaced by|replacement|compatibility name|alias of/i.test(
    line,
  );

function collectDeprecations(sources: Source[]): Deprecations {
  const tables = new Map<string, string>();
  const columns = new Map<string, { owners: Set<string>; reason: string }>();
  const columnOwners = new Map<string, Set<string>>();
  for (const source of sources) {
    const issue = (source.issues ?? []).find(
      (entry) => isDeprecatedText(entry.title) || isDeprecatedText(entry.description),
    );
    if (issue || isDeprecatedText(source.description?.slice(0, 40))) {
      tables.set(source.tableName, issue?.title ?? 'marked deprecated in the data scheme');
    }
    for (const column of source.columns ?? []) {
      if (!columnOwners.has(column.name)) columnOwners.set(column.name, new Set());
      columnOwners.get(column.name)!.add(source.tableName);
      if (isDeprecatedText(column.description)) {
        const entry = columns.get(column.name) ?? { owners: new Set<string>(), reason: '' };
        entry.owners.add(source.tableName);
        entry.reason = (column.description ?? '').slice(0, 120);
        columns.set(column.name, entry);
      }
    }
  }
  return { tables, columns, columnOwners };
}

/**
 * Deprecated identifiers a file still USES (mentions on warning lines are ignored). A
 * deprecated column is reported only when the file references one of the tables it is
 * deprecated on and no other referenced table carries a live column of the same name.
 */
function findDeprecatedUsages(file: string, deprecations: Deprecations): string[] {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const text = lines.join('\n');
  const referencedTables = new Set<string>();
  for (const match of text.matchAll(/`(amazon_[a-z0-9_]+)`/g)) {
    referencedTables.add(match[1]);
  }
  const findings: string[] = [];
  lines.forEach((line, index) => {
    if (isWarningLine(line)) return;
    for (const match of line.matchAll(/`(amazon_[a-z0-9_]+)(?:\.([a-z0-9_]+))?`/g)) {
      const [, id, dotted] = match;
      if (deprecations.tables.has(id)) {
        findings.push(`${id} (line ${index + 1}): ${deprecations.tables.get(id)}`);
      }
      if (dotted && deprecations.columns.get(dotted)?.owners.has(id)) {
        findings.push(`${id}.${dotted} (line ${index + 1}): ${deprecations.columns.get(dotted)!.reason}`);
      }
    }
    for (const match of line.matchAll(/`([a-z0-9_]+)`/g)) {
      const column = match[1];
      const dep = deprecations.columns.get(column);
      if (!dep) continue;
      const referencesOwner = [...dep.owners].some((table) => referencedTables.has(table));
      if (!referencesOwner) continue;
      const liveElsewhere = [...(deprecations.columnOwners.get(column) ?? [])].some(
        (table) => !dep.owners.has(table) && referencedTables.has(table),
      );
      if (liveElsewhere) continue; // ambiguous: same column name is live on another referenced table
      findings.push(`${column} (line ${index + 1}, deprecated on ${[...dep.owners].join(', ')}): ${dep.reason}`);
    }
  });
  return [...new Set(findings)];
}

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

let loadedSources: Source[] | null = null;

describe('skills reference only tables and columns that exist in the DataDoe data scheme', () => {
  let known: Set<string> | null = null;

  beforeAll(async () => {
    const sources = await fetchScheme();
    loadedSources = sources;
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

/**
 * Deprecation pass. Warns (does not fail) when a skill still USES a table or column the
 * data scheme marks as deprecated. Set REQUIRE_NO_DEPRECATED=1 to turn the warning into a
 * failure once the migration off the deprecated sources is agreed.
 */
describe('skills do not build on tables or columns the DataDoe data scheme marks deprecated', () => {
  const files = listMarkdownFiles(skillsDir).map((file) => path.relative(repoRoot, file));
  const strict = process.env.REQUIRE_NO_DEPRECATED === '1';

  test.each(files)('%s', (relativeFile) => {
    if (!loadedSources) return;
    const deprecations = collectDeprecations(loadedSources);
    const usages = findDeprecatedUsages(path.join(repoRoot, relativeFile), deprecations);
    if (usages.length === 0) return;
    const message = `validate-scheme: ${relativeFile} still uses deprecated identifiers:\n  - ${usages.join('\n  - ')}`;
    if (strict) {
      expect(usages).toEqual([]);
    } else {
      console.warn(message);
    }
  });
});
