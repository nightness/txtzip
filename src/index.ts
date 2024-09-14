#!/usr/bin/env node

import { readdir, stat, readFile, writeFile, unlink } from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createInterface } from 'readline';
import { existsSync, createReadStream } from 'fs';
import ignore, { Ignore } from 'ignore';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  'check-update': boolean;
}

// Function to parse environment variable arguments into an array
function parseEnvArgs(envArgs: string | undefined): string[] {
  if (!envArgs) return [];
  // Use a simple regex to split arguments similar to a shell
  return envArgs.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
}

// Parse environment variable arguments
const envArgs = parseEnvArgs(process.env.TXTZIP_ARGS);

// Combine environment variable arguments with command-line arguments
// Command-line arguments take precedence
const argv = yargs([...envArgs, ...hideBin(process.argv)])
  .usage('Usage: txtzip [options]')
  .wrap(process.stdout.columns || 80) // Set the wrap width to the terminal width
  .options({
    source: {
      alias: 's',
      type: 'string',
      description: 'Source folder to archive (defaults to current working directory)',
      default: '.',
    },
    output: {
      alias: 'o',
      type: 'string',
      description:
        'Output file name (defaults to text-archive.txt in the current directory)',
      default: './text-archive.txt',
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
    'check-update': {
      alias: 'u',
      type: 'boolean',
      description: 'Check for the latest version available',
      default: false,
    },
    // **Do not define a 'version' option here**
  })
  .alias('help', 'h')
  .alias('version', 'v')
  .version()
  .help('help')
  .epilog('For more information, visit https://github.com/nightness/txtzip')
  .argv as Args;

// Extract the values for command-line arguments
const {
  source: sourceFolder,
  output: outputFile,
  overwrite: overwriteOutput,
  'source-only': sourceOnly,
  'strip-empty-lines': stripEmptyLines,
  'check-update': checkUpdate,
} = argv;

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

    const outputFileExists = existsSync(outputFile);

    // Overwrite output file if the flag is set
    if (overwriteOutput && outputFileExists) {
      await unlink(outputFile);
    } else if (outputFileExists) {
      console.error(
        `Output file already exists: ${outputFile}. Use the -w flag to overwrite it.`
      );
      return;
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

// Function to check for the latest version on npm
function checkForLatestVersion() {
  const packageName = 'txtzip';
  const npmRegistryUrl = `https://registry.npmjs.org/${packageName}`;

  // Read the current version from package.json
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  let currentVersion = '';

  try {
    const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    currentVersion = packageJson.version;
    console.log(`Current version: ${currentVersion}`);
  } catch (error) {
    console.error('Failed to read package.json:', error);
    process.exit(1);
  }

  https
    .get(npmRegistryUrl, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const npmData = JSON.parse(data);
          const latestVersion = npmData['dist-tags'].latest;

          if (latestVersion !== currentVersion) {
            console.log(
              `A new version of ${packageName} is available: ${latestVersion}. You are using version ${currentVersion}.`
            );
            console.log(
              `Run 'npm install -g ${packageName}' to update to the latest version.`
            );
          } else {
            console.log(`You are using the latest version (${currentVersion}).`);
          }
        } catch (error) {
          console.error('Failed to parse npm registry data:', error);
        }
      });
    })
    .on('error', (err) => {
      console.error('Failed to check for latest version:', err);
    });
}

// Main execution
if (checkUpdate) {
  checkForLatestVersion();
} else {
  // Start the main process
  createTextArchive(sourceFolder);
}