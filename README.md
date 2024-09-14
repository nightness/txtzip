# **txtzip**

`txtzip` is a simple command-line tool for developers that zips all the text files in a project folder into a single text file. It respects `.gitignore` and automatically ignores the `.git` folder, making it easy to bundle up your source code for sharing with ChatGPT or other LLM.

## Features

- Collects all text files from a folder into a single archive.
- Respects `.gitignore` rules.
- Automatically skips the `.git` folder.
- Outputs a clean, readable text archive with delineations showing file paths.
- Perfect for sharing source files, preparing archives, or uploading to AI prompts.

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

### Example

```bash
npx txtzip --source ./src --output ./my-text-archive.txt
```

This will generate a `my-text-archive.txt` file containing all the text files from the `src` folder, with clear delineations marking the start and end of each file.

### Example Output

```
=== Start of File: src/index.ts ===
<file contents>

=== End of File: src/index.ts ===

=== Start of File: src/utils/helper.ts ===
<file contents>

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
