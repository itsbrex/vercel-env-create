import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as process from 'node:process'

import { afterEach, describe, expect, it } from 'vitest'

import * as index from '../src/index'

const currentDirectory = process.cwd()
const envSuffixes = ['', '.example', '.local', '.development', '.production']

const createTestFile = async (filePath: string) => {
  const testFileContent = 'console.log(process.env.TEST_VAR);'
  await fs.writeFile(filePath, testFileContent)
}

afterEach(async () => {
  for (const suffix of envSuffixes) {
    const envFilePath = path.join(currentDirectory, `.env${suffix}`)
    if (await fs.stat(envFilePath).catch(() => false)) {
      await fs.unlink(envFilePath)
    }
  }
  const testFilePath = path.join(currentDirectory, 'testfile.ts')
  if (await fs.stat(testFilePath).catch(() => false)) {
    await fs.unlink(testFilePath)
  }
})

describe('vercel-env-create', () => {
  it('should create all .env files when none exist', async () => {
    await createTestFile(path.join(currentDirectory, 'testfile.ts'))
    await index.createEnvFiles()

    for (const suffix of envSuffixes) {
      const envFilePath = path.join(currentDirectory, `.env${suffix}`)
      const fileExists = !!(await fs.stat(envFilePath).catch(() => false))
      expect(fileExists).toBe(true)
    }
  })

  it('should append new environment variables to existing .env files', async () => {
    await createTestFile(path.join(currentDirectory, 'testfile.ts'))

    for (const suffix of envSuffixes) {
      const envFilePath = path.join(currentDirectory, `.env${suffix}`)
      await fs.writeFile(envFilePath, 'EXISTING_VAR=')
    }

    await index.appendEnvVariables()

    for (const suffix of envSuffixes) {
      const envFilePath = path.join(currentDirectory, `.env${suffix}`)
      const fileContent = await fs.readFile(envFilePath, 'utf8')
      expect(fileContent).toContain('TEST_VAR=')
      expect(fileContent).toContain('EXISTING_VAR=')
    }
  })
})
