# Hutouch File Finder Extension

Hutouch File Finder is a Visual Studio Code extension that allows you to quickly search and open files by their name within your workspace. It skips common framework and dependency directories to focus on user-managed files.
## Features -->

- Search for files by name (with or without extension) within the workspace.
- Opens the file content in a new read-only editor tab.
- Excludes directories like `node_modules`, `.vscode`, `dist`, `build`, etc., to avoid searching within framework files.

## Requirements

- Visual Studio Code
- Node.js (for development and packaging)

## Installation

### From the Marketplace

1. Open Visual Studio Code.
2. Go to the Extensions view by clicking the Extensions icon in the Activity Bar on the side of the window or by pressing `Ctrl+Shift+X`.
3. Search for "Hutouch File Finder" and click Install.

### From VSIX File

1. Download the `.vsix` file.
2. Open Visual Studio Code.
3. Go to the Extensions view by clicking the Extensions icon in the Activity Bar on the side of the window or by pressing `Ctrl+Shift+X`.
4. Click on the `...` (More Actions) button in the top right corner and select `Install from VSIX...`.
5. Select the downloaded `.vsix` file to install the extension.

## Usage

1. Open your workspace in Visual Studio Code.
2. Press `Ctrl+Shift+P` to open the Command Palette.
3. Type `Hutouch: Activate` and press `Enter`.
4. Enter the filename (with or without extension) in the input box and press `Enter`.
5. The extension will search for the file and open its content in a new read-only editor tab if found.

## Known Issues

- None at the moment.

## Release Notes

### 1.0.0

- Initial release of Hutouch File Finder.

## Contributing

If you find any issues or have suggestions for improvements, please open an issue or submit a pull request on the [GitHub repository](#).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

