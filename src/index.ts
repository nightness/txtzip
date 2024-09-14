#!/usr/bin/env node

import { readdir, stat, readFile, writeFile, unlink } from 'fs/promises';
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
  overwrite: boolean;
  'source-only': boolean;
  'strip-empty-lines': boolean;
}

// Function to parse environment variable arguments into an array
function parseEnvArgs(envArgs: string | undefined): string[] {
  if (!envArgs) return [];
  // Use a simple regex to split arguments similar to a shell
  return envArgs.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
}

// Parse environment variable arguments
const envArgs = parseEnvArgs(process.env.TXTZIP_ARGS);

// Setup command-line arguments with explicit typing
const argv = yargs([...envArgs, ...hideBin(process.argv)])
  .usage('Usage: txtzip [options]')
  .options({
    source: {
      alias: 's',
      type: 'string',
      description: 'Source folder to archive (defaults to current working directory)',
      default: process.cwd(),
    },
    output: {
      alias: 'o',
      type: 'string',
      description: 'Output file name (defaults to text-archive.txt in the current directory)',
      default: path.join(process.cwd(), 'text-archive.txt'),
    },
    overwrite: {
      alias: 'w',
      type: 'boolean',
      description: 'Overwrite the output file if it exists',
      default: false,
    },
    'source-only': {
      alias: 'S',
      type: 'boolean',
      description: 'Only include files with source code related extensions',
      default: false,
    },
    'strip-empty-lines': {
      alias: 'e',
      type: 'boolean',
      description: 'Strip empty lines from files',
      default: false,
    },
  })
  .alias('help', 'h')
  .help('help')
  .epilog('For more information, visit https://github.com/nightness/txtzip')
  .example([
    [
      'txtzip --source ./src --output ./output.txt',
      'Bundle all text files from ./src to ./output.txt',
    ],
    ['txtzip -w', 'Overwrite the output file if it exists'],
    ['txtzip -S -e', 'Include only source code files and strip empty lines'],
  ])
  .argv as Args;

// Extract the values for command-line arguments
const sourceFolder = argv.source;
const outputFile = argv.output;
const overwriteOutput = argv.overwrite;
const sourceOnly = argv['source-only'];
const stripEmptyLines = argv['strip-empty-lines'];

// List of common source code file extensions
const sourceCodeExtensions = [
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rb', '.php', '.swift', '.kt', '.kts', '.rs', '.sh', '.bat',
  '.ps1', '.pl', '.lua', '.sql', '.scala', '.groovy', '.hs', '.erl', '.ex',
  '.exs', '.r', '.jl', '.f90', '.f95', '.f03', '.clj', '.cljc', '.cljs',
  '.coffee', '.dart', '.elm', '.fs', '.fsi', '.fsx', '.fsscript', '.gd',
  '.hbs', '.idr', '.nim', '.ml', '.mli', '.mll', '.mly', '.php',
  '.purs', '.rkt', '.vb', '.vbs', '.vba', '.feature', '.s', '.asm', '.sln',
  '.md', '.markdown', '.yml', '.yaml', '.json', '.xml', '.html', '.css',
  '.scss', '.less', '.ini', '.conf', '.config', '.toml', '.tex', '.bib',
];

// Function to check if a file is binary or text
function isBinaryFile(contentBuffer: Buffer): boolean {
  for (let i = 0; i < 24 && i < contentBuffer.length; i++) {
    const charCode = contentBuffer[i];
    if (
      (charCode > 0 && charCode < 9) ||
      (charCode > 13 && charCode < 32) ||
      charCode === 127
    ) {
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
async function getFilesRecursively(
  dir: string,
  ig: Ignore
): Promise<string[]> {
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
      // If source-only flag is set, filter by source code extensions
      if (sourceOnly) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!sourceCodeExtensions.includes(ext)) {
          continue;
        }
      }
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

    // Overwrite output file if the flag is set
    if (overwriteOutput && existsSync(outputFile)) {
      await unlink(outputFile);
    }

    let archiveBuffer = ''; // Memory buffer for storing file contents

    for (const file of allFiles) {
      const fileStats = await stat(file);

      // Only consider regular files
      if (fileStats.isFile()) {
        const contentBuffer = await readFile(file);

        // Skip binary files
        if (!isBinaryFile(contentBuffer)) {
          const relativePath = path.relative(sourceFolder, file);
          let content = contentBuffer.toString('utf8');

          // Strip empty lines if the flag is set
          if (stripEmptyLines) {
            content = content
              .split('\n')
              .filter((line) => line.trim() !== '')
              .join('\n');
          }

          archiveBuffer += `\n=== Start of File: ${relativePath} ===\n`;
          archiveBuffer += content;
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
