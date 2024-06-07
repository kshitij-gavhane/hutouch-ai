const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const express = require("express");
require("dotenv").config();
const { default: OpenAI } = require("openai");

const PORT = 45678;

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY ||
    "sk-proj-31UxLmHHYQZw1yebanjMT3BlbkFJ3KFD8n0kCkFfNFl6PAoP",
});

function activate(context) {
  startServer();
  vscode.window.showInformationMessage(
    `HuTouch AI File Analysis server started on port ${PORT}`
  );
}

function deactivate() {
  if (server) {
    server.close(() => {
      console.log("Server closed");
    });
  }
}

const EXCLUDED_DIRS = [
  "node_modules",
  ".vscode",
  "dist",
  "build",
  ".git",
  "coverage",
  "out",
  "bin",
  "obj",
  "target",
  "__pycache__",
  ".idea",
  ".gradle",
  ".mvn",
  ".settings",
  ".classpath",
  ".project",
  "CMakeFiles",
  "CMakeCache.txt",
  ".vs",
  "packages",
  ".history",
  ".terraform",
  ".serverless",
  ".pytest_cache",
  ".venv",
  "Pods",
  "DerivedData",
  ".next",
  ".nuxt",
  "vendor",
  ".sass-cache",
  ".cache",
  ".parcel-cache",
  "elm-stuff",
  "_site",
  "public",
  ".docusaurus",
  "static",
  ".expo",
  ".cache-loader",
];

const EXCLUDED_FILES = [
  ".gitignore",
  "README.md",
  "yarn.lock",
  "package-lock.json",
  ".metadata",
];

function shouldExclude(fileOrDir) {
  const name = path.basename(fileOrDir);
  return EXCLUDED_DIRS.includes(name) || EXCLUDED_FILES.includes(name);
}

function getFilesRecursive(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
      file = path.resolve(dir, file);
      const stat = fs.statSync(file);
      if (stat.isDirectory() && !shouldExclude(file)) {
        results = results.concat(getFilesRecursive(file));
      } else if (stat.isFile() && !shouldExclude(file)) {
        results.push(file);
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return results;
}

async function analyzeFileContent(content, fileName) {
  const fileType = path.extname(fileName).toLowerCase();
  const prompt = `
    Analyze the following ${fileType} code & FORMAT IN PROPER JSON WITHOUT ANY TEST DESCRIPTION. List all import statements excluding system or standard library dependencies. 
    Then, Identify all files that are dependencies for this code:
    \n\n${content}
    \n\nList the imports and dependencies in the format:
    Imports:
    - <import statements>

    Dependencies:
    - <ONLY NAME OF FILE WITH EXTENSION>
   IMPORTANT: Ensure the response is a valid JSON object without any additional text or description.. DO NOT INCLUDE ANY TEXT/DESCRIPTION OTHER THAN THE IMPORTS AND DEPENDENCIES. GIVE FULL FILE NAME IN THE DEPENDENCIES WITH EXTENSION.
    `;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-0125",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a helpful code analyser which returns only json output, and no extraneous text.",
      },
      { role: "user", content: prompt },
    ],
  });

  const text = completion.choices[0].message.content.trim();
  try {
    const analysis = JSON.parse(text);
    return analysis;
  } catch (error) {
    console.error("Error parsing JSON from OpenAI response:", error);
    throw new Error("Failed to parse JSON from OpenAI response");
  }
}

async function findFileDetails(fileName, rootPath) {
  const allFiles = getFilesRecursive(rootPath);
  console.log("All files:", allFiles); // Debugging information
  const fileFullPath = allFiles.find(
    (f) => path.basename(f).toLowerCase() === fileName.toLowerCase()
  );
  console.log("File full path:", fileFullPath); // Debugging information
  if (!fileFullPath) {
    throw new Error(`File not found in the project: ${fileName}`);
  }
  const fileContent = fs.readFileSync(fileFullPath, "utf8");
  const { Imports, Dependencies } = await analyzeFileContent(
    fileContent,
    fileName
  );
  const fileDetails = [];

  // Add the main file content
  fileDetails.push({
    file_path: fileFullPath,
    content: fileContent,
    imports: Imports || [],
    dependencies: Dependencies || [],
  });

  // Add the content of related files from dependencies
  for (const dependency of Dependencies) {
    const dependencyFileName = path.basename(dependency);
    const dependencyFilePath = allFiles.find(
      (f) => path.basename(f).toLowerCase() === dependencyFileName.toLowerCase()
    );
    if (dependencyFilePath && fs.existsSync(dependencyFilePath)) {
      fileDetails.push({
        file_path: dependencyFilePath,
        content: fs.readFileSync(dependencyFilePath, "utf8"),
      });
    } else {
      console.log(`Dependency file not found: ${dependencyFileName}`);
    }
  }

  return fileDetails;
}

function generateFolderStructure(dir, prefix = "") {
  let result = "";
  try {
    const list = fs.readdirSync(dir);
    list.forEach((file, index) => {
      const fullPath = path.resolve(dir, file);
      const stat = fs.statSync(fullPath);
      const isLast = index === list.length - 1;
      const newPrefix = prefix + (isLast ? "└── " : "├── ");

      if (stat.isDirectory() && !shouldExclude(fullPath)) {
        result += `${newPrefix}${file}/\n`;
        result += generateFolderStructure(
          fullPath,
          prefix + (isLast ? "    " : "│   ")
        );
      } else if (stat.isFile() && !shouldExclude(fullPath)) {
        result += `${newPrefix}${file}\n`;
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return result;
}

let server;

function startServer() {
  const app = express();
  app.use(express.json());

  app.post("/file-content", async (req, res) => {
    const { fileName } = req.body;
    if (!fileName) {
      return res.status(400).send({ error: "fileName is required" });
    }
    const rootPath = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : "";
    if (!rootPath) {
      return res.status(400).send({ error: "No workspace folder open" });
    }
    try {
      const fileDetails = await findFileDetails(fileName, rootPath);
      const folderStructure = generateFolderStructure(rootPath);
      const response = fileDetails.map((file) => {
        const { imports, dependencies, ...rest } = file;
        return imports && dependencies
          ? { ...rest, imports, dependencies }
          : rest;
      });
      response.push({
        file_path: "Readme.txt",
        content: folderStructure,
      });
      res.send(response);
    } catch (error) {
      console.error("Error finding file details:", error);
      res.status(404).send({ error: error.message });
    }
  });

  server = app
    .listen(PORT, () => {
      console.log(`HuTouch AI File Analysis server started on port ${PORT}`);
    })
    .on("error", (err) => {
      console.error("Server error:", err);
    });
}

exports.activate = activate;
exports.deactivate = deactivate;
