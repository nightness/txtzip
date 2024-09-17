#!/usr/bin/env node

import { readdir, stat, readFile, writeFile, unlink } from 'fs/promises';
import { existsSync, readFileSync, createReadStream } from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createInterface } from 'readline';
import ignore, { Ignore } from 'ignore';
import https from 'https';
import { minimatch } from 'minimatch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const additionalIgnoredFiles = [
  '.DS_Store', 'Thumbs.db', 'desktop.ini', 'txtzip.json', 'txtzip.txt',
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
  include: string[];
  exclude: string[];
}

// Function to parse environment variable arguments into an array
function parseEnvArgs(envArgs: string | undefined): string[] {
  if (!envArgs) return [];
  return envArgs.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
}

// Parse environment variable arguments
const envArgs = parseEnvArgs(process.env.TXTZIP_ARGS);

// Initial parse to get 'source' option
const initialArgv = yargs([...envArgs, ...hideBin(process.argv)])
  .options({
    source: {
      alias: 's',
      type: 'string',
      default: '.',
    },
  })
  .help(false)
  .version(false)
  .parseSync();

// Resolve the source folder to an absolute path
const sourceFolder = path.resolve(initialArgv.source);

// Load the `txtzip.json` configuration file if it exists
function loadConfigFromFile(sourceFolder: string): Partial<Args> {
  const configFile = path.join(sourceFolder, 'txtzip.json');
  if (existsSync(configFile)) {
    try {
      const configContent = readFileSync(configFile, 'utf8');
      return JSON.parse(configContent) as Partial<Args>;
    } catch (error: any) {
      console.error(`Failed to parse txtzip.json: ${error?.message}`);
    }
  }
  return {};
}

// Load defaults from `txtzip.json` if it exists in the source folder
const configDefaults = loadConfigFromFile(sourceFolder);

// Now parse argv again, providing 'configDefaults' as defaults
const argv = yargs([...envArgs, ...hideBin(process.argv)])
  .usage('Usage: txtzip [options]')
  .wrap(process.stdout.columns || 80) // Set the wrap width to the terminal width
  .options({
    source: {
      alias: 's',
      type: 'string',
      description: 'Source folder to archive (defaults to current working directory)',
      default: configDefaults.source || '.',
    },
    output: {
      alias: 'o',
      type: 'string',
      description: 'Output file name (defaults to txtzip.txt in the current directory)',
      default: configDefaults.output || './txtzip.txt',
    },
    overwrite: {
      alias: 'w',
      type: 'boolean',
      description: 'Overwrite the output file if it exists',
      default: configDefaults.overwrite || false,
    },
    'source-only': {
      alias: 'S',
      type: 'boolean',
      description: 'Only include files with source code related extensions',
      default: configDefaults['source-only'] || false,
    },
    'strip-empty-lines': {
      alias: 'e',
      type: 'boolean',
      description: 'Strip empty lines from files',
      default: configDefaults['strip-empty-lines'] || false,
    },
    'check-update': {
      alias: 'u',
      type: 'boolean',
      description: 'Check for the latest version available',
      default: configDefaults['check-update'] || false,
    },
    include: {
      alias: 'i',
      type: 'array',
      description: 'Include files matching the given glob patterns',
      default: configDefaults.include || [],
    },
    exclude: {
      alias: 'x',
      type: 'array',
      description: 'Exclude files matching the given glob patterns',
      default: configDefaults.exclude || [],
    },
  })
  .alias('help', 'h')
  .alias('version', 'v')
  .version()
  .help('help')
  .epilog('For more information, visit https://github.com/nightness/txtzip')
  .parseSync() as Args;

// Extract the values for command-line arguments
const {
  source,
  output,
  overwrite: overwriteOutput,
  'source-only': sourceOnly,
  'strip-empty-lines': stripEmptyLines,
  'check-update': checkUpdate,
  include: includePatterns,
  exclude: excludePatterns,
} = argv;

// Resolve paths to absolute paths
const resolvedSourceFolder = path.resolve(sourceFolder);
const resolvedOutputFile = path.resolve(output);

// List of common source code file extensions
const sourceCodeExtensions = [
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rb', '.php', '.swift', '.kt', '.kts', '.rs', '.sh', '.bat',
  '.ps1', '.pl', '.lua', '.sql', '.scala', '.groovy', '.hs', '.erl', '.ex',
  '.exs', '.r', '.jl', '.f90', '.f95', '.f03', '.clj', '.cljc', '.cljs',
  '.coffee', '.dart', '.elm', '.fs', '.fsi', '.fsx', '.fsscript', '.gd',
  '.hbs', '.idr', '.nim', '.ml', '.mli', '.mll', '.mly', '.purs', '.rkt',
  '.vb', '.vbs', '.vba', '.feature', '.s', '.asm', '.sln', '.md', '.markdown',
  '.yml', '.yaml', '.json', '.xml', '.html', '.css', '.scss', '.less', '.ini',
  '.conf', '.config', '.toml', '.tex', '.bib',
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
    const gitignoreContent = await readFile(gitignorePath, 'utf8');
    ig.add(gitignoreContent);
  }

  // Add additional ignored files
  ig.add(additionalIgnoredFiles);

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
    const relativePath = path.relative(resolvedSourceFolder, fullPath);

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

      // Apply exclude patterns
      if (excludePatterns.some(pattern => minimatch(relativePath, pattern))) {
        continue;
      }

      // Apply include patterns
      if (
        includePatterns.length > 0 &&
        !includePatterns.some(pattern => minimatch(relativePath, pattern))
      ) {
        continue;
      }

      files.push(fullPath);
    }
  }

  return files;
}

// Function to create the text archive from the source folder
async function createTextArchive(): Promise<void> {
  try {
    const ig = await loadIgnorePatterns(resolvedSourceFolder); // Load ignore patterns from .gitignore
    const allFiles = await getFilesRecursively(resolvedSourceFolder, ig);

    const outputFileExists = existsSync(resolvedOutputFile);

    // Overwrite output file if the flag is set
    if (overwriteOutput && outputFileExists) {
      await unlink(resolvedOutputFile);
    } else if (outputFileExists) {
      console.error(
        `Output file already exists: ${resolvedOutputFile}. Use the -w flag to overwrite it.`
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
          const relativePath = path.relative(resolvedSourceFolder, file);
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
    await writeFile(resolvedOutputFile, archiveBuffer, 'utf8');
    console.log(`Text archive created successfully: ${resolvedOutputFile}`);
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
  createTextArchive();
}
