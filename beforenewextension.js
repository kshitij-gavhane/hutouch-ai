const vscode = require("vscode");
const mime = require("mime");
const fs = require("fs");
const path = require("path");
const os = require("os");
const express = require("express");
require("dotenv").config(); // Load environment variables early
const { default: OpenAI } = require("openai");

const PORT = 45678;

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY ||
    "sk-proj-31UxLmHHYQZw1yebanjMT3BlbkFJ3KFD8n0kCkFfNFl6PAoP",
});

let server;

async function createAssistant() {
  const assistant = await openai.beta.assistants.create({
    model: "gpt-4o",
    name: "FileAnalysisAssistant",
    instructions:
      "You are a helpful code analyser which returns only json output, and no extraneous text.",
    tools: [{ type: "file_search" }],
  });
  return assistant.id;
}

async function createVectorStore() {
  const vectorStore = await openai.beta.vectorStores.create({
    name: "ProjectFilesStore",
  });
  return vectorStore.id;
}

async function uploadFilesToVectorStore(vectorStoreId, files) {
  const fileIds = [];
  let counter = 0; // Initialize the counter

  for (const file of files) {
    const fileContent = fs.readFileSync(file);

    // Increment the counter for each file and generate a unique file_id
    const fileId = `file-${counter}`;

    const myVectorStoreFile = await openai.beta.vectorStores.files.create(
      vectorStoreId,
      {
        file_id: fileId,
      }
    );

    fileIds.push(fileId); // Add the unique file_id to the fileIds array
    counter++; // Increment the counter
  }

  return fileIds;
}

async function upload_files_to_vector_store(vector_id, files_list) {
  const myVectorStoreFileBatch =
    await openai.beta.vectorStores.fileBatches.create(vector_id, {
      file_ids: files_list,
    });
  console.log(myVectorStoreFileBatch);
  console.log(
    files_list.length,
    " files is successfully uploaded to vector store"
  );
  return myVectorStoreFileBatch;
}

async function createThread(assistantId, vectorStoreId) {
  const thread = await openai.beta.threads.create({
    // assistant_id: assistantId,
    tool_resources: {
      file_search: {
        vector_store_ids: [vectorStoreId],
      },
    },
  });
  return thread.id;
}

async function analyzeFilesInThread(threadId, fileName, assistant_id) {
  const prompt = `Analyze the code in the file ${fileName} and provide a detailed breakdown in JSON format. Identify:
    - All classes and their methods
    - Logic within each method
    - Where each class and method is used within the project`;

  // Create a message for the thread
  const message = await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: prompt,
  });

  // Run the thread with the created message
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistant_id,
    // messages: [{ id: message.id }]
  });

  // Get the response from the thread run
  // const text = run.choices[0].message.content.trim();
  try {
    const analysis = JSON.parse("text");
    return analysis;
  } catch (error) {
    console.error("Error parsing JSON from OpenAI response:", error);
    throw new Error("Failed to parse JSON from OpenAI response");
  }
}

async function deleteResources(assistantId, threadId, vectorStoreId) {
  await openai.beta.assistants.del(assistantId);
  await openai.beta.threads.del(threadId);
  await openai.beta.vectorStores.del(vectorStoreId);
}

function activate(context) {
  startServer();
  vscode.window.showInformationMessage(
    `HuTouch AI File Analysis server started on port ${PORT}`
  );

  // Register the event listener for file changes
  vscode.workspace.onDidChangeTextDocument((event) => {
    const fileName = event.document.fileName;
    vscode.window.showInformationMessage(`File changed: ${fileName}`);
    console.log(`File changed: ${fileName}`);
  });

  // Register the command to create the project context
  let disposable = vscode.commands.registerCommand(
    "hutouch.createProjectContext",
    async function () {
      const rootPath = vscode.workspace.workspaceFolders
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : "";
      if (!rootPath) {
        vscode.window.showErrorMessage("No workspace folder open");
        return;
      }

      try {
        await createProjectContext(rootPath);
        vscode.window.showInformationMessage(
          "Project context created successfully"
        );
      } catch (error) {
        console.error("Error creating project context:", error);
        vscode.window.showErrorMessage("Error creating project context");
      }
    }
  );

  context.subscriptions.push(disposable);
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
async function upload_file_to_openai_storage(file_path) {
  const file = await openai.files.create({
    file: fs.createReadStream(file_path),
    purpose: "assistants",
  });

  console.log(file);
  return file.id;
}

async function update_assistant(assistant_id, vector_id) {
  const myUpdatedAssistant = await openai.beta.assistants.update(assistant_id, {
    tools: [{ type: "file_search" }],
    tool_resources: vector_id,
  });

  console.log(myUpdatedAssistant);
  console.log("assistant updated successfully");
  return myUpdatedAssistant;
}
function isTextFile(mimeType) {
  return (
    mimeType === "application/javascript" ||
    mimeType === "application/x-httpd-php" ||
    mimeType === "text/plain" ||
    mimeType === "application/vnd.dart" ||
    mimeType === "application/json" ||
    mimeType === "text/html" ||
    mimeType === "text/css" ||
    mimeType === "text/x-c" ||
    mimeType === "text/x-c++src" ||
    mimeType === "text/x-java-source" ||
    mimeType === "text/x-python" ||
    mimeType === "application/x-sh" ||
    mimeType === "text/x-ruby" ||
    mimeType === "text/x-perl" ||
    mimeType === "application/xml" ||
    mimeType === "text/x-sql" ||
    mimeType === "text/x-go" ||
    mimeType === "text/x-yaml" ||
    mimeType === "text/x-markdown" ||
    mimeType === "text/x-php" ||
    mimeType === "text/x-pascal" ||
    mimeType === "text/x-fortran" ||
    mimeType === "text/x-lisp" ||
    mimeType === "text/x-haskell" ||
    mimeType === "text/x-scala" ||
    mimeType === "text/x-erlang" ||
    mimeType === "application/x-rustsrc" ||
    mimeType === "application/x-tcl" ||
    mimeType === "text/x-vbscript" ||
    mimeType === "text/x-asm" ||
    mimeType === "text/x-actionscript" ||
    mimeType === "text/x-coffeescript" ||
    mimeType === "text/x-kotlin" ||
    mimeType === "text/x-swift" ||
    mimeType === "text/x-clojure" ||
    mimeType === "text/x-typescript" ||
    mimeType === "application/x-sass" ||
    mimeType === "application/x-less" ||
    mimeType === "application/x-csharp" ||
    mimeType === "text/x-d" ||
    mimeType === "text/x-objectivec" ||
    mimeType === "text/x-ocaml" ||
    mimeType === "text/x-sml" ||
    mimeType === "text/x-fsharp" ||
    mimeType === "application/x-prolog" ||
    mimeType === "text/x-applescript" ||
    mimeType === "text/x-scheme" ||
    mimeType === "application/x-vhdl" ||
    mimeType === "application/x-verilog" ||
    mimeType === "text/x-twig" ||
    mimeType === "application/x-python-code" ||
    mimeType === "text/x-groovy" ||
    mimeType === "text/x-powershell" ||
    mimeType === "application/x-racket" ||
    mimeType === "text/x-rust" ||
    mimeType === "text/x-dart" ||
    mimeType === "text/x-matlab" ||
    mimeType === "text/x-arduino" ||
    mimeType === "text/x-awk" ||
    mimeType === "text/x-dockerfile" ||
    mimeType === "text/x-sas" ||
    mimeType === "text/x-vhdl" ||
    mimeType === "text/x-verilog" ||
    mimeType === "application/x-csource" ||
    mimeType === "application/x-elixir" ||
    mimeType === "text/x-elm" ||
    mimeType === "application/x-lua" ||
    mimeType === "text/x-racket" ||
    mimeType === "application/x-toml" ||
    mimeType === "text/x-forth" ||
    mimeType === "text/x-nim" ||
    mimeType === "text/x-vala" ||
    mimeType === "text/x-bash" ||
    mimeType === "text/x-batch" ||
    mimeType === "text/x-hcl" ||
    mimeType === "text/x-r" ||
    mimeType === "application/x-tex" ||
    mimeType === "application/x-clojurescript" ||
    mimeType === "text/x-antlr" ||
    mimeType === "text/x-idl" ||
    mimeType === "text/x-vue" ||
    mimeType === "text/x-dhall" ||
    mimeType === "text/x-nix" ||
    mimeType === "text/x-cmake" ||
    mimeType === "text/x-cobol" ||
    mimeType === "text/x-crystal" ||
    mimeType === "text/x-puppet" ||
    mimeType === "text/x-rst" ||
    mimeType === "text/x-graphql" ||
    mimeType === "text/x-sqlite" ||
    mimeType === "text/x-haxe" ||
    mimeType === "text/x-groovyscript" ||
    mimeType === "text/x-terraform" ||
    mimeType === "text/x-rmarkdown" ||
    mimeType === "text/x-brightscript" ||
    mimeType === "text/x-glsl" ||
    mimeType === "text/x-nanorc" ||
    mimeType === "text/x-po" ||
    mimeType === "text/x-toml" ||
    mimeType === "text/x-properties" ||
    mimeType === "text/x-apache" ||
    mimeType === "text/x-nginx"
  );
}

/**
 * Function to copy content from source file to a new text file.
 * @param {string} sourceFilePath - Path of the source file.
 * @returns {Promise<string>} - Promise that resolves to the new text file path.
 */
function copyFileContentToTextFile(sourceFilePath) {
  return new Promise((resolve, reject) => {
    // Generate the new file path with .txt extension
    const destinationFilePath = path.join(
      path.dirname(sourceFilePath),
      `${path.basename(sourceFilePath, path.extname(sourceFilePath))}.txt`
    );

    // Read the content of the source file
    fs.readFile(sourceFilePath, "utf8", (err, data) => {
      if (err) {
        return reject(`Error reading the file: ${err}`);
      }

      // Write the content to the new text file
      fs.writeFile(destinationFilePath, data, (err) => {
        if (err) {
          return reject(`Error writing to the file: ${err}`);
        }

        resolve(destinationFilePath);
      });
    });
  });
}

function delete_a_file(file_path) {
  fs.unlink(file_path, (err) => {
    if (err) {
      console.error(`Error deleting file: ${err.message}`);
    } else {
      console.log("File deleted successfully");
    }
  });
}

async function createProjectContext(rootPath) {
  const allFiles = getFilesRecursive(rootPath);
  let file_ids = [];

  const assistantId = await createAssistant();
  const vectorStoreId = await createVectorStore();

  //   for (let i = 0; i < allFiles.length; ++i) {
  //     let curr_file_path = allFiles[i];
  //     let mimeType = mime.lookup(curr_file_path);
  //     if (isTextFile(mimeType)) {
  //       copyFileContentToTextFile(curr_file_path)
  //         .then((newFilePath) => {
  //           console.log(`Content successfully written to ${newFilePath}`);
  //           upload_file_to_openai_storage(newFilePath)
  //             .then((file_id) => {
  //               file_ids.push(file_id);
  //               delete_a_file(newFilePath);
  //               if (i == allFiles.length - 1) {
  //                 if (file_ids != []) {
  //                   upload_files_to_vector_store(vectorStoreId, file_ids)
  //                     .then((resp) => {
  //                         console.log(resp)
  //                         update_assistant(assistantId, vectorStoreId)
  //                             .then((resp) => console.log(resp))
  //                             .catch((err) => {
  //                             console.log(err);
  //                             });
  //                     })
  //                     .catch((err) => {
  //                       console.log(err);
  //                     });
  //                 }
  //               }
  //             })
  //             .catch((err) => console.log(err));
  //         })
  //         .catch((error) => {
  //           console.error(error);
  //         });
  //     } else {
  //       console.log("Not a text file");
  //     }
  //   }
  let files_to_be_deleted = [];
  for (let i = 0; i < allFiles.length; ++i) {
    let curr_file_path = allFiles[i];
    let mimeType = mime.lookup(curr_file_path);
    if (isTextFile(mimeType)) {
      let newFilePath = await copyFileContentToTextFile(curr_file_path);
      files_to_be_deleted.push(newFilePath);
      console.log("newFilePath: ", newFilePath);
      let file_id = await upload_file_to_openai_storage(newFilePath);
      file_ids.push(file_id);
      if (i == allFiles.length - 1) {
        if (file_ids != []) {
          let vector_store = await upload_files_to_vector_store(
            vectorStoreId,
            file_ids
          );
          console.log(vector_store);
          let updated_assistant = await update_assistant(
            assistantId,
            vectorStoreId
          );
          console.log(updated_assistant);
          for (let i = 0; i < files_to_be_deleted.length; ++i) {
            delete_a_file(files_to_be_deleted[i]);
          }
        }
      }
    } else {
      console.log("Not a text file");
    }
  }

  try {
    const threadId = await createThread(assistantId, vectorStoreId);

    const projectContext = [];

    for (const file of allFiles) {
      const context = await analyzeFilesInThread(
        threadId,
        path.basename(file),
        assistantId
      );
      projectContext.push({
        file_path: file,
        context: context,
      });
    }

    const contextFilePath = path.join(rootPath, "project_context.json");
    fs.writeFileSync(
      contextFilePath,
      JSON.stringify(projectContext, null, 2),
      "utf8"
    );
    console.log("Project context written to:", contextFilePath);
    await deleteResources(assistantId, threadId, vectorStoreId);
  } catch (error) {
    await deleteResources(assistantId, vectorStoreId);
    throw error;
  }
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
    imports: Imports,
    dependencies: Dependencies,
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
      res.send({ fileDetails, folderStructure });
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
