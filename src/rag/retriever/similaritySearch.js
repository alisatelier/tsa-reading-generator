function calculateDotProduct(vectorLeft, vectorRight) {
  let dotProductTotal = 0;

  const numberOfDimensions = Math.min(vectorLeft.length, vectorRight.length);

  for (let dimensionIndex = 0; dimensionIndex < numberOfDimensions; dimensionIndex += 1) {
    dotProductTotal += vectorLeft[dimensionIndex] * vectorRight[dimensionIndex];
  }

  return dotProductTotal;
}

function calculateVectorMagnitude(vector) {
  const dotProductWithItself = calculateDotProduct(vector, vector);
  return Math.sqrt(dotProductWithItself);
}

function calculateCosineSimilarity(queryVector, knowledgeVector) {
  const queryMagnitude = calculateVectorMagnitude(queryVector);
  const knowledgeMagnitude = calculateVectorMagnitude(knowledgeVector);

  if (queryMagnitude === 0 || knowledgeMagnitude === 0) {
    return 0;
  }

  const dotProduct = calculateDotProduct(queryVector, knowledgeVector);
  return dotProduct / (queryMagnitude * knowledgeMagnitude);
}

function isValidIndexItem(candidateItem) {
  const hasId = typeof candidateItem?.id === "string";
  const hasPath = typeof candidateItem?.path === "string";
  const hasText = typeof candidateItem?.text === "string";
  const hasEmbedding = Array.isArray(candidateItem?.embedding);

  return hasId && hasPath && hasText && hasEmbedding;
}

export function scoreIndexItemsBySimilarity({ queryEmbeddingVector, ragIndexItems }) {
  const scoredItems = [];

  for (const item of ragIndexItems) {
    if (!isValidIndexItem(item)) {
      continue;
    }

    const similarityScore = calculateCosineSimilarity(queryEmbeddingVector, item.embedding);

    scoredItems.push({
      id: item.id,
      path: item.path,
      text: item.text,
      similarityScore,
    });
  }

  if (scoredItems.length === 0) {
    throw new Error(
      `No valid index items contained embeddings.\n` +
        `Confirm your index builder is saving "embedding" arrays per item.`
    );
  }

  return scoredItems;
}

export function selectTopMostRelevantItems({ scoredKnowledgeItems, numberOfResultsToReturn }) {
  const sortedCopy = [...scoredKnowledgeItems].sort(
    (leftItem, rightItem) => rightItem.similarityScore - leftItem.similarityScore
  );

  return sortedCopy.slice(0, numberOfResultsToReturn);
}
