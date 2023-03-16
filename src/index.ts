#!/usr/bin/env node

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'

const pattern = /process.env\.(\w+)/g

const suffixes = ['', '.local', '.development', '.production']

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
const existingFiles = envFilePaths.filter(fs.existsSync)

if (existingFiles.length > 0) {
  console.log('\n🚨 The following .env files already exist in the current directory: ')
  for (const filePath of existingFiles) {
    const fileName = path.basename(filePath)
    console.log(`  - ${fileName}`)
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  rl.question(
    '\nDo you want to:\n1. Delete existing .env files and create new ones\n2. Cancel and exit\n\nEnter your choice (1-2): ',
    (choice: string) => {
      if (choice === '1') {
        for (const filePath of existingFiles) fs.unlinkSync(filePath)
        console.log('\n❌ Deleted existing .env files\n')
      } else if (choice === '2') {
        console.log('\nExiting...👋\n')
        process.exit(1)
      } else {
        console.log('\nInvalid choice. 🤦 Exiting...\n')
        process.exit(1)
      }

      rl.close()

      createEnvFiles()

      console.log('\nEnvironment files created successfully! 🙌')
      process.exit()
    }
  )
} else {
  createEnvFiles()

  console.log('\nEnvironment files created successfully 🙌')
  process.exit()
}

function createEnvFiles() {
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

    if (suffix === '') {
      console.log('✅  - .env file created')
    } else {
      console.log(`✅  - .env${suffix} file created`)
    }
  }

  console.log('\nEnvironment files created successfully 🙌')
  process.exit()
}
