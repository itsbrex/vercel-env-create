import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendMissingVars, findReferencedEnvVars, run, SUPPORTED_ENV_FILES } from '../src/index';

const envSuffixes = SUPPORTED_ENV_FILES;

let cwd = '';

const createFixture = async (filePath: string, content: string) => {
  await fs.writeFile(filePath, content);
};

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'vercel-env-create-'));
});

afterEach(async () => {
  if (!cwd) return;

  const entries = await fs.readdir(cwd, { withFileTypes: true });

  for (const entry of entries) {
    const target = path.join(cwd, entry.name);
    if (entry.isDirectory()) {
      await fs.rm(target, { recursive: true, force: true });
    } else {
      await fs.unlink(target);
    }
  }
  await fs.rmdir(cwd);
});

describe('findReferencedEnvVars', () => {
  it('collects env references from JS and TS files', async () => {
    const testFile = path.join(cwd, 'app.ts');

    await createFixture(
      testFile,
      'console.log(process.env.API_URL);\nconsole.log(import.meta.env.NEXT_PUBLIC_FLAG);'
    );

    const result = await findReferencedEnvVars({ rootDir: cwd, extensions: new Set(['.ts']) });

    expect(Array.from(result).sort()).toEqual(['API_URL', 'NEXT_PUBLIC_FLAG']);
  });

  it('collects env references inside YAML templates', async () => {
    const testFile = path.join(cwd, 'config.yaml');

    await createFixture(testFile, 'endpoint: "${BASE_URL}"');

    const result = await findReferencedEnvVars({ rootDir: cwd, extensions: new Set(['.yaml']) });
    expect(result).toEqual(new Set(['BASE_URL']));
  });
});

describe('appendMissingVars', () => {
  it('appends only missing variables while preserving existing entries', async () => {
    const vars = new Set(['ALREADY_THERE', 'NEW_ONE']);
    const file = path.join(cwd, '.env');

    await fs.writeFile(file, 'ALREADY_THERE=present\n');

    await appendMissingVars(cwd, ['.env'], vars);

    const lines = (await fs.readFile(file, 'utf8')).trim().split('\n');
    expect(lines).toContain('ALREADY_THERE=present');
    expect(lines).toContain('NEW_ONE=');
  });
});

describe('run', () => {
  it('creates every supported env file when no example exists', async () => {
    await createFixture(path.join(cwd, 'index.ts'), 'console.log(process.env.ABC);');

    await run(cwd);

    for (const suffix of envSuffixes) {
      const envFilePath = path.join(cwd, suffix);
      const exists = await fs
        .stat(envFilePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
      expect((await fs.readFile(envFilePath, 'utf8')).trim()).toContain('ABC=');
    }
  });

  it('copies example content into all env files when available', async () => {
    await createFixture(path.join(cwd, '.env.example'), 'EXAMPLE=from-example\n');

    await run(cwd);

    for (const suffix of envSuffixes) {
      const envFilePath = path.join(cwd, suffix);
      const exists = await fs
        .stat(envFilePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
      expect(await fs.readFile(envFilePath, 'utf8')).toContain('EXAMPLE=from-example');
    }
  });
});
