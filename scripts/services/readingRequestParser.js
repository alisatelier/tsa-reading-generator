// parses and normalizes request inputs

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function parseReadingRequestBody(requestBody) {
  const safeRequestBody = requestBody || {};

  const userQuestionText = normalizeText(safeRequestBody.question);
  const spreadNameText = normalizeText(safeRequestBody.spreadName);
  const cardLinesText = normalizeStringArray(safeRequestBody.cards);

  return {
    userQuestionText,
    spreadNameText,
    cardLinesText,
  };
}
