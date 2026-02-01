
import fs from "fs";
import path from "path";
import { ollamaEmbed } from "../services/ollama.js";

/**
 * CONFIGURATION
 * This is the JSON file created by: npm run rag:index
 */
const RAG_INDEX_FILE_ABSOLUTE_PATH = path.join(
  process.cwd(),
  "data",
  "index.json"
);

/**
 * Loads the RAG index JSON from disk.
 * This file contains:
 * - embedModel: which embedding model was used
 * - items: each item has { id, path, text, embedding }
 */
function loadRagIndexFromDisk() {
  const ragIndexFileExists = fs.existsSync(RAG_INDEX_FILE_ABSOLUTE_PATH);

  if (!ragIndexFileExists) {
    throw new Error(
      `Missing RAG index file: ${RAG_INDEX_FILE_ABSOLUTE_PATH}\n` +
        `Run this first: npm run rag:index`
    );
  }

  const ragIndexJsonText = fs.readFileSync(RAG_INDEX_FILE_ABSOLUTE_PATH, "utf8");
  return JSON.parse(ragIndexJsonText);
}

/**
 * Math helpers for cosine similarity.
 * Cosine similarity helps us find which knowledge texts are "closest" to the query.
 */

function calculateDotProductBetweenVectors(vectorLeft, vectorRight) {
  let dotProductTotal = 0;

  const numberOfDimensions = Math.min(vectorLeft.length, vectorRight.length);

  for (let dimensionIndex = 0; dimensionIndex < numberOfDimensions; dimensionIndex++) {
    dotProductTotal += vectorLeft[dimensionIndex] * vectorRight[dimensionIndex];
  }

  return dotProductTotal;
}

function calculateVectorMagnitude(vector) {
  const dotProductWithItself = calculateDotProductBetweenVectors(vector, vector);
  return Math.sqrt(dotProductWithItself);
}

function calculateCosineSimilarityBetweenVectors(queryVector, knowledgeVector) {
  const queryVectorMagnitude = calculateVectorMagnitude(queryVector);
  const knowledgeVectorMagnitude = calculateVectorMagnitude(knowledgeVector);

  // If either vector has no magnitude, similarity is meaningless; treat as 0.
  if (queryVectorMagnitude === 0 || knowledgeVectorMagnitude === 0) {
    return 0;
  }

  const dotProduct = calculateDotProductBetweenVectors(queryVector, knowledgeVector);
  return dotProduct / (queryVectorMagnitude * knowledgeVectorMagnitude);
}

/**
 * Creates an embedding vector for the user's query text.
 * Uses the same embedding model that was used to build the index.
 */
async function createEmbeddingVectorForQueryText({
  embeddingModelName,
  queryText,
}) {
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
 * Scores every knowledge item by similarity to the query.
 */
function scoreKnowledgeItemsBySimilarity({
  queryEmbeddingVector,
  ragIndexItems,
}) {
  const scoredKnowledgeItems = ragIndexItems.map((knowledgeItem) => {
    const similarityScore = calculateCosineSimilarityBetweenVectors(
      queryEmbeddingVector,
      knowledgeItem.embedding
    );

    return {
      id: knowledgeItem.id,
      path: knowledgeItem.path,
      text: knowledgeItem.text,
      similarityScore,
    };
  });

  return scoredKnowledgeItems;
}

/**
 * Sorts items from highest similarityScore to lowest, then returns the top N.
 */
function selectTopMostRelevantItems({
  scoredKnowledgeItems,
  numberOfResultsToReturn,
}) {
  const scoredItemsSortedByRelevance = scoredKnowledgeItems.sort(
    (leftItem, rightItem) => rightItem.similarityScore - leftItem.similarityScore
  );

  return scoredItemsSortedByRelevance.slice(0, numberOfResultsToReturn);
}

/**
 * MAIN FUNCTION (what your reading route will call)
 * Given a query string, retrieve the most relevant knowledge chunks from the index.
 */
export async function retrieveMostRelevantKnowledgeChunks({
  userQueryText,
  numberOfResultsToReturn = 8,
}) {
  const ragIndex = loadRagIndexFromDisk();

  const embeddingModelName =
    ragIndex.embedModel || "nomic-embed-text";

  const queryEmbeddingVector = await createEmbeddingVectorForQueryText({
    embeddingModelName,
    queryText: userQueryText,
  });

  const ragIndexItems = Array.isArray(ragIndex.items) ? ragIndex.items : [];

  if (ragIndexItems.length === 0) {
    throw new Error(
      `RAG index contains zero items.\n` +
        `Check that /knowledge has text files and re-run: npm run rag:index`
    );
  }

  const scoredKnowledgeItems = scoreKnowledgeItemsBySimilarity({
    queryEmbeddingVector,
    ragIndexItems,
  });

  const topRelevantKnowledgeItems = selectTopMostRelevantItems({
    scoredKnowledgeItems,
    numberOfResultsToReturn,
  });

  return topRelevantKnowledgeItems;
}
