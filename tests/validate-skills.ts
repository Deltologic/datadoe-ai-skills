import fs from 'node:fs';
import path from 'node:path';
import * as YAML from 'yaml';

type SkillFrontmatter = {
  name?: unknown;
  description?: unknown;
  metadata?: unknown;
};

const repoRoot = path.resolve(__dirname, '..');
const skillsDir = path.join(repoRoot, 'skills');
const readmePath = path.join(repoRoot, 'README.md');

const requiredAuthor = 'DataDoe';
const requiredSkillsUrl = 'https://app.datadoe.com/hub/ai-agents-and-skills';
const requiredYoutubePrefix = 'https://www.youtube.com/embed/';

const allowedCategories = [
  'Reporting',
  'Profit & Finance',
  'Account Health',
  'PPC & Ads',
  'Inventory',
  'Listings & Content',
  'Search & SEO',
] as const;
const allowedAccess = ['read', 'write'] as const;
const allowedInterface = ['mcp', 'api', 'both'] as const;
const allowedOutput = ['report', 'app', 'action'] as const;

const enumMetadataChecks = [
  { key: 'category', allowed: allowedCategories },
  { key: 'access', allowed: allowedAccess },
  { key: 'interface', allowed: allowedInterface },
  { key: 'output', allowed: allowedOutput },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSkillFrontmatter(skillFilePath: string): SkillFrontmatter {
  const contents = fs.readFileSync(skillFilePath, 'utf8');
  const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!match) {
    throw new Error(`Missing YAML frontmatter in ${skillFilePath}`);
  }

  return YAML.parse(match[1]) as SkillFrontmatter;
}

function getSkillDirectories(): string[] {
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function validateSkillDirectory(skillDirectory: string): string[] {
  const errors: string[] = [];
  const skillFilePath = path.join(skillsDir, skillDirectory, 'SKILL.md');

  if (!fs.existsSync(skillFilePath)) {
    errors.push(`Missing SKILL.md in ${skillDirectory}.`);
    return errors;
  }

  const frontmatter = readSkillFrontmatter(skillFilePath);
  const metadata = frontmatter.metadata;

  if (typeof frontmatter.name !== 'string' || frontmatter.name.trim() === '') {
    errors.push(`${skillDirectory}: name must be a non-empty string.`);
  } else {
    if (frontmatter.name !== skillDirectory) {
      errors.push(
        `${skillDirectory}: directory name must match frontmatter name (${frontmatter.name}).`,
      );
    }
    if (frontmatter.name.length >= 64) {
      errors.push(`${skillDirectory}: name must be shorter than 64 characters.`);
    }
  }

  if (typeof frontmatter.description !== 'string' || frontmatter.description.trim() === '') {
    errors.push(`${skillDirectory}: description must be present.`);
  }

  if (!isRecord(metadata)) {
    errors.push(`${skillDirectory}: metadata must be a YAML object.`);
    return errors;
  }

  if (metadata.author !== requiredAuthor) {
    errors.push(`${skillDirectory}: metadata.author must be ${requiredAuthor}.`);
  }

  if (metadata['check-more-skills-at'] !== requiredSkillsUrl) {
    errors.push(`${skillDirectory}: metadata.check-more-skills-at must be ${requiredSkillsUrl}.`);
  }

  if ('youtube-video-embed-url' in metadata) {
    const youtubeUrl = metadata['youtube-video-embed-url'];
    if (typeof youtubeUrl !== 'string') {
      errors.push(`${skillDirectory}: metadata.youtube-video-embed-url must be a string.`);
    } else if (!youtubeUrl.startsWith(requiredYoutubePrefix)) {
      errors.push(
        `${skillDirectory}: metadata.youtube-video-embed-url must start with ${requiredYoutubePrefix}.`,
      );
    }
  }

  for (const check of enumMetadataChecks) {
    const value = metadata[check.key];
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${skillDirectory}: metadata.${check.key} is required.`);
    } else if (!(check.allowed as readonly string[]).includes(value)) {
      errors.push(
        `${skillDirectory}: metadata.${check.key} must be one of: ${check.allowed.join(', ')} (got "${value}").`,
      );
    }
  }

  return errors;
}

function readAvailableSkillsFromReadme(): string[] {
  const lines = fs.readFileSync(readmePath, 'utf8').split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === '## Available Skills');

  if (headingIndex === -1) {
    throw new Error('README is missing the "## Available Skills" section.');
  }

  const tableLines: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith('## ')) {
      break;
    }
    if (line.startsWith('|')) {
      tableLines.push(line);
    }
  }

  const dataRows = tableLines.filter((line) => !/^\|\s*-{3,}/.test(line));
  const rows = dataRows.slice(1);

  return rows
    .map((row) =>
      row
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length >= 1)
    .map((cells) => cells[0].replace(/^`|`$/g, ''));
}

function validateReadmeSkills(skillDirectories: string[]): string[] {
  const readmeSkills = readAvailableSkillsFromReadme();
  const missingSkills = skillDirectories.filter((skill) => !readmeSkills.includes(skill));
  const unknownSkills = readmeSkills.filter((skill) => !skillDirectories.includes(skill));
  const duplicateSkills = readmeSkills.filter(
    (skill, index) => readmeSkills.indexOf(skill) !== index,
  );

  const errors: string[] = [];

  if (missingSkills.length > 0) {
    errors.push(`README is missing skills: ${missingSkills.join(', ')}`);
  }
  if (unknownSkills.length > 0) {
    errors.push(`README lists unknown skills: ${unknownSkills.join(', ')}`);
  }
  if (duplicateSkills.length > 0) {
    errors.push(`README lists duplicate skills: ${duplicateSkills.join(', ')}`);
  }

  return errors;
}

describe('skill repository validation', () => {
  const skillDirectories = getSkillDirectories();

  test('contains at least one skill directory', () => {
    expect(skillDirectories.length).toBeGreaterThan(0);
  });

  test.each(skillDirectories)('%s has valid SKILL.md frontmatter', (skillDirectory) => {
    expect(validateSkillDirectory(skillDirectory)).toEqual([]);
  });

  test('README skill list matches the skill directories', () => {
    expect(validateReadmeSkills(skillDirectories)).toEqual([]);
  });
});
