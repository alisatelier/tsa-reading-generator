export function parseCommandLineArguments({ defaultTopK }) {
  const rawArguments = process.argv.slice(2);

  const queryParts = [];
  let requestedTopK = defaultTopK;

  for (let index = 0; index < rawArguments.length; index += 1) {
    const token = rawArguments[index];

    if (token === "--k") {
      const nextToken = rawArguments[index + 1];
      const parsed = Number(nextToken);

      if (Number.isFinite(parsed) && parsed > 0) {
        requestedTopK = Math.floor(parsed);
      }

      index += 1;
      continue;
    }

    queryParts.push(token);
  }

  return { queryText: queryParts.join(" ").trim(), requestedTopK };
}

export function formatPreviewText(fullText, maxLength = 220) {
  return String(fullText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export async function runRetrieverFromCommandLine({
  retrieveMostRelevantKnowledgeChunks,
  defaultTopK,
}) {
  const { queryText, requestedTopK } = parseCommandLineArguments({ defaultTopK });

  if (!queryText) {
    console.log('Usage: node src/rag/retriever.js "one of sparks" [--k 8]');
    process.exit(1);
  }

  const topResults = await retrieveMostRelevantKnowledgeChunks({
    userQueryText: queryText,
    numberOfResultsToReturn: requestedTopK,
  });

  console.log(`\nQuery: ${queryText}`);
  console.log(`Top matches: ${topResults.length}\n`);

  topResults.forEach((resultItem, resultIndex) => {
    console.log(
      `${resultIndex + 1}) score=${resultItem.similarityScore.toFixed(4)} | ${resultItem.path}\n` +
        `   ${formatPreviewText(resultItem.text)}\n`
    );
  });
}
