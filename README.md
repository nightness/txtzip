# **txtzip**

`txtzip` is a simple command-line tool for developers that bundles all the text files in a project folder into a single text file. It respects `.gitignore` and automatically ignores the `.git` folder, making it easy to bundle up your source code for sharing with ChatGPT or other LLMs.

## Features

- **Collects all text files** from a folder into a single archive.
- **Respects `.gitignore` rules** to exclude ignored files and folders.
- **Automatically skips the `.git` folder** to prevent including Git metadata.
- **Outputs a clean, readable text archive** with delineations showing file paths.
- **Overwrite Output File**: Use the `--overwrite` (`-w`) flag to overwrite the output file if it exists.
- **Include Only Source Code Files**: Use the `--source-only` (`-S`) flag to include only files with source code related extensions.
- **Strip Empty Lines**: Use the `--strip-empty-lines` (`-e`) flag to remove empty lines from files.
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

- **`--source`** (`-s`) (optional): The source folder to archive. Defaults to the current working directory.
- **`--output`** (`-o`) (optional): The output file name for the text archive. Defaults to `text-archive.txt`.
- **`--overwrite`** (`-w`): Overwrite the output file if it exists.
- **`--source-only`** (`-S`): Only include files with source code related extensions.
- **`--strip-empty-lines`** (`-e`): Strip empty lines from files.

### Examples

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

You can combine multiple flags to customize the output:

```bash
npx txtzip --source ./src --output ./output.txt --overwrite --source-only --strip-empty-lines
```

### Explanation of New Flags

- **`--overwrite`** (`-w`):

  If this flag is set, the program will delete the existing output file before creating a new one. This ensures that the output file doesn't get accidentally included in the archive.

- **`--source-only`** (`-S`):

  When this flag is set, the program will only include files with common source code extensions, such as `.js`, `.ts`, `.py`, `.java`, etc. This is useful for focusing on source code and excluding other text files like documentation or configuration files.

- **`--strip-empty-lines`** (`-e`):

  If this flag is set, the program will remove empty lines from the file contents before adding them to the archive. This can help reduce the size of the archive and make the content more concise.

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
git clone https://github.com/your-username/txtzip.git
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
