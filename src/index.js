#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Define the pattern for environment variables
const pattern = /process.env\.(\w+)/g;

// Define the list of suffixes for environment-specific files
const suffixes = ['', '.local', '.development', '.production'];

// Create a dictionary to store the found environment variables for each suffix
const envVars = {};
for (const suffix of suffixes) {
	envVars[suffix] = new Set();
}

// Define a function to recursively search for references to environment variables
function searchDirectory(directory) {
	// Define a list of directory names to exclude
	const excludeDirs = ['node_modules'];

	for (const item of fs.readdirSync(directory)) {
		const itemPath = path.join(directory, item);
		const stat = fs.statSync(itemPath);

		if (stat.isDirectory() && !item.startsWith('.') && !excludeDirs.includes(item)) {
			searchDirectory(itemPath);
		} else if (stat.isFile() && path.extname(itemPath) === '.js') {
			const contents = fs.readFileSync(itemPath, 'utf-8');
			let match;

			while ((match = pattern.exec(contents)) !== null) {
				for (const [suffix, vars] of Object.entries(envVars)) {
					if (!vars.has(match[1])) {
						vars.add(match[1]);
					}
				}
			}
		}
	}
}

// Get the current directory
const currentDirectory = process.cwd();

// Check if any .env files already exist in the current directory
const envFilePaths = suffixes.map((suffix) => path.join(currentDirectory, `.env${suffix}`));
const existingFiles = envFilePaths.filter(fs.existsSync);

if (existingFiles.length > 0) {
	// If any .env files already exist, prompt the user for how to proceed
	console.log('The following .env files already exist in the current directory:');
	existingFiles.forEach((filePath) => console.log(`- ${filePath}`));

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	rl.question(
		'Do you want to:\n1. Delete all existing .env files and create new ones\n2. Cancel and exit\nEnter your choice (1-2): ',
		(choice) => {
			// Handle the user's choice
			if (choice === '1') {
				existingFiles.forEach((filePath) => fs.unlinkSync(filePath));
				console.log('Deleted existing .env files');
			} else if (choice === '2') {
				console.log('Exiting...');
				process.exit(1);
			} else {
				console.log('Invalid choice. Exiting...');
				process.exit(1);
			}

			rl.close();
		},
	);
}

// Call the searchDirectory function to find all references to environment variables
searchDirectory(currentDirectory);

// Create the environment-specific .env files
for (const suffix of suffixes) {
	const envFilePath = path.join(currentDirectory, `.env${suffix}`);
	const envFileContent = [];

	// if suffix is not empty then add ENV_FILE variable
	if (suffix !== '') {
		envFileContent.push(`ENV_FILE=.env${suffix}`);
	}

	for (const envVar of envVars[suffix]) {
		if (suffix === '' && envVar === 'ENV_FILE') {
			continue;
		} else if (suffix !== '' && envVar === 'ENV_FILE') {
			envFileContent.push(`${envVar}=.${suffix}`);
		} else {
			envFileContent.push(`${envVar}=`);
		}
	}

	fs.writeFileSync(envFilePath, envFileContent.join('\n'));

	if (suffix === '') {
		console.log('.env file created');
	} else {
		console.log(`.env${suffix} file created`);
	}
}
