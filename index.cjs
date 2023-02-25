#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

function _interopNamespaceDefault(e) {
	const n = Object.create(null);
	if (e) {
		for (const k in e) {
			n[k] = e[k];
		}
	}
	n.default = e;
	return n;
}

const fs__namespace = /*#__PURE__*/_interopNamespaceDefault(fs);
const path__namespace = /*#__PURE__*/_interopNamespaceDefault(path);
const readline__namespace = /*#__PURE__*/_interopNamespaceDefault(readline);

const pattern = /process.env\.(\w+)/g;
const suffixes = ["", ".local", ".development", ".production"];
const envVars = {};
for (const suffix of suffixes) {
  envVars[suffix] = /* @__PURE__ */ new Set();
}
function searchDirectory(directory) {
  const excludeDirs = ["node_modules"];
  const extensions = [".js", ".ts", ".jsx", ".tsx", ".html", ".css"];
  fs__namespace.readdirSync(directory).forEach((item) => {
    const itemPath = path__namespace.join(directory, item);
    const stat = fs__namespace.statSync(itemPath);
    if (stat.isDirectory() && !item.startsWith(".") && !excludeDirs.includes(item)) {
      searchDirectory(itemPath);
    } else if (stat.isFile() && extensions.includes(path__namespace.extname(itemPath))) {
      const contents = fs__namespace.readFileSync(itemPath, "utf-8");
      let match;
      while ((match = pattern.exec(contents)) !== null) {
        for (const [suffix, vars] of Object.entries(envVars)) {
          if (match[1] !== void 0 && !vars.has(match[1])) {
            vars.add(match[1]);
          }
        }
      }
    }
  });
}
const currentDirectory = process.cwd();
const envFilePaths = suffixes.map((suffix) => path__namespace.join(currentDirectory, `.env${suffix}`));
const existingFiles = envFilePaths.filter(fs__namespace.existsSync);
if (existingFiles.length > 0) {
  console.log("\n\u{1F6A8} The following .env files already exist in the current directory: ");
  existingFiles.forEach((filePath) => {
    const fileName = path__namespace.basename(filePath);
    console.log(`  - ${fileName}`);
  });
  const rl = readline__namespace.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question(
    "\nDo you want to:\n1. Delete existing .env files and create new ones\n2. Cancel and exit\n\nEnter your choice (1-2): ",
    (choice) => {
      if (choice === "1") {
        existingFiles.forEach((filePath) => fs__namespace.unlinkSync(filePath));
        console.log("\n\u274C Deleted existing .env files\n");
      } else if (choice === "2") {
        console.log("\nExiting...\u{1F44B}\n");
        process.exit(1);
      } else {
        console.log("\nInvalid choice. \u{1F926} Exiting...\n");
        process.exit(1);
      }
      rl.close();
      createEnvFiles();
      console.log("\nEnvironment files created successfully! \u{1F64C}");
      process.exit();
    }
  );
} else {
  createEnvFiles();
  console.log("\nEnvironment files created successfully \u{1F64C}");
  process.exit();
}
function createEnvFiles() {
  searchDirectory(currentDirectory);
  for (const suffix of suffixes) {
    const envFilePath = path__namespace.join(currentDirectory, `.env${suffix}`);
    const envFileContent = [];
    if (suffix !== "") {
      envFileContent.push(`ENV_FILE=.env${suffix}`);
    }
    for (const envVar of envVars[suffix] ?? []) {
      if (suffix === "" && envVar === "ENV_FILE") {
        continue;
      } else if (suffix !== "" && envVar === "ENV_FILE") {
        envFileContent.push(`${envVar}=.${suffix}`);
      } else {
        envFileContent.push(`${envVar}=`);
      }
    }
    fs__namespace.writeFileSync(envFilePath, envFileContent.join("\n"));
    if (suffix === "") {
      console.log("\u2705  - .env file created");
    } else {
      console.log(`\u2705  - .env${suffix} file created`);
    }
  }
  console.log("\nEnvironment files created successfully \u{1F64C}");
  process.exit();
}
