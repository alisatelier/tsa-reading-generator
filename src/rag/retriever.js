import path from "node:path";
import { pathToFileURL } from "node:url";
import { ollamaEmbed } from "../services/ollama.js";

import { loadRagIndexFromDisk, normalizeRagIndexShape } from "./retriever/ragIndexStore.js";
import { scoreIndexItemsBySimilarity, selectTopMostRelevantItems } from "./retriever/similaritySearch.js";
import { runRetrieverFromCommandLine } from "./retriever/retrieverCli.js";

const DEFAULT_NUMBER_OF_RESULTS = 8;

/**
 * Calls Ollama embeddings and returns a number[] embedding.
 */
async function createEmbeddingVectorForQueryText({ embeddingModelName, queryText }) {
  const embeddingResponse = await ollamaEmbed({
    model: embeddingModelName,
    input: queryText,
  });

  const queryEmbeddingVector = embeddingResponse?.embedding;

  if (!Array.isArray(queryEmbeddingVector)) {
    const responsePreview = JSON.stringify(embeddingResponse).slice(0, 400);
    throw new Error(
      `Unexpected embeddings response for query.\n` +
        `Expected { embedding: number[] }\n` +
        `Got: ${responsePreview}`
    );
  }

  return queryEmbeddingVector;
}

/**
 * PUBLIC API
 */
export async function retrieveMostRelevantKnowledgeChunks({
  userQueryText,
  numberOfResultsToReturn = DEFAULT_NUMBER_OF_RESULTS,
}) {
  if (typeof userQueryText !== "string" || userQueryText.trim().length === 0) {
    throw new Error("userQueryText must be a non-empty string.");
  }

  const ragIndex = loadRagIndexFromDisk();
  const { embeddingModelName, ragIndexItems } = normalizeRagIndexShape(ragIndex);

  const queryEmbeddingVector = await createEmbeddingVectorForQueryText({
    embeddingModelName,
    queryText: userQueryText.trim(),
  });

  const scoredKnowledgeItems = scoreIndexItemsBySimilarity({
    queryEmbeddingVector,
    ragIndexItems,
  });

  return selectTopMostRelevantItems({
    scoredKnowledgeItems,
    numberOfResultsToReturn,
  });
}

/**
 * True when this file is executed directly: node src/rag/retriever.js ...
 */
function isRunningAsMainModule() {
  const executedFilePath = process.argv[1];
  if (!executedFilePath) return false;

  const executedFileUrl = pathToFileURL(executedFilePath).href;
  return import.meta.url === executedFileUrl;
}

if (isRunningAsMainModule()) {
  runRetrieverFromCommandLine({
    retrieveMostRelevantKnowledgeChunks,
    defaultTopK: DEFAULT_NUMBER_OF_RESULTS,
  }).catch((error) => {
    console.error("❌ Retriever CLI failed:", error.message);
    process.exit(1);
  });
}
