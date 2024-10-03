#!/usr/bin/env node

import { readdir, stat, readFile, writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
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
  chunkSize: string;
  'prefix-tree': boolean;
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
      description: 'Output file name (defaults to txtzip.md in the current directory)',
      default: configDefaults.output || './txtzip.md',
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
    chunkSize: {
      alias: 'c',
      type: 'string',
      description: 'Maximum size of each output file (e.g., 1M, 512k)',
      default: configDefaults.chunkSize || '',
    },
    'prefix-tree': {
      alias: 'p',
      type: 'boolean',
      description: 'Prefix the output with a tree-like structure of included files',
      default: configDefaults['prefix-tree'] || false,
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
  chunkSize: chunkSizeStr,
  'prefix-tree': prefixTree,
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

// Function to determine if a pattern is recursive
function isPatternRecursive(pattern: string): boolean {
  return !pattern.includes('/') && !pattern.includes('\\');
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

      let includeMatch = includePatterns.length === 0;
      let excludeMatch = false;

      // Apply include patterns
      for (const pattern of includePatterns) {
        const isRecursive = isPatternRecursive(pattern);
        const matchPath = isRecursive ? relativePath : path.relative(resolvedSourceFolder, fullPath);
        if (minimatch(matchPath, pattern, { matchBase: isRecursive })) {
          includeMatch = true;
          break;
        }
      }

      // Apply exclude patterns
      for (const pattern of excludePatterns) {
        if (minimatch(relativePath, pattern)) {
          excludeMatch = true;
          break;
        }
      }

      if (includeMatch && !excludeMatch) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// Function to parse size strings (e.g., '1M', '512k') into bytes
function parseSize(sizeStr: string): number {
  const units: { [key: string]: number } = {
    '': 1,
    'b': 1,
    'k': 1024,
    'kb': 1024,
    'm': 1024 * 1024,
    'mb': 1024 * 1024,
    'g': 1024 * 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
  };

  const match = sizeStr.trim().toLowerCase().match(/^(\d+)([bkmg]b?)?$/);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`);
  }
  const num = parseInt(match[1], 10);
  const unit = match[2] || '';
  const multiplier = units[unit];
  if (multiplier === undefined) {
    throw new Error(`Invalid size unit in size: ${sizeStr}`);
  }
  return num * multiplier;
}

let maxChunkSize = 0;

if (chunkSizeStr) {
  try {
    maxChunkSize = parseSize(chunkSizeStr);
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

// Function to get the output file path based on index
function getOutputFilePath(index: number): string {
  const ext = path.extname(resolvedOutputFile);
  const baseName = path.basename(resolvedOutputFile, ext);
  const dirName = path.dirname(resolvedOutputFile);
  const indexStr = index.toString().padStart(2, '0');
  return path.join(dirName, `${baseName}.${indexStr}${ext}`);
}

// Tree node interface
interface TreeNode {
  name: string;
  children: TreeNode[];
  isFile: boolean;
}

// Function to build the tree structure from file paths
function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', children: [], isFile: false };

  for (const relPath of paths) {
    const parts = relPath.split(path.sep);
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let childNode = currentNode.children.find(child => child.name === part);
      if (!childNode) {
        childNode = {
          name: part,
          children: [],
          isFile: i === parts.length - 1, // If last part, it's a file
        };
        currentNode.children.push(childNode);
      }
      currentNode = childNode;
    }
  }
  return root;
}

// Function to render the tree into a string
function renderTree(
  node: TreeNode,
  prefix: string = '',
  isLast: boolean = true,
  isRoot: boolean = true
): string[] {
  const lines: string[] = [];
  const connector = isRoot ? '' : (isLast ? '└── ' : '├── ');
  if (node.name) {
    lines.push(prefix + connector + node.name + (node.isFile ? '' : path.sep));
  }

  const newPrefix = prefix + (isRoot ? '' : (isLast ? '    ' : '│   '));

  node.children.sort((a, b) => {
    // Directories first
    if (!a.isFile && b.isFile) return -1;
    if (a.isFile && !b.isFile) return 1;
    return a.name.localeCompare(b.name);
  });

  node.children.forEach((child, index) => {
    const isLastChild = index === node.children.length - 1;
    const childLines = renderTree(child, newPrefix, isLastChild, false);
    lines.push(...childLines);
  });

  return lines;
}

// Function to get language identifier from file extension
function getLanguageFromExtension(ext: string): string {
  const extensionMap: { [key: string]: string } = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'jsx',
    '.tsx': 'tsx',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'cpp',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.kts': 'kotlin',
    '.rs': 'rust',
    '.sh': 'bash',
    '.bat': 'bat',
    '.ps1': 'powershell',
    '.pl': 'perl',
    '.lua': 'lua',
    '.sql': 'sql',
    '.scala': 'scala',
    '.groovy': 'groovy',
    '.hs': 'haskell',
    '.erl': 'erlang',
    '.ex': 'elixir',
    '.exs': 'elixir',
    '.r': 'r',
    '.jl': 'julia',
    '.f90': 'fortran',
    '.f95': 'fortran',
    '.f03': 'fortran',
    '.clj': 'clojure',
    '.cljc': 'clojure',
    '.cljs': 'clojure',
    '.coffee': 'coffeescript',
    '.dart': 'dart',
    '.elm': 'elm',
    '.fs': 'fsharp',
    '.fsi': 'fsharp',
    '.fsx': 'fsharp',
    '.gd': 'gdscript',
    '.hbs': 'handlebars',
    '.idr': 'idris',
    '.nim': 'nim',
    '.ml': 'ocaml',
    '.mli': 'ocaml',
    '.mll': 'ocaml',
    '.mly': 'ocaml',
    '.purs': 'purescript',
    '.rkt': 'racket',
    '.vb': 'vb.net',
    '.vbs': 'vbscript',
    '.vba': 'vba',
    '.feature': 'gherkin',
    '.s': 'assembly',
    '.asm': 'assembly',
    '.sln': 'xml',
    '.md': 'markdown',
    '.markdown': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.json': 'json',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.ini': 'ini',
    '.conf': '',
    '.config': '',
    '.toml': 'toml',
    '.tex': 'latex',
    '.bib': 'bibtex',
    '.txt': '',
  };
  return extensionMap[ext.toLowerCase()] || '';
}

// Function to create the text archive from the source folder
async function createTextArchive(): Promise<void> {
  try {
    const ig = await loadIgnorePatterns(resolvedSourceFolder); // Load ignore patterns from .gitignore
    const allFiles = await getFilesRecursively(resolvedSourceFolder, ig);

    // Prepare to collect the content
    let outputFilesContent: string[] = [''];
    let currentChunkSize = 0;
    let currentFileIndex = 0;
    let isContinuingFile = false;
    let currentFileName = '';

    // Generate tree structure if prefixTree is true
    if (prefixTree) {
      const relativePaths = allFiles.map(file => path.relative(resolvedSourceFolder, file));
      const tree = buildTree(relativePaths);

      // Sort the root-level children for consistent ordering
      tree.children.sort((a, b) => {
        // Directories first
        if (!a.isFile && b.isFile) return -1;
        if (a.isFile && !b.isFile) return 1;
        return a.name.localeCompare(b.name);
      });

      const treeLines = renderTree(tree, '', true, true);
      const treeString = treeLines.join('\n');
      const treeStringWithSpacing = '```plaintext\n' + treeString + '\n```\n\n';
      const treeStringSize = Buffer.byteLength(treeStringWithSpacing, 'utf8');

      if (maxChunkSize > 0 && currentChunkSize + treeStringSize > maxChunkSize) {
        // Tree doesn't fit in current chunk, start a new chunk
        outputFilesContent.unshift(treeStringWithSpacing);
        currentChunkSize = treeStringSize;
        currentFileIndex++;
      } else {
        // Add tree to the current chunk
        outputFilesContent[0] = treeStringWithSpacing + outputFilesContent[0];
        currentChunkSize += treeStringSize;
      }
    }

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

          const ext = path.extname(file).toLowerCase();
          const isMarkdown = ext === '.md' || ext === '.markdown';
          let language = getLanguageFromExtension(ext);

          let fileHeader = `\n## File: ${relativePath}\n\n`;
          let fileContent = '';

          if (isMarkdown) {
            // Include content as-is for Markdown files
            fileContent = content + '\n';
          } else {
            // Wrap content in code block for other files
            fileContent = `\`\`\`${language}\n${content}\n\`\`\`\n`;
          }

          let totalFileContent = fileHeader + fileContent;
          let totalFileContentSize = Buffer.byteLength(totalFileContent, 'utf8');

          let contentPointer = 0;

          while (contentPointer < totalFileContent.length) {
            let remainingChunkSpace = maxChunkSize > 0 ? maxChunkSize - currentChunkSize : Infinity;
            let remainingContentLength = totalFileContent.length - contentPointer;
            let sliceLength = Math.min(remainingChunkSpace, remainingContentLength);

            // Ensure we don't cut in the middle of a multi-byte character
            let contentSlice = totalFileContent.substr(contentPointer, sliceLength);

            if (maxChunkSize > 0 && currentChunkSize + Buffer.byteLength(contentSlice, 'utf8') > maxChunkSize) {
              // Adjust slice to fit into the chunk
              while (Buffer.byteLength(contentSlice, 'utf8') > remainingChunkSpace && sliceLength > 0) {
                sliceLength--;
                contentSlice = totalFileContent.substr(contentPointer, sliceLength);
              }
            }

            // Update content pointer
            contentPointer += sliceLength;

            // Add continuation headers and footers if necessary
            if (isContinuingFile) {
              // We're continuing a file from the previous chunk
              contentSlice = `\n## Continuation of File: ${currentFileName}\n\n` + contentSlice;
              isContinuingFile = false;
            }

            // Check if we have reached the end of the file in this chunk
            if (contentPointer < totalFileContent.length) {
              // Not at the end, so we need to add a continuation notice
              contentSlice += `\n*File continues in next part*\n`;
              isContinuingFile = true;
              currentFileName = relativePath;
            }

            // Add content to the current chunk
            outputFilesContent[currentFileIndex] += contentSlice;
            currentChunkSize += Buffer.byteLength(contentSlice, 'utf8');

            // If we've reached the max chunk size, start a new chunk
            if (maxChunkSize > 0 && currentChunkSize >= maxChunkSize) {
              currentFileIndex++;
              outputFilesContent.push('');
              currentChunkSize = 0;
            }
          }
        }
      }
    }

    // Write output files
    for (let i = 0; i < outputFilesContent.length; i++) {
      const outputFilePath = outputFilesContent.length > 1 ? getOutputFilePath(i + 1) : resolvedOutputFile;

      if (!overwriteOutput && existsSync(outputFilePath)) {
        console.error(
          `Output file already exists: ${outputFilePath}. Use the -w flag to overwrite it.`
        );
        return;
      }

      await writeFile(outputFilePath, outputFilesContent[i], 'utf8');
    }

    console.log(`Markdown archive created successfully with ${outputFilesContent.length} file(s).`);
  } catch (error) {
    console.error('Error while creating markdown archive:', error);
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
