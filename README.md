# **txtzip**

`txtzip` is a simple command-line tool for developers that bundles all the text files in a project folder into a single text file. It respects `.gitignore` and automatically ignores the `.git` folder, making it easy to bundle up your source code for sharing with ChatGPT or other LLMs.

## Features

- **Collects all text files** from a folder into a single archive.
- **Respects `.gitignore` rules** to exclude ignored files and folders.
- **Automatically skips the `.git` folder** to prevent including Git metadata.
- **Include or Exclude Files**: Use the `--include` (`-i`) and `--exclude` (`-x`) options to include or exclude files based on glob patterns.
- **Outputs a clean, readable text archive** with delineations showing file paths.
- **Overwrite Output File**: Use the `--overwrite` (`-w`) flag to overwrite the output file if it exists.
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

```bash
npx txtzip --source ./your-folder --output ./your-output.txt
```

### Install globally

```bash
npm install -g txtzip
```

Then run:

```bash
txtzip --source ./your-folder --output ./your-output.txt
```

## Usage

### Command-line options:

- **`--source`** (`-s`): The source folder to archive. Defaults to the current working directory.
- **`--output`** (`-o`): The output file name for the text archive. Defaults to `text-archive.txt` in the current directory.
- **`--overwrite`** (`-w`): Overwrite the output file if it exists.
- **`--source-only`** (`-S`): Only include files with source code-related extensions.
- **`--strip-empty-lines`** (`-e`): Strip empty lines from files.
- **`--include`** (`-i`): Include files matching the given glob patterns. Can be specified multiple times.
- **`--exclude`** (`-x`): Exclude files matching the given glob patterns. Can be specified multiple times.
- **`--check-update`** (`-u`): Check for the latest version available.
- **`--help`** (`-h`): Show help information about the command-line options.
- **`--version`** (`-v`): Show the current version.

### Configuration File: `txtzip.json`

You can define default options in a `txtzip.json` file located in the source folder. This allows you to configure `txtzip` without having to pass all options via the command line.

Example `txtzip.json`:

```json
{
  "source": "./src",
  "output": "./archive.txt",
  "overwrite": true,
  "source-only": true,
  "strip-empty-lines": true,
  "include": ["*.ts", "*.js"],
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

**Examples:**

- **Set `TXTZIP_ARGS` to include `-w`, `-S`, and `-e` flags:**

  ```bash
  export TXTZIP_ARGS="-wSe"

  npx txtzip --source ./src --output ./output.txt
  ```

- **Override an argument from `TXTZIP_ARGS`:**

  ```bash
  export TXTZIP_ARGS="-wSe"

  # Override the overwrite flag to false
  npx txtzip --source ./src --output ./output.txt --no-overwrite
  ```

### Examples

#### **Include and Exclude Patterns**

- **Include only `.ts` and `.js` files:**

  ```bash
  txtzip -i "*.ts" -i "*.js" --source ./src --output ./output.txt
  ```

- **Exclude test files and node_modules:**

  ```bash
  txtzip -x "*.test.js" -x "node_modules/**" --source ./src --output ./output.txt
  ```

#### **Check for Updates**

Check if a newer version of `txtzip` is available:

```bash
npx txtzip --check-update
```

#### **Show Version**

Display the current version:

```bash
npx txtzip --version
```

#### **Overwrite Output File**

Overwrite the output file if it already exists:

```bash
npx txtzip --source ./src --output ./output.txt --overwrite
```

#### **Only Include Source Code Files**

Include only files with common source code extensions:

```bash
npx txtzip --source ./src --output ./output.txt --source-only
```

#### **Strip Empty Lines**

Remove empty lines from files before adding them to the archive:

```bash
npx txtzip --source ./src --output ./output.txt --strip-empty-lines
```

#### **Combining Flags**

You can combine multiple flags and environment variables to customize the output:

```bash
export TXTZIP_ARGS="-wS"

npx txtzip --source ./src --output ./output.txt --strip-empty-lines
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

```
=== Start of File: src/index.ts ===
#!/usr/bin/env node
import { readdir, stat } from 'fs/promises';
import path from 'path';
// ... rest of the file contents

=== End of File: src/index.ts ===

=== Start of File: src/utils/helper.ts ===
export function helper() {
  // helper function code
}
// ... rest of the file contents

=== End of File: src/utils/helper.ts ===
```

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
txtzip --source ./src --output ./output.txt
```

## Contributing

Feel free to submit issues or pull requests to improve `txtzip`. Contributions are always welcome!

## License

This project is licensed under the ISC License.
