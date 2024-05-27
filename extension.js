const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

function activate(context) {
    // Register the command with the updated command name from `package.json`
    let disposable = vscode.commands.registerCommand('hutouch.activate', async () => {
        const input = await vscode.window.showInputBox({ placeHolder: 'Enter the filename (with or without extension)' });
        if (input) {
            const rootPath = vscode.workspace.workspaceFolders
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : ""; // Get the path of the first workspace folder
            displayFileContent(input.toLowerCase(), rootPath);  // Convert input to lower case
			console.log('rootPath: ', rootPath);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

const EXCLUDED_DIRS = [
    'node_modules',    // JavaScript/Node.js
    '.vscode',         // Visual Studio Code settings
    'dist',            // Distribution folders
    'build',           // Build output folders
    '.git',            // Git repository
    'coverage',        // Code coverage reports
    'out',             // Output directories
    'bin',             // Binary files (Java, .NET)
    'obj',             // Object files (C#, .NET)
    'target',          // Maven/Gradle target directory (Java)
    '__pycache__',     // Python bytecode cache
    '.idea',           // IntelliJ IDEA settings
    '.gradle',         // Gradle settings (Java)
    '.mvn',            // Maven settings (Java)
    '.settings',       // Eclipse settings (Java)
    '.classpath',      // Eclipse classpath file (Java)
    '.project',        // Eclipse project file (Java)
    'CMakeFiles',      // CMake build system files
    'CMakeCache.txt',  // CMake cache file
    '.vs',             // Visual Studio settings
    'packages',        // Various package managers (e.g., NuGet)
    '.history',        // Local history (VSCode extensions)
    '.terraform',      // Terraform state files
    '.serverless',     // Serverless framework
    '.pytest_cache',   // Pytest cache
    '.venv',           // Python virtual environment
    'Pods',            // CocoaPods (iOS)
    'DerivedData',     // Xcode derived data (iOS)
    'node_modules',    // npm/yarn (Node.js)
    '.next',           // Next.js (React)
    '.nuxt',           // Nuxt.js (Vue.js)
    'vendor',          // Composer (PHP), Bundler (Ruby)
    '.sass-cache',     // Sass cache
    '.cache',          // Various cache directories
    '.parcel-cache',   // Parcel bundler (JavaScript)
    'elm-stuff',       // Elm language
    '_site',           // Jekyll static site generator
    'public',          // Public build output (various)
    '.docusaurus',     // Docusaurus documentation
    'static',          // Static files (various)
    '.expo',           // Expo (React Native)
    '.cache-loader',   // Webpack cache
    'yarn.lock',       // Yarn lockfile
    'package-lock.json'// npm lockfile
];

// Function to check if a directory should be excluded
function shouldExclude(dir) {
    return EXCLUDED_DIRS.some(excludedDir => dir.includes(excludedDir));
}

// Recursive function to get files
function getFilesRecursive(dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(function(file) {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        const baseName = path.basename(file);

        // Skip directories that are in the EXCLUDED_DIRS list
        if (stat && stat.isDirectory() && !shouldExclude(baseName)) {
            results = results.concat(getFilesRecursive(file));
        } else if (stat && stat.isFile()) {
            results.push(file);
        }
    });

    return results;
}


async function displayFileContent(fileName, rootPath) {
    if (!rootPath) {
        vscode.window.showErrorMessage("No folder or workspace opened");
        return;
    }

    const allFiles = getFilesRecursive(rootPath);
    const fileFullPath = allFiles.find(f => {
        const baseName = path.basename(f, path.extname(f)).toLowerCase();
        const extName = path.extname(f).toLowerCase();
        return fileName.includes('.')
            ? (baseName + extName) === fileName
            : baseName === fileName;
    });

    if (fileFullPath) {
        const fileContent = fs.readFileSync(fileFullPath, 'utf8');
        // Display content in a new read-only editor tab instead of a message box
        const document = await vscode.workspace.openTextDocument({
            language: 'text',
            content: fileContent
        });
        await vscode.window.showTextDocument(document, { preview: false });
    } else {
        vscode.window.showInformationMessage('File not found in the project');
    }
}

exports.activate = activate;
exports.deactivate = deactivate;



/*
  // "activationEvents":["activationEvents"],
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

function activate(context) {
    // Register the command with the updated command name from `package.json`
    let disposable = vscode.commands.registerCommand('hutouch.activate', async () => {
        const input = await vscode.window.showInputBox({ placeHolder: 'Enter the filename (without extension)' });
        if (input) {
            const rootPath = vscode.workspace.workspaceFolders
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : ""; // Get the path of the first workspace folder
            displayFileContent(input.toLowerCase(), rootPath);  // Convert input to lower case
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

function getFilesRecursive(dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(function(file) {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursive(file));
        } else {
            results.push(file);
        }
    });

    return results;
}

async function displayFileContent(fileName, rootPath) {
    if (!rootPath) {
        vscode.window.showErrorMessage("No folder or workspace opened");
        return;
    }

    const allFiles = getFilesRecursive(rootPath);
    const fileFullPath = allFiles.find(f => path.basename(f, path.extname(f)).toLowerCase() === fileName);

    if (fileFullPath) {
        const fileContent = fs.readFileSync(fileFullPath, 'utf8');

        // Send file content to the API endpoint
        try {
            const response = await axios.post('http://your-api-endpoint.com/api/upload', {
                fileName: path.basename(fileFullPath),
                content: fileContent
            });
            vscode.window.showInformationMessage(`File data sent successfully: ${response.data.message}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error sending file data: ${error.message}`);
        }

        // Display content in a new read-only editor tab instead of a message box
        const document = await vscode.workspace.openTextDocument({
            language: 'text',
            content: fileContent
        });
        await vscode.window.showTextDocument(document, { preview: false });
    } else {
        vscode.window.showInformationMessage('File not found in the project');
    }
}

exports.activate = activate;
exports.deactivate = deactivate;
*/