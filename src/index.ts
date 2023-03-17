#!/usr/bin / env node

/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'node:fs'
import * as path from 'node:path'

const pattern = /process.env\.(\w+)/g

const suffixes = ['', '.example', '.local', '.development', '.production']

const envVars: Record<string, Set<string>> = {}
for (const suffix of suffixes) {
  envVars[suffix] = new Set()
}

function searchDirectory(directory: string): void {
  const excludeDirs = new Set(['node_modules'])

  // Additional file extensions to search for
  const extensions = new Set(['.js', '.ts', '.jsx', '.tsx', '.html', '.css'])

  for (const item of fs.readdirSync(directory)) {
    const itemPath = path.join(directory, item)
    const stat = fs.statSync(itemPath)

    if (stat.isDirectory() && !item.startsWith('.') && !excludeDirs.has(item)) {
      searchDirectory(itemPath)
    } else if (stat.isFile() && extensions.has(path.extname(itemPath))) {
      const contents = fs.readFileSync(itemPath, 'utf8')
      let match

      while ((match = pattern.exec(contents)) !== null) {
        for (const [suffix, vars] of Object.entries(envVars)) {
          if (match[1] !== undefined && !vars.has(match[1])) {
            vars.add(match[1])
          }
        }
      }
    }
  }
}

const currentDirectory = process.cwd()

const envFilePaths = suffixes.map((suffix) => path.join(currentDirectory, `.env${suffix}`))

const exampleFiles = ['.env.example', '.env.local.example'].map((example) => path.join(currentDirectory, example))

const existingFiles = envFilePaths.filter(fs.existsSync)

for (const example of exampleFiles) {
  if (fs.existsSync(example)) {
    for (const filePath of envFilePaths) {
      if (!fs.existsSync(filePath)) {
        fs.copyFileSync(example, filePath)
      }
    }
    break
  }
}

if (existingFiles.length > 0) {
  appendEnvVariables()
} else {
  createEnvFiles()
}

export function createEnvFiles(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      searchDirectory(currentDirectory)

      for (const suffix of suffixes) {
        const envFilePath = path.join(currentDirectory, `.env${suffix}`)
        const envFileContent: string[] = []

        if (suffix !== '') {
          envFileContent.push(`ENV_FILE=.env${suffix}`)
        }

        for (const envVar of envVars[suffix] ?? []) {
          if (suffix === '' && envVar === 'ENV_FILE') {
            continue
          } else if (suffix !== '' && envVar === 'ENV_FILE') {
            envFileContent.push(`${envVar}=.${suffix}`)
          } else {
            envFileContent.push(`${envVar}=`)
          }
        }

        fs.writeFileSync(envFilePath, envFileContent.join('\n'))
      }

      resolve()
    } catch (error) {
      reject(error)
    }
  })
}

export function appendEnvVariables(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      searchDirectory(currentDirectory)

      for (const suffix of suffixes) {
        const envFilePath = path.join(currentDirectory, `.env${suffix}`)
        const envFileContent: string[] = []

        if (fs.existsSync(envFilePath)) {
          const existingContent = fs.readFileSync(envFilePath, 'utf8').split('\n')
          const existingVars = new Set(existingContent.map((line) => line.split('=')[0]))

          for (const envVar of envVars[suffix] ?? []) {
            if (!existingVars.has(envVar)) {
              if (suffix === '' && envVar === 'ENV_FILE') {
                continue
              } else if (suffix !== '' && envVar === 'ENV_FILE') {
                envFileContent.push(`${envVar}=.${suffix}`)
              } else {
                envFileContent.push(`${envVar}=`)
              }
            }
          }

          if (envFileContent.length > 0) {
            fs.appendFileSync(envFilePath, `${envFileContent.join('\n')}\n`)
          }
        }
      }

      resolve()
    } catch (error) {
      reject(error)
    }
  })
}
