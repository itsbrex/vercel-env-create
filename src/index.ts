import { existsSync, promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { cancel, intro, isCancel, multiselect, outro, select, spinner } from '@clack/prompts';

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

export const SUPPORTED_ENV_FILES = [
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

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_VERCEL_ENVIRONMENT = 'development';
const ENV_FILE_DEFAULT = '.env';
const VERCEL_CLI = 'vercel';

export type EnvScanResult = Set<string>;
export type VercelEnvironment = 'development' | 'preview' | 'production';

export type RunOptions = {
  push?: boolean;
  projects?: string[];
  environment?: VercelEnvironment;
  envFile?: string;
  nonInteractive?: boolean;
  commandRunner?: (args: string[], options: { cwd: string; stdin?: string }) => Promise<string>;
};

type ScanOptions = {
  rootDir?: string;
  extensions?: Set<string>;
  ignoreDirs?: Set<string>;
};

type LinkedVercelProject = {
  name: string;
  id?: string;
  orgId?: string;
};

type VercelProject = {
  name: string;
  id?: string;
};

export async function run(targetRoot = process.cwd(), options: RunOptions = {}): Promise<void> {
  const variables = await findReferencedEnvVars({ rootDir: targetRoot });

  const hasExampleFile = BASE_ENV_EXAMPLE_FILES.some((name) =>
    existsSync(path.join(targetRoot, name))
  );

  if (hasExampleFile) {
    await seedFromExample(targetRoot);
  } else {
    await writeEnvTemplates(targetRoot, SUPPORTED_ENV_FILES, '');
    await appendMissingVars(targetRoot, SUPPORTED_ENV_FILES, variables);
  }

  if (!options.push) {
    return;
  }

  const selectedEnvironment =
    options.environment ||
    (await resolveEnvironment(DEFAULT_VERCEL_ENVIRONMENT, options.nonInteractive));

  const projectTargets = await resolveProjectTargets(targetRoot, options);
  await pushToProjects({
    targetRoot,
    variables,
    projects: projectTargets,
    environment: selectedEnvironment,
    envFile: options.envFile || ENV_FILE_DEFAULT,
    commandRunner: options.commandRunner,
  });
}

function seedFromExample(targetRoot: string): Promise<void> {
  return (async () => {
    const selectedExample =
      BASE_ENV_EXAMPLE_FILES.find((name) => existsSync(path.join(targetRoot, name))) ??
      BASE_ENV_EXAMPLE_FILES[0]!;

    const exampleContent = await fs.readFile(path.join(targetRoot, selectedExample), 'utf8');

    await writeEnvTemplates(
      targetRoot,
      SUPPORTED_ENV_FILES,
      `${exampleContent}${exampleContent.endsWith('\n') ? '' : '\n'}`
    );
  })();
}

async function resolveEnvironment(
  defaultValue: VercelEnvironment,
  nonInteractive?: boolean
): Promise<VercelEnvironment> {
  if (nonInteractive || !process.stdout.isTTY) {
    return defaultValue;
  }

  const selected = await select({
    message: 'Select target environment for push',
    options: [
      { value: 'development', label: 'development', hint: 'Used for local development' },
      { value: 'preview', label: 'preview', hint: 'Used for preview deployments' },
      { value: 'production', label: 'production', hint: 'Used for production deployments' },
    ],
    initialValue: defaultValue,
  });

  if (isCancel(selected)) {
    cancel('Operation canceled.');
    throw new Error('Environment selection canceled.');
  }

  return selected as VercelEnvironment;
}

async function resolveProjectTargets(targetRoot: string, options: RunOptions): Promise<string[]> {
  const linkedProject = await getLinkedProject(targetRoot);
  const providedProjects = options.projects?.map((name) => name.trim()).filter(Boolean) ?? [];
  const nonInteractive = options.nonInteractive ?? false;

  if (providedProjects.length > 0) {
    return providedProjects;
  }

  if (linkedProject) {
    return [linkedProject.name];
  }

  if (nonInteractive) {
    throw new Error('No Vercel project linked or provided. Pass --project <name> and retry.');
  }

  return selectProjectsInteractively(targetRoot, options.commandRunner);
}

async function selectProjectsInteractively(
  targetRoot: string,
  commandRunner?: (args: string[], options: { cwd: string; stdin?: string }) => Promise<string>
): Promise<string[]> {
  await ensureVercelAuth(targetRoot, commandRunner);

  intro('Vercel Env Create');

  const projects = await listVercelProjects(targetRoot, commandRunner);
  if (projects.length === 0) {
    throw new Error('No Vercel projects available in current scope.');
  }

  const selected = await multiselect({
    message: 'Select one or more linked Vercel projects',
    options: projects.map((project) => ({
      value: project.name,
      label: project.id ? `${project.name} (${project.id})` : project.name,
      hint: project.id,
    })),
    required: true,
  });

  if (isCancel(selected)) {
    cancel('Operation canceled.');
    throw new Error('Project selection canceled.');
  }

  return selected as string[];
}

async function pushToProjects({
  targetRoot,
  variables,
  projects,
  environment,
  envFile,
  commandRunner,
}: {
  targetRoot: string;
  variables: EnvScanResult;
  projects: string[];
  environment: VercelEnvironment;
  envFile: string;
  commandRunner?: (args: string[], options: { cwd: string; stdin?: string }) => Promise<string>;
}): Promise<void> {
  return (async () => {
    await ensureVercelAuth(targetRoot, commandRunner);

    const linkedProject = await getLinkedProject(targetRoot);
    const values = await parseEnvValues(targetRoot, envFile);

    const payload = Array.from(variables)
      .map((name) => ({
        name,
        value: values.get(name),
      }))
      .filter((entry): entry is { name: string; value: string } => entry.value !== undefined);

    const missing = Array.from(variables).filter((name) => !values.has(name));

    if (missing.length > 0) {
      console.warn(
        `Skipping ${missing.length} referenced variable(s) with no local value in ${envFile}.`
      );
    }

    if (payload.length === 0) {
      throw new Error(`No environment values found in ${envFile}.`);
    }

    const sp = spinner();
    sp.start(`Preparing to push ${payload.length} variable(s) to ${projects.length} project(s)`);

    const contexts = await Promise.all(
      projects.map(async (project) =>
        linkedProject && projectMatches(linkedProject, project)
          ? { project, cwd: targetRoot, cleanup: async () => {} }
          : prepareProjectContext(project)
      )
    );

    for (const { project, cwd, cleanup } of contexts) {
      sp.message(`Uploading to ${project}`);
      try {
        for (const { name, value } of payload) {
          await runVercelCommand(
            ['env', 'add', name, environment, '--force'],
            {
              cwd,
              stdin: `${value}\n`,
            },
            commandRunner
          );
        }
      } catch (error) {
        sp.stop(`Push failed for ${project}.`);
        await cleanup();
        throw error;
      }
      await cleanup();
    }

    sp.stop('Remote push complete.');
    outro(`Pushed ${payload.length} variable(s) to ${projects.length} selected project(s).`);
  })();

  async function prepareProjectContext(projectName: string): Promise<{
    project: string;
    cwd: string;
    cleanup: () => Promise<void>;
  }> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vercel-env-create-'));

    try {
      await runVercelCommand(
        ['link', '--project', projectName, '--yes'],
        {
          cwd: tempDir,
        },
        commandRunner
      );
    } catch (error) {
      await fs.rm(tempDir, { recursive: true, force: true });
      throw new Error(
        `Could not link temp project context for ${projectName}. ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    return {
      project: projectName,
      cwd: tempDir,
      cleanup: async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
      },
    };
  }
}

function projectMatches(project: LinkedVercelProject, selected: string): boolean {
  return (
    project.name === selected ||
    Boolean(project.id && project.id === selected) ||
    Boolean(project.id && selected.startsWith(project.id))
  );
}

function ensureVercelAuth(
  cwd: string,
  commandRunner?: (args: string[], options: { cwd: string; stdin?: string }) => Promise<string>
): Promise<string> {
  return runVercelCommand(['whoami'], { cwd }, commandRunner).catch((error) => {
    throw new Error(
      `${error instanceof Error ? error.message : 'Unable to verify authentication'}\nRun \`vercel login\` first.`
    );
  });
}

export async function listVercelProjects(
  cwd: string,
  commandRunner?: (args: string[], options: { cwd: string; stdin?: string }) => Promise<string>
): Promise<VercelProject[]> {
  const output = await runVercelCommand(['projects', 'list'], { cwd }, commandRunner);
  return parseVercelProjectsOutput(output);
}

export function parseVercelProjectsOutput(output: string): VercelProject[] {
  const trimmed = output.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const projects: VercelProject[] = [];
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }

        const project = entry as { name?: string; id?: string; projectId?: string };
        if (typeof project.name !== 'string') {
          continue;
        }

        const id = typeof project.id === 'string' ? project.id : project.projectId;

        projects.push({
          name: project.name,
          id: typeof id === 'string' ? id : undefined,
        });
      }

      return dedupeProjectNames(projects);
    }
  } catch {
    // fallback to table parse
  }

  const rows = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.toLowerCase().startsWith('name'))
    .filter((line) => !line.toLowerCase().startsWith('project'))
    .filter((line) => !line.startsWith('No projects'))
    .filter((line) => !/^[┌└─]+/.test(line));

  const matches: VercelProject[] = [];
  for (const row of rows) {
    const match = /^(\S+)\s+(\S+)/.exec(row);
    if (!match) {
      continue;
    }
    const [, name, id] = match;
    if (!name || !id) {
      continue;
    }

    matches.push({
      name,
      id,
    });
  }

  return dedupeProjectNames(matches);
}

function dedupeProjectNames(projects: VercelProject[]): VercelProject[] {
  const seen = new Set<string>();
  const output: VercelProject[] = [];

  for (const project of projects) {
    if (seen.has(project.name)) {
      continue;
    }

    seen.add(project.name);
    output.push(project);
  }

  return output;
}

async function getLinkedProject(targetRoot: string): Promise<LinkedVercelProject | null> {
  const projectPath = path.join(targetRoot, '.vercel', 'project.json');
  try {
    const raw = await fs.readFile(projectPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      projectName?: string;
      name?: string;
      projectId?: string;
      orgId?: string;
    };
    const name = parsed.projectName ?? parsed.name;

    if (name) {
      return {
        name,
        id: parsed.projectId,
        orgId: parsed.orgId,
      };
    }

    if (parsed.projectId) {
      return {
        name: parsed.projectId,
        id: parsed.projectId,
        orgId: parsed.orgId,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function parseEnvValues(targetRoot: string, fileName: string): Promise<Map<string, string>> {
  const valuesPath = path.join(targetRoot, fileName);
  const content = await fs.readFile(valuesPath, 'utf8');
  return parseEnvFile(content);
}

export function parseEnvFile(content: string): Map<string, string> {
  const output = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const token = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = token.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = token.slice(0, separatorIndex).trim();
    if (!ENV_KEY_PATTERN.test(key)) {
      continue;
    }

    let value = token.slice(separatorIndex + 1);
    const isQuoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));

    if (!isQuoted) {
      value = value.trim();
    }

    if (isQuoted) {
      value = value.slice(1, -1);
    }

    output.set(key, value);
  }

  return output;
}

async function runVercelCommand(
  args: string[],
  options: { cwd: string; stdin?: string },
  commandRunner?: (args: string[], options: { cwd: string; stdin?: string }) => Promise<string>
): Promise<string> {
  if (commandRunner) {
    return commandRunner(args, options);
  }

  return spawnVercelCommand(args, options);
}

function spawnVercelCommand(
  args: string[],
  options: { cwd: string; stdin?: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(VERCEL_CLI, args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error: unknown) => {
      if (
        error instanceof Error &&
        'code' in error &&
        typeof (error as { code?: unknown }).code === 'string' &&
        (error as { code?: unknown }).code === 'ENOENT'
      ) {
        reject(
          new Error(
            'Vercel CLI not found. Install it with `npm i -g vercel` or make sure it is available in PATH.'
          )
        );
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            stderr.trim() || stdout.trim() || `Vercel CLI command failed with exit code ${code}`
          )
        );
      }
    });

    if (options.stdin) {
      child.stdin?.write(options.stdin);
      child.stdin?.end();
    }
  });
}

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

        if (!cells) {
          continue;
        }

        for (const pattern of PROCESS_ENV_PATTERNS) {
          for (const match of cells.matchAll(pattern)) {
            const variable = match[1];
            if (variable) {
              found.add(variable);
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
  targetRoot: string,
  targetFiles: readonly string[],
  exampleContent = ''
): Promise<void> {
  for (const fileName of targetFiles) {
    const filePath = path.join(targetRoot, fileName);

    if (!existsSync(filePath)) {
      await fs.writeFile(filePath, exampleContent);
    }
  }
}

export async function appendMissingVars(
  targetRoot: string,
  targetFiles: readonly string[],
  variables: EnvScanResult
): Promise<void> {
  const normalized = Array.from(variables).sort();

  for (const fileName of targetFiles) {
    const filePath = path.join(targetRoot, fileName);

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

    const separator = fileContent.endsWith('\n') || fileContent.length === 0 ? '' : '\n';
    await fs.writeFile(filePath, `${fileContent}${separator}${additions.join('\n')}\n`);
  }
}

async function listFiles(dir: string, ignoreDirs: Set<string>): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (ignoreDirs.has(entry.name) || entry.name.startsWith('.')) {
      continue;
    }

    const childPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await listFiles(childPath, ignoreDirs)));
      continue;
    }

    if (entry.isFile()) {
      results.push(childPath);
    }
  }

  return results;
}
