const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const express = require('express');

const PORT = 45678; // Using an uncommon port

function activate(context) {
    startServer();
    vscode.window.showInformationMessage(`Hutouch File Finder server started on port ${PORT}`);
}

function deactivate() {
    if (server) {
        server.close();
    }
}

const EXCLUDED_DIRS = [
    'node_modules', '.vscode', 'dist', 'build', '.git', 'coverage', 'out', 'bin', 'obj', 'target', '__pycache__',
    '.idea', '.gradle', '.mvn', '.settings', '.classpath', '.project', 'CMakeFiles', 'CMakeCache.txt', '.vs',
    'packages', '.history', '.terraform', '.serverless', '.pytest_cache', '.venv', 'Pods', 'DerivedData', '.next',
    '.nuxt', 'vendor', '.sass-cache', '.cache', '.parcel-cache', 'elm-stuff', '_site', 'public', '.docusaurus',
    'static', '.expo', '.cache-loader', 'yarn.lock', 'package-lock.json'
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

async function findFileDetails(fileName, rootPath) {
    if (!rootPath) {
        throw new Error("No folder or workspace opened");
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
        return { path: fileFullPath, name: path.basename(fileFullPath), content: fileContent };
    } else {
        throw new Error('File not found in the project');
    }
}

// Recursive function to generate directory tree
function generateDirectoryTree(dir, level = 0) {
    let results = {};
    const list = fs.readdirSync(dir);

    list.forEach(function(file) {
        const fullPath = path.resolve(dir, file);
        const stat = fs.statSync(fullPath);

        // Skip excluded directories using the shouldExclude function
        if (stat.isDirectory()) {
            if (!shouldExclude(file)) {
                results[file] = generateDirectoryTree(fullPath, level + 1);
            }
        } else if (stat.isFile()) {
            results[file] = null; // null or some other representation for files
        }
    });

    return results;
}


let server;

function startServer() {
    const app = express();
    app.use(express.json());

    app.post('/file-content', async (req, res) => {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).send({ error: 'fileName is required' });
        }

        const rootPath = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : ""; // Get the path of the first workspace folder

        try {
            const fileDetails = await findFileDetails(fileName.toLowerCase(), rootPath);
            res.send(fileDetails);
        } catch (error) {
            res.status(404).send({ error: error.message });
        }
    });

    app.get('/directory-tree', async (req, res) => {
    const rootPath = vscode.workspace.workspaceFolders
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : null;

    if (!rootPath) {
        return res.status(400).send({ error: 'No workspace folder open' });
    }

    try {
        const tree = generateDirectoryTree(rootPath);
        res.json(tree);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


    server = app.listen(PORT, () => {
        console.log(`Hutouch File Finder server started on port ${PORT}`);
    });
}

exports.activate = activate;
exports.deactivate = deactivate;
