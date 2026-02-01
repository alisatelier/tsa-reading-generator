import { loadTarotManifest, loadSpreadManifest } from "../knowledge/manifestStore.js";
import { readKnowledgeTextFile } from "../knowledge/fileStore.js";

// Optional: keep this as its own file like you wanted earlier
import { buildSystemInstructionText } from "./systemInstruction/buildSystemInstructionText.js";

export function buildReadingContextText({
  spreadKey,
  questionText,
  drawnCards, // [{ cardId: 22, isReversed: false }, ...] in position order
}) {
  const tarotManifest = loadTarotManifest();
  const spreadManifest = loadSpreadManifest();

  const spreadDefinition = spreadManifest[spreadKey];
  if (!spreadDefinition) {
    throw new Error(`Unknown spreadKey: "${spreadKey}" (not found in spreadManifest.json)`);
  }

  if (!Array.isArray(drawnCards) || drawnCards.length === 0) {
    throw new Error(`drawnCards must be a non-empty array.`);
  }

  // 1) Spread rules text (optional but recommended)
  const spreadRulesText = spreadDefinition.spreadPath
    ? readKnowledgeTextFile(spreadDefinition.spreadPath)
    : "";

  // 2) Position meanings
  const positionKeysInOrder = spreadDefinition.positions || [];
  if (positionKeysInOrder.length !== drawnCards.length) {
    throw new Error(
      `Spread "${spreadKey}" expects ${positionKeysInOrder.length} cards, but got ${drawnCards.length}.`
    );
  }

  const positionMeaningBlocks = positionKeysInOrder.map((positionKey, index) => {
    const positionPath = `knowledge/positions/${positionKey}.txt`;
    const positionText = readKnowledgeTextFile(positionPath);

    return [
      `--- POSITION ${index + 1}: ${positionKey} ---`,
      positionText,
    ].join("\n");
  });

  // 3) Card knowledge blocks (card + suit + pip when applicable)
  const cardKnowledgeBlocks = drawnCards.map((drawnCard, index) => {
    const cardIdString = String(drawnCard.cardId);
    const cardRecord = tarotManifest.cardsById?.[cardIdString];

    if (!cardRecord?.cardPath) {
      throw new Error(`Card id ${cardIdString} not found in tarotManifest.json`);
    }

    const cardText = readKnowledgeTextFile(cardRecord.cardPath);

    const suitText = cardRecord.suitPath ? readKnowledgeTextFile(cardRecord.suitPath) : "";
    const pipText = cardRecord.pipPath ? readKnowledgeTextFile(cardRecord.pipPath) : "";

    const reversalLine = drawnCard.isReversed ? "REVERSED: yes" : "REVERSED: no";

    return [
      `--- CARD ${index + 1}: id=${cardIdString} | ${reversalLine} ---`,
      cardText,
      suitText ? `\n--- SUIT ARCHETYPE ---\n${suitText}` : "",
      pipText ? `\n--- PIP ARCHETYPE ---\n${pipText}` : "",
    ].filter(Boolean).join("\n");
  });

  // 4) Assemble final context text
  const contextText = [
    `=== SPREAD ===`,
    `SPREAD KEY: ${spreadKey}`,
    spreadRulesText,
    `\n=== QUESTION ===`,
    questionText,
    `\n=== POSITIONS ===`,
    positionMeaningBlocks.join("\n\n"),
    `\n=== CARDS ===`,
    cardKnowledgeBlocks.join("\n\n"),
  ].join("\n");

  const systemText = buildSystemInstructionText();

  return { systemText, contextText };
}
