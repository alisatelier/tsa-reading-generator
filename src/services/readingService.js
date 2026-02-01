// orchestrates “retrieve context → generate reading”

import { retrieveMostRelevantKnowledgeChunks } from "../rag/retriever.js";
import { ollamaChat } from "./ollama.js";
import {
  buildRetrievalQueryText,
  buildUserPromptText,
  formatRetrievedKnowledgeChunksForPrompt,
} from "./readingPromptBuilder.js";
import { buildSystemInstructionText } from "../prompts/instructionText.js";


const DEFAULT_CHAT_MODEL_NAME = "qwen2.5:7b-instruct";
const DEFAULT_NUMBER_OF_RETRIEVED_CHUNKS = 8;

export async function generateReading({
  userQuestionText,
  spreadNameText,
  cardLinesText,
}) {
  const retrievalQueryText = buildRetrievalQueryText({
    userQuestionText,
    spreadNameText,
    cardLinesText,
  });

  const retrievedKnowledgeChunks = await retrieveMostRelevantKnowledgeChunks({
    userQueryText: retrievalQueryText,
    numberOfResultsToReturn: DEFAULT_NUMBER_OF_RETRIEVED_CHUNKS,
  });

  const formattedContextText = formatRetrievedKnowledgeChunksForPrompt(retrievedKnowledgeChunks);

  const systemInstructionText = buildSystemInstructionText();

  const userPromptText = buildUserPromptText({
    userQuestionText,
    spreadNameText,
    cardLinesText,
    formattedContextText,
  });

  const ollamaChatResponse = await ollamaChat({
    model: DEFAULT_CHAT_MODEL_NAME,
    stream: false,
    messages: [
      { role: "system", content: systemInstructionText },
      { role: "user", content: userPromptText },
    ],
  });

  const readingText = ollamaChatResponse?.message?.content || "";

  return {
    readingText,
    debug: {
      retrievalQueryText,
      retrievedChunks: retrievedKnowledgeChunks.map((knowledgeChunk) => ({
        path: knowledgeChunk.path,
        similarityScore: knowledgeChunk.similarityScore,
      })),
    },
  };
}
