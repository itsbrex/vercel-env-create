import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

const PROCESS_ENV_PATTERNS = [
  /\bprocess\.env\.([A-Z_][A-Z0-9_]*)/g,
  /\bimport\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
  /\bprocess\.env\[["']([A-Z_][A-Z0-9_]*)["']\]/g,
  /\bimport\.meta\.env\[["']([A-Z_][A-Z0-9_]*)["']\]/g,
  /\$\{([A-Z_][A-Z0-9_]*)\}/g,
];

const DEFAULT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yaml',
  '.yml',
  '.ipynb',
]);

const DEFAULT_IGNORE_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'node_modules',
  'dist',
  'out',
]);

const SUPPORTED_ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.test',
  '.env.test.local',
  '.env.production',
  '.env.production.local',
] as const;

const BASE_ENV_EXAMPLE_FILES = ['.env.example', '.env.local.example'];

type ScanOptions = {
  rootDir?: string;
  extensions?: Set<string>;
  ignoreDirs?: Set<string>;
};

export type EnvScanResult = Set<string>;

export async function findReferencedEnvVars(options: ScanOptions = {}): Promise<EnvScanResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const ignoreDirs = options.ignoreDirs ?? DEFAULT_IGNORE_DIRS;

  const found = new Set<string>();
  const files = await listFiles(rootDir, ignoreDirs);

  for (const filePath of files) {
    if (!extensions.has(path.extname(filePath))) {
      continue;
    }

    const content = await fs.readFile(filePath, 'utf8');

    if (path.extname(filePath) === '.ipynb') {
      try {
        const notebook = JSON.parse(content);
        const cells = Array.isArray(notebook.cells)
          ? notebook.cells
              .filter((cell: { cell_type: string; source?: unknown }) => cell?.cell_type === 'code')
              .flatMap((cell: { source?: unknown }) =>
                Array.isArray(cell.source) ? cell.source.join('') : ''
              )
              .join('\n')
          : '';

        if (cells) {
          for (const pattern of PROCESS_ENV_PATTERNS) {
            for (const match of cells.matchAll(pattern)) {
              const variable = match[1];
              if (variable) {
                found.add(variable);
              }
            }
          }
        }
      } catch {
        continue;
      }
      continue;
    }

    for (const pattern of PROCESS_ENV_PATTERNS) {
      for (const match of content.matchAll(pattern)) {
        const variable = match[1];
        if (variable) {
          found.add(variable);
        }
      }
    }
  }

  return found;
}

export async function writeEnvTemplates(
  rootDir: string,
  targetFiles: readonly string[],
  exampleContent = ''
): Promise<void> {
  for (const fileName of targetFiles) {
    const filePath = path.join(rootDir, fileName);

    if (!existsSync(filePath)) {
      await fs.writeFile(filePath, exampleContent);
    }
  }
}

export async function appendMissingVars(
  rootDir: string,
  targetFiles: readonly string[],
  variables: EnvScanResult
): Promise<void> {
  const normalized = Array.from(variables).sort();

  for (const fileName of targetFiles) {
    const filePath = path.join(rootDir, fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    const fileContent = await fs.readFile(filePath, 'utf8');
    const existingVars = new Set(
      fileContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split('=')[0])
        .filter(Boolean)
    );

    const additions = normalized
      .filter((name) => !existingVars.has(name))
      .map((name) => `${name}=`);
    if (additions.length === 0) {
      continue;
    }

    const sep = fileContent.endsWith('\n') || fileContent.length === 0 ? '' : '\n';
    const next = `${fileContent}${sep}${additions.join('\n')}\n`;
    await fs.writeFile(filePath, next);
  }
}

export async function run(targetRoot = process.cwd()): Promise<void> {
  const variables = await findReferencedEnvVars({ rootDir: targetRoot });

  const hasExampleFile = BASE_ENV_EXAMPLE_FILES.some((name) =>
    existsSync(path.join(targetRoot, name))
  );

  if (hasExampleFile) {
    const selectedExample: string =
      BASE_ENV_EXAMPLE_FILES.find((name) => existsSync(path.join(targetRoot, name))) ??
      BASE_ENV_EXAMPLE_FILES[0]!;
    const exampleContent = await fs.readFile(path.join(targetRoot, selectedExample), 'utf8');

    await writeEnvTemplates(
      targetRoot,
      SUPPORTED_ENV_FILES,
      `${exampleContent}${exampleContent.endsWith('\n') ? '' : '\n'}`
    );

    return;
  }

  await writeEnvTemplates(targetRoot, SUPPORTED_ENV_FILES, '');
  await appendMissingVars(targetRoot, SUPPORTED_ENV_FILES, variables);
}

async function listFiles(dir: string, ignoreDirs: Set<string>): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoreDirs.has(entry.name) || entry.name.startsWith('.')) {
      continue;
    }

    const child = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await listFiles(child, ignoreDirs)));
      continue;
    }

    if (entry.isFile()) {
      results.push(child);
    }
  }

  return results;
}

export { SUPPORTED_ENV_FILES };
