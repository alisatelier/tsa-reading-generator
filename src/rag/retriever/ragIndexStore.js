import fs from "node:fs";
import path from "node:path";

const RAG_INDEX_FILE_ABSOLUTE_PATH = path.join(process.cwd(), "data", "index.json");
const DEFAULT_EMBEDDING_MODEL_NAME = "nomic-embed-text";

export function loadRagIndexFromDisk() {
  const ragIndexFileExists = fs.existsSync(RAG_INDEX_FILE_ABSOLUTE_PATH);

  if (!ragIndexFileExists) {
    throw new Error(
      `Missing RAG index file: ${RAG_INDEX_FILE_ABSOLUTE_PATH}\n` +
        `Run this first: npm run rag:index`
    );
  }

  const ragIndexJsonText = fs.readFileSync(RAG_INDEX_FILE_ABSOLUTE_PATH, "utf8");

  try {
    return JSON.parse(ragIndexJsonText);
  } catch (parseError) {
    throw new Error(
      `Failed to parse RAG index JSON at: ${RAG_INDEX_FILE_ABSOLUTE_PATH}\n` +
        `Error: ${parseError.message}`
    );
  }
}

export function normalizeRagIndexShape(ragIndex) {
  const embeddingModelName =
    typeof ragIndex?.embedModel === "string" && ragIndex.embedModel.trim().length > 0
      ? ragIndex.embedModel.trim()
      : DEFAULT_EMBEDDING_MODEL_NAME;

  const ragIndexItems = Array.isArray(ragIndex?.items) ? ragIndex.items : [];

  if (ragIndexItems.length === 0) {
    throw new Error(
      `RAG index contains zero items.\n` +
        `Check that /knowledge has text files and re-run: npm run rag:index`
    );
  }

  return { embeddingModelName, ragIndexItems };
}