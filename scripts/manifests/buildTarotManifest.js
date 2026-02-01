import fs from "node:fs";
import path from "node:path";

/**
 * CONFIG
 * If your knowledge folder is in /src/knowledge, set KNOWLEDGE_ROOT_RELATIVE = "src/knowledge"
 * If it is in /knowledge (project root), keep it as "knowledge"
 */
const KNOWLEDGE_ROOT_RELATIVE = "knowledge";
const KNOWLEDGE_CARDS_RELATIVE = `${KNOWLEDGE_ROOT_RELATIVE}/cards`;
const DATA_OUTPUT_RELATIVE = "data/tarotManifest.json";

function normalizeKey(text) {
  return String(text || "").trim().toLowerCase();
}

function ensureDataFolderExists() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function listTextFilesInFolder(folderRelativePath) {
  const folderAbsolutePath = path.join(process.cwd(), folderRelativePath);

  if (!fs.existsSync(folderAbsolutePath)) {
    throw new Error(`Missing folder: ${folderRelativePath}`);
  }

  const names = fs.readdirSync(folderAbsolutePath);
  return names
    .filter((name) => name.toLowerCase().endsWith(".txt"))
    .map((name) => path.join(folderRelativePath, name).split(path.sep).join("/"));
}

function readTextFile(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

function extractFirstMatch(text, regex) {
  const match = String(text || "").match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Your card headers are often a single long line.
 * This regex captures the canonical name up to the next known field.
 */
function extractCanonicalTsaName(cardText) {
  return extractFirstMatch(
    cardText,
    /CANONICAL TSA NAME[^:]*:\s*(.+?)(?=\s+RWS\s+EQUIVALENT|\s+ELEMENT:|\s+SUIT:|\s+PIP:|\s+NAMING RULE:|\n|$)/i
  );
}

function extractCardId(cardText) {
  return extractFirstMatch(cardText, /CARD ID:\s*([0-9]+)/i);
}

function extractSuit(cardText) {
  return extractFirstMatch(cardText, /\bSUIT:\s*([A-Za-z]+)/i);
}

function extractPip(cardText) {
  return extractFirstMatch(cardText, /\bPIP:\s*([A-Za-z0-9]+)/i);
}

function pathExists(relativePath) {
  const abs = path.join(process.cwd(), relativePath);
  return fs.existsSync(abs);
}

function main() {
  ensureDataFolderExists();

  const cardFilePaths = listTextFilesInFolder(KNOWLEDGE_CARDS_RELATIVE);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    knowledgeRoot: KNOWLEDGE_ROOT_RELATIVE,
    cardsById: {},
    cardsByCanonicalName: {},
  };

  let majorCount = 0;
  let pipCount = 0;
  let skippedCount = 0;

  for (const cardPath of cardFilePaths) {
    const cardText = readTextFile(cardPath);

    const cardId = extractCardId(cardText);
    const canonicalName = extractCanonicalTsaName(cardText);
    const suit = extractSuit(cardText);
    const pip = extractPip(cardText);

    if (!cardId) {
      skippedCount += 1;
      continue;
    }

    const record = { cardPath };

    // If SUIT + PIP exist, treat as minor arcana pip and map to suit/pip archetypes.
    if (suit && pip) {
      const suitPath = `${KNOWLEDGE_ROOT_RELATIVE}/minorArcana/suits/${normalizeKey(suit)}.txt`;
      const pipPath = `${KNOWLEDGE_ROOT_RELATIVE}/minorArcana/pips/${normalizeKey(pip)}.txt`;

      // Only include if files exist (prevents broken manifest)
      if (!pathExists(suitPath)) {
        throw new Error(
          `Missing suit file for card ${cardId} (${canonicalName || "unknown"}): ${suitPath}`
        );
      }
      if (!pathExists(pipPath)) {
        throw new Error(
          `Missing pip file for card ${cardId} (${canonicalName || "unknown"}): ${pipPath}`
        );
      }

      record.suitPath = suitPath;
      record.pipPath = pipPath;
      pipCount += 1;
    } else {
      majorCount += 1;
    }

    manifest.cardsById[String(cardId)] = record;

    if (canonicalName) {
      manifest.cardsByCanonicalName[normalizeKey(canonicalName)] = String(cardId);
    }
  }

  const outputAbsolutePath = path.join(process.cwd(), DATA_OUTPUT_RELATIVE);
  fs.writeFileSync(outputAbsolutePath, JSON.stringify(manifest, null, 2), "utf8");

  console.log("✅ tarotManifest written:", DATA_OUTPUT_RELATIVE);
  console.log("✅ Cards mapped:", Object.keys(manifest.cardsById).length);
  console.log("   - Majors mapped:", majorCount);
  console.log("   - Pips mapped:", pipCount);
  console.log("   - Skipped (missing CARD ID):", skippedCount);
}

main();
