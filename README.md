# **txtzip**

`txtzip` is a simple command-line tool for developers that bundles all the text files in a project folder into a single **Markdown** file. It respects `.gitignore` and automatically ignores the `.git` folder, making it easy to bundle up your source code for sharing with ChatGPT or other LLMs.

## Features

- **Collects all text files** from a folder into a single **Markdown** archive.
- **Respects `.gitignore` rules** to exclude ignored files and folders.
- **Automatically skips the `.git` folder** to prevent including Git metadata.
- **Include or Exclude Files**: Use the `--include` (`-i`) and `--exclude` (`-x`) options to include or exclude files based on glob patterns.
  - **Recursive Matching**: Patterns without a path separator (e.g., `*.ts`) will match files recursively in all subdirectories.
  - **Specific Matching**: Patterns with a path separator (e.g., `src/**/*.tsx`) will match files according to the specified path.
- **Outputs a clean, readable Markdown archive** with code blocks and formatted file paths.
- **Proper Handling of Markdown Files**: When including Markdown files (e.g., `README.md`), their content is included as-is without wrapping all of it in a code block.
- **Prefix Tree Structure**: Use the `--prefix-tree` (`-p`) flag to include a tree-like structure of the included files at the beginning of the output.
- **Overwrite Output File**: Use the `--overwrite` (`-w`) flag to overwrite the output file if it exists.
- **Chunk Large Output Files**: Use the `--chunk-size` (`-c`) option to split the output into multiple files when it exceeds the specified size.
- **Include Only Source Code Files**: Use the `--source-only` (`-S`) flag to include only files with source code-related extensions.
- **Strip Empty Lines**: Use the `--strip-empty-lines` (`-e`) flag to remove empty lines from files.
- **Support for Configuration File**: Specify default options in a `txtzip.json` file located in the source folder.
- **Environment Variable Support**: Set default command-line arguments using the `TXTZIP_ARGS` environment variable.
- **Check for Updates**: Use the `--check-update` (`-u`) flag to check if a newer version is available.
- **Version Command**: Use the `--version` (`-v`) flag to display the current version.
- **Help Command**: Use the `--help` (`-h`) flag to display detailed help information.
- Perfect for **sharing source files**, **preparing archives**, or **uploading to AI prompts**.

## Installation

You can use `txtzip` directly with `npx` or install it globally:

### Using `npx` (no installation required)

**`--source` and `--output` are both optional and default to the current directory and `txtzip.md`, respectively.**

```bash
npx txtzip --source ./ --output ./txtzip.md
```

### Install globally

```bash
npm install -g txtzip
```

Then run:

```bash
txtzip --source ./your-folder --output ./your-output.md
```

## Usage

### Command-line options:

- **`--source`** (`-s`): The source folder to archive. Defaults to the current working directory.
- **`--output`** (`-o`): The output file name for the Markdown archive. Defaults to `txtzip.md` in the current directory.
- **`--overwrite`** (`-w`): Overwrite the output file if it exists.
- **`--chunk-size`** (`-c`): Maximum size of each output file (e.g., `1M`, `512k`). If specified, the output will be split into multiple files not exceeding this size.
- **`--source-only`** (`-S`): Only include files with source code-related extensions.
- **`--strip-empty-lines`** (`-e`): Strip empty lines from files.
- **`--include`** (`-i`): Include files matching the given glob patterns. Can be specified multiple times.
  - **Recursive Matching**: Patterns without a path separator (e.g., `*.ts`) will match files recursively in all subdirectories.
  - **Specific Matching**: Patterns with a path separator (e.g., `src/**/*.tsx`) will match files according to the specified path.
- **`--exclude`** (`-x`): Exclude files matching the given glob patterns. Can be specified multiple times.
- **`--prefix-tree`** (`-p`): Include a tree-like structure of the included files at the beginning of the output.
- **`--check-update`** (`-u`): Check for the latest version available.
- **`--help`** (`-h`): Show help information about the command-line options.
- **`--version`** (`-v`): Show the current version.

### Configuration File: `txtzip.json`

You can define default options in a `txtzip.json` file located in the source folder. This allows you to configure `txtzip` without having to pass all options via the command line.

Example `txtzip.json`:

```json
{
  "source": "./src",
  "output": "./archive.md",
  "overwrite": true,
  "chunkSize": "10k",
  "source-only": true,
  "strip-empty-lines": true,
  "prefix-tree": true,
  "include": ["*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules/**", "*.test.js"]
}
```

### How `txtzip.json` Works:

- `txtzip` will look for `txtzip.json` in the source folder.
- Options specified in `txtzip.json` will be used as **default values** for command-line options.
- **Command-line arguments override** the values in `txtzip.json`.
- If `txtzip.json` is not found, the tool will use its built-in defaults.

### Environment Variable: `TXTZIP_ARGS`

You can set default command-line arguments using the `TXTZIP_ARGS` environment variable.

#### **`TXTZIP_ARGS`**:

- Contains default command-line arguments as a string (e.g., `"-wSe"`).
- Arguments specified in `TXTZIP_ARGS` are parsed and used as defaults.
- **Note**: Command-line arguments provided when running the program will override these defaults.

## **Examples**

### **Include a Tree Structure of Included Files**

Include a tree-like structure of the included files at the beginning of the output:

```bash
txtzip --source ./src --output ./output.md --prefix-tree
```

Example output at the beginning of `output.md`:

```plaintext
app/
├── page.tsx
├── layout.tsx
├── globals.css
└── theme/
    └── theme.ts

src/
├── app.controller.ts
├── app.module.ts
└── main.ts

docker-compose.yml
docker-compose.dev.yml
start-hybrid.js
jest.config.json
next.config.js
package.json
tsconfig.json
tsconfig.server.json
```

### **Handling Markdown Files**

When `txtzip` encounters Markdown files like `README.md`, it includes their content directly without wrapping it in code blocks. This ensures that the Markdown formatting is preserved in the output.

### **Include Patterns with Recursive and Specific Matching**

- **Include all `.ts` files recursively**:

  ```bash
  txtzip -i "*.ts" --source ./src --output ./output.md
  ```

- **Include only `.tsx` files in the `src` directory and its subdirectories**:

  ```bash
  txtzip -i "src/**/*.tsx" --source ./ --output ./output.md
  ```

- **Include all `.js` files in the current directory only (non-recursive)**:

  ```bash
  txtzip -i "./*.js" --source ./ --output ./output.md
  ```

### **Set `TXTZIP_ARGS` to include `-w`, `-S`, and `-e` flags:**

```bash
export TXTZIP_ARGS="-wSe"

npx txtzip --source ./src --output ./output.md
```

### **Override an argument from `TXTZIP_ARGS`:**

```bash
export TXTZIP_ARGS="-wSe"

# Override the overwrite flag to false
npx txtzip --source ./src --output ./output.md --no-overwrite
```

### **Exclude test files and node_modules:**

```bash
txtzip -x "*.test.js" -x "node_modules/**" --source ./src --output ./output.md
```

### **Chunk Large Output Files**

Split the output into multiple files, each not exceeding 1MB:

```bash
txtzip --source ./src --output ./output.md --chunk-size 1M
```

### **Check for Updates**

Check if a newer version of `txtzip` is available:

```bash
npx txtzip --check-update
```

### **Show Version**

Display the current version:

```bash
npx txtzip --version
```

### **Overwrite Output File**

Overwrite the output file if it already exists:

```bash
npx txtzip --source ./src --output ./output.md --overwrite
```

### **Only Include Source Code Files**

Include only files with common source code extensions:

```bash
npx txtzip --source ./src --output ./output.md --source-only
```

### **Strip Empty Lines**

Remove empty lines from files before adding them to the archive:

```bash
n

px txtzip --source ./src --output ./output.md --strip-empty-lines
```

### **Combining Flags**

You can combine multiple flags and environment variables to customize the output:

```bash
export TXTZIP_ARGS="-wS"

npx txtzip --source ./src --output ./output.md --strip-empty-lines --prefix-tree
```

### Getting Help

To display detailed help information:

```bash
npx txtzip --help
```

or

```bash
txtzip -h
```

This will display information about all available options, along with usage examples.

### Example Output

```plaintext
app/
├── page.tsx
├── layout.tsx
├── globals.css
└── theme/
    └── theme.ts

src/
├── app.controller.ts
├── app.module.ts
└── main.ts

docker-compose.yml
docker-compose.dev.yml
start-hybrid.js
jest.config.json
next.config.js
package.json
tsconfig.json
tsconfig.server.json
```

## File: src/index.ts

```typescript
#!/usr/bin/env node
import { readdir, stat } from 'fs/promises';
import path from 'path';
// ... rest of the file contents
```

## File: README.md

This is the content of the `README.md` file included as-is, without being wrapped in a code block.

---

## Development

### Clone the repository

```bash
git clone https://github.com/nightness/txtzip.git
cd txtzip
npm install
```

### Build

```bash
npm run build
```

### Test locally

```bash
npm link
txtzip --source ./src --output ./output.md
```

## Contributing

Feel free to submit issues or pull requests to improve `txtzip`. Contributions are always welcome!

## License

This project is licensed under the ISC License.