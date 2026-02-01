// src/rag/buildIndex.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ollamaEmbed } from "../services/ollama.js";

/**
 * CONFIGURATION
 * - knowledge folder: where you store your card meanings, position meanings, spread rules, etc.
 * - output file: where we write the embedding index JSON
 * - embedding model: the Ollama embedding model we use to create vectors
 */
const KNOWLEDGE_FOLDER_ABSOLUTE_PATH = path.join(process.cwd(), "knowledge");
const RAG_INDEX_OUTPUT_FILE_ABSOLUTE_PATH = path.join(
  process.cwd(),
  "data",
  "index.json"
);
const EMBEDDING_MODEL_NAME = "nomic-embed-text";

/**
 * Reads the /knowledge folder recursively and returns ALL .txt and .md file paths.
 */
function getAllKnowledgeFilePathsRecursively(currentFolderAbsolutePath) {
  const collectedFilePaths = [];

  const folderEntries = fs.readdirSync(currentFolderAbsolutePath, {
    withFileTypes: true,
  });

  for (const folderEntry of folderEntries) {
    const entryAbsolutePath = path.join(
      currentFolderAbsolutePath,
      folderEntry.name
    );

    if (folderEntry.isDirectory()) {
      const nestedFilePaths =
        getAllKnowledgeFilePathsRecursively(entryAbsolutePath);
      collectedFilePaths.push(...nestedFilePaths);
      continue;
    }

    const isTextFile = entryAbsolutePath.endsWith(".txt");
    const isMarkdownFile = entryAbsolutePath.endsWith(".md");

    if (folderEntry.isFile() && (isTextFile || isMarkdownFile)) {
      collectedFilePaths.push(entryAbsolutePath);
    }
  }

  return collectedFilePaths;
}

/**
 * Creates a stable hash so each knowledge item can have an ID that changes
 * when the content changes.
 */
function createSha1HashForText(textToHash) {
  return crypto.createHash("sha1").update(textToHash).digest("hex");
}

/**
 * Ensures a folder exists before writing files into it.
 */
function ensureFolderExists(folderAbsolutePath) {
  fs.mkdirSync(folderAbsolutePath, { recursive: true });
}

/**
 * Builds the RAG index:
 * - reads files from /knowledge
 * - creates embeddings for each file's text using Ollama embeddings
 * - writes data/index.json with embeddings and text
 */
async function buildRagIndexFile() {
  // 1) Confirm /knowledge exists
  const knowledgeFolderExists = fs.existsSync(KNOWLEDGE_FOLDER_ABSOLUTE_PATH);
  if (!knowledgeFolderExists) {
    console.error(
      `❌ Missing folder: ${KNOWLEDGE_FOLDER_ABSOLUTE_PATH}\n` +
        `Create it and add .txt or .md files under /knowledge.`
    );
    process.exit(1);
  }

  // 2) Find knowledge files
  const knowledgeFileAbsolutePaths = getAllKnowledgeFilePathsRecursively(
    KNOWLEDGE_FOLDER_ABSOLUTE_PATH
  );

  if (knowledgeFileAbsolutePaths.length === 0) {
    console.error(
      "❌ No .txt or .md files found in /knowledge.\n" +
        "Add at least one knowledge file, then run: npm run rag:index"
    );
    process.exit(1);
  }

  console.log(
    `Found ${knowledgeFileAbsolutePaths.length} knowledge files.\n` +
      `Creating embeddings using model: ${EMBEDDING_MODEL_NAME}\n`
  );

  // 3) Build index items
  const ragIndexItems = [];

  for (const knowledgeFileAbsolutePath of knowledgeFileAbsolutePaths) {
    const knowledgeFileTextRaw = fs.readFileSync(
      knowledgeFileAbsolutePath,
      "utf8"
    );

    const knowledgeFileTextTrimmed = knowledgeFileTextRaw.trim();
    if (!knowledgeFileTextTrimmed) {
      // Skip empty files
      continue;
    }

    const knowledgeFileRelativePath = path.relative(
      process.cwd(),
      knowledgeFileAbsolutePath
    );

    const knowledgeFileTextHash = createSha1HashForText(
      knowledgeFileTextTrimmed
    );

    const ragIndexItemId = `${knowledgeFileRelativePath}::${knowledgeFileTextHash}`;

    console.log(`Embedding file: ${knowledgeFileRelativePath}`);

    // 3a) Create embedding using Ollama
    const embeddingResponse = await ollamaEmbed({
      model: EMBEDDING_MODEL_NAME,
      input: knowledgeFileTextTrimmed,
    });

    const embeddingVector = embeddingResponse?.embedding;

    if (!Array.isArray(embeddingVector)) {
      const responsePreview = JSON.stringify(embeddingResponse).slice(0, 400);
      throw new Error(
        `Unexpected embeddings response for file: ${knowledgeFileRelativePath}\n` +
          `Expected { embedding: number[] }\n` +
          `Got: ${responsePreview}`
      );
    }

    // 3b) Add to index list
    ragIndexItems.push({
      id: ragIndexItemId,
      path: knowledgeFileRelativePath,
      text: knowledgeFileTextTrimmed,
      embedding: embeddingVector,
    });
  }

  if (ragIndexItems.length === 0) {
    console.error(
      "❌ All knowledge files were empty (or contained only whitespace).\n" +
        "Add text to at least one file under /knowledge and retry."
    );
    process.exit(1);
  }

  // 4) Prepare output object
  const ragIndexFileContents = {
    version: 1,
    createdAt: new Date().toISOString(),
    embedModel: EMBEDDING_MODEL_NAME,
    itemCount: ragIndexItems.length,
    items: ragIndexItems,
  };

  // 5) Ensure /data exists and write index.json
  const outputFolderAbsolutePath = path.dirname(
    RAG_INDEX_OUTPUT_FILE_ABSOLUTE_PATH
  );
  ensureFolderExists(outputFolderAbsolutePath);

  fs.writeFileSync(
    RAG_INDEX_OUTPUT_FILE_ABSOLUTE_PATH,
    JSON.stringify(ragIndexFileContents, null, 2),
    "utf8"
  );

  console.log(
    `\n✅ RAG index written to: ${path.relative(
      process.cwd(),
      RAG_INDEX_OUTPUT_FILE_ABSOLUTE_PATH
    )}`
  );
  console.log(`✅ Items indexed: ${ragIndexItems.length}\n`);
}

/**
 * Run the script
 */
buildRagIndexFile().catch((error) => {
  console.error("❌ Failed to build RAG index:", error);
  process.exit(1);
});
