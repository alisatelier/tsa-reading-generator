import { loadTarotManifest, loadSpreadManifest } from "../knowledge/manifestStore.js";
import { readKnowledgeTextFile } from "../knowledge/fileStore.js";
import { buildSystemInstructionText } from "./systemInstruction/buildSystemInstructionText.js";

/**
 * Builds deterministic prompt inputs for the LLM:
 * - spread rules
 * - (optional) supporting references
 * - question text
 * - position meanings (fixed spreads) OR client-provided positionLabels (horoscope)
 * - card knowledge (card + suit + pip when applicable)
 */
export function buildReadingContextText({
  spreadKey,
  questionText,
  drawnCards,
  positionLabels = null, // horoscope only: ["Aquarius", "Pisces", ...]
}) {
  if (typeof spreadKey !== "string" || spreadKey.trim().length === 0) {
    throw new Error("spreadKey must be a non-empty string.");
  }

  if (typeof questionText !== "string" || questionText.trim().length === 0) {
    throw new Error("questionText must be a non-empty string.");
  }

  if (!Array.isArray(drawnCards) || drawnCards.length === 0) {
    throw new Error("drawnCards must be a non-empty array.");
  }

  const tarotManifest = loadTarotManifest();
  const spreadManifest = loadSpreadManifest();

  const spreadDefinition = spreadManifest[spreadKey];
  if (!spreadDefinition) {
    throw new Error(
      `Unknown spreadKey: "${spreadKey}". Add it to data/spreadManifest.json`
    );
  }

  const spreadType = String(spreadDefinition.type || "").toLowerCase();
  const isHoroscopeSpread = spreadKey === "horoscope" || spreadType === "horoscope";

  /**
   * 1) Spread rules text (optional)
   */
  const spreadRulesText = spreadDefinition.spreadPath
    ? readKnowledgeTextFile(spreadDefinition.spreadPath)
    : "";

  /**
   * 1b) Supporting reference files (optional)
   * Example: horoscope can include 2nd file that explains zodiac logic
   */
  const supportingPaths = Array.isArray(spreadDefinition.supportingPaths)
    ? spreadDefinition.supportingPaths
    : [];

  const supportingReferenceBlocks = supportingPaths.map((supportingPath) => {
    const supportingText = readKnowledgeTextFile(supportingPath);
    return [
      `--- SUPPORTING REFERENCE ---`,
      `PATH: ${supportingPath}`,
      supportingText,
    ].join("\n");
  });

  /**
   * 2) Position meanings
   * - For fixed spreads: use spreadDefinition.positions + knowledge/positions/*.txt
   * - For horoscope: tarot app provides positionLabels; we do not load positions files
   */
  let positionMeaningBlocks = [];
  let expectedCardCount = null;

  if (isHoroscopeSpread) {
    expectedCardCount = 12;

    if (drawnCards.length !== expectedCardCount) {
      throw new Error(`Horoscope expects 12 cards, but got ${drawnCards.length}.`);
    }

    if (!Array.isArray(positionLabels) || positionLabels.length !== expectedCardCount) {
      throw new Error(
        `Horoscope requires positionLabels (12 items) from the tarot app.\n` +
          `Received: ${
            Array.isArray(positionLabels) ? positionLabels.length : "null"
          }`
      );
    }

    positionMeaningBlocks = positionLabels.map((label, index) => {
      const cleanLabel = String(label || "").trim();
      if (!cleanLabel) {
        throw new Error(`Horoscope positionLabels[${index}] is empty.`);
      }

      return [
        `--- POSITION ${index + 1}: ${cleanLabel} ---`,
        `Interpret this card as guidance for ${cleanLabel} in the zodiac sequence provided by the tarot app.`,
      ].join("\n");
    });
  } else {
    const positionKeysInOrder = Array.isArray(spreadDefinition.positions)
      ? spreadDefinition.positions
      : [];

    expectedCardCount = positionKeysInOrder.length;

    if (expectedCardCount === 0) {
      throw new Error(
        `Spread "${spreadKey}" has no positions listed in data/spreadManifest.json.`
      );
    }

    if (drawnCards.length !== expectedCardCount) {
      throw new Error(
        `Spread "${spreadKey}" expects ${expectedCardCount} cards, but got ${drawnCards.length}.`
      );
    }

    positionMeaningBlocks = positionKeysInOrder.map((positionKey, index) => {
      const positionPath = `knowledge/positions/${positionKey}.txt`;
      const positionText = readKnowledgeTextFile(positionPath);

      return [
        `--- POSITION ${index + 1}: ${positionKey} ---`,
        positionText,
      ].join("\n");
    });
  }

  /**
   * 3) Card knowledge blocks
   * Always load exact card text.
   * If the card is a pip/minor, tarotManifest includes suitPath and pipPath.
   */
  const cardKnowledgeBlocks = drawnCards.map((drawnCard, index) => {
    const cardIdString = String(drawnCard?.cardId ?? "").trim();
    if (!cardIdString) {
      throw new Error(`drawnCards[${index}].cardId is missing.`);
    }

    const cardRecord = tarotManifest.cardsById?.[cardIdString];
    if (!cardRecord?.cardPath) {
      throw new Error(
        `Card id ${cardIdString} not found in tarotManifest.json (cardsById).\n` +
          `Did you rebuild manifests?`
      );
    }

    const cardText = readKnowledgeTextFile(cardRecord.cardPath);
    const suitText = cardRecord.suitPath ? readKnowledgeTextFile(cardRecord.suitPath) : "";
    const pipText = cardRecord.pipPath ? readKnowledgeTextFile(cardRecord.pipPath) : "";

    const isReversed = Boolean(drawnCard?.isReversed);
    const reversalLine = isReversed ? "REVERSED: yes" : "REVERSED: no";

    return [
      `--- CARD ${index + 1}: id=${cardIdString} | ${reversalLine} ---`,
      cardText,
      suitText ? `\n--- SUIT ARCHETYPE ---\n${suitText}` : "",
      pipText ? `\n--- PIP ARCHETYPE ---\n${pipText}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  /**
   * 4) Assemble final context text
   */
  const contextText = [
    `=== SPREAD ===`,
    `SPREAD KEY: ${spreadKey}`,
    spreadRulesText,

    supportingReferenceBlocks.length > 0 ? `\n=== SUPPORTING REFERENCES ===` : "",
    supportingReferenceBlocks.join("\n\n"),

    `\n=== QUESTION ===`,
    questionText.trim(),

    `\n=== POSITIONS ===`,
    positionMeaningBlocks.join("\n\n"),

    `\n=== CARDS ===`,
    cardKnowledgeBlocks.join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const systemText = buildSystemInstructionText();

  return { systemText, contextText };
}
