import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Checks for the optional skill folders (`references/`, `scripts/`, `assets/`):
 * - nothing else sits at the skill root, because DataDoe Skills only imports these folders;
 * - every path `SKILL.md` names exists, and every bundled file is used;
 * - assets are text files that still work after DataDoe Skills converts them to Markdown;
 * - no file uses a name `npx skills add` drops on install;
 * - every script passes its fixture cases in `tests/fixtures/<skill>/<case>/case.json`.
 */

const repoRoot = path.resolve(__dirname, '..');
const skillsDir = path.join(repoRoot, 'skills');
const fixturesDir = path.join(repoRoot, 'tests', 'fixtures');

const RESOURCE_FOLDERS = ['references', 'scripts', 'assets'] as const;
const ALLOWED_ROOT_ENTRIES: ReadonlySet<string> = new Set(['SKILL.md', ...RESOURCE_FOLDERS]);
const IGNORED_ENTRIES: ReadonlySet<string> = new Set(['.DS_Store']);

// DataDoe Skills stores references/ and scripts/ unchanged but converts every assets/ file to
// Markdown with markitdown (datadoe-core, services/libs/public-api/src/plugins/
// skill-fetch.service.ts), which strips HTML markup, CSS and JS and drops other formats.
// Only text that still works after that conversion belongs in assets/; templates that must
// stay exact go to references/. The size limit mirrors SKILL_ASSET_MAX_BYTES in plugins.config.ts.
const ASSET_ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set(['md', 'markdown', 'txt', 'json', 'csv']);
const ASSET_MAX_BYTES = 2_097_152;

// `npx skills add` (vercel-labs/skills, src/installer.ts) skips files with these names on install.
const INSTALL_EXCLUDED_FILE_NAMES: ReadonlySet<string> = new Set(['metadata.json']);

// Skills whose scripts predate fixture tests. Do not add new skills here.
const SKILLS_WITHOUT_FIXTURES: ReadonlySet<string> = new Set(['amazon-asin-search-auditor']);

const RESOURCE_PATH_PATTERN = /(?<![\w./-])((?:references|scripts|assets)\/[A-Za-z0-9_./-]*[A-Za-z0-9_])/g;

type FixtureCase = {
  readonly skill: string;
  readonly name: string;
  readonly dir: string;
};

type FixtureSpec = {
  readonly command: readonly string[];
  readonly stdout?: string;
  readonly files?: Readonly<Record<string, string>>;
};

function getSkillDirectories(): string[] {
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_ENTRIES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

/** Bundled files as skill-relative POSIX paths, e.g. `references/rules.md`. */
function listResourceFiles(skill: string): string[] {
  const skillDir = path.join(skillsDir, skill);
  return RESOURCE_FOLDERS.flatMap((folder) =>
    listFiles(path.join(skillDir, folder)).map((file) =>
      path.relative(skillDir, file).split(path.sep).join('/'),
    ),
  );
}

function readSkillFile(skill: string): string {
  return fs.readFileSync(path.join(skillsDir, skill, 'SKILL.md'), 'utf8');
}

function findReferencedPaths(text: string): string[] {
  return [...new Set([...text.matchAll(RESOURCE_PATH_PATTERN)].map((match) => match[1]))];
}

function validateRootEntries(skill: string): string[] {
  return fs
    .readdirSync(path.join(skillsDir, skill), { withFileTypes: true })
    .filter((entry) => !IGNORED_ENTRIES.has(entry.name))
    .filter((entry) => {
      if (entry.name === 'SKILL.md') return !entry.isFile();
      return !ALLOWED_ROOT_ENTRIES.has(entry.name) || !entry.isDirectory();
    })
    .map(
      (entry) =>
        `${skill}: "${entry.name}" is not allowed at the skill root (only SKILL.md, references/, scripts/, assets/).`,
    );
}

function validateReferencedPathsExist(skill: string): string[] {
  const skillDir = path.join(skillsDir, skill);
  return findReferencedPaths(readSkillFile(skill))
    .filter((relativePath) => !fs.existsSync(path.join(skillDir, relativePath)))
    .map((relativePath) => `${skill}: SKILL.md names ${relativePath}, which does not exist.`);
}

/**
 * A bundled file is used when SKILL.md names its path, or another bundled file names its
 * path or file name (scripts often load templates with path.join(...)).
 */
function validateNoUnusedFiles(skill: string): string[] {
  const skillDir = path.join(skillsDir, skill);
  const skillText = readSkillFile(skill);
  const resources = listResourceFiles(skill);
  const texts = new Map(
    resources.map((resource) => [resource, fs.readFileSync(path.join(skillDir, resource), 'latin1')]),
  );

  return resources
    .filter((resource) => {
      if (skillText.includes(resource)) return false;
      const baseName = path.posix.basename(resource);
      return ![...texts].some(
        ([other, text]) => other !== resource && (text.includes(resource) || text.includes(baseName)),
      );
    })
    .map((resource) => `${skill}: ${resource} is not used by SKILL.md or any other bundled file.`);
}

function validateAssets(skill: string): string[] {
  const skillDir = path.join(skillsDir, skill);
  return listResourceFiles(skill)
    .filter((resource) => resource.startsWith('assets/'))
    .flatMap((resource) => {
      const errors: string[] = [];
      const extension = path.posix.extname(resource).slice(1).toLowerCase();
      if (!ASSET_ALLOWED_EXTENSIONS.has(extension)) {
        errors.push(
          `${skill}: ${resource} would not survive DataDoe Skills' Markdown conversion of assets/; put templates and code in references/ (assets/ allows ${[...ASSET_ALLOWED_EXTENSIONS].join(', ')}).`,
        );
      }
      const sizeBytes = fs.statSync(path.join(skillDir, resource)).size;
      if (sizeBytes > ASSET_MAX_BYTES) {
        errors.push(`${skill}: ${resource} is ${sizeBytes} bytes; assets must be at most ${ASSET_MAX_BYTES}.`);
      }
      return errors;
    });
}

function validateInstallableNames(skill: string): string[] {
  return listResourceFiles(skill)
    .filter((resource) => INSTALL_EXCLUDED_FILE_NAMES.has(path.posix.basename(resource)))
    .map((resource) => `${skill}: ${resource} is dropped by \`npx skills add\`; rename it.`);
}

/** DataDoe Skills stores references and scripts as UTF-8 text. */
function validateTextResources(skill: string): string[] {
  const skillDir = path.join(skillsDir, skill);
  return listResourceFiles(skill)
    .filter((resource) => resource.startsWith('references/') || resource.startsWith('scripts/'))
    .filter((resource) => fs.readFileSync(path.join(skillDir, resource)).includes(0))
    .map((resource) => `${skill}: ${resource} is binary; references/ and scripts/ must be text files.`);
}

function listFixtureCases(): FixtureCase[] {
  if (!fs.existsSync(fixturesDir)) return [];
  return fs
    .readdirSync(fixturesDir, { withFileTypes: true })
    .filter((skillEntry) => skillEntry.isDirectory())
    .flatMap((skillEntry) =>
      fs
        .readdirSync(path.join(fixturesDir, skillEntry.name), { withFileTypes: true })
        .filter((caseEntry) => caseEntry.isDirectory())
        .map((caseEntry) => ({
          skill: skillEntry.name,
          name: caseEntry.name,
          dir: path.join(fixturesDir, skillEntry.name, caseEntry.name),
        })),
    )
    .sort((a, b) => `${a.skill}/${a.name}`.localeCompare(`${b.skill}/${b.name}`));
}

function readFixtureSpec(fixture: FixtureCase): FixtureSpec {
  const specPath = path.join(fixture.dir, 'case.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as Partial<FixtureSpec>;
  if (!Array.isArray(spec.command) || spec.command.length === 0) {
    throw new Error(`${specPath}: "command" must be a non-empty array.`);
  }
  if (spec.stdout === undefined && spec.files === undefined) {
    throw new Error(`${specPath}: set "stdout", "files" or both.`);
  }
  return spec as FixtureSpec;
}

function expandPlaceholders(value: string, places: Readonly<Record<string, string>>): string {
  return value.replace(/\$\{(skill|case|out)\}/g, (_, key: string) => places[key]);
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

function expectSameContent(actual: string, expectedPath: string): void {
  const expected = fs.readFileSync(expectedPath, 'utf8');
  if (expectedPath.endsWith('.json')) {
    expect(JSON.parse(actual)).toEqual(JSON.parse(expected));
  } else {
    expect(normalizeText(actual)).toEqual(normalizeText(expected));
  }
}

/** Scripts a fixture command runs, plus helper scripts other scripts load by file name. */
function findExercisedScripts(skill: string, fixtures: readonly FixtureCase[]): Set<string> {
  const exercised = new Set<string>();
  for (const fixture of fixtures.filter((candidate) => candidate.skill === skill)) {
    for (const arg of readFixtureSpec(fixture).command) {
      for (const referenced of findReferencedPaths(arg)) {
        if (referenced.startsWith('scripts/')) exercised.add(referenced);
      }
    }
  }
  const skillDir = path.join(skillsDir, skill);
  const scripts = listResourceFiles(skill).filter((resource) => resource.startsWith('scripts/'));
  for (const script of scripts) {
    const baseName = path.posix.basename(script);
    const loadedByOther = scripts.some(
      (other) => other !== script && fs.readFileSync(path.join(skillDir, other), 'utf8').includes(baseName),
    );
    if (loadedByOther) exercised.add(script);
  }
  return exercised;
}

describe('skill resource folders', () => {
  const skills = getSkillDirectories();
  const fixtures = listFixtureCases();

  test.each(skills)('%s has only SKILL.md and resource folders at its root', (skill) => {
    expect(validateRootEntries(skill)).toEqual([]);
  });

  test.each(skills)('%s names only bundled files that exist', (skill) => {
    expect(validateReferencedPathsExist(skill)).toEqual([]);
  });

  test.each(skills)('%s bundles no unused files', (skill) => {
    expect(validateNoUnusedFiles(skill)).toEqual([]);
  });

  test.each(skills)('%s bundles only assets that survive DataDoe Skills', (skill) => {
    expect(validateAssets(skill)).toEqual([]);
  });

  test.each(skills)('%s uses file names that survive `npx skills add`', (skill) => {
    expect(validateInstallableNames(skill)).toEqual([]);
  });

  test.each(skills)('%s keeps references and scripts as text', (skill) => {
    expect(validateTextResources(skill)).toEqual([]);
  });

  test.each(skills)('%s has a fixture case for every script', (skill) => {
    if (SKILLS_WITHOUT_FIXTURES.has(skill)) return;
    const exercised = findExercisedScripts(skill, fixtures);
    const missing = listResourceFiles(skill)
      .filter((resource) => resource.startsWith('scripts/'))
      .filter((script) => !exercised.has(script));
    expect(missing).toEqual([]);
  });

  test('fixture folders belong to existing skills', () => {
    const unknown = [...new Set(fixtures.map((fixture) => fixture.skill))].filter(
      (skill) => !skills.includes(skill),
    );
    expect(unknown).toEqual([]);
  });
});

describe('skill script fixtures', () => {
  const fixtures = listFixtureCases();

  if (fixtures.length === 0) {
    test('no fixture cases yet', () => {
      expect(fixtures).toEqual([]);
    });
    return;
  }

  test.each(fixtures.map((fixture) => [`${fixture.skill}/${fixture.name}`, fixture] as const))(
    '%s',
    (_, fixture) => {
      const spec = readFixtureSpec(fixture);
      const skillDir = path.join(skillsDir, fixture.skill);
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `skill-fixture-${fixture.skill}-`));
      try {
        const places = { skill: skillDir, case: fixture.dir, out: outDir };
        const [executable, ...args] = spec.command.map((part) => expandPlaceholders(part, places));
        const result = spawnSync(executable === 'node' ? process.execPath : executable, args, {
          cwd: skillDir,
          encoding: 'utf8',
          env: { ...process.env, TZ: 'UTC' },
        });
        if (result.error) throw result.error;
        expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
        if (spec.stdout !== undefined) {
          expectSameContent(result.stdout, path.join(fixture.dir, spec.stdout));
        }
        for (const [actualRelative, expectedRelative] of Object.entries(spec.files ?? {})) {
          const actual = fs.readFileSync(path.join(outDir, actualRelative), 'utf8');
          expectSameContent(actual, path.join(fixture.dir, expectedRelative));
        }
      } finally {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
    },
  );
});
