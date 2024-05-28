
# HuTouch AI

![HuTouch AI Logo](images/icon.png)

**HuTouch AI** is a supportive IDE extension designed to enhance the workflow for HuTouch AI WinForms applications. This extension provides an integrated solution to interact with the file system through an HTTP server, allowing the WinForms application to request file content seamlessly.

## Features

- Automatically starts an HTTP server on VS Code startup.
- Listens for file content requests from external applications (e.g., WinForms) via an HTTP endpoint.
- Searches for and retrieves file content in the currently opened workspace.
- Returns file details including path, name, and content.

## Installation

### Prerequisites

- Visual Studio Code v1.89.0 or higher
- Node.js and npm installed

### Steps

1. Clone the repository or download the extension files.
2. Navigate to the extension directory and install dependencies:
   ```sh
   npm install
   ```
3. Package the extension using `vsce`:
   ```sh
   npm install -g vsce
   vsce package
   ```
4. Install the `.vsix` file in VS Code:
   - Open VS Code.
   - Go to the Extensions view by clicking the Extensions icon in the Activity Bar on the side of the window or by pressing `Ctrl+Shift+X`.
   - Click on the `...` (More Actions) button in the top right corner.
   - Select `Install from VSIX...`.
   - Navigate to your packaged `.vsix` file and select it to install the extension.

## Usage

1. Open Visual Studio Code. The HuTouch AI extension will automatically activate and start an HTTP server on port `45678`.
2. The extension will listen for POST requests on the `/file-content` endpoint.
3. Send a POST request to `http://localhost:45678/file-content` with the following JSON body:
   ```json
   {
       "fileName": "example.txt"
   }
   ```
4. The extension will respond with the file details including path, name, and content.

### Example Using `curl`

```sh
curl -X POST http://localhost:45678/file-content -H "Content-Type: application/json" -d '{"fileName": "example.txt"}'
```

### Example Using Postman

1. Open Postman.
2. Create a new HTTP request.
3. Set the request method to `POST`.
4. Set the URL to `http://localhost:45678/file-content`.
5. In the "Body" tab, select "raw" and choose "JSON" from the dropdown menu.
6. Enter the JSON body:
   ```json
   {
       "fileName": "example.txt"
   }
   ```
7. Click "Send" to send the request.
8. Check the response for file details.

## Configuration

No additional configuration is required. The extension is designed to work out-of-the-box.

## Contribution

Contributions are welcome! If you have any ideas, suggestions, or issues, please feel free to open an issue or submit a pull request.

### Repository

[GitHub Repository](https://github.com/kshitij-gavhane/hutouch-ai)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Kshitij Gavhane

---

For more information, visit the [HuTouch AI GitHub repository](https://github.com/kshitij-gavhane/hutouch-ai).
