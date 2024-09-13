#!/usr/bin/env node

import { readdir, stat, readFile, writeFile } from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createInterface } from 'readline';
import { existsSync, createReadStream } from 'fs';
import ignore, { Ignore } from 'ignore';

const additionalIgnoredFiles = [
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
  '.vscode', '.idea', '.git', '.gitignore', 'node_modules', 'package-lock.json', 'yarn.lock'
];

// Define command-line argument types
interface Args {
  source: string;
  output: string;
}

// Setup command-line arguments with explicit typing
const argv = yargs(hideBin(process.argv))
  .options({
    source: {
      alias: 's',
      type: 'string',
      description: 'Source folder to archive',
      default: process.cwd(),
      demandOption: false,
    },
    output: {
      alias: 'o',
      type: 'string',
      description: 'Output file name (defaults to current working directory)',
      default: path.join(process.cwd(), 'text-archive.txt'),
      demandOption: false,
    },
  })
  .strict()
  .help()
  .parseSync() as Args;

// Extract the values for source and output
const sourceFolder = argv.source;
const outputFile = argv.output;

// Function to check if a file is binary or text
function isBinaryFile(contentBuffer: Buffer): boolean {
  for (let i = 0; i < 24 && i < contentBuffer.length; i++) {
    const charCode = contentBuffer[i];
    if ((charCode > 0 && charCode < 9) || (charCode > 13 && charCode < 32) || charCode === 127) {
      return true;
    }
  }
  return false;
}

// Read and parse the .gitignore file using the `ignore` package
async function loadIgnorePatterns(sourceFolder: string): Promise<Ignore> {
  const ig = ignore();
  const gitignorePath = path.join(sourceFolder, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignoreStream = createReadStream(gitignorePath);
    const rl = createInterface({
      input: gitignoreStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      ig.add(line);
    }
  }

  return ig;
}

// Recursive function to traverse directories and return a list of files
async function getFilesRecursively(dir: string, ig: Ignore): Promise<string[]> {
  let files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(sourceFolder, fullPath);

    // Skip additional ignored files
    if (additionalIgnoredFiles.includes(entry.name)) {
      continue;
    }

    // Check against the .gitignore rules
    if (ig.ignores(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files = files.concat(await getFilesRecursively(fullPath, ig));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

// Function to create the text archive from the source folder
async function createTextArchive(sourceFolder: string): Promise<void> {
  try {
    const ig = await loadIgnorePatterns(sourceFolder); // Load ignore patterns from .gitignore
    const allFiles = await getFilesRecursively(sourceFolder, ig);
    let archiveBuffer = ''; // Memory buffer for storing file contents

    for (const file of allFiles) {
      const fileStats = await stat(file);

      // Only consider regular files
      if (fileStats.isFile()) {
        const content = await readFile(file);

        // Skip binary files
        if (!isBinaryFile(content)) {
          const relativePath = path.relative(sourceFolder, file);
          archiveBuffer += `\n=== Start of File: ${relativePath} ===\n`;
          archiveBuffer += content.toString('utf8');
          archiveBuffer += `\n=== End of File: ${relativePath} ===\n`;
        }
      }
    }

    // Save the accumulated content to the output file
    await writeFile(outputFile, archiveBuffer, 'utf8');
    console.log(`Text archive created successfully: ${outputFile}`);
  } catch (error) {
    console.error('Error while creating text archive:', error);
  }
}

// Start the process
createTextArchive(sourceFolder);
